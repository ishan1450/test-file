from typing import Optional
from fastapi import APIRouter, Request, Response, HTTPException, status, Depends, Header
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.config import settings
from app.models.meta_integration import MetaIntegration
from app.services.meta_service import MetaGraphService
from app.services.import_service import process_single_meta_lead

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.get("/meta")
def verify_meta_webhook(
    request: Request,
):
    """
    Handles Meta's official webhook verification handshake.
    Query parameters: hub.mode, hub.challenge, hub.verify_token
    """
    params = request.query_params
    mode = params.get("hub.mode")
    verify_token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and verify_token == settings.META_WEBHOOK_VERIFY_TOKEN:
        # Return plain text challenge as requested by Meta specification
        return Response(content=str(challenge), media_type="text/plain", status_code=status.HTTP_200_OK)

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification token mismatch or invalid mode",
    )


@router.post("/meta")
async def handle_meta_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Receives and processes incoming Meta Lead Ads real-time webhook events.
    Verifies authenticity using SHA256 HMAC signature.
    Fetches full lead from Graph API and triggers transactional round-robin import.
    """
    body_bytes = await request.body()

    # Authenticate webhook payload
    if not MetaGraphService.verify_webhook_signature(body_bytes, x_hub_signature_256):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid signature: Webhook authenticity verification failed",
        )

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body")

    # Load active integration
    integration = db.query(MetaIntegration).filter(MetaIntegration.is_connected == True).first()
    integration_id = integration.id if integration else None
    token = integration.access_token if integration else settings.META_ACCESS_TOKEN
    mappings = integration.field_mappings if integration else {}

    meta_service = MetaGraphService(access_token=token)

    entries = payload.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            if change.get("field") == "leadgen":
                val = change.get("value", {})
                leadgen_id = str(val.get("leadgen_id", ""))
                page_id = str(val.get("page_id", "") or entry.get("id", ""))
                form_id = str(val.get("form_id", ""))
                ad_id = str(val.get("ad_id", ""))

                if not leadgen_id:
                    continue

                raw_lead = None
                # Retrieve full lead details from Meta Graph API
                try:
                    raw_lead = await meta_service.get_lead_details(leadgen_id)
                except Exception as e:
                    # If Graph API fetch fails (e.g. test payload without live token)
                    raw_lead = {
                        "id": leadgen_id,
                        "page_id": page_id,
                        "form_id": form_id,
                        "ad_id": ad_id,
                        "field_data": val.get("field_data", []),
                        "fetch_error": str(e),
                    }

                # Transactionally process lead & mandatory round-robin assignment
                process_single_meta_lead(
                    db=db,
                    raw_lead=raw_lead,
                    event_type="webhook",
                    integration_id=integration_id,
                    field_mappings=mappings,
                )

    return {"status": "ok", "message": "Event received and processed"}
