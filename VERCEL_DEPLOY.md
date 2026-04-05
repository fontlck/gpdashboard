# Vercel Deployment Guide — GP Dashboard

## Pre-flight: What Was Fixed for Production

Before deploying, the following production blockers were resolved:

| # | Issue | File | Severity |
|---|-------|------|----------|
| 1 | `React.CSSProperties` used without `import React` | `components/shared/StatusBadge.tsx` | 🔴 Build fail |
| 2 | `React.ReactNode` used without `import React` | `app/(admin)/admin/reports/[id]/page.tsx` | 🔴 Build fail |
| 3 | `React.ReactNode` used without `import React` | `app/(admin)/admin/settings/page.tsx` | 🔴 Build fail |
| 4 | `React.ReactNode` used without `import React` | `app/(partner)/dashboard/reports/[id]/page.tsx` | 🔴 Build fail |
| 5 | `React.ReactNode` used without `import React` | `app/(partner)/dashboard/account/page.tsx` | 🔴 Build fail |
| 6 | No `server-only` guard on service-role client | `lib/supabase/admin.ts` | 🟡 Security |
| 7 | `server-only` not in dependencies | `package.json` | 🟡 Security |
| 8 | Missing security response headers | `next.config.ts` | 🟡 Security |

---

## Step 1 — Push to GitHub

Create a GitHub repository and push the project:

```bash
cd gp-dashboard
git init
git add .
git commit -m "feat: GP Dashboard Sprint 1 scaffold"
# Create repo at github.com/new, then:
git remote add origin git@github.com:YOUR_USERNAME/gp-dashboard.git
git branch -M main
git push -u origin main
```

> **Important:** The `.env.local` file is gitignored. Do NOT commit it.
> Never commit `SUPABASE_SERVICE_ROLE_KEY` to the repository.

---

## Step 2 — Create a Vercel Project

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Click **Import Git Repository** → select `gp-dashboard`
3. Under **Framework Preset**, Vercel should auto-detect **Next.js** ✓
4. Leave **Root Directory** as `.` (default)
5. Leave **Build Command** as `next build` (default)
6. Leave **Output Directory** as `.next` (default)
7. **Do NOT click Deploy yet** — configure environment variables first (Step 3)

---

## Step 3 — Add Environment Variables in Vercel

In the Vercel project setup page, scroll to **Environment Variables**.
Add each variable below. Set **all three environments**: Production, Preview, Development.

### Variables to enter

| Variable Name | Value | Notes |
|---------------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pzwumotqnnmxnsrfjalz.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(the long JWT string from `.env.local.example`)* | Safe to expose — RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | *(from Supabase Dashboard → Settings → API → service_role)* | **Server-only. Never prefix with `NEXT_PUBLIC_`** |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-PROJECT.vercel.app` | Set after first deploy; use your actual Vercel URL |

> **Where to find the service role key:**
> Supabase Dashboard → Your Project → Settings (⚙️) → API → Project API Keys → `service_role`
> Click the eye icon to reveal it.

---

## Step 4 — First Deploy

Click **Deploy**. Vercel will:
1. Clone your repo
2. Run `npm install`
3. Run `next build` (TypeScript + ESLint check included)
4. Deploy to a `.vercel.app` URL

**Expected build time:** ~2–3 minutes.

If the build fails, check the Vercel build logs. The most common causes:
- Missing env variable → check Step 3
- TypeScript error → the 5 type fixes in this version resolve all known TS errors

---

## Step 5 — Configure Supabase for Production

### 5a. Add your Vercel URL to Supabase Auth

1. Supabase Dashboard → Your Project → **Authentication** → **URL Configuration**
2. **Site URL**: change from `http://localhost:3000` to `https://YOUR-PROJECT.vercel.app`
3. **Redirect URLs**: add `https://YOUR-PROJECT.vercel.app/auth/callback`
4. Also add `https://YOUR-PROJECT.vercel.app/**` as an additional redirect
5. Click **Save**

> Without this, Supabase will refuse to redirect back to your Vercel URL after magic links or OAuth.

### 5b. (Optional) Enable Email Auth Confirmations

