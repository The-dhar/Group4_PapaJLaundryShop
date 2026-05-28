# Group 4 Papa J Laundry Shop - Team Playbook

This document is the single source of truth for setup, deployment, safety rules, and troubleshooting.

Use this file when onboarding teammates or asking Cursor/AI assistants for help.

---

## 1) Current Production Setup

- Frontend (Web): Vercel
- Backend API: Render (Dockerized Laravel)
- Database: Render PostgreSQL
- Mobile: React Native (Expo) connected to hosted backend
- Repository to use: `https://github.com/shadzx09/Group4_PapaJLaundryShop`

---

## 2) Live URLs

- Web frontend: `https://papa-j-laundry-shop.vercel.app`
- Backend API base: `https://papaj-laundry-backend.onrender.com`

API example:

- Login endpoint: `https://papaj-laundry-backend.onrender.com/api/login`

---

## 3) Branch and Git Rules (Team Workflow)

All active members should point to the fork repo (`shadzx09`) and not the old inactive owner repo.

### Check and fix remote

```bash
git remote -v
git remote set-url origin https://github.com/shadzx09/Group4_PapaJLaundryShop.git
```

### Daily start

```bash
git pull origin main
```

### Before pushing

1. Pull latest `main`
2. Run required checks (see section 10)
3. Push only after checks pass

---

## 4) Local Environment Variables

Each developer creates these locally (do not commit local env files).

### Web (ReactJS)

Create `ReactJS/.env.local`:

```env
REACT_APP_API_URL=https://papaj-laundry-backend.onrender.com
```

### Mobile (ReactNative)

Create `ReactNative/.env.local`:

```env
EXPO_PUBLIC_API_URL=https://papaj-laundry-backend.onrender.com
```

Notes:

- Web and mobile both support env-based API URL.
- If env is missing, code may fallback to localhost which breaks hosted usage.

---

## 5) Backend Render Environment Variables (Required)

In Render service `papaj-laundry-backend`, ensure:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://papaj-laundry-backend.onrender.com`
- `DB_CONNECTION=pgsql`
- `DB_HOST=<external render postgres host>`
- `DB_PORT=5432`
- `DB_DATABASE=<render db name>`
- `DB_USERNAME=<render db user>`
- `DB_PASSWORD=<render db password>`
- `DB_SSLMODE=require`
- `QUEUE_CONNECTION=database`
- `SESSION_DRIVER=database`
- `CACHE_STORE=database`
- `LOG_LEVEL=info`
- `FRONTEND_URL=https://papa-j-laundry-shop.vercel.app`
- `CORS_ALLOWED_ORIGINS=https://papa-j-laundry-shop.vercel.app,http://localhost:3000`
- `SANCTUM_STATEFUL_DOMAINS=papa-j-laundry-shop.vercel.app,localhost:3000`

Important:

- Use the **external** PostgreSQL hostname for `DB_HOST`, not internal host.

---

## 6) Deployment Behavior and Startup

Backend Docker startup command runs:

1. `php artisan config:clear`
2. `php artisan migrate --force`
3. `php artisan db:seed --force`
4. start Laravel server

So migrations/seeds are applied automatically on deploy.

Seeders are idempotent-safe for default users and service prices.

---

## 7) Default Accounts

Current seeded users:

- Owner: `owner@gmail.com` / `owner123`
- Manager: `manager@gmail.com` / `manager123`

Use manager for web clerk/branch workflows.

Security reminder:

- Change default passwords in production when finalizing project handoff.

---

## 8) What Was Implemented (High-Level)

### Web fixes

- API URL env wiring
- CORS/Sanctum production setup
- Sidebar/logout fixes
- Archive/restore flow fixes
- Unclaimed and Receipt crash hardening
- POS customer data expanded to 5-field structure
- Extra Charges changed to checkbox multi-select behavior

### Backend fixes

