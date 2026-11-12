import time
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from app.models.lead import Lead
from app.models.meta_integration import MetaIntegration
from app.models.meta_sync_log import MetaSyncLog
from app.services.assignment_service import assign_lead_round_robin
from app.services.activity_service import log_lead_activity, ActivityType
from app.services.meta_service import MetaGraphService


def extract_lead_fields(
    raw_lead: Dict[str, Any],
    field_mappings: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Extracts and standardizes Meta Lead form field data into CRM Lead attributes.
    Supports user-configured mappings and common intelligent aliases.
    """
    field_data = raw_lead.get("field_data", [])
    mappings = field_mappings or {}

    extracted: Dict[str, Any] = {
        "full_name": None,
        "phone": None,
        "email": None,
        "property_type": None,
        "preferred_location": None,
        "min_budget": None,
        "max_budget": None,
        "custom_fields": {},
    }

    # Map raw field values into dictionary
    raw_fields: Dict[str, str] = {}
    for item in field_data:
        name = item.get("name", "").lower()
        values = item.get("values", [])
        val_str = str(values[0]).strip() if values else ""
        raw_fields[name] = val_str

    for name, val in raw_fields.items():
        crm_field = mappings.get(name)

        if crm_field and crm_field in extracted and crm_field != "custom_fields":
            extracted[crm_field] = val
        elif "full_name" in name or name in ["name", "first_name"]:
            if not extracted["full_name"]:
                extracted["full_name"] = val
        elif "phone" in name or "mobile" in name or "contact" in name:
            if not extracted["phone"]:
                extracted["phone"] = val
        elif "email" in name:
            if not extracted["email"]:
                extracted["email"] = val
        elif "property" in name or "type" in name or "unit" in name:
            if not extracted["property_type"]:
                extracted["property_type"] = val
        elif "location" in name or "city" in name or "area" in name:
            if not extracted["preferred_location"]:
                extracted["preferred_location"] = val
        elif "budget" in name or "price" in name:
            # Parse numeric if possible
            clean_val = "".join(c for c in val if c.isdigit() or c == ".")
            try:
                extracted["max_budget"] = float(clean_val) if clean_val else None
            except ValueError:
                pass
            extracted["custom_fields"][name] = val
        else:
            extracted["custom_fields"][name] = val

    # Fallbacks for mandatory fields
    if not extracted["full_name"]:
        extracted["full_name"] = "Meta Lead " + str(raw_lead.get("id", "Unknown"))
    if not extracted["phone"]:
        extracted["phone"] = "N/A"

    return extracted


def process_single_meta_lead(
    db: Session,
    raw_lead: Dict[str, Any],
    event_type: str = "webhook",
    integration_id: Optional[int] = None,
    field_mappings: Optional[Dict[str, str]] = None,
) -> Tuple[Optional[Lead], str, Optional[str]]:
    """
    Transactionally processes, deduplicates, and assigns a Meta lead.
    Returns: (Lead, status, error_message)
    status can be: "success", "skipped_duplicate", "failed"
    """
    # Serialize imports with the one-time cleanup and prevent old Meta IDs
    # recorded as processed during cleanup from being re-created.
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(741902632)"))

    meta_lead_id = str(raw_lead.get("id", ""))
    if not meta_lead_id:
        error = "Payload missing external Meta lead id"
        _record_sync_log(db, integration_id, None, event_type, "failed", error, raw_lead)
        db.commit()
        return None, "failed", error

    # 1. Deduplication check
    existing_lead = db.query(Lead).filter(Lead.meta_lead_id == meta_lead_id).first()
    if existing_lead:
        # Duplicate lead: do not advance rotation, record skipped log
        _record_sync_log(db, integration_id, meta_lead_id, event_type, "skipped_duplicate", None, raw_lead)
        log_lead_activity(
            db=db,
            lead_id=existing_lead.id,
            activity_type=ActivityType.DUPLICATE_META_EVENT_SKIPPED,
            description=f"Duplicate Meta webhook/sync event skipped for external lead ID {meta_lead_id}",
            actor_id=None,
        )
        db.commit()
        return existing_lead, "skipped_duplicate", None

    previously_processed = db.query(MetaSyncLog).filter(
        MetaSyncLog.external_lead_id == meta_lead_id, MetaSyncLog.status == "success"
    ).first()
    if previously_processed:
        return None, "skipped_duplicate", None

    try:
        # 2. Extract and format fields
        extracted = extract_lead_fields(raw_lead, field_mappings)

        lead = Lead(
            full_name=extracted["full_name"],
            phone=extracted["phone"],
            email=extracted["email"],
            source="Facebook Lead Ads",
            meta_lead_id=meta_lead_id,
            meta_page_id=str(raw_lead.get("page_id", "")) or None,
            meta_form_id=str(raw_lead.get("form_id", "")) or None,
            meta_campaign_id=str(raw_lead.get("campaign_id", "")) or None,
            meta_campaign_name=raw_lead.get("campaign_name"),
            meta_ad_id=str(raw_lead.get("ad_id", "")) or None,
            meta_ad_name=raw_lead.get("ad_name"),
            property_type=extracted["property_type"],
            preferred_location=extracted["preferred_location"],
            min_budget=extracted["min_budget"],
            max_budget=extracted["max_budget"],
            status="New",
            custom_fields=extracted["custom_fields"],
        )

        db.add(lead)
        db.flush()  # Generates lead.id within the transaction

        # 3. Mandatory Round-Robin Assignment
        assign_lead_round_robin(db, lead, actor_id=None)

        # 4. Activity & Sync log
        log_lead_activity(
            db=db,
            lead_id=lead.id,
            activity_type=ActivityType.META_LEAD_IMPORTED,
            description=f"Lead imported from Meta Lead Ads (External ID: {meta_lead_id})",
            actor_id=None,
            new_values={
                "source": "Facebook Lead Ads",
                "campaign": lead.meta_campaign_name,
                "ad": lead.meta_ad_name,
            },
        )

        _record_sync_log(db, integration_id, meta_lead_id, event_type, "success", None, raw_lead)

        db.commit()
        return lead, "success", None

    except IntegrityError:
        db.rollback()
        # Concurrent insert duplicate race condition
        _record_sync_log(db, integration_id, meta_lead_id, event_type, "skipped_duplicate", "Duplicate concurrent key", raw_lead)
        db.commit()
        existing = db.query(Lead).filter(Lead.meta_lead_id == meta_lead_id).first()
        return existing, "skipped_duplicate", None

    except Exception as exc:
        db.rollback()
        err_msg = str(exc)
        _record_sync_log(db, integration_id, meta_lead_id, event_type, "failed", err_msg, raw_lead)
        db.commit()
        return None, "failed", err_msg


def _record_sync_log(
    db: Session,
    integration_id: Optional[int],
    external_lead_id: Optional[str],
    event_type: str,
    status: str,
    error_message: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> MetaSyncLog:
    # Sanitize payload: strip any access token
    clean_payload = None
    if payload:
        clean_payload = {k: v for k, v in payload.items() if "token" not in k.lower() and "secret" not in k.lower()}

    log = MetaSyncLog(
        integration_id=integration_id,
        external_lead_id=external_lead_id,
        event_type=event_type,
        status=status,
        error_message=error_message,
        payload=clean_payload,
        processed_at=datetime.utcnow() if status != "pending" else None,
    )
    db.add(log)
    return log


async def import_historical_meta_leads(
    db: Session,
    integration: MetaIntegration,
    form_ids: Optional[List[str]] = None,
    since_timestamp: Optional[int] = None,
    until_timestamp: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Fetches historical submissions from Meta for the selected forms and processes them.
    Sorts deterministically by created_time to preserve round-robin sequence order.
    """
    start_time = time.time()
    meta_service = MetaGraphService(access_token=integration.access_token)

    target_forms = form_ids or [f.get("id") for f in integration.selected_forms if isinstance(f, dict) and f.get("id")]
    if not target_forms and integration.selected_forms:
        target_forms = [str(f) for f in integration.selected_forms if isinstance(f, (str, int))]

    all_raw_leads: List[Dict[str, Any]] = []
    errors: List[str] = []

    for fid in target_forms:
        try:
            leads = await meta_service.get_form_leads(
                form_id=fid,
                since_timestamp=since_timestamp,
                until_timestamp=until_timestamp,
            )
            all_raw_leads.extend(leads)
        except Exception as e:
            errors.append(f"Failed to fetch leads for form {fid}: {str(e)}")

    # Sort leads by created_time ascending for stable, sequential round-robin distribution
    all_raw_leads.sort(key=lambda x: x.get("created_time") or "")

    imported = 0
    duplicates = 0
    failed = 0

    for raw_lead in all_raw_leads:
        _, status, err = process_single_meta_lead(
            db=db,
            raw_lead=raw_lead,
            event_type="historical_import",
            integration_id=integration.id,
            field_mappings=integration.field_mappings,
        )
        if status == "success":
            imported += 1
        elif status == "skipped_duplicate":
            duplicates += 1
        else:
            failed += 1
            if err:
                errors.append(f"Lead {raw_lead.get('id')}: {err}")

    # Update integration last sync timestamp
    integration.last_sync_at = datetime.utcnow()
    db.commit()

    duration = round(time.time() - start_time, 2)
    return {
        "total_discovered": len(all_raw_leads),
        "successfully_imported": imported,
        "duplicates_skipped": duplicates,
        "failed": failed,
        "completion_time_seconds": duration,
        "errors": errors,
    }
