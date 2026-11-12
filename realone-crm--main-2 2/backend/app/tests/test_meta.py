import hmac
import hashlib
import json
import pytest
from unittest.mock import patch, AsyncMock
from app.core.config import settings
from app.models.lead import Lead
from app.models.meta_sync_log import MetaSyncLog
from app.models.meta_integration import MetaIntegration
from app.services.import_service import import_historical_meta_leads


def test_meta_webhook_verification_handshake(client):
    # Valid handshake
    params = {
        "hub.mode": "subscribe",
        "hub.challenge": "1158201444",
        "hub.verify_token": settings.META_WEBHOOK_VERIFY_TOKEN,
    }
    resp = client.get("/api/v1/webhooks/meta", params=params)
    assert resp.status_code == 200
    assert resp.text == "1158201444"

    # Invalid token rejected
    bad_params = {
        "hub.mode": "subscribe",
        "hub.challenge": "1158201444",
        "hub.verify_token": "wrong_token",
    }
    bad_resp = client.get("/api/v1/webhooks/meta", params=bad_params)
    assert bad_resp.status_code == 403


def test_webhook_signature_verification(client):
    # Set a test app secret
    settings.META_APP_SECRET = "test_meta_app_secret_12345"

    payload = {
        "object": "page",
        "entry": [
            {
                "id": "page_123",
                "time": 1700000000,
                "changes": [
                    {
                        "field": "leadgen",
                        "value": {
                            "leadgen_id": "meta_webhook_lead_1",
                            "form_id": "form_1",
                            "page_id": "page_123",
                        },
                    }
                ],
            }
        ],
    }
    raw_body = json.dumps(payload).encode("utf-8")

    # 1. Invalid signature rejected
    bad_resp = client.post(
        "/api/v1/webhooks/meta",
        content=raw_body,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": "sha256=invalidsignature"},
    )
    assert bad_resp.status_code == 403

    # 2. Correct HMAC signature accepted
    valid_sig = hmac.new(
        key=settings.META_APP_SECRET.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    # Mock Graph API lead detail retrieval
    mock_lead_data = {
        "id": "meta_webhook_lead_1",
        "created_time": "2026-10-17T14:00:00+0000",
        "field_data": [
            {"name": "full_name", "values": ["Webhook Lead"]},
            {"name": "phone_number", "values": ["+1888888888"]},
            {"name": "email", "values": ["webhook@test.com"]},
        ],
    }

    with patch("app.services.meta_service.MetaGraphService.get_lead_details", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_lead_data
        ok_resp = client.post(
            "/api/v1/webhooks/meta",
            content=raw_body,
            headers={"Content-Type": "application/json", "X-Hub-Signature-256": f"sha256={valid_sig}"},
        )
        assert ok_resp.status_code == 200

    # Clean up setting
    settings.META_APP_SECRET = ""


@pytest.mark.asyncio
async def test_historical_import_with_pagination(db, agent1_user):
    """
    Simulates importing existing Meta leads across paginated Graph API responses.
    """
    integration = db.query(MetaIntegration).first()
    integration.is_connected = True
    integration.access_token = "mock_access_token_123"
    integration.selected_forms = [{"id": "form_paginated", "name": "Contact Form"}]
    db.commit()

    # Mocked 2 pages of leads
    page1 = [
        {"id": "hist_1", "created_time": "2026-10-17T10:00:00+0000", "field_data": [{"name": "full_name", "values": ["Lead 1"]}, {"name": "phone_number", "values": ["+111"]}]},
        {"id": "hist_2", "created_time": "2026-10-17T10:05:00+0000", "field_data": [{"name": "full_name", "values": ["Lead 2"]}, {"name": "phone_number", "values": ["+222"]}]},
    ]
    page2 = [
        {"id": "hist_3", "created_time": "2026-10-17T10:10:00+0000", "field_data": [{"name": "full_name", "values": ["Lead 3"]}, {"name": "phone_number", "values": ["+333"]}]},
    ]

    with patch("app.services.meta_service.MetaGraphService.get_form_leads", new_callable=AsyncMock) as mock_get_leads:
        mock_get_leads.return_value = page1 + page2

        result = await import_historical_meta_leads(
            db=db,
            integration=integration,
            form_ids=["form_paginated"],
        )

        assert result["total_discovered"] == 3
        assert result["successfully_imported"] == 3
        assert result["duplicates_skipped"] == 0
        assert result["failed"] == 0

        # Verify leads in database
        leads_in_db = db.query(Lead).filter(Lead.meta_lead_id.in_(["hist_1", "hist_2", "hist_3"])).all()
        assert len(leads_in_db) == 3


@pytest.mark.asyncio
async def test_retry_failed_imports(client, admin_token, db, agent1_user):
    """
    Tests retrying failed sync log records.
    """
    integration = db.query(MetaIntegration).first()
    integration.is_connected = True
    integration.access_token = "mock_token"
    db.commit()

    # Insert a failed sync log
    failed_log = MetaSyncLog(
        integration_id=integration.id,
        external_lead_id="failed_retry_lead_1",
        event_type="webhook",
        status="failed",
        error_message="Simulated temporary API timeout",
        payload={
            "id": "failed_retry_lead_1",
            "field_data": [
                {"name": "full_name", "values": ["Recovered Lead"]},
                {"name": "phone_number", "values": ["+1999999999"]},
            ],
        },
    )
    db.add(failed_log)
    db.commit()

    # Retry endpoint
    resp = client.post("/api/v1/meta/retry-failed", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["retried"] == 1
    assert data["successfully_resolved"] == 1

    # Verify lead created and assigned
    created_lead = db.query(Lead).filter(Lead.meta_lead_id == "failed_retry_lead_1").first()
    assert created_lead is not None
    assert created_lead.full_name == "Recovered Lead"
