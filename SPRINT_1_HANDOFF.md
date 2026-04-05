# Sprint 1 Handoff — GP Dashboard

## 1. Folder Structure

```
gp-dashboard/
├── app/
│   ├── (admin)/
│   │   └── admin/
│   │       ├── layout.tsx              ← Auth guard (admin role) + AdminSidebar
│   │       ├── page.tsx                ← Overview: KPI cards + recent reports
│   │       ├── audit/page.tsx          ← Audit log (200 most recent events)
│   │       ├── branches/page.tsx       ← Branch list with rev-share & start dates
│   │       ├── partners/page.tsx       ← Partner cards with branch counts
│   │       ├── refunds/page.tsx        ← Refund ledger with report linkage
│   │       ├── reports/
│   │       │   ├── page.tsx            ← All reports table
│   │       │   └── [id]/page.tsx       ← Report detail: financial + artist breakdown
│   │       ├── settings/page.tsx       ← VAT rate, currency, CSV limit (read-only)
│   │       ├── upload/page.tsx         ← CSV upload placeholder (Sprint 2)
│   │       └── users/page.tsx          ← User list with role badges
│   ├── (auth)/
│   │   ├── layout.tsx                  ← Minimal centered layout for auth pages
│   │   └── login/page.tsx              ← Email/password sign-in form
│   ├── (partner)/
│   │   └── dashboard/
│   │       ├── layout.tsx              ← Auth guard (partner role) + PartnershipHero + PartnerSidebar
│   │       ├── page.tsx                ← Overview: KPI cards + reports table
│   │       ├── account/page.tsx        ← Profile + partner details + branches
│   │       └── reports/[id]/page.tsx   ← Report detail (partner-safe view)
│   ├── auth/callback/route.ts          ← Magic-link / OAuth exchange handler
│   ├── globals.css                     ← Design tokens, fonts, global resets
│   ├── layout.tsx                      ← Root HTML shell (DM Sans + Prompt fonts)
│   └── page.tsx                        ← Root redirect (→ /login)
│
├── components/
│   ├── admin/
│   │   ├── AdminHeader.tsx             ← Page title + subtitle + actions slot
│   │   └── AdminSidebar.tsx            ← 9-item nav + sign-out (client component)
│   ├── partner/
│   │   ├── PartnerSidebar.tsx          ← 3-item nav + sign-out (client component)
│   │   └── PartnershipHero.tsx         ← Premium duration display with stat chips
│   └── shared/
│       ├── EmptyState.tsx              ← Icon + title + description empty placeholder
│       ├── KpiCard.tsx                 ← Stat card with accent color variants
│       ├── LoadingSpinner.tsx          ← Gold spinning ring
│       └── StatusBadge.tsx             ← Pill badge for report statuses
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   ← Browser client (Client Components)
│   │   ├── server.ts                   ← Server client with Next.js cookies()
│   │   └── admin.ts                    ← Service-role client (bypasses RLS)
│   ├── types/
│   │   └── database.types.ts           ← Auto-generated Supabase types + aliases
│   └── utils/
│       ├── cn.ts                       ← clsx + tailwind-merge helper
│       ├── currency.ts                 ← formatTHB, roundHalfUp, parseMoneyValue
│       └── date.ts                     ← formatReportingPeriod, calculatePartnershipDuration
│
├── middleware.ts                        ← Route protection + role-based redirects
├── tailwind.config.ts                  ← Custom colors, shadows, animations, fonts
├── .env.local.example                  ← Required environment variable template
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

---

## 2. SQL Migrations Applied (Supabase project: pzwumotqnnmxnsrfjalz)

| # | File | Tables Created |
|---|------|----------------|
| 001 | extensions_settings_partners_branches | `settings`, `partners`, `branches` |
| 002 | profiles_and_auth_trigger | `profiles`, `handle_new_user()` trigger |
| 003 | csv_uploads_monthly_reports_report_rows | `csv_uploads`, `monthly_reports`, `report_rows` |
| 004 | artist_summaries_refunds_audit_logs | `artist_summaries`, `refunds`, `audit_logs` |
| 005 | updated_at_triggers | `handle_updated_at()` applied to 7 tables |
| 006 | rls_policies | All RLS policies for 10 tables |
| 007 | seed_settings | `vat_rate=0.07`, `system_currency=THB`, `csv_max_rows=50000` |

**Total tables:** `settings`, `partners`, `branches`, `profiles`, `csv_uploads`, `monthly_reports`, `report_rows`, `artist_summaries`, `refunds`, `audit_logs`

---

## 3. RLS Policy Summary

### Helper functions
- `is_admin()` — Returns `TRUE` if the calling user's profile has `role = 'admin'`
- `get_my_partner_id()` — Returns the `partner_id` from the calling user's profile

### Policy matrix

| Table | Admin can | Partner can |
|-------|-----------|-------------|
| `settings` | SELECT | SELECT (read-only) |
| `partners` | ALL | SELECT own record only |
| `branches` | ALL | SELECT where `partner_id = get_my_partner_id()` |
| `profiles` | ALL | SELECT & UPDATE own row only |
| `csv_uploads` | ALL | — (no access) |
| `monthly_reports` | ALL | SELECT where branch belongs to their partner |
| `report_rows` | ALL | SELECT where report's branch belongs to their partner |
| `artist_summaries` | ALL | SELECT where report's branch belongs to their partner |
| `refunds` | ALL | SELECT where report's branch belongs to their partner |
| `audit_logs` | ALL | — (no access) |

---

## 4. Auth Flow Summary

```
User visits any protected route
       ↓
