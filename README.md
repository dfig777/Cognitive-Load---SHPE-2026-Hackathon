# NeuroFocus

A neuro-inclusive AI workspace — calm task decomposition, text simplification, and bionic reading — built on **FastAPI + Azure OpenAI + Azure Cosmos DB + React**.

---

## Architecture

```
React (MSAL auth)  →  FastAPI  →  Azure OpenAI (GPT-4o / GPT-4-32k)
                          ↓
                   Azure Cosmos DB (NoSQL, serverless)
```

### Why Cosmos DB instead of PostgreSQL?

| | Azure Cosmos DB (NoSQL) | PostgreSQL |
|---|---|---|
| Schema | Flexible JSON documents — perfect for evolving preference shapes | Fixed schema, migrations needed |
| Serverless | ✅ Pay-per-request, zero idle cost | ❌ Always-on compute |
| Azure-native | ✅ First-class SDK, RBAC, AAD integration | Possible but extra setup |
| Partition key | `/user_id` — instant single-user queries | Requires indexing strategy |

---

## Quick Start

### 1. Provision infrastructure

```bash
az group create -n neurofocus-rg -l eastus
az deployment group create \
  -g neurofocus-rg \
  --template-file infra/neurofocus.bicep
```

The Bicep template creates:
- Azure OpenAI (GPT-4o + GPT-4-32k deployments)
- Azure Cosmos DB — serverless, NoSQL — with `user_preferences` and `sessions` containers
- Azure App Service (Python 3.11) for the FastAPI backend
- Azure Static Web Apps for the React frontend

### 2. Backend

```bash
cd backend
cp .env.example .env       # fill in values from Bicep outputs
pip install -r requirements.txt
uvicorn main:app --reload
```

API docs: http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
cp .env.example .env       # VITE_AZURE_CLIENT_ID + VITE_AZURE_TENANT_ID
npm install
npm run dev
```

Open: http://localhost:5173

### 4. Azure AD app registration

1. Register a **Single-Page Application** in Azure AD.
2. Add redirect URI: `http://localhost:5173` (dev) + your SWA URL (prod).
3. Expose an API scope: `access_as_user`.
4. Add the client ID to both `.env` files.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | e.g. `https://xxx.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | From Azure portal |
| `AZURE_OPENAI_DEPLOYMENT_GPT4O` | Deployment name (default: `gpt-4o`) |
| `AZURE_OPENAI_DEPLOYMENT_GPT4_32K` | Deployment name (default: `gpt-4-32k`) |
| `COSMOS_ENDPOINT` | Cosmos DB endpoint URL |
| `COSMOS_KEY` | Primary key |
| `AZURE_TENANT_ID` | Your AAD tenant |
| `AZURE_CLIENT_ID` | SPA app registration client ID |
| `SECRET_KEY` | Random 32-byte hex string |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_AZURE_CLIENT_ID` | SPA app registration client ID |
| `VITE_AZURE_TENANT_ID` | AAD tenant ID |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/preferences` | Load user preferences from Cosmos |
| PUT | `/api/preferences` | Save user preferences |
| POST | `/api/decompose` | Break a goal into timed steps |
| POST | `/api/summarise` | Streaming text simplification (SSE) |
| POST | `/api/explain` | Explain why a sentence was simplified |
| POST | `/api/nudge` | Supportive nudge when a timer overruns |
| POST | `/api/sessions` | Save a decomposed session |
| GET | `/api/sessions` | List past sessions |

Full OpenAPI spec at `/docs` when running locally.

---

## Team Responsibilities

| Role | Primary files |
|---|---|
| Lead Backend Engineer | `backend/main.py`, `backend/ai_service.py`, `backend/db.py` |
| Frontend Accessibility Lead | `frontend/src/components/`, `frontend/src/styles/global.css` |
| Cognitive UX Researcher | `backend/ai_service.py` (system prompts), accessibility testing |
| DevOps / Infra | `infra/neurofocus.bicep` |

---

## Accessibility

- ARIA labels on all interactive elements
- Focus-visible outlines for keyboard navigation
- Three font options: Default, OpenDyslexic, Atkinson Hyperlegible
- Adjustable line height and letter spacing (persisted per user)
- High-contrast theme
- Bionic Reading toggle
- Calm error messages — no alarming HTTP status language exposed to users
- Focus Mode hides all sidebars for reduced visual noise
