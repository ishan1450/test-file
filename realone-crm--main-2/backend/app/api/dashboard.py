from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.models.user import User, UserRole, ApprovalStatus
from app.models.lead import Lead
from app.models.activity import LeadActivity
from app.models.meta_sync_log import MetaSyncLog
from app.core.permissions import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Reports"])


@router.get("/stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns role-aware dashboard statistics.
    Admin sees company-wide metrics and agent breakdowns.
    Agent sees strictly their own assigned leads metrics.
    """
    if current_user.role == UserRole.ADMIN.value:
        # 1. Total and status metrics across company
        total_leads = db.query(Lead).filter(Lead.archived_at.is_(None)).count()
        new_leads = db.query(Lead).filter(Lead.archived_at.is_(None), Lead.status == "New").count()
        qualified_leads = db.query(Lead).filter(Lead.archived_at.is_(None), Lead.status == "Qualified").count()
        negotiation_leads = db.query(Lead).filter(Lead.archived_at.is_(None), Lead.status == "Negotiation").count()
        won_leads = db.query(Lead).filter(Lead.archived_at.is_(None), Lead.status == "Won").count()
        lost_leads = db.query(Lead).filter(Lead.archived_at.is_(None), Lead.status == "Lost").count()
        unassigned_leads = db.query(Lead).filter(Lead.archived_at.is_(None), Lead.assigned_agent_id.is_(None)).count()

        # 2. User metrics
        active_agents = db.query(User).filter(
            User.role == UserRole.AGENT.value,
            User.approval_status == ApprovalStatus.APPROVED.value,
            User.is_active == True,
        ).count()
        pending_registrations = db.query(User).filter(
            User.approval_status == ApprovalStatus.PENDING.value
        ).count()

        # 3. Leads by Source
        source_counts = (
            db.query(Lead.source, func.count(Lead.id))
            .filter(Lead.archived_at.is_(None))
            .group_by(Lead.source)
            .all()
        )
        leads_by_source = [{"source": s, "count": c} for s, c in source_counts]

        # 4. Leads by Status
        status_counts = (
            db.query(Lead.status, func.count(Lead.id))
            .filter(Lead.archived_at.is_(None))
            .group_by(Lead.status)
            .all()
        )
        leads_by_status = [{"status": s, "count": c} for s, c in status_counts]

        # 5. Leads Assigned to each Agent
        agents = db.query(User).filter(User.role == UserRole.AGENT.value).all()
        agent_lead_counts = (
            db.query(Lead.assigned_agent_id, func.count(Lead.id))
            .filter(Lead.archived_at.is_(None), Lead.assigned_agent_id.isnot(None))
            .group_by(Lead.assigned_agent_id)
            .all()
        )
        agent_counts_map = {aid: cnt for aid, cnt in agent_lead_counts}
        leads_per_agent = [
            {
                "agent_id": a.id,
                "agent_name": a.full_name,
                "email": a.email,
                "is_active": a.is_active,
                "lead_count": agent_counts_map.get(a.id, 0),
            }
            for a in agents
        ]

        # 6. Recent Meta sync events
        recent_sync_logs = (
            db.query(MetaSyncLog)
            .order_by(MetaSyncLog.created_at.desc())
            .limit(5)
            .all()
        )
        recent_syncs = [
            {
                "id": log.id,
                "external_lead_id": log.external_lead_id,
                "event_type": log.event_type,
                "status": log.status,
                "created_at": log.created_at.isoformat(),
                "error_message": log.error_message,
            }
            for log in recent_sync_logs
        ]

        # 7. Recent activities
        recent_activities = (
            db.query(LeadActivity)
            .order_by(LeadActivity.created_at.desc())
            .limit(10)
            .all()
        )
        activities_list = [
            {
                "id": act.id,
                "lead_id": act.lead_id,
                "type": act.activity_type,
                "description": act.description,
                "created_at": act.created_at.isoformat(),
            }
            for act in recent_activities
        ]

        return {
            "role": "admin",
            "total_leads": total_leads,
            "new_leads": new_leads,
            "qualified_leads": qualified_leads,
            "negotiation_leads": negotiation_leads,
            "won_leads": won_leads,
            "lost_leads": lost_leads,
            "unassigned_leads": unassigned_leads,
            "active_agent_count": active_agents,
            "pending_registrations": pending_registrations,
            "leads_by_source": leads_by_source,
            "leads_by_status": leads_by_status,
            "leads_per_agent": leads_per_agent,
            "recent_syncs": recent_syncs,
            "recent_activities": activities_list,
        }

    else:
        # Agent role: STRICTLY scoped to current_user.id
        agent_id = current_user.id
        base_query = db.query(Lead).filter(
            Lead.assigned_agent_id == agent_id,
            Lead.archived_at.is_(None),
        )

        total_leads = base_query.count()
        new_leads = base_query.filter(Lead.status == "New").count()
        qualified_leads = base_query.filter(Lead.status == "Qualified").count()
        negotiation_leads = base_query.filter(Lead.status == "Negotiation").count()
        won_leads = base_query.filter(Lead.status == "Won").count()
        lost_leads = base_query.filter(Lead.status == "Lost").count()

        # Status distribution for this agent
        status_counts = (
            db.query(Lead.status, func.count(Lead.id))
            .filter(Lead.assigned_agent_id == agent_id, Lead.archived_at.is_(None))
            .group_by(Lead.status)
            .all()
        )
        leads_by_status = [{"status": s, "count": c} for s, c in status_counts]

        # Source distribution for this agent
        source_counts = (
            db.query(Lead.source, func.count(Lead.id))
            .filter(Lead.assigned_agent_id == agent_id, Lead.archived_at.is_(None))
            .group_by(Lead.source)
            .all()
        )
        leads_by_source = [{"source": s, "count": c} for s, c in source_counts]

        # Recently updated assigned leads
        recent_leads = (
            base_query.order_by(Lead.updated_at.desc())
            .limit(5)
            .all()
        )
        recent_leads_list = [
            {
                "id": l.id,
                "full_name": l.full_name,
                "phone": l.phone,
                "status": l.status,
                "source": l.source,
                "property_type": l.property_type,
                "updated_at": l.updated_at.isoformat(),
            }
            for l in recent_leads
        ]

        # Recent activities on assigned leads
        assigned_lead_ids = [l.id for l in db.query(Lead.id).filter(Lead.assigned_agent_id == agent_id).all()]
        activities_list = []
        if assigned_lead_ids:
            activities = (
                db.query(LeadActivity)
                .filter(LeadActivity.lead_id.in_(assigned_lead_ids))
                .order_by(LeadActivity.created_at.desc())
                .limit(10)
                .all()
            )
            activities_list = [
                {
                    "id": act.id,
                    "lead_id": act.lead_id,
                    "type": act.activity_type,
                    "description": act.description,
                    "created_at": act.created_at.isoformat(),
                }
                for act in activities
            ]

        return {
            "role": "agent",
            "total_leads": total_leads,
            "new_leads": new_leads,
            "qualified_leads": qualified_leads,
            "negotiation_leads": negotiation_leads,
            "won_leads": won_leads,
            "lost_leads": lost_leads,
            "leads_by_status": leads_by_status,
            "leads_by_source": leads_by_source,
            "recent_leads": recent_leads_list,
            "recent_activities": activities_list,
        }
