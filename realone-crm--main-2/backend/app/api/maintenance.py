from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import require_admin
from app.db.database import get_db
from app.models.activity import LeadActivity
from app.models.assignment_state import RoundRobinState
from app.models.lead import Lead
from app.models.meta_sync_log import MetaSyncLog
from app.models.user import User, UserRole

router = APIRouter(prefix="/maintenance", tags=["Temporary Initial Maintenance"])
META_IMPORT_LOCK_KEY = 741902632


@router.post("/initial-cleanup")
def initial_cleanup(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """One-time destructive cleanup of initial dummy leads and agent accounts."""
    if not settings.INITIAL_CLEANUP_ENABLED:
        raise HTTPException(status_code=404, detail="Initial cleanup is disabled")

    try:
        if db.bind.dialect.name == "postgresql":
            # Uses the same transaction-scoped lock as Meta lead ingestion so an
            # in-flight import cannot recreate an old lead after cleanup.
            db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": META_IMPORT_LOCK_KEY})

        completed = db.query(MetaSyncLog).filter(
            MetaSyncLog.event_type == "initial_cleanup", MetaSyncLog.status == "success"
        ).first()
        if completed:
            raise HTTPException(status_code=409, detail="Initial cleanup has already been completed")

        # Mark existing Meta IDs as already processed before deleting the leads.
        # This prevents the periodic historical sync from importing old dummy
        # Meta leads again while retaining the existing Meta integration/logs.
        meta_ids = [row[0] for row in db.query(Lead.meta_lead_id).filter(Lead.meta_lead_id.isnot(None)).all()]
        existing_success_ids = {row[0] for row in db.query(MetaSyncLog.external_lead_id).filter(
            MetaSyncLog.status == "success", MetaSyncLog.external_lead_id.isnot(None)
        ).all()}
        for meta_id in set(meta_ids) - existing_success_ids:
            db.add(MetaSyncLog(
                integration_id=None, external_lead_id=meta_id,
                event_type="initial_cleanup_preserve", status="success", attempt_count=1,
                error_message=None, payload=None
            ))

        lead_count = db.query(Lead).count()
        activity_count = db.query(LeadActivity).count()
        agent_ids = [row[0] for row in db.query(User.id).filter(User.role == UserRole.AGENT.value).all()]

        # Remove references to agent accounts before deletion. Leads are all
        # removed, while approval and round-robin references are safely nulled.
        if agent_ids:
            db.query(User).filter(User.approved_by.in_(agent_ids)).update(
                {User.approved_by: None}, synchronize_session=False
            )
        rr_state = db.query(RoundRobinState).filter(RoundRobinState.id == 1).first()
        if rr_state and rr_state.last_assigned_agent_id in agent_ids:
            rr_state.last_assigned_agent_id = None

        # Explicitly remove activity rows first; the database also has an ON DELETE
        # CASCADE, but this keeps cleanup deterministic across supported test DBs.
        db.query(LeadActivity).delete(synchronize_session=False)
        db.query(Lead).delete(synchronize_session=False)
        deleted_agents = db.query(User).filter(User.role == UserRole.AGENT.value).delete(synchronize_session=False)

        db.add(MetaSyncLog(
            integration_id=None, external_lead_id=None, event_type="initial_cleanup",
            status="success", attempt_count=1,
            error_message=None, payload={"leads_deleted": lead_count, "activities_deleted": activity_count, "agents_deleted": deleted_agents}
        ))
        db.commit()
        return {
            "message": "Initial dummy data cleanup completed",
            "leads_deleted": lead_count,
            "lead_activities_deleted": activity_count,
            "agents_deleted": deleted_agents,
            "admin_preserved": current_user.id,
            "meta_integration_preserved": True,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
