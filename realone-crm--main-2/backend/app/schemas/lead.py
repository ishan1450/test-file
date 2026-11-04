from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class LeadBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    phone: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = None
    source: str = Field(default="Other")
    property_type: Optional[str] = None
    preferred_location: Optional[str] = None
    min_budget: Optional[float] = None
    max_budget: Optional[float] = None
    status: str = Field(default="New")
    notes: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None


class LeadCreate(LeadBase):
    assigned_agent_id: Optional[int] = None


class LeadUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    property_type: Optional[str] = None
    preferred_location: Optional[str] = None
    min_budget: Optional[float] = None
    max_budget: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    # Reassignment can only be set if user is Admin (checked in endpoint)
    assigned_agent_id: Optional[int] = None


class LeadAgentSummary(BaseModel):
    id: int
    full_name: str
    email: str

    class Config:
        from_attributes = True


class LeadActivityResponse(BaseModel):
    id: int
    activity_type: str
    description: str
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LeadResponse(LeadBase):
    id: int
    meta_lead_id: Optional[str] = None
    meta_page_id: Optional[str] = None
    meta_form_id: Optional[str] = None
    meta_campaign_id: Optional[str] = None
    meta_campaign_name: Optional[str] = None
    meta_ad_id: Optional[str] = None
    meta_ad_name: Optional[str] = None
    assigned_agent_id: Optional[int] = None
    assigned_agent: Optional[LeadAgentSummary] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeadDetailResponse(LeadResponse):
    activities: List[LeadActivityResponse] = []


class LeadListResponse(BaseModel):
    items: List[LeadResponse]
    total: int
    page: int
    size: int
    pages: int
