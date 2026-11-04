from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User, UserRole, ApprovalStatus
from app.models.lead import Lead
from app.models.assignment_state import RoundRobinState
from app.services.activity_service import log_lead_activity, ActivityType
from app.schemas.user import UserResponse, UserApprovalUpdate, UserStatusUpdate, UserRoleUpdate
from app.core.permissions import require_admin, get_current_user

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=List[UserResponse])
def get_all_users(
    role: Optional[str] = None,
    approval_status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin only: List all users in the system with optional role and status filters.
    """
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if approval_status:
        query = query.filter(User.approval_status == approval_status)
    return query.order_by(User.created_at.desc()).all()


@router.get("/agents", response_model=List[UserResponse])
def get_active_agents(
    include_admins: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns active, approved team members. By default includes both Agents and Admins for complete lead management.
    """
    query = db.query(User).filter(
        User.approval_status == ApprovalStatus.APPROVED.value,
        User.is_active == True,
    )
    if not include_admins:
        query = query.filter(User.role == UserRole.AGENT.value)

    return query.order_by(User.role.asc(), User.full_name.asc()).all()


@router.get("/pending", response_model=List[UserResponse])
def get_pending_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin only: List all users pending approval.
    """
    return (
        db.query(User)
        .filter(User.approval_status == ApprovalStatus.PENDING.value)
        .order_by(User.created_at.desc())
        .all()
    )


@router.put("/{user_id}/approval", response_model=UserResponse)
def update_approval_status(
    user_id: int,
    approval_data: UserApprovalUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin only: Approve or reject an account registration.
    On approval, assigns the Agent role by default.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if approval_data.action == "approve":
        user.approval_status = ApprovalStatus.APPROVED.value
        user.role = UserRole.AGENT.value  # By default assign Agent role on approval
        user.approved_at = datetime.utcnow()
        user.approved_by = current_user.id
        user.is_active = True
    elif approval_data.action == "reject":
        user.approval_status = ApprovalStatus.REJECTED.value
        user.approved_at = datetime.utcnow()
        user.approved_by = current_user.id
        user.is_active = False

        # Ensure rejected agent is stripped from any assigned leads
        leads = db.query(Lead).filter(Lead.assigned_agent_id == user.id).all()
        for lead in leads:
            lead.assigned_agent_id = None
            log_lead_activity(
                db=db,
                lead_id=lead.id,
                activity_type=ActivityType.LEAD_REASSIGNED,
                description=f"Lead unassigned because agent {user.full_name} was rejected",
                actor_id=current_user.id,
                old_values={"assigned_agent_id": user.id},
                new_values={"assigned_agent_id": None},
            )

        # If singleton round-robin state pointed to this user, clear it
        rr_state = db.query(RoundRobinState).filter(RoundRobinState.id == 1).first()
        if rr_state and rr_state.last_assigned_agent_id == user.id:
            rr_state.last_assigned_agent_id = None
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be 'approve' or 'reject'",
        )

    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    status_data: UserStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin only: Activate or deactivate a user account.
    Only approved accounts can be activated.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id and not status_data.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account.",
        )

    if status_data.is_active and user.approval_status != ApprovalStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot activate an unapproved or rejected account. The account must be approved first.",
        )

    user.is_active = status_data.is_active
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role_data: UserRoleUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin only: Change a user's role between admin and agent.
    """
    if role_data.role not in [UserRole.ADMIN.value, UserRole.AGENT.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'admin' or 'agent'",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.role = role_data.role
    db.commit()
    db.refresh(user)
    return user
