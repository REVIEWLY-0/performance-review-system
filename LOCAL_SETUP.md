# Local Setup Guide — Reviewly

Time to first run: ~15 minutes.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | **20 LTS** (recommended); v24 works but is not required | `node --version` |
| npm | 10+ | `npm --version` |
| Docker Desktop | any recent | `docker --version` |
| Docker Compose | V2 (bundled with Docker Desktop) | `docker compose version` |

---

## 1. Clone & Install

```bash
git clone https://github.com/REVIEWLY-0/performance-review-system.git
cd performance-review-system

# Install backend deps
cd backend && npm install && cd ..

# Install frontend deps
cd frontend && npm install && cd ..
```

---

## 2. Start the Database

From the **repo root**:

```bash
docker compose up -d
```

This starts two services:
- **PostgreSQL 16** — `localhost:5433` (user: `reviewly`, pass: `reviewly`, db: `reviewly`)
- **Adminer** (DB browser) — http://localhost:8080

**Verify Postgres is up:**
```bash
docker compose ps
# Both services should show "running"

# Optional: connect directly
docker exec -it $(docker compose ps -q postgres) psql -U reviewly -d reviewly -c '\dt'
```

**Adminer login** at http://localhost:8080:
- System: `PostgreSQL`
- Server: `postgres` ← use this inside Adminer (container name, not localhost)
- Username: `reviewly`
- Password: `reviewly`
- Database: `reviewly`

> **Host DB tools** (TablePlus, DBeaver, psql on your machine): use `Host=localhost`, `Port=5433` instead.

---

## 3. Backend Environment

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in the required values:

```env
# Already correct for local Docker Compose — do not change
DATABASE_URL="postgresql://reviewly:reviewly@localhost:5433/reviewly"

# Supabase — get these from your Supabase project dashboard
# Dashboard → Project Settings → API
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_JWT_SECRET="your-jwt-secret"          # Settings → API → JWT Secret

# Email — get from Mailtrap: https://mailtrap.io → Inboxes → SMTP Settings
MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=587
MAILTRAP_USER=your_mailtrap_user
MAILTRAP_PASS=your_mailtrap_password

# Leave these as-is for local dev
PORT=4000
NODE_ENV=development
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN="http://localhost:3000"
UNSUBSCRIBE_SECRET="any-random-string-for-local-dev"
```

> **Supabase note:** Auth (login/signup) runs through Supabase. You need a real Supabase project URL and JWT secret — local Postgres only stores application data, Supabase handles auth tokens. Ask the team lead for shared dev credentials or create a free project at supabase.com.

---

## 4. Frontend Environment

```bash
cp frontend/.env.example frontend/.env.local
```

Open `frontend/.env.local`:

```env
# From your Supabase project dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# Leave as-is
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
NEXT_PUBLIC_APP_NAME="Reviewly"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 5. Database Setup (Prisma)

Run these in order from the `backend/` directory:

```bash
cd backend

# 1. Generate Prisma client (must run after any schema change)
npx prisma generate

# 2. Apply all migrations to your local database
npx prisma migrate deploy

# 3. (Optional) Seed test data — run AFTER signing up your first admin account
#    The seed expects a company to already exist (created on signup).
npx ts-node prisma/seed.ts
```

**Verify migrations applied:**
```bash
npx prisma migrate status
# All migrations should show "Applied"
```

---

## 6. Run Backend + Frontend

Open two terminals:

**Terminal 1 — Backend** (runs on http://localhost:4000):
```bash
cd backend
npm run start:dev
# Expected output: "Reviewly Backend — Port: 4000"
```

**Terminal 2 — Frontend** (runs on http://localhost:3000):
```bash
cd frontend
npm run dev
# Expected output: "Local: http://localhost:3000"
```

---

## 7. Quick Sanity Check

Run these after both services are up:

```bash
# 1. Backend health
curl http://localhost:4000/api/health
# Expected: {"status":"ok"}

# 2. Frontend
# Open http://localhost:3000/login — the login page should load without errors
```

**If signup or login fails immediately**, check Supabase env vars first:
- `SUPABASE_URL` and `SUPABASE_JWT_SECRET` in `backend/.env`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env.local`

Auth runs through Supabase even locally — misconfigured Supabase vars are the #1 cause of broken signup/login.

---

## 8. First Run Checklist

**Path A — Fresh start (no seed):**
1. Go to http://localhost:3000/signup
2. Create your admin account — this creates the company row in the database
3. You'll be redirected to `/admin`
4. Manually create departments, employees, and review cycles via the UI

**Path B — Seed test data (recommended for testing):**
1. Complete Path A step 1–3 first (signup must happen before seed)
2. Run the seed: `cd backend && npx ts-node prisma/seed.ts`
3. Test user credentials (all seeded accounts): password = `password123`

---

## Troubleshooting

### Port already in use

```bash
# Find what's using port 5433 (postgres)
lsof -i :5433

# Find what's using port 4000 (backend)
lsof -i :4000

# Kill by PID
kill -9 <PID>

# Or change PORT in backend/.env to e.g. 4001
```

### Prisma: "Can't reach database server"

```bash
# Make sure Docker is running
docker compose ps

# If postgres container isn't running
docker compose up -d postgres

# Check logs
docker compose logs postgres
```

### Prisma: "Migration table not found" or schema out of sync

```bash
cd backend
npx prisma migrate deploy   # re-apply all migrations
npx prisma generate          # regenerate client
```

### CORS errors in browser console

- Confirm `CORS_ORIGIN` in `backend/.env` includes `http://localhost:3000`
- Confirm `NEXT_PUBLIC_API_URL` in `frontend/.env.local` is `http://localhost:4000/api`
- Restart the backend after any `.env` change

### "Missing Supabase credentials"

- The app uses Supabase for auth even locally — there is no local auth fallback
- Double-check `SUPABASE_URL` and `SUPABASE_JWT_SECRET` in `backend/.env`
- Double-check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env.local`

### Seed fails: "No company found"

- Sign up at http://localhost:3000/signup first
- Then re-run `npx ts-node prisma/seed.ts`

### Multiple Next.js dev servers fighting

```bash
# Kill all next dev processes
pkill -f "next dev"
# Then restart: cd frontend && npm run dev
```
