# Local Development Setup (Team Guide)

This guide documents how to run TRANSPO HUB locally without relying on any hosted repository integration.

## 1) Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL 15+ (local or managed)

## 2) Install Dependencies
```bash
cd backend
npm install

cd ../frontend
npm install
```

## 3) Configure Environment Variables

### Backend
Create `backend/.env` from template:
```bash
cd backend
copy .env.example .env
```

Set required values:
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transpo` (or managed DB URL)
- `JWT_SECRET=<strong-random-secret>`
- `PORT=5000` (optional)

### Frontend
Create `frontend/.env.local` from template:
```bash
cd frontend
copy .env.local.example .env.local
```

Defaults:
- `NEXT_PUBLIC_API_URL=/api`
- `BACKEND_URL=http://localhost:5000`

## 4) Start the Application

Option A (recommended if you have Docker Desktop): run full stack with Postgres
```bash
docker compose up --build
```

Option B: run services manually (requires local PostgreSQL running)

Terminal A (backend):
```bash
cd backend
npm start
```

Terminal B (frontend):
```bash
cd frontend
npm run dev
```

Open:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:5000/api/health`

## 5) Verification Commands

Backend tests:
```bash
cd backend
npm test
```

Frontend checks:
```bash
cd frontend
npm run lint
npm run build
```

## 6) Production Parity (Vercel + Render)

Backend (Render):
- `DATABASE_URL`
- `JWT_SECRET`

Frontend (Vercel):
- `BACKEND_URL=https://<render-backend>.onrender.com`

## 7) Repository Migration Readiness
- GitHub Actions workflow removed (`.github/workflows/ci.yml`)
- No required hardcoded repository URL for runtime setup
- Team can reproduce environment from:
  - `README.md`
  - `LOCAL_SETUP.md`
  - `backend/.env.example`
  - `frontend/.env.local.example`
