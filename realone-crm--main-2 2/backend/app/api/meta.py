from datetime import datetime
import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.meta_integration import MetaIntegration
from app.models.meta_sync_log import MetaSyncLog
from app.schemas.meta import (
    MetaConnectionSetup,
    MetaIntegrationResponse,
    MetaFormSelection,
    MetaFieldMappingUpdate,
    MetaHistoricalImportRequest,
    MetaSimulateLeadRequest,
    MetaImportResult,
    MetaSyncLogResponse,
)
from app.core.permissions import require_admin
from app.core.config import settings
from app.services.meta_service import MetaGraphService
from app.services.import_service import import_historical_meta_leads, process_single_meta_lead

router = APIRouter(prefix="/meta", tags=["Meta Integration"])


def _get_or_create_integration(db: Session) -> MetaIntegration:
    integration = db.query(MetaIntegration).first()
    if not integration:
        integration = MetaIntegration(
            is_connected=False,
            selected_forms=[],
            field_mappings={
                "full_name": "full_name",
                "phone_number": "phone",
                "email": "email",
                "property_type": "property_type",
                "preferred_location": "preferred_location",
                "budget": "max_budget",
            },
        )
        db.add(integration)
        db.commit()
        db.refresh(integration)
    return integration


@router.get("/status", response_model=MetaIntegrationResponse)
def get_meta_status(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Returns Meta Integration status, configuration, counts, and webhook details.
    """
    integration = _get_or_create_integration(db)

    imported_count = (
        db.query(MetaSyncLog)
        .filter(MetaSyncLog.status == "success")
        .count()
    )
    failed_count = (
        db.query(MetaSyncLog)
        .filter(MetaSyncLog.status == "failed")
        .count()
    )

    webhook_url = f"{settings.BACKEND_URL}/api/v1/webhooks/meta"

    return MetaIntegrationResponse(
        id=integration.id,
        page_id=integration.page_id,
        page_name=integration.page_name,
        instagram_account_id=integration.instagram_account_id,
        instagram_username=integration.instagram_username,
        is_connected=integration.is_connected,
        selected_forms=integration.selected_forms or [],
        field_mappings=integration.field_mappings or {},
        webhook_verified=integration.webhook_verified,
        webhook_subscribed_at=integration.webhook_subscribed_at,
        last_sync_at=integration.last_sync_at,
        imported_count=imported_count,
        failed_count=failed_count,
        webhook_url=webhook_url,
        verify_token=settings.META_WEBHOOK_VERIFY_TOKEN,
    )


@router.post("/connect", response_model=MetaIntegrationResponse)
async def connect_meta(
    setup_data: MetaConnectionSetup,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Connects or updates Meta Page and credentials. Validates Page via Graph API.
    """
    integration = _get_or_create_integration(db)
    meta_service = MetaGraphService(access_token=setup_data.access_token)

    page_name = setup_data.page_name
    insta_id = setup_data.instagram_account_id
    insta_user = setup_data.instagram_username

    try:
        # Validate connection against Graph API
        page_info = await meta_service.get_page_info(setup_data.page_id)
        page_name = page_info.get("name", setup_data.page_name or "Connected Page")
        insta_info = page_info.get("instagram_business_account", {})
        if insta_info:
            insta_id = insta_info.get("id")
            insta_user = insta_info.get("username")
    except Exception:
        # If credentials cannot be verified live, we allow saving configuration if valid format,
        # but if invalid, handle gracefully
        if not page_name:
            page_name = f"Page {setup_data.page_id}"

    integration.page_id = setup_data.page_id
    integration.page_name = page_name
    integration.access_token = setup_data.access_token
    integration.instagram_account_id = insta_id
    integration.instagram_username = insta_user
    integration.is_connected = True
    integration.updated_at = datetime.utcnow()

    # Try fetching available lead forms
    try:
        forms = await meta_service.get_lead_forms(setup_data.page_id)
        if forms and not integration.selected_forms:
            integration.selected_forms = forms
    except Exception:
        pass

    db.commit()
    db.refresh(integration)
    return get_meta_status(current_user=current_user, db=db)


@router.post("/disconnect")
def disconnect_meta(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Disconnects Meta integration.
    """
    integration = _get_or_create_integration(db)
    integration.is_connected = False
    integration.access_token = None
    db.commit()
    return {"message": "Meta integration disconnected successfully"}


@router.get("/forms")
async def get_forms(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Fetches available Meta Lead Ads forms for the connected page.
    """
    integration = _get_or_create_integration(db)
    if not integration.is_connected or not integration.page_id or not integration.access_token:
        return {"forms": integration.selected_forms or []}

    meta_service = MetaGraphService(access_token=integration.access_token)
    try:
        forms = await meta_service.get_lead_forms(integration.page_id)
        return {"forms": forms}
    except Exception as e:
        return {"forms": integration.selected_forms or [], "warning": str(e)}


@router.put("/forms")
def update_selected_forms(
    data: MetaFormSelection,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Updates the list of selected forms to synchronize.
    """
    integration = _get_or_create_integration(db)
    integration.selected_forms = data.forms
    db.commit()
    return {"message": "Selected forms updated", "forms": integration.selected_forms}


@router.put("/field-mappings")
def update_field_mappings(
    data: MetaFieldMappingUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Updates custom field mappings from Meta form questions to CRM lead attributes.
    """
    integration = _get_or_create_integration(db)
    integration.field_mappings = data.mappings
    db.commit()
    return {"message": "Field mappings updated successfully", "field_mappings": integration.field_mappings}


@router.post("/import-historical", response_model=MetaImportResult)
async def import_historical(
    import_req: MetaHistoricalImportRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Imports historical lead submissions from selected forms using official Meta Graph API.
    """
    integration = _get_or_create_integration(db)
    if not integration.is_connected or not integration.access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meta integration is not connected. Please connect a Page first.",
        )

    since_ts = None
    until_ts = None
    if import_req.since_date:
        try:
            dt = datetime.strptime(import_req.since_date, "%Y-%m-%d")
            since_ts = int(dt.timestamp())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid since_date format. Use YYYY-MM-DD")

    if import_req.until_date:
        try:
            dt = datetime.strptime(import_req.until_date, "%Y-%m-%d")
            until_ts = int(dt.timestamp())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid until_date format. Use YYYY-MM-DD")

    result = await import_historical_meta_leads(
        db=db,
        integration=integration,
        form_ids=import_req.form_ids,
        since_timestamp=since_ts,
        until_timestamp=until_ts,
    )
    return result


@router.post("/sync-now", response_model=MetaImportResult)
async def sync_now(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Sync Now action: Triggers lead synchronization for configured forms.
    """
    integration = _get_or_create_integration(db)
    if not integration.is_connected or not integration.access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meta integration is not connected",
        )

    return await import_historical_meta_leads(db=db, integration=integration)


@router.get("/logs", response_model=List[MetaSyncLogResponse])
def get_sync_logs(
    limit: int = 50,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Returns recent Meta sync and webhook processing logs.
    """
    return (
        db.query(MetaSyncLog)
        .order_by(MetaSyncLog.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/retry-failed")
async def retry_failed_imports(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Retries failed Meta import log entries.
    """
    failed_logs = (
        db.query(MetaSyncLog)
        .filter(MetaSyncLog.status == "failed")
        .order_by(MetaSyncLog.created_at.asc())
        .all()
    )

    integration = _get_or_create_integration(db)
    meta_service = MetaGraphService(access_token=integration.access_token)

    retried_count = 0
    success_count = 0

    for log in failed_logs:
        log.attempt_count += 1
        retried_count += 1
        raw_lead = None

        if log.external_lead_id and integration.is_connected and integration.access_token:
            try:
                raw_lead = await meta_service.get_lead_details(log.external_lead_id)
            except Exception:
                raw_lead = log.payload
        else:
            raw_lead = log.payload

        if raw_lead and raw_lead.get("id"):
            _, status_res, err = process_single_meta_lead(
                db=db,
                raw_lead=raw_lead,
                event_type="retry",
                integration_id=integration.id,
                field_mappings=integration.field_mappings,
            )
            if status_res in ["success", "skipped_duplicate"]:
                log.status = status_res
                log.error_message = None
                log.processed_at = datetime.utcnow()
                success_count += 1
            else:
                log.error_message = err

    db.commit()
    return {
        "retried": retried_count,
        "successfully_resolved": success_count,
    }


@router.post("/simulate-lead")
def simulate_meta_lead(
    req: MetaSimulateLeadRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Simulates an instant incoming lead from Facebook / Instagram Lead Ads.
    Tests end-to-end ingestion, deduplication, and automatic round-robin assignment.
    """
    integration = _get_or_create_integration(db)
    sim_id = f"sim_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    platform_name = (req.platform or "Instagram").strip()
    source_str = f"{platform_name} Lead Ads"

    raw_lead = {
        "id": sim_id,
        "page_id": integration.page_id or "109823471029",
        "form_id": "form_sim_991823",
        "campaign_id": "camp_sim_7721",
        "campaign_name": req.campaign_name or "Summer 2026 Luxury Villas Campaign",
        "ad_id": "ad_sim_3312",
        "ad_name": req.ad_name or "Virtual Tour - 4BHK Penthouse",
        "field_data": [
            {"name": "full_name", "values": [req.full_name or "Sophia Martinez"]},
            {"name": "phone_number", "values": [req.phone or "+1 (555) 234-5678"]},
            {"name": "email", "values": [req.email or "sophia.martinez@example.com"]},
            {"name": "property_type", "values": [req.property_type or "Luxury Villa"]},
            {"name": "preferred_location", "values": [req.preferred_location or "Beverly Hills / Westside"]},
            {"name": "budget", "values": [str(req.max_budget or 1250000)]},
        ],
    }

    lead, status_res, err = process_single_meta_lead(
        db=db,
        raw_lead=raw_lead,
        event_type="simulation",
        integration_id=integration.id,
        field_mappings=integration.field_mappings,
    )

    if status_res != "success" or not lead:
        raise HTTPException(
            status_code=400,
            detail=f"Lead simulation failed: {err or 'Unknown error'}",
        )

    db.refresh(lead)
    assigned_name = lead.assigned_agent.full_name if lead.assigned_agent else "Unassigned"
    assigned_email = lead.assigned_agent.email if lead.assigned_agent else None

    return {
        "status": "success",
        "message": f"Lead automatically captured from {source_str} and assigned to {assigned_name} via Round-Robin!",
        "lead_id": lead.id,
        "full_name": lead.full_name,
        "phone": lead.phone,
        "email": lead.email,
        "source": lead.source,
        "campaign_name": lead.meta_campaign_name,
        "ad_name": lead.meta_ad_name,
        "assigned_agent": {
            "id": lead.assigned_agent_id,
            "full_name": assigned_name,
            "email": assigned_email,
        },
    }
