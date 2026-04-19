# Production Deployment Guide (Vercel + Render + Render Postgres)

This guide shows the exact steps to deploy:
- Backend API + Socket.io on **Render**
- Postgres on **Render**
- Frontend (Next.js) on **Vercel**

Important behavior:
- In `NODE_ENV=production`, the backend refuses JSON-file storage and requires `DATABASE_URL` (Postgres).
- The frontend talks to the backend via `/api/*` rewrites (Vercel → Render).

---

## Prerequisites

1. Your code is pushed to GitHub/GitLab (Render + Vercel need a repo).
2. You can sign in to **Render** and **Vercel**.
3. You can generate a strong secret (for `JWT_SECRET`).

---

## 1) Create Postgres on Render

1. Open Render dashboard → **New** → **PostgreSQL**.
2. Choose:
   - Name: `transpo-postgres`
   - Region: same region as your backend service (best latency)
3. Click **Create Database**.
4. Open the database details page and copy:
   - **Internal Database URL** (recommended when backend is also on Render)
   - Or **External Database URL** if you must connect from outside Render

You will use the URL as:
- `DATABASE_URL=<copied url>`

SSL:
- Render Postgres typically works best with `DATABASE_SSL=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.

---

## 2) Deploy Backend on Render (Web Service)

### A) Create the web service

1. Render dashboard → **New** → **Web Service**
2. Choose your repository.
3. Configure:
   - **Name:** `transpo-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Region:** same as your Render Postgres

### B) Configure build + start

In Render → Service settings:
- **Build Command**
```bash
npm install
```

- **Start Command**
```bash
npm start
```

### C) Set environment variables (required)

Render → Service → **Environment** → Add these:

- `NODE_ENV` = `production`
- `DB_MODE` = `postgres`
- `DATABASE_URL` = (paste the Render Postgres *Internal Database URL*)
- `JWT_SECRET` = (long random string)

Recommended:
- `DATABASE_SSL` = `true`
- `DATABASE_SSL_REJECT_UNAUTHORIZED` = `false`
- `JWT_EXPIRES_IN` = `2h` (optional)

CORS (recommended so only your Vercel site can call the API):
- `CORS_ALLOW_ALL` = `false`
- `CORS_ORIGINS` = `https://<your-vercel-app>.vercel.app`

Notes:
- Render sets `PORT` automatically. You do not need to set `PORT` manually.

### D) Deploy and confirm

1. Click **Deploy** (or push a commit to trigger deployment).
2. In Render → Service → **Logs**, confirm you see:
   - `DB mode: postgres`
3. Confirm health endpoint:
   - `GET https://<your-render-backend>.onrender.com/api/health`

If health fails:
- Check Render logs for database connection errors.
- Ensure `DATABASE_SSL=true` is set.

---

## 3) Create the first admin user (one-time)

The API does not allow public admin registration. You must seed the first admin manually.

### Option A (recommended): run locally against the production database

1. From your machine, open a terminal in the repo:
```bash
cd backend
```

2. Export the production database URL temporarily (use the **External** Render DB URL if your local machine cannot reach Internal):
```bash
set NODE_ENV=production
set DB_MODE=postgres
set DATABASE_URL=<your render postgres url>
set DATABASE_SSL=true
set DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

3. Run the script:
```bash
set ADMIN_EMAIL=admin@yourdomain.com
set ADMIN_PASSWORD=StrongPasswordHere
set ADMIN_NAME=System Admin
set ADMIN_PHONE=+256...
set ADMIN_ROLE=admin
node scripts/create-admin.js
```

### Option B: run as a one-off job inside Render

If your Render plan supports a shell/one-off job, run the same command there using the service env vars.

---

## 4) Deploy Frontend on Vercel

### A) Create project

1. Vercel dashboard → **Add New** → **Project**
2. Import your repository.
3. Configure:
   - **Root Directory:** `frontend`

### B) Set Vercel environment variables

Vercel → Project → **Settings** → **Environment Variables**:

- `BACKEND_URL` = `https://<your-render-backend>.onrender.com`
  - This powers the Next.js rewrite rule in `frontend/next.config.ts`:
    - `/api/*` → `BACKEND_URL/api/*`

- `NEXT_PUBLIC_SOCKET_URL` = `https://<your-render-backend>.onrender.com`
  - Socket.io must connect directly to Render.

- `NEXT_PUBLIC_ENABLE_SOCKET` = `true`

Optional (default is already `/api`):
- `NEXT_PUBLIC_API_URL` = `/api`

### C) Deploy

1. Click **Deploy**.
2. After deploy, open:
   - `https://<your-vercel-app>.vercel.app`

---

## 5) Post-deploy validation (do these in order)

### Backend health
- Open: `https://<render-backend>.onrender.com/api/health`
- Expect: `200` JSON response

### Admin login
- Open: `https://<vercel-app>.vercel.app/login`
- Log in with the admin you created in step 3
- Confirm admin pages load:
  - `/admin/deliveries`
  - `/admin/metrics`
  - `/admin/bookings`

### Exports
From the UI:
- Admin Metrics: download **CSV** and **PDF**
- Admin Bookings: download **CSV** and **PDF**
- User Bookings: download **CSV** and **PDF**

Expected:
- CSV downloads open in spreadsheet software
- PDF downloads have headers/footers + pagination

### Real-time (Socket.io)
1. Open `/admin/deliveries` in one tab
2. Open `/deliveries` (user) in another tab
3. Toggle Received/Undo on admin side
4. Confirm user side reflects changes without a full reload

If Socket.io fails:
- Verify `NEXT_PUBLIC_SOCKET_URL` points to Render (not Vercel).
- Verify backend is reachable on HTTPS.

---

## 6) Common problems and fixes

### “ERR_CONNECTION_REFUSED” from the frontend
- Backend is down or `BACKEND_URL` is wrong.
- Fix: check Render service status + correct `BACKEND_URL` on Vercel.

### Backend says “DATABASE_URL must be set in production”
- Render env var missing.
- Fix: set `DATABASE_URL` on Render and redeploy.

### Postgres connection fails
- Fix: set `DATABASE_SSL=true` and keep `DATABASE_SSL_REJECT_UNAUTHORIZED=false` on Render.

### Socket “websocket error”
- Fix: set `NEXT_PUBLIC_SOCKET_URL=https://<render-backend>.onrender.com` and redeploy Vercel.