1. Supabase Dashboard → Authentication → **Providers** → **Email**
2. If you want password-only auth (no email confirmation), disable **Confirm email**
3. This portal uses `signInWithPassword()` — email confirmation is not required for login but new signups will be held in `unconfirmed` state until confirmed unless you disable it

---

## Step 6 — Update `NEXT_PUBLIC_APP_URL` in Vercel

After your first deploy:
1. Copy your Vercel URL (e.g. `https://gp-dashboard-abc123.vercel.app`)
2. Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
3. Edit `NEXT_PUBLIC_APP_URL` → set to your Vercel URL
4. **Redeploy**: Deployments → ... → Redeploy (or push a new commit)

---

## Step 7 — Create Your Admin User

The auth trigger auto-creates all users as `role = 'partner'`. Promote yourself to admin:

**Via Supabase Dashboard:**
1. Authentication → Users → find your email → copy the UUID
2. Table Editor → `profiles` table → find the row with that UUID
3. Edit `role` column → change `partner` → `admin`
4. Save

**Via SQL Editor (faster):**
```sql
UPDATE profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'your@email.com'
);
```

---

## Step 8 — Post-Deploy Verification Checklist

Test these immediately after deploying:

### Auth
- [ ] Visit `https://YOUR-PROJECT.vercel.app` → should redirect to `/login`
- [ ] Log in as admin → should land on `/admin`
- [ ] Log in as partner → should land on `/dashboard`
- [ ] Visit `/admin` as a logged-out user → should redirect to `/login`
- [ ] Sign out → should return to `/login`
- [ ] Visit `/login` while logged in → should redirect to your dashboard (no login loop)

### Admin Dashboard
- [ ] `/admin` loads with KPI cards (values may be 0 if no data yet)
- [ ] `/admin/reports` shows empty state correctly
- [ ] `/admin/branches` shows your branches (if seeded)
- [ ] `/admin/partners` shows your partners (if seeded)
- [ ] `/admin/settings` shows VAT rate `7%`, currency `THB`, max rows `50,000`
- [ ] `/admin/audit` shows empty state

### Partner Dashboard
- [ ] Partner user can log in and see `/dashboard`
- [ ] PartnershipHero renders (shows new-partner state if no `partnership_start_date` set yet)
- [ ] `/dashboard/account` shows profile info

### Security
- [ ] Open browser DevTools → Network → check response headers on any page
  - Should include: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- [ ] Partner cannot access `/admin/*` (try directly in browser — should redirect)
- [ ] Admin cannot access `/dashboard/*` (try directly — should redirect)

---

## Vercel Project Settings Reference

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Node.js Version | 20.x (Vercel default) |
| Build Command | `next build` |
| Output Directory | `.next` |
| Install Command | `npm install` |
| Root Directory | `.` |

### Optional Custom Domain
Vercel Dashboard → Your Project → **Settings** → **Domains** → Add domain

After adding a custom domain, update:
- `NEXT_PUBLIC_APP_URL` in Vercel env vars
- Supabase Auth **Site URL** and **Redirect URLs**

---

## Known Risks & Follow-up Fixes

### Sprint 2 (before going live with real data)
- `SUPABASE_SERVICE_ROLE_KEY` must be set — currently only used by `createAdminClient()` (Sprint 2 CSV import), but the guard will throw at runtime if a request ever reaches that code path without the key set.

### Supabase Row Level Security verification
- Test via Supabase Table Editor with a partner user's JWT. RLS policies were applied in migration `006`, but always verify in production that:
  - Partners cannot read other partners' `monthly_reports`
  - Partners cannot read `audit_logs` or `csv_uploads`

### Preview deployments
- Vercel creates preview deployments for every PR. These will also use the Supabase production database unless you create a Supabase branch (Supabase branching is a paid feature).
- If you want to prevent preview deployments from hitting production data, either: restrict env vars to `Production` environment only, or use Supabase database branching.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY` rotation
- If you ever rotate the Supabase anon key, update it in Vercel env vars and redeploy.
- The current anon key has no expiry (it's a JWT with far-future `exp`).

---

*Deployment guide for GP Dashboard Sprint 1 — April 2026*
