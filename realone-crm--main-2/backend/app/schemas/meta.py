from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class MetaConnectionSetup(BaseModel):
    page_id: str
    page_name: Optional[str] = None
    access_token: str
    instagram_account_id: Optional[str] = None
    instagram_username: Optional[str] = None


class MetaIntegrationResponse(BaseModel):
    id: int
    page_id: Optional[str] = None
    page_name: Optional[str] = None
    instagram_account_id: Optional[str] = None
    instagram_username: Optional[str] = None
    is_connected: bool
    selected_forms: List[Dict[str, Any]] = []
    field_mappings: Dict[str, str] = {}
    webhook_verified: bool
    webhook_subscribed_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    imported_count: int = 0
    failed_count: int = 0
    webhook_url: str
    verify_token: str

    class Config:
        from_attributes = True


class MetaFormSelection(BaseModel):
    forms: List[Dict[str, Any]]


class MetaFieldMappingUpdate(BaseModel):
    mappings: Dict[str, str] = Field(
        ...,
        description="Dictionary mapping Meta form field names to CRM lead fields (e.g. {'full_name': 'full_name', 'phone_number': 'phone', 'email': 'email', 'budget': 'max_budget'})"
    )


class MetaHistoricalImportRequest(BaseModel):
    form_ids: Optional[List[str]] = None
    since_date: Optional[str] = None  # YYYY-MM-DD
    until_date: Optional[str] = None  # YYYY-MM-DD


class MetaSimulateLeadRequest(BaseModel):
    full_name: Optional[str] = "Sophia Martinez"
    phone: Optional[str] = "+1 (555) 234-5678"
    email: Optional[str] = "sophia.martinez@example.com"
    property_type: Optional[str] = "Luxury Villa"
    preferred_location: Optional[str] = "Beverly Hills / Westside"
    max_budget: Optional[float] = 1250000.0
    platform: Optional[str] = "Instagram"
    campaign_name: Optional[str] = "Summer 2026 Luxury Villas Campaign"
    ad_name: Optional[str] = "Virtual Tour - 4BHK Penthouse"


class MetaImportResult(BaseModel):
    total_discovered: int
    successfully_imported: int
    duplicates_skipped: int
    failed: int
    completion_time_seconds: float
    errors: List[str] = []


class MetaSyncLogResponse(BaseModel):
    id: int
    external_lead_id: Optional[str] = None
    event_type: str
    status: str
    attempt_count: int
    error_message: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