- Dockerized Laravel for Render deployment
- Proxy trust/HTTPS handling improvements
- Migration hardening/idempotent behavior
- Added archive/restore/update transaction endpoints
- Added richer transaction response fields for mobile needs
- Added customer detail fields support:
  - `first_name`, `last_name`, `street`, `barangay`, `city`
- Added service pricing API:
  - `GET /api/service-prices`
  - `POST /api/service-prices`
  - `PUT /api/service-prices/{id}`

### Mobile fixes

- Branch create payload corrected (`username` key)
- Branch clerk update endpoint corrected (`/branches/{id}/clerk`)
- Dashboard connected to hosted transactions/branches API
- Clerk logs connected to hosted transactions API
- Price management connected to hosted service-prices API
- Branch account dashboard connected to hosted transactions filtered by branch

---

## 9) Migration Safety Procedures (Very Important)

When adding/changing DB schema:

1. Always create a **new migration**, do not rewrite old deployed migrations unless necessary.
2. Prefer safe checks (`Schema::hasTable`, `Schema::hasColumn`) for cross-environment compatibility.
3. Keep migrations reversible (`down()`).
4. Avoid destructive schema changes directly on active production tables without plan.
5. Test on local before pushing.

Recommended migration flow:

```bash
php artisan make:migration your_change_name
php artisan migrate
php artisan migrate:rollback
php artisan migrate
```

---

## 10) Required Pre-Push Checks

Run these before pushing:

### Backend

```bash
cd LaravelServer
php artisan test
```

### Web

```bash
cd ReactJS
npm install
npm run build
```

### Mobile

```bash
cd ReactNative
npm install
npx expo start
```

If mobile lint is used:

```bash
npm run lint
```

Fix errors before push (warnings can be tracked separately).

---

## 11) End-to-End Test Checklist (Release Checklist)

### Web

1. Login
2. POS create transaction
3. Transaction Log shows transaction
4. Mark paid
5. Receipt: mark picked up, print, archive
6. Archive page shows archived item
7. Restore archived item
8. Unclaimed page loads and filters
9. Logout works

### Mobile

1. Login works with hosted API
2. Branch create works
3. Clerk assignment works
4. Dashboard charts load data
5. Clerk logs load data
6. Price list loads, create, edit, persists
7. Branch dashboard view shows branch-filtered records

---

## 12) Troubleshooting Guide

### A) CORS error / blocked by CORS

Check Render env:

- `CORS_ALLOWED_ORIGINS`
- `SANCTUM_STATEFUL_DOMAINS`
- exact frontend domain spelling must match

### B) Mixed content (HTTPS page trying HTTP API)

Ensure frontend env points to `https://...` backend URL.

### C) Render deploy fails on DB host

Use external DB hostname in `DB_HOST`.

### D) App works locally but not teammate laptop

Usually missing local env:

- `ReactJS/.env.local`
- `ReactNative/.env.local`

### E) Archive/Receipt/Unclaimed blank screen

1. Hard refresh browser (`Ctrl+Shift+R`)
2. Check console errors
3. Confirm latest commit deployed on Vercel/Render

---

## 13) Rollback / Recovery Procedure

If a bad deploy happens:

1. Identify last known good commit:

```bash
git log --oneline
```

2. Revert specific bad commit safely:

```bash
git revert <bad_commit_hash>
git push origin main
```

3. Wait for Render + Vercel redeploy.

Avoid force push on shared branch unless absolutely necessary and approved.

---

## 14) Notes for Cursor/AI Assistants

When using Cursor on teammate laptops, ask it to read this file first:

- `TEAM_PLAYBOOK.md`

Suggested prompt:

`Read TEAM_PLAYBOOK.md first and follow the safety and deployment procedures before making any changes.`

---

## 15) Ownership and Coordination

- Coordinate schema/API changes in team chat before merging.
- One person handles infra/deploy updates at a time.
- Everyone pulls latest before coding.
- Keep commits focused and descriptive.

---

Last updated with hosted deployment, web stability fixes, and mobile API integration.
