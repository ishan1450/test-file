from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.user import User, UserRole, ApprovalStatus
from app.models.lead import Lead
from app.models.assignment_state import RoundRobinState
from app.services.activity_service import log_lead_activity, ActivityType


def get_eligible_agents(db: Session) -> List[User]:
    """
    Returns active, approved agents ordered deterministically by ID.
    Admin users are strictly excluded.
    """
    return (
        db.query(User)
        .filter(
            User.role == UserRole.AGENT.value,
            User.approval_status == ApprovalStatus.APPROVED.value,
            User.is_active == True,
        )
        .order_by(User.id.asc())
        .all()
    )


def assign_lead_round_robin(
    db: Session,
    lead: Lead,
    actor_id: Optional[int] = None,
) -> Optional[User]:
    """
    Assigns a lead to the next eligible agent using persistent round-robin rotation.
    Guarantees concurrency safety using PostgreSQL row locking (`SELECT ... FOR UPDATE`).
    """
    eligible_agents = get_eligible_agents(db)
    if not eligible_agents:
        log_lead_activity(
            db=db,
            lead_id=lead.id,
            activity_type=ActivityType.LEAD_ASSIGNED,
            description="Lead unassigned: No active approved agents available in rotation",
            actor_id=actor_id,
            new_values={"assigned_agent_id": None},
        )
        return None

    # Acquire lock on the singleton round-robin state row
    state = (
        db.query(RoundRobinState)
        .filter(RoundRobinState.id == 1)
        .with_for_update()
        .first()
    )

    if not state:
        # Initialize singleton state row if not already created
        state = RoundRobinState(id=1, total_assigned_count=0)
        db.add(state)
        db.flush()

    agent_ids = [agent.id for agent in eligible_agents]

    # Deterministic next agent selection
    if state.last_assigned_agent_id is None:
        next_agent_id = agent_ids[0]
    elif state.last_assigned_agent_id in agent_ids:
        current_idx = agent_ids.index(state.last_assigned_agent_id)
        next_agent_id = agent_ids[(current_idx + 1) % len(agent_ids)]
    else:
        # The previously assigned agent was deactivated, removed, or changed role
        # Pick the next agent strictly greater than the last assigned ID to preserve sequence
        subsequent = [aid for aid in agent_ids if aid > state.last_assigned_agent_id]
        if subsequent:
            next_agent_id = subsequent[0]
        else:
            next_agent_id = agent_ids[0]

    chosen_agent = next(a for a in eligible_agents if a.id == next_agent_id)

    # Assign lead
    old_agent_id = lead.assigned_agent_id
    lead.assigned_agent_id = chosen_agent.id

    # Advance rotation state
    state.last_assigned_agent_id = chosen_agent.id
    state.last_assignment_at = datetime.utcnow()
    state.total_assigned_count += 1

    # Record assignment in audit trail
    log_lead_activity(
        db=db,
        lead_id=lead.id,
        activity_type=ActivityType.LEAD_ASSIGNED,
        description=f"Lead assigned to {chosen_agent.full_name} via Round-Robin rotation",
        actor_id=actor_id,
        old_values={"assigned_agent_id": old_agent_id},
        new_values={"assigned_agent_id": chosen_agent.id, "agent_name": chosen_agent.full_name},
    )

    return chosen_agent


def reassign_lead_manually(
    db: Session,
    lead: Lead,
    new_agent_id: Optional[int],
    actor: User,
) -> Optional[User]:
    """
    Allows Admin to manually reassign a lead without modifying or advancing the automatic rotation.
    """
    old_agent_id = lead.assigned_agent_id
    new_agent = None

    if new_agent_id is not None:
        new_agent = (
            db.query(User)
            .filter(
                User.id == new_agent_id,
                User.approval_status == ApprovalStatus.APPROVED.value,
                User.is_active == True,
            )
            .first()
        )
        if not new_agent:
            raise ValueError("Target user does not exist or is not an active approved team member")
        lead.assigned_agent_id = new_agent.id
        description = f"Lead manually reassigned to {new_agent.full_name} ({new_agent.role.capitalize()}) by {actor.full_name}"
    else:
        lead.assigned_agent_id = None
        description = f"Lead unassigned by {actor.full_name}"

    log_lead_activity(
        db=db,
        lead_id=lead.id,
        activity_type=ActivityType.LEAD_REASSIGNED,
        description=description,
        actor_id=actor.id,
        old_values={"assigned_agent_id": old_agent_id},
        new_values={"assigned_agent_id": lead.assigned_agent_id},
    )

    return new_agent
