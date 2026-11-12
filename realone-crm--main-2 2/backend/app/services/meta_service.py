import hmac
import hashlib
from typing import Optional, Dict, Any, List
import httpx
from app.core.config import settings
from app.models.meta_integration import MetaIntegration


class MetaGraphService:
    def __init__(self, access_token: Optional[str] = None):
        self.api_version = settings.META_GRAPH_API_VERSION
        self.base_url = f"https://graph.facebook.com/{self.api_version}"
        self.access_token = access_token or settings.META_ACCESS_TOKEN

    @staticmethod
    def verify_webhook_signature(payload_bytes: bytes, signature_header: Optional[str]) -> bool:
        """
        Validates the SHA256 HMAC signature sent by Meta in the X-Hub-Signature-256 header.
        """
        if not settings.META_APP_SECRET:
            # If app secret is not configured in local development, skip verification
            return True
        if not signature_header:
            return False

        parts = signature_header.split("sha256=")
        if len(parts) != 2:
            return False
        expected_hash = parts[1]

        computed_hash = hmac.new(
            key=settings.META_APP_SECRET.encode("utf-8"),
            msg=payload_bytes,
            digestmod=hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(computed_hash, expected_hash)

    async def get_page_info(self, page_id: str) -> Dict[str, Any]:
        """
        Fetches Page details from Meta Graph API.
        """
        url = f"{self.base_url}/{page_id}"
        params = {
            "access_token": self.access_token,
            "fields": "id,name,instagram_business_account{id,username}",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    async def get_lead_forms(self, page_id: str) -> List[Dict[str, Any]]:
        """
        Fetches lead forms belonging to a Page.
        """
        url = f"{self.base_url}/{page_id}/leadgen_forms"
        params = {
            "access_token": self.access_token,
            "fields": "id,name,status,created_time,questions",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            return data.get("data", [])

    async def get_lead_details(self, lead_id: str) -> Dict[str, Any]:
        """
        Fetches full field data and metadata for a specific Meta lead submission.
        """
        url = f"{self.base_url}/{lead_id}"
        params = {
            "access_token": self.access_token,
            "fields": "id,created_time,field_data,ad_id,ad_name,campaign_id,campaign_name,form_id,page_id",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    async def get_form_leads(
        self,
        form_id: str,
        since_timestamp: Optional[int] = None,
        until_timestamp: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetches leads from a specific Meta lead form with cursor pagination support.
        """
        leads = []
        url = f"{self.base_url}/{form_id}/leads"
        params: Dict[str, Any] = {
            "access_token": self.access_token,
            "fields": "id,created_time,field_data,ad_id,ad_name,campaign_id,campaign_name,form_id,page_id",
            "limit": 100,
        }
        if since_timestamp:
            params["since"] = since_timestamp
        if until_timestamp:
            params["until"] = until_timestamp

        async with httpx.AsyncClient(timeout=30.0) as client:
            while url:
                resp = await client.get(url, params=params if leads == [] else None)
                resp.raise_for_status()
                data = resp.json()
                page_leads = data.get("data", [])
                leads.extend(page_leads)

                # Pagination
                paging = data.get("paging", {})
                url = paging.get("next")
                params = {}  # Next URL already includes parameters

        return leads
