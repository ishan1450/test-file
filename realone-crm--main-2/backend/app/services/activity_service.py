from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.activity import LeadActivity


class ActivityType:
    LEAD_CREATED = "lead_created"
    LEAD_EDITED = "lead_edited"
    STATUS_CHANGED = "status_changed"
    LEAD_ASSIGNED = "lead_assigned"
    LEAD_REASSIGNED = "lead_reassigned"
    META_LEAD_IMPORTED = "meta_lead_imported"
    DUPLICATE_META_EVENT_SKIPPED = "duplicate_meta_event_skipped"
    LEAD_ARCHIVED = "lead_archived"
    LEAD_RESTORED = "lead_restored"


def log_lead_activity(
    db: Session,
    lead_id: int,
    activity_type: str,
    description: str,
    actor_id: Optional[int] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
) -> LeadActivity:
    activity = LeadActivity(
        lead_id=lead_id,
        actor_id=actor_id,
        activity_type=activity_type,
        description=description,
        old_values=old_values,
        new_values=new_values,
    )
    db.add(activity)
    # We do not commit immediately to allow enclosing transactions to commit atomically
    return activity
