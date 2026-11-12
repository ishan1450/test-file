from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, desc, asc

from app.db.database import get_db
from app.models.user import User, UserRole, ApprovalStatus
from app.models.lead import Lead
from app.models.activity import LeadActivity
from app.schemas.lead import (
    LeadCreate,
    LeadUpdate,
    LeadResponse,
    LeadDetailResponse,
    LeadListResponse,
    LeadActivityResponse,
)
from app.core.permissions import get_current_user
from app.services.activity_service import log_lead_activity, ActivityType
from app.services.assignment_service import reassign_lead_manually, assign_lead_round_robin

router = APIRouter(prefix="/leads", tags=["Leads Management"])


@router.get("", response_model=LeadListResponse)
def get_leads(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    source_filter: Optional[str] = Query(None, alias="source"),
    property_type: Optional[str] = None,
    preferred_location: Optional[str] = None,
    agent_id: Optional[int] = None,
    archived_only: bool = False,
    include_archived: bool = False,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List leads with strict role-based authorization.
    Admin: Sees all leads, can filter by assigned agent.
    Agent: Sees ONLY leads assigned to their account.
    """
    query = db.query(Lead).options(joinedload(Lead.assigned_agent))

    # Strict role-based scoping
    if current_user.role == UserRole.AGENT.value:
        query = query.filter(Lead.assigned_agent_id == current_user.id)
    elif agent_id is not None:
        if agent_id == -1:
            query = query.filter(Lead.assigned_agent_id.is_(None))
        else:
            query = query.filter(Lead.assigned_agent_id == agent_id)

    # Archival scoping
    if archived_only:
        query = query.filter(Lead.archived_at.isnot(None))
    elif not include_archived:
        query = query.filter(Lead.archived_at.is_(None))

    # Filters
    if status_filter:
        query = query.filter(Lead.status == status_filter)
    if source_filter:
        query = query.filter(Lead.source == source_filter)
    if property_type:
        query = query.filter(Lead.property_type.ilike(f"%{property_type}%"))
    if preferred_location:
        query = query.filter(Lead.preferred_location.ilike(f"%{preferred_location}%"))

    # Search (name, phone, email)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Lead.full_name.ilike(search_pattern),
                Lead.phone.ilike(search_pattern),
                Lead.email.ilike(search_pattern),
            )
        )

    # Total count
    total = query.count()

    # Sorting
    sort_col = getattr(Lead, sort_by, Lead.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    # Pagination
    items = query.offset((page - 1) * size).limit(size).all()
    pages = (total + size - 1) // size if total > 0 else 1

    return LeadListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(
    lead_in: LeadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new CRM lead.
    Agents can create leads, which are automatically assigned to themselves.
    Admins can manually assign an agent or assign via round-robin.
    """
    lead = Lead(
        full_name=lead_in.full_name,
        phone=lead_in.phone,
        email=lead_in.email,
        source=lead_in.source,
        property_type=lead_in.property_type,
        preferred_location=lead_in.preferred_location,
        min_budget=lead_in.min_budget,
        max_budget=lead_in.max_budget,
        status=lead_in.status,
        notes=lead_in.notes,
        custom_fields=lead_in.custom_fields or {},
        created_by=current_user.id,
    )

    if current_user.role == UserRole.AGENT.value:
        # Agent strictly self-assigns created lead
        lead.assigned_agent_id = current_user.id
    elif lead_in.assigned_agent_id is not None:
        # Admin assigned specific team member (Agent or Admin)
        target_agent = db.query(User).filter(
            User.id == lead_in.assigned_agent_id,
            User.approval_status == ApprovalStatus.APPROVED.value,
            User.is_active == True,
        ).first()
        if not target_agent:
            raise HTTPException(status_code=400, detail="Invalid target user ID or inactive account")
        lead.assigned_agent_id = target_agent.id

    db.add(lead)
    db.flush()

    # Log creation activity
    log_lead_activity(
        db=db,
        lead_id=lead.id,
        activity_type=ActivityType.LEAD_CREATED,
        description=f"Lead created by {current_user.full_name}",
        actor_id=current_user.id,
        new_values={
            "full_name": lead.full_name,
            "phone": lead.phone,
            "status": lead.status,
            "source": lead.source,
            "assigned_agent_id": lead.assigned_agent_id,
        },
    )

    db.commit()
    db.refresh(lead)
    return lead


@router.get("/export/csv")
def export_leads_csv(
    agent_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    source_filter: Optional[str] = Query(None, alias="source"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Exports leads as a downloadable CSV file.
    Admin can export all leads from all agents & admins, or filter by specific assignee.
    """
    import csv
    import io
    from fastapi.responses import Response

    query = db.query(Lead).options(joinedload(Lead.assigned_agent))

    if current_user.role == UserRole.AGENT.value:
        query = query.filter(Lead.assigned_agent_id == current_user.id)
    elif agent_id is not None:
        if agent_id == -1:
            query = query.filter(Lead.assigned_agent_id.is_(None))
        else:
            query = query.filter(Lead.assigned_agent_id == agent_id)

    if status_filter:
        query = query.filter(Lead.status == status_filter)
    if source_filter:
        query = query.filter(Lead.source == source_filter)

    leads = query.order_by(desc(Lead.created_at)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID",
        "Full Name",
        "Phone",
        "Email",
        "Status",
        "Source",
        "Property Type",
        "Preferred Location",
        "Min Budget",
        "Max Budget",
        "Assigned Team Member",
        "Role",
        "Created At",
    ])

    for l in leads:
        assigned_name = l.assigned_agent.full_name if l.assigned_agent else "Unassigned"
        assigned_role = l.assigned_agent.role.capitalize() if l.assigned_agent else "None"
        writer.writerow([
            l.id,
            l.full_name,
            l.phone,
            l.email or "",
            l.status,
            l.source,
            l.property_type or "",
            l.preferred_location or "",
            l.min_budget or "",
            l.max_budget or "",
            assigned_name,
            assigned_role,
            l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else "",
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_all_agents_and_admins.csv"},
    )


@router.get("/{lead_id}", response_model=LeadDetailResponse)
def get_lead_details(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get detailed information and audit history for a single lead.
    Strict role check: Agent cannot view a lead assigned to someone else.
    """
    lead = (
        db.query(Lead)
        .options(joinedload(Lead.assigned_agent))
        .filter(Lead.id == lead_id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    # Strict role-based check
    if current_user.role == UserRole.AGENT.value and lead.assigned_agent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You are not authorized to view this lead",
        )

    # Fetch activities with actor info
    activities = (
        db.query(LeadActivity)
        .options(joinedload(LeadActivity.actor))
        .filter(LeadActivity.lead_id == lead.id)
        .order_by(LeadActivity.created_at.desc())
        .all()
    )

    activity_responses = [
        LeadActivityResponse(
            id=act.id,
            activity_type=act.activity_type,
            description=act.description,
            actor_id=act.actor_id,
            actor_name=act.actor.full_name if act.actor else "System",
            old_values=act.old_values,
            new_values=act.new_values,
            created_at=act.created_at,
        )
        for act in activities
    ]

    response = LeadDetailResponse.model_validate(lead)
    response.activities = activity_responses
    return response


@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: int,
    lead_in: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update lead details. Prefills, validates, and logs activity history.
    Agents can only update their assigned leads and CANNOT reassign agents.
    """
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    # Strict access check
    if current_user.role == UserRole.AGENT.value and lead.assigned_agent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot modify leads that are not assigned to you",
        )

    # Prevent agents from attempting reassignment via payload
    if current_user.role == UserRole.AGENT.value and lead_in.assigned_agent_id is not None:
        if lead_in.assigned_agent_id != lead.assigned_agent_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Agents are not permitted to reassign leads",
            )

    old_values = {}
    new_values = {}

    update_fields = [
        "full_name",
        "phone",
        "email",
        "source",
        "property_type",
        "preferred_location",
        "min_budget",
        "max_budget",
        "notes",
    ]

    for field in update_fields:
        val = getattr(lead_in, field)
        if val is not None:
            curr_val = getattr(lead, field)
            if curr_val != val:
                old_values[field] = curr_val
                new_values[field] = val
                setattr(lead, field, val)

    # Custom fields merge
    if lead_in.custom_fields is not None:
        merged = dict(lead.custom_fields or {})
        merged.update(lead_in.custom_fields)
        lead.custom_fields = merged

    # Status change
    if lead_in.status is not None and lead_in.status != lead.status:
        old_status = lead.status
        lead.status = lead_in.status
        log_lead_activity(
            db=db,
            lead_id=lead.id,
            activity_type=ActivityType.STATUS_CHANGED,
            description=f"Status changed from {old_status} to {lead.status} by {current_user.full_name}",
            actor_id=current_user.id,
            old_values={"status": old_status},
            new_values={"status": lead.status},
        )

    # Reassignment (Admin only)
    if current_user.role == UserRole.ADMIN.value and lead_in.assigned_agent_id is not None:
        if lead_in.assigned_agent_id != lead.assigned_agent_id:
            reassign_lead_manually(db, lead, lead_in.assigned_agent_id, current_user)

    # General edit activity log
    if old_values:
        log_lead_activity(
            db=db,
            lead_id=lead.id,
            activity_type=ActivityType.LEAD_EDITED,
            description=f"Lead details updated by {current_user.full_name}",
            actor_id=current_user.id,
            old_values=old_values,
            new_values=new_values,
        )

    lead.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/archive", response_model=LeadResponse)
def archive_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Archive lead (Admin only).
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can archive leads",
        )

    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    lead.archived_at = datetime.utcnow()
    log_lead_activity(
        db=db,
        lead_id=lead.id,
        activity_type=ActivityType.LEAD_ARCHIVED,
        description=f"Lead archived by {current_user.full_name}",
        actor_id=current_user.id,
    )
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/restore", response_model=LeadResponse)
def restore_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Restore an archived lead (Admin only).
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can restore archived leads",
        )

    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    lead.archived_at = None
    log_lead_activity(
        db=db,
        lead_id=lead.id,
        activity_type=ActivityType.LEAD_RESTORED,
        description=f"Lead restored by {current_user.full_name}",
        actor_id=current_user.id,
    )
    db.commit()
    db.refresh(lead)
    return lead
