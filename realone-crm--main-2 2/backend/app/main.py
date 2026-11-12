from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.database import SessionLocal, engine, Base
from app.models.assignment_state import RoundRobinState
from app.api import auth, users, leads, dashboard, meta, webhooks, maintenance

# Ensure tables are created if running without alembic in tests
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Real One CRM with Meta Lead Ads Integration and Mandatory Round-Robin Assignment",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local development on any port while allowing credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


import asyncio
from app.models.meta_integration import MetaIntegration
from app.services.import_service import import_historical_meta_leads


async def auto_meta_lead_sync_worker():
    """
    Background worker that runs continuously to auto-sync new leads from Meta Graph API
    if an active Meta integration is connected.
    """
    while True:
        try:
            await asyncio.sleep(180)  # Polling interval: every 3 minutes
            db = SessionLocal()
            try:
                integration = db.query(MetaIntegration).filter(MetaIntegration.is_connected == True).first()
                if integration and integration.access_token:
                    await import_historical_meta_leads(db=db, integration=integration)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception:
            pass


@app.on_event("startup")
async def startup_event():
    """
    Ensure singleton Round-Robin state row exists and launch background auto-sync worker.
    """
    db = SessionLocal()
    try:
        state = db.query(RoundRobinState).filter(RoundRobinState.id == 1).first()
        if not state:
            state = RoundRobinState(id=1, total_assigned_count=0)
            db.add(state)
            db.commit()
    finally:
        db.close()

    # Launch background auto-sync task for Meta leads
    asyncio.create_task(auto_meta_lead_sync_worker())

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Real One CRM backend is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "graph_api_version": settings.META_GRAPH_API_VERSION,
    }


# Include API v1 Routers
api_v1 = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1)
app.include_router(users.router, prefix=api_v1)
app.include_router(leads.router, prefix=api_v1)
app.include_router(dashboard.router, prefix=api_v1)
app.include_router(meta.router, prefix=api_v1)
app.include_router(webhooks.router, prefix=api_v1)
app.include_router(maintenance.router, prefix=api_v1)
