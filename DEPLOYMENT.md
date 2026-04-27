# TRANSPO HUB — Deployment Guide
## Frontend → Vercel | Backend + Database → Render

---

## Overview

| Service | Platform | URL Pattern |
|---------|----------|-------------|
| Frontend (Next.js) | Vercel | `https://transpo-hub.vercel.app` |
| Backend (Node.js/Express) | Render Web Service | `https://transpo-hub-api.onrender.com` |
| Database (PostgreSQL) | Render PostgreSQL | Internal connection string |

---

## Step 1 — Set Up the Database on Render

1. Go to [render.com](https://render.com) → **New** → **PostgreSQL**
2. Fill in:
   - **Name**: `transpo-db`
   - **Database**: `transpo_db`
   - **User**: `transpo_user`
   - **Region**: Choose closest to your users (e.g. Frankfurt for East Africa)
   - **Plan**: Free (or Starter for production)
3. Click **Create Database**
4. Once created, go to the database dashboard and copy:
   - **Internal Database URL** — used by the backend service (same Render region)
   - **External Database URL** — used for local testing only

> Keep the Internal URL — you will paste it into the backend environment variables.

---

## Step 2 — Deploy the Backend to Render

### 2.1 Create the Web Service

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo (`BonitaPurity/transpo` or `evnzhenry/BAP`)
3. Fill in:
   - **Name**: `transpo-hub-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Plan**: Free (or Starter)

### 2.2 Set Environment Variables

In the Render dashboard → your web service → **Environment** tab, add each variable from `backend/.env.production`:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `JWT_SECRET` | *(copy from `backend/.env.production`)* |
| `REFRESH_TOKEN_SECRET` | *(copy from `backend/.env.production`)* |
| `JWT_EXPIRES_IN` | `2h` |
| `REFRESH_TOKEN_EXPIRES_IN` | `14d` |
| `DATABASE_URL` | *(paste Internal Database URL from Step 1)* |
| `DB_MODE` | `postgres` |
| `DATABASE_SSL` | `true` |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` |
| `DATABASE_POOL_MAX` | `10` |
| `CORS_ORIGINS` | `https://transpo-hub.vercel.app` *(update after Vercel deploy)* |
| `CORS_ALLOW_ALL` | `false` |
| `SEED_BASE_DATA` | `true` *(set to false after first deploy)* |
| `JSON_SEED_DEMO_DATA` | `false` |
| `ENFORCE_HTTPS` | `true` |
| `ADMIN_BYPASS_AUTH_ENABLED` | `false` |
| `SIM_INTERVAL_MS` | `1000` |
| `DELIVERY_GEOFENCE_METERS` | `200` |

### 2.3 Deploy

Click **Create Web Service**. Render will:
1. Pull your code from GitHub
2. Run `npm install`
3. Start the server with `node src/index.js`
4. On first boot, the database schema is created and base data is seeded automatically

> After the first successful deploy, go back to Environment and set `SEED_BASE_DATA=false` to prevent re-seeding on restarts.

### 2.4 Note your Backend URL

Once deployed, your backend URL will be something like:
```
https://transpo-hub-api.onrender.com
```
Copy this — you need it for the frontend.

---

## Step 3 — Deploy the Frontend to Vercel

### 3.1 Import the Project

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import your GitHub repo (`BonitaPurity/transpo` or `evnzhenry/BAP`)
3. Set:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend` ← **important, must be set to `frontend`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

> The root-level `vercel.json` already sets `rootDirectory: "frontend"` so Vercel should auto-detect this. If it doesn't, set it manually in the UI.

### 3.2 Set Environment Variables

In Vercel → your project → **Settings** → **Environment Variables**, add each variable from `frontend/.env.production`:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `/api` |
| `BACKEND_URL` | `https://transpo-hub-api.onrender.com` *(your Render URL)* |
| `NEXT_PUBLIC_ENABLE_SOCKET` | `true` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://transpo-hub-api.onrender.com` *(your Render URL)* |
| `NEXT_PUBLIC_DEBUG` | `false` |

> Set all variables for **Production**, **Preview**, and **Development** environments.

### 3.3 Deploy

Click **Deploy**. Vercel will build and deploy your Next.js app.

> Your frontend URL will be something like `https://transpo-hub.vercel.app`

### 3.4 Update CORS on Backend

Once you have your Vercel URL, go back to Render → your backend service → **Environment** and update:

```
CORS_ORIGINS=https://transpo-hub.vercel.app
```

Then click **Save Changes** — Render will redeploy automatically.

---

## Step 4 — Verify the Deployment

### 4.1 Backend Health Check
Open in browser:
```
https://transpo-hub-api.onrender.com/api/health
```
Expected response:
```json
{"status":"OK","message":"TRANSPO HUB API Running","uptimeSeconds":...}
```

### 4.2 Frontend
Open your Vercel URL and verify:
- Home page loads
- Login works with `admin@transpo.ug` / `admin123`
- Admin dashboard shows live stats
- Live tracking map loads with buses
- Booking flow completes end-to-end

### 4.3 Change Default Admin Password
After first login, go to **Admin** → **Users** and change the default admin password immediately.

---

## Step 5 — Admin Credentials & Password Reset

### Default Credentials (seeded on first boot)

| Name | Email | Password |
|------|-------|----------|
| Admin | `admin@transpo.ug` | `admin123` |
| Ops | `ops@transpo.ug` | `ops2024` |
| Dispatch | `dispatch@transpo.ug` | `dispatch1` |

These are created automatically when `SEED_BASE_DATA=true` on first boot.

### If Login Fails in Production

The most common cause is the admin accounts were not seeded. Fix it using the Render Shell:

1. Go to Render → your backend service → **Shell** tab
2. Run:
```bash
node scripts/seed-admin.js
```
This creates all three admin accounts if they don't exist yet.

### Reset a Specific Admin Password

In the Render Shell:
```bash
ADMIN_EMAIL=admin@transpo.ug ADMIN_PASSWORD=YourNewPassword123 node scripts/seed-admin.js
```

### Verify Accounts Exist

In the Render Shell:
```bash
node -e "require('dotenv').config();const {createStore}=require('./src/storage/store');const s=createStore({logger:console});s.init().then(()=>s.readAll('users')).then(u=>{u.forEach(x=>console.log(x.id,x.email,x.role));process.exit(0);})"
```

---

## Step 6 — Custom Domain (Optional)

### Vercel
1. Go to your Vercel project → **Settings** → **Domains**
2. Add your domain (e.g. `transpo.ug`)
3. Update your DNS records as instructed by Vercel
4. Update `CORS_ORIGINS` on Render to your custom domain

### Render
1. Go to your Render web service → **Settings** → **Custom Domains**
2. Add your API subdomain (e.g. `api.transpo.ug`)
3. Update `NEXT_PUBLIC_SOCKET_URL` and `BACKEND_URL` on Vercel

---

## Environment Variables Reference

### Backend (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Must be `production` |
| `PORT` | No | **Do NOT set** — Render assigns this automatically |
| `JWT_SECRET` | Yes | 96-char hex string — never share |
| `REFRESH_TOKEN_SECRET` | Yes | 96-char hex string — never share |
| `JWT_EXPIRES_IN` | Yes | `2h` recommended |
| `REFRESH_TOKEN_EXPIRES_IN` | Yes | `14d` recommended |
| `DATABASE_URL` | Yes | Render Internal PostgreSQL URL |
| `DB_MODE` | Yes | `postgres` |
| `DATABASE_SSL` | Yes | `true` for Render |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Yes | `false` for Render |
| `CORS_ORIGINS` | Yes | Your Vercel frontend URL |
| `CORS_ALLOW_ALL` | Yes | `false` |
| `SEED_BASE_DATA` | First deploy only | `true` then set to `false` |
| `ENFORCE_HTTPS` | Yes | `true` |
| `SIM_INTERVAL_MS` | No | `1000` (Postgres mode) |
| `DELIVERY_GEOFENCE_METERS` | No | `200` |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | `/api` (uses Next.js proxy) |
| `BACKEND_URL` | Yes | Your Render backend URL (server-side) |
| `NEXT_PUBLIC_ENABLE_SOCKET` | Yes | `true` |
| `NEXT_PUBLIC_SOCKET_URL` | Yes | Your Render backend URL |
| `NEXT_PUBLIC_DEBUG` | No | `false` |

---

## Troubleshooting

### Vercel shows 404 Not Found
- Ensure **Root Directory** is set to `frontend` in Vercel project settings
- Go to Vercel → your project → **Settings** → **General** → **Root Directory** → set to `frontend`
- Trigger a redeploy after changing the root directory
- Ensure `BACKEND_URL` environment variable is set — without it the API proxy has no target

### Backend not starting on Render
- Check Render logs for `JWT_SECRET must be set in production`
- Ensure `DATABASE_URL` is the **Internal** URL (not External)
- Ensure `DB_MODE=postgres`

### Frontend shows blank page or API errors
- Check browser console for CORS errors
- Verify `CORS_ORIGINS` on Render matches your exact Vercel URL (no trailing slash)
- Verify `BACKEND_URL` on Vercel points to your Render service

### Socket.io not connecting (live tracking not working)
- Vercel does not support WebSocket upgrades on the `/api` proxy path
- Ensure `NEXT_PUBLIC_SOCKET_URL` points directly to your Render backend URL
- Render free tier sleeps after 15 min of inactivity — first connection may take 30s to wake

### Database connection errors
- Use the **Internal** Database URL on Render (not External)
- Ensure `DATABASE_SSL=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=false`

### Render free tier limitations
- Free web services sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds (cold start)
- Upgrade to Starter plan ($7/month) to avoid cold starts

---

## Security Checklist Before Going Live

- [ ] `JWT_SECRET` is a unique 96-char random hex string
- [ ] `REFRESH_TOKEN_SECRET` is a different unique 96-char random hex string
- [ ] `CORS_ALLOW_ALL=false`
- [ ] `CORS_ORIGINS` set to exact frontend URL
- [ ] `SEED_BASE_DATA=false` after first deploy
- [ ] `ADMIN_BYPASS_AUTH_ENABLED=false`
- [ ] Default admin password changed after first login
- [ ] `backend/.env.production` is NOT committed to git
- [ ] `frontend/.env.production` is NOT committed to git
