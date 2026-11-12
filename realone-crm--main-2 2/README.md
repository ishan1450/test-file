# Real Estate CRM with Meta Lead Ads Integration & Mandatory Round-Robin Assignment

A production-ready, full-stack Real Estate Customer Relationship Management (CRM) system architected for real estate agencies. Features deep **Meta Lead Ads (Facebook & Instagram)** server-side integration and **mandatory persistent round-robin lead rotation** backed by PostgreSQL transaction row locking.

---

## 1. Key Features

- **Strict Role-Based Scoping**:
  - **Admin**: Full visibility across all leads, manual assignment override, approval portal, agent management, Meta integration settings, sync logs, and company-wide analytics.
  - **Agent**: Zero-trust lead access. Agents can only view, edit, and access audit timelines for leads explicitly assigned to them. Cannot view other agents' leads, unassigned leads, or reassign leads.
- **Admin-Approved Registration Flow**:
  - Public registration creates an account with `agent` role and `pending` approval status.
  - Pending users are strictly blocked from logging in or querying CRM endpoints.
  - Admin approves or rejects accounts from the Account Approvals portal.
- **Mandatory Persistent Round-Robin Lead Rotation**:
  - Runs in a PostgreSQL transaction with `SELECT ... FOR UPDATE` row locking on singleton assignment state (`round_robin_state`).
  - Survives server restarts, horizontal multi-worker scaling, and deployments.
  - Deterministically distributes incoming Meta and manual leads across active, approved agents.
  - Deactivated agents are dynamically skipped in the rotation sequence without resetting or corrupting state.
  - Admin manual reassignment does not consume or advance the automatic rotation cursor.
  - Duplicated Meta events or failed imports never consume an assignment turn.
- **Real Meta Lead Ads Integration (Graph API v22.0)**:
  - Official Meta Webhook verification handshake (`hub.mode`, `hub.challenge`, `hub.verify_token`).
  - Webhook authenticity verification via SHA-256 HMAC signature (`X-Hub-Signature-256`).
  - Real-time lead retrieval from Meta Graph API upon `leadgen` event.
  - Deduplication enforcing database-level unique constraint on `meta_lead_id`.
  - Historical lead submission imports with cursor pagination support and chronological ordering.
  - Manual "Sync Now" action.
  - Retry failed imports with attempt tracking and sanitized error logging.
  - Customizable form question-to-CRM field mapping.
- **Complete Audit Trail & Activity History**:
  - Detailed chronological timeline tracking creation, edits, status transitions, round-robin assignments, manual overrides, Meta webhook imports, and archival/restoration.
- **Lead Archival & Restoration**:
  - Soft archival with indexed timestamp filters for clean historical record retention.

---

## 2. Technology Stack

### Backend
- **Language**: Python 3.9+
- **Framework**: FastAPI (Async REST API)
- **Database**: PostgreSQL 16
- **ORM & Migrations**: SQLAlchemy 2.x, Alembic
- **Security**: Native Bcrypt, PyJWT (Short-lived access token + 7-day refresh token)
- **Validation**: Pydantic v2, Email-Validator
- **HTTP Client**: HTTPX (async Graph API client)
- **Testing**: Pytest, Pytest-Asyncio

### Frontend
- **Framework**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4 (SaaS aesthetic, white/slate surfaces, restrained blue accents)
- **Routing**: React Router DOM v7
- **Icons**: Lucide React
- **Data Visualization**: Recharts

---

## 3. Project Structure

