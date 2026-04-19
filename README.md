# TRANSPO HUB

TRANSPO HUB is a transit logistics platform with:
- Passenger booking and manifest management
- Admin operations dashboard and scenario simulations
- Fleet monitoring and telemetry views
- PostgreSQL-backed APIs for production-ready persistence

## Stack
- Frontend: Next.js (`frontend`)
- Backend: Node.js + Express + Socket.io (`backend`)
- Database: PostgreSQL

## Local Development Setup

### 1) Install dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2) Configure environment variables

Backend:
```bash
cd backend
copy .env.example .env
```
Set at minimum in `backend/.env`:
- `DATABASE_URL` (local or hosted Postgres)
- `JWT_SECRET` (required for secure auth)

Frontend:
```bash
cd frontend
copy .env.local.example .env.local
```

### 3) Run services
Backend:
```bash
cd backend
npm start
```

Frontend:
```bash
cd frontend
npm run dev
```

### 4) Local verification
- Backend health: `http://localhost:5000/api/health`
- Frontend app: `http://localhost:3000`

## Test and Build Verification

Backend tests:
```bash
cd backend
npm test
```

Frontend lint/build:
```bash
cd frontend
npm run lint
npm run build
```

## Downloads and PDF Exports
- Admin Ops Intelligence audit export:
  - CSV: `GET /api/admin/manifest/export?format=csv`
  - PDF: `GET /api/admin/manifest/export?format=pdf`
- Admin bookings export:
  - CSV: `GET /api/admin/bookings/export?format=csv&paymentStatus=Completed`
  - PDF: `GET /api/admin/bookings/export?format=pdf&paymentStatus=Completed`
- User bookings export (signed-in user or admin):
  - CSV: `GET /api/bookings/user/:id/export?format=csv`
  - PDF: `GET /api/bookings/user/:id/export?format=pdf`

## Production Deployment (Vercel + Render)

### Backend on Render
Required environment:
- `DATABASE_URL`
- `NODE_ENV=production`
- `DB_MODE=postgres` (optional; auto-enables Postgres when `DATABASE_URL` is present in production)
- `JWT_SECRET`
- `DATABASE_SSL=true` (recommended on Render)

Start command:
```bash
npm start
```

### Frontend on Vercel
Set:
- `BACKEND_URL=https://<your-render-service>.onrender.com`

The frontend uses same-origin `/api` and rewrites to backend via `frontend/next.config.ts`.

## Migration Readiness Notes
- GitHub Actions workflow has been removed from `.github/workflows`.
- Environment templates were added:
  - `backend/.env.example`
  - `frontend/.env.local.example`
- Setup no longer depends on repository-specific URLs.

## Additional Documentation
- System report: [SYSTEM_DOCUMENTATION.md](./SYSTEM_DOCUMENTATION.md)
- Team setup/runbook: [LOCAL_SETUP.md](./LOCAL_SETUP.md)
- Production deployment (Vercel + Render + Postgres): [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