middleware.ts runs createServerClient with cookies
       ↓
supabase.auth.getUser() called (validates JWT with Supabase)
       ↓
No session?  → redirect /login
       ↓ (session exists)
Fetch profile.role from 'profiles' table
       ↓
role = 'admin'   → allow /admin/**, redirect /dashboard → /admin
role = 'partner' → allow /dashboard/**, redirect /admin → /dashboard
       ↓
Page renders as Server Component
Server client created fresh per request via createClient()
All DB queries run under the user's JWT — RLS enforced automatically
```

**Auth trigger:** When any new user signs up via Supabase Auth, `handle_new_user()` automatically inserts a row into `profiles` with `role = 'partner'` (default). Admin roles must be set manually in Supabase until a UI for this is built.

**Service role client (`admin.ts`):** Used only in server-side import jobs (Sprint 2). Bypasses RLS. Never exposed to the browser.

---

## 5. Route Structure

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Redirects to `/login` |
| `/login` | Public | Email/password sign-in |
| `/auth/callback` | Public | Magic-link / OAuth code exchange |
| `/admin` | Admin only | Overview dashboard |
| `/admin/reports` | Admin only | All reports list |
| `/admin/reports/[id]` | Admin only | Full report detail |
| `/admin/upload` | Admin only | CSV upload (Sprint 2 placeholder) |
| `/admin/branches` | Admin only | Branch management |
| `/admin/partners` | Admin only | Partner management |
| `/admin/users` | Admin only | User list |
| `/admin/refunds` | Admin only | Refund ledger |
| `/admin/audit` | Admin only | Audit log |
| `/admin/settings` | Admin only | System settings (read-only) |
| `/dashboard` | Partner only | Partner overview + KPIs |
| `/dashboard/reports/[id]` | Partner only | Report detail (own data) |
| `/dashboard/account` | Partner only | Profile + partner + branches |

---

## 6. Environment Variables Required

Copy `.env.local.example` to `.env.local` and fill in:

```bash
# Supabase — from Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://pzwumotqnnmxnsrfjalz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon/public key>

# Service role — NEVER expose to browser
# Required for Sprint 2 CSV import (admin.ts)
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
```

**Where to find them:** Supabase Dashboard → Project → Settings → API

---

## 7. What to Test Locally

### Setup
```bash
cd gp-dashboard
npm install
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
# Open http://localhost:3000
```

### Auth flows
- [ ] Visit `/` — should redirect to `/login`
- [ ] Log in with an admin account → should land on `/admin`
- [ ] Log in with a partner account → should land on `/dashboard`
- [ ] Try visiting `/admin` as a partner → should redirect to `/dashboard`
- [ ] Try visiting `/dashboard` as an admin → should redirect to `/admin`
- [ ] Sign out from either sidebar → should return to `/login`
- [ ] Visit `/login` while already logged in → should redirect to role dashboard

### Admin pages
- [ ] `/admin` — KPI cards load (Active Branches, Pending, Payouts Due, Total Reports)
- [ ] `/admin/reports` — table renders; empty state shows if no reports exist
- [ ] `/admin/reports/[id]` — full financial breakdown, artist table, refund panel
- [ ] `/admin/branches` — branch list with revenue share percentages
- [ ] `/admin/partners` — partner cards with branch pills
- [ ] `/admin/users` — user list with role badges
- [ ] `/admin/refunds` — refund ledger (empty state if none)
- [ ] `/admin/audit` — audit log (empty state if no events)
- [ ] `/admin/settings` — reads VAT rate, currency, CSV limit from DB
- [ ] `/admin/upload` — placeholder page renders without errors

### Partner pages
- [ ] `/dashboard` — PartnershipHero renders at top; KPI cards and reports table below
- [ ] Partnership hero shows duration chips if `partnership_start_date` is set on branch
- [ ] Partnership hero shows graceful new-partner state if start date is null
- [ ] `/dashboard/reports/[id]` — renders own reports; 404 for reports from other partners
- [ ] `/dashboard/account` — shows profile, partner details, branches table

### RLS verification (via Supabase dashboard or Table Editor)
- [ ] Partner user JWT cannot read `csv_uploads` or `audit_logs`
- [ ] Partner user JWT cannot read `monthly_reports` from a different partner's branches

---

## 8. Recommended Sprint 2 Next Steps

### Priority 1 — CSV Import Pipeline (core product)
Implement the full 5-phase import flow behind `/admin/upload`:

1. **Validate** — parse CSV, check headers, count rows (≤50k), reject non-THB, check date range
2. **Map branches** — match `branchName (metadata)` to `branches.name` (case-insensitive); present unmapped names for admin to resolve via dropdown
3. **Preview** — show per-branch aggregates (gross, net, transaction count) before committing
4. **Import** — write `report_rows` (skip duplicate `charge_id` per report), upsert `monthly_reports`, aggregate `artist_summaries`
5. **Confirm** — mark `csv_upload.status = 'imported'`, set `partnership_start_date` from earliest transaction if not already set (source = 'csv_derived'), write audit log event

Key utilities needed:
- `lib/csv/parse.ts` — PapaParse wrapper, column normaliser, row-level validator
- `lib/csv/financial.ts` — per-branch aggregator, roundHalfUp applied to each numeric field
- `app/api/upload/route.ts` — streaming multipart handler using admin client

### Priority 2 — Report lifecycle actions
- **Approve** button on `/admin/reports/[id]` → sets `status = 'pending_review'` then `approved`
- **Mark Paid** → sets `status = 'paid'`, records `paid_at`
- **Recalculate** → re-runs financial formulas using current snapshots, updates report, writes audit event
- **Add Refund** modal on admin refunds page

### Priority 3 — Partner portal enhancements
- Payout history chart (gross/net/payout over time) using Recharts
- PDF payout statement generation per report (for accounting)
- Email notifications on report approval / payment

### Priority 4 — Operations
- Invite flow for partner user creation (magic link + partner_id pre-assignment)
- Admin UI for editing settings (VAT rate, etc.)
- Pagination on audit log, reports list
- Branch partnership_start_date edit UI in admin branches page

---

*Sprint 1 completed: April 2026. Supabase project: `pzwumotqnnmxnsrfjalz`. Next.js 15 / React 19.*