```
├── backend/
│   ├── alembic/                  # Alembic database migrations
│   ├── app/
│   │   ├── api/                  # FastAPI REST routers (auth, leads, users, dashboard, meta, webhooks)
│   │   ├── core/                 # Config, security (bcrypt/JWT), permissions
│   │   ├── db/                   # Database engine, session, Base
│   │   ├── models/               # SQLAlchemy models (User, Lead, LeadActivity, MetaIntegration, MetaSyncLog, RoundRobinState)
│   │   ├── schemas/              # Pydantic v2 validation models
│   │   ├── services/             # Core business logic (assignment_service, import_service, meta_service, activity_service)
│   │   ├── tests/                # Automated pytest test suites (auth, leads, assignment, meta)
│   │   └── main.py               # FastAPI entrypoint & startup handlers
│   ├── scripts/
│   │   ├── bootstrap_admin.py    # Command-line admin creation utility
│   │   └── seed_initial_team.py  # Development seed script (1 Admin, 3 Agents)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/           # Reusable UI components (LeadModal, etc.)
│   │   ├── context/              # AuthContext & useAuth hook
│   │   ├── layouts/              # DashboardLayout with responsive sidebar & navbar
│   │   ├── pages/                # Login, Register, Approvals, Agents, Leads, LeadDetails, Reports, MetaSettings, Profile
│   │   ├── services/             # API client & resource services
│   │   ├── types/                # TypeScript interfaces
│   │   ├── App.tsx               # App router and role-based guards
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── README.md
└── .gitignore
```

---

## 4. Setup and Installation

### Prerequisites
- Python 3.9+ installed
- Node.js 18+ and npm installed
- PostgreSQL 14+ installed and running locally

### Step 1: Clone and Configure Environment

In `backend/`:
```bash
cp .env.example .env
```
Ensure your `DATABASE_URL` is set:
```ini
DATABASE_URL=postgresql+psycopg2://<user>:<password>@localhost:5432/real_estate_crm
AUTH_SECRET_KEY=your_secure_random_jwt_secret_key_minimum_32_characters
META_WEBHOOK_VERIFY_TOKEN=meta_crm_webhook_secret_token_verify_2026
```

### Step 2: Database Initialization

1. Create PostgreSQL database:
```bash
createdb real_estate_crm
```
2. Run database migrations:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
```

### Step 3: Seed Initial 1 Admin and 3 Agents

Run the seeding script to create the initial team:
```bash
python scripts/seed_initial_team.py
```
- **Admin**: `admin@realestate.com` / `Password123!`
- **Agent 1**: `sarah.agent@realestate.com` / `Password123!`
- **Agent 2**: `michael.agent@realestate.com` / `Password123!`
- **Agent 3**: `priya.agent@realestate.com` / `Password123!`
- **Pending Registration**: `david.new@realestate.com` / `Password123!`

To bootstrap an independent custom administrator via CLI:
```bash
python scripts/bootstrap_admin.py --email admin@yourdomain.com --name "System Admin" --password "YourStrongPassword"
```

### Step 4: Start Backend Dev Server

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```
Backend API interactive docs: `http://localhost:8000/api/v1/docs`

### Step 5: Start Frontend Dev Server

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 5. Round-Robin Lead Rotation Architecture

The Round-Robin lead assignment engine enforces strict business fairness:
1. **Concurrency Safety**: Acquires an exclusive row lock on `RoundRobinState` (`SELECT ... FOR UPDATE`) inside the PostgreSQL transaction.
2. **Eligible Pool Scoping**: Evaluates users matching `role == 'agent' AND approval_status == 'approved' AND is_active == True` ordered deterministically by `id ASC`.
3. **Cursor Persistence**: Tracks `last_assigned_agent_id` and advances rotation only when a new lead is successfully inserted and committed.
4. **Agent State Changes**:
   - If an agent is deactivated, the rotation naturally picks the next eligible agent in order without corrupting state.
   - When new agents are approved, they integrate into the next cycle in sequence.
5. **Deduplication Safeguard**:
   - Duplicate Meta webhook events or historical leads matching an existing `meta_lead_id` are detected, recorded as `skipped_duplicate`, and **do not consume a rotation turn**.
   - Failed imports rollback cleanly and do not consume a turn.
6. **Admin Manual Reassignments**:
   - Admins can manually reassign a lead to any active agent. This records a `lead_reassigned` audit entry but **strictly preserves the automatic round-robin state**.

---

## 6. Real Meta Lead Ads Integration Setup

Follow these steps to configure real Meta Lead Ads with your Facebook Page and Instagram Account:

