import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    PROJECT_NAME: str = "Real One CRM"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql+psycopg2://ishan@localhost:5432/real_estate_crm",
        description="PostgreSQL connection string"
    )
    
    # Security
    AUTH_SECRET_KEY: str = Field(
        default="crm_super_secret_jwt_signing_key_replace_in_prod_2026_xyz",
        description="JWT secret key"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Meta / Facebook Graph API & Lead Ads
    META_APP_ID: str = Field(default="", description="Meta Developer App ID")
    META_APP_SECRET: str = Field(default="", description="Meta Developer App Secret")
    META_GRAPH_API_VERSION: str = Field(default="v22.0", description="Supported Meta Graph API version")
    META_REDIRECT_URI: str = Field(default="http://localhost:5173/meta/callback", description="Meta OAuth Redirect URI")
    META_WEBHOOK_VERIFY_TOKEN: str = Field(
        default="meta_crm_webhook_secret_token_verify_2026",
        description="Custom webhook verification token set in Meta App Dashboard"
    )
    META_ACCESS_TOKEN: str = Field(default="", description="Configured System User or Page Access Token")
    
    # Temporary, explicitly enabled first-run maintenance controls
    INITIAL_ADMIN_SETUP_ENABLED: bool = False
    INITIAL_CLEANUP_ENABLED: bool = False

    # Frontend URL for CORS
    FRONTEND_URL: str = Field(default="http://localhost:5173", description="Frontend base URL")
    BACKEND_URL: str = Field(default="http://localhost:8000", description="Backend base URL")
    
    # CORS Origins
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