### A. Meta for Developers App Setup
1. Log into [Meta for Developers](https://developers.facebook.com/).
2. Click **My Apps** → **Create App**.
3. Select **Business** as the app type.
4. Add the **Webhooks** and **Facebook Login for Business** products to your app.

### B. Required App Permissions
Your Meta System User or Access Token must have the following Graph API permissions:
- `leads_retrieval`: Required to fetch customer submissions from Instant Forms.
- `pages_show_list`: Required to list and discover Facebook Pages.
- `pages_read_engagement`: Required to read Page metadata.
- `pages_manage_ads`: Required to link ad campaigns and lead forms.

### C. Webhook Subscription
1. Under **App Dashboard → Webhooks**, select **Page** from the dropdown.
2. Click **Subscribe to this object**.
3. Fill in:
   - **Callback URL**: `https://your-crm-domain.com/api/v1/webhooks/meta` (Must be HTTPS in production; use Ngrok/Cloudflare Tunnel for local testing).
   - **Verify Token**: Enter the token matching `META_WEBHOOK_VERIFY_TOKEN` in your `.env` (default: `meta_crm_webhook_secret_token_verify_2026`).
4. Click **Verify and Save**.
5. In the Page field subscriptions table, locate **leadgen** and click **Subscribe**.

### D. CRM Portal Configuration
1. Log in to the CRM as Admin (`admin@realestate.com`).
2. Navigate to **Meta Lead Ads** in the sidebar.
3. Click **Connect Facebook Page** and provide your:
   - Facebook Page ID
   - Page Name
   - Page Access Token (or System User Token)
4. Verify connection status displays **Connected**.
5. Use **Field Mappings** to map custom questions (e.g., "Property Type", "Budget") to CRM fields.
6. Click **Sync Now** or **Import Existing** to pull historical leads.

---

## 7. Automated Testing Suite

The backend includes 21 automated integration tests covering all critical paths:

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest app/tests/ -v
```

### Verified Test Categories:
- **Authentication & Approval Security**:
  - `test_public_registration_creates_pending_account`: Confirms public signups default to pending.
  - `test_public_registration_cannot_self_assign_admin`: Prevents privilege escalation.
  - `test_pending_user_cannot_login_or_access_crm`: Verifies pending accounts are blocked.
  - `test_admin_approval_grants_agent_role`: Confirms admin approval activates agent.
  - `test_deactivated_account_loses_access`: Confirms deactivated users lose access immediately.
- **Strict Role-Based Lead Permissions**:
  - `test_lead_visibility_scoping`: Admin sees all; Agent sees strictly assigned leads.
  - `test_agent_cannot_access_another_agents_lead_details`: Blocks cross-agent URL manipulation.
  - `test_agent_cannot_reassign_lead`: Blocks unauthorized reassignment attempts.
  - `test_edit_lead_updates_db_and_activity_history`: Validates audit log generation.
  - `test_lead_archival_and_restoration`: Tests soft delete and restore restricted to Admin.
- **Round-Robin Assignment Engine**:
  - `test_six_leads_distributed_two_per_agent`: Verifies 2-per-agent sequential rotation.
  - `test_rotation_persists_across_restart`: Confirms rotation state persists in PostgreSQL across connections.
  - `test_duplicate_events_do_not_advance_rotation`: Confirms duplicates do not consume turns.
  - `test_failed_imports_do_not_consume_turn`: Confirms failed payloads do not advance rotation.
  - `test_deactivated_agent_is_skipped`: Confirms inactive agents are gracefully bypassed.
  - `test_admin_manual_reassignment_does_not_reset_rotation`: Confirms manual override isolation.
  - `test_concurrent_imports_preserve_round_robin`: Verifies thread safety and row locking under parallel execution.
- **Meta Lead Ads Integration**:
  - `test_meta_webhook_verification_handshake`: Validates GET handshake verification.
  - `test_webhook_signature_verification`: Validates SHA256 HMAC signature verification and invalid signature rejection.
  - `test_historical_import_with_pagination`: Tests multi-page lead retrieval and chronological assignment.
  - `test_retry_failed_imports`: Tests recovering failed log entries.

---

## 8. Remaining Steps for Live Production Meta Access

When moving to live Meta production:
1. **Public HTTPS Domain**: Meta webhooks require an SSL/TLS certificate. Use a reverse proxy (e.g. Nginx, Caddy) or Cloudflare Tunnel pointing to `http://localhost:8000`.
2. **Meta App Review**:
   - For internal employee use within a Meta Business Manager, System User tokens can access Page leads directly under **Standard Access**.
   - If deploying multi-tenant for external businesses, submit the Meta App for review for `leads_retrieval` and `pages_manage_ads` permissions.
3. **Secret Rotation**: Set strong production random keys for `AUTH_SECRET_KEY`, `META_APP_SECRET`, and `META_WEBHOOK_VERIFY_TOKEN` in the production environment variables.


## First production setup: initial admin and clean start

This repository includes temporary, server-guarded first-run tools. They are disabled by default and do not run automatically.

### Deployment layout in this repository

The root `wrangler.jsonc` configures a Cloudflare Worker with static frontend assets and `/api/*` proxying to Render. This is a Workers Static Assets deployment (via `wrangler deploy`), not a Cloudflare Pages build. If your production site is actually a Pages project, configure `VITE_API_BASE_URL` to the Render API URL and use the Pages build settings instead.

### 1. Back up Supabase

Before proceeding, create a Supabase database backup or export. Do not run the cleanup without a recoverable backup. Confirm the Render service points to the intended Supabase project.

### 2. Deploy the backend to Render

Use the existing backend service and root directory `backend`. Build command: `pip install -r requirements.txt`. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Keep the existing `DATABASE_URL`, `AUTH_SECRET_KEY`, Meta credentials, and webhook configuration unchanged.

Temporarily add these Render environment variables:

- `INITIAL_ADMIN_SETUP_ENABLED=true`
- `INITIAL_CLEANUP_ENABLED=true`

Do not enable these flags on a publicly reachable production API until you are ready to create the administrator and perform cleanup. The first-admin endpoint still refuses to create an account if any admin already exists or the one-time setup marker is present.

### 3. Deploy the frontend / Worker

From the repository root run `npm install --prefix frontend`, then `npm install`, then `npm run deploy`. The existing Worker config sets `BACKEND_URL` to `https://realone-crm.onrender.com`; change it only if your Render service URL differs. In Cloudflare, make sure the Worker is bound to the intended domain. If the app is deployed as Cloudflare Pages instead, use the existing `frontend` directory with build command `npm run build` and output directory `dist`, and set `VITE_API_BASE_URL` to the Render origin (for example `https://realone-crm.onrender.com`).

### 4. Create the first admin

Open `https://YOUR-CRM-DOMAIN/initial-admin-setup`. The page is usable only while `INITIAL_ADMIN_SETUP_ENABLED=true`, no admin exists, and no previous initial-admin marker exists. Create the admin with a unique email and a strong password (12+ characters). Then sign in at `/login`.

If setup reports that an administrator already exists, stop here. Do not delete or promote accounts through SQL. First identify the existing admin account through your current account records and confirm whether it should be retained.

### 5. Run the one-time cleanup

While signed in as the new admin, open `https://YOUR-CRM-DOMAIN/initial-cleanup` and read the deletion list carefully. The endpoint deletes every lead and every account with role `agent`; associated lead activities are removed by the database foreign-key cascade. It clears agent references in round-robin/approval state. It preserves administrator accounts, Meta integration configuration, and Meta sync logs. Existing Meta lead IDs are marked processed so the periodic historical sync does not recreate the dummy Meta leads. Confirm the operation once.

### 6. Disable temporary setup controls

Immediately after successful cleanup, set both Render variables to `false`:

- `INITIAL_ADMIN_SETUP_ENABLED=false`
- `INITIAL_CLEANUP_ENABLED=false`

Redeploy/restart the Render service so the flags take effect. The admin setup marker and cleanup marker also prevent repeat use even if the flags are accidentally re-enabled. Remove the temporary frontend routes/pages in a later normal release if desired; the backend flags keep the endpoints disabled.

### 7. Verify

Check that the admin can sign in, the Leads page is empty, the Agents page has no agent accounts, the Meta settings still show the existing configuration, and a newly submitted Meta lead can be received and assigned. Do not use the demo seed script against production.
