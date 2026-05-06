-- ══════════════════════════════════════════════════════════════════════════════
-- Multi-tenant migration — GP Dashboard
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Safe to run: all existing data is preserved and assigned to Org 1
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Organizations table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  slug         TEXT        NOT NULL UNIQUE,
  is_vat       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── 2. Org memberships table ──────────────────────────────────────────────────
-- Maps users → organizations with a role per org.
-- A user can belong to multiple orgs (e.g. superadmin).

CREATE TABLE IF NOT EXISTS org_memberships (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'partner')),
  partner_id      UUID        REFERENCES partners(id),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);


-- ── 3. Add organization_id columns (nullable first for safe backfill) ─────────

ALTER TABLE branches     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE partners     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE csv_uploads  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE settings     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE audit_logs   ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);


-- ── 4. Insert Org 1 — existing VAT dashboard ─────────────────────────────────

INSERT INTO organizations (id, name, slug, is_vat)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'GP Dashboard',
  'gp-dashboard',
  true
)
ON CONFLICT (id) DO NOTHING;


-- ── 5. Backfill all existing data → Org 1 ────────────────────────────────────

UPDATE branches    SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE partners    SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE csv_uploads SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE settings    SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE audit_logs  SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;


-- ── 6. Make NOT NULL after backfill ──────────────────────────────────────────

ALTER TABLE branches    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE partners    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE csv_uploads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE settings    ALTER COLUMN organization_id SET NOT NULL;
-- audit_logs: keep nullable (old logs won't have it)


-- ── 7. Migrate existing profiles → org_memberships ───────────────────────────

INSERT INTO org_memberships (user_id, organization_id, role, partner_id)
SELECT
  p.id,
  '00000000-0000-0000-0000-000000000001',
  p.role,
  p.partner_id
FROM profiles p
ON CONFLICT (user_id, organization_id) DO NOTHING;


-- ── 8. Indexes for performance ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_branches_org    ON branches    (organization_id);
CREATE INDEX IF NOT EXISTS idx_partners_org    ON partners    (organization_id);
CREATE INDEX IF NOT EXISTS idx_csv_uploads_org ON csv_uploads (organization_id);
CREATE INDEX IF NOT EXISTS idx_settings_org    ON settings    (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org  ON audit_logs  (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org  ON org_memberships (organization_id);


-- ── 9. RLS — organizations ────────────────────────────────────────────────────

ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY;

-- Anyone can read orgs they belong to
CREATE POLICY "members can read their orgs"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM org_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only service_role (admin client) can insert/update orgs
CREATE POLICY "service role manages orgs"
  ON organizations FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read their own memberships
CREATE POLICY "users read own memberships"
  ON org_memberships FOR SELECT
  USING (user_id = auth.uid());

-- Service role manages all memberships
CREATE POLICY "service role manages memberships"
  ON org_memberships FOR ALL
  USING (auth.role() = 'service_role');


-- ── 10. Helper function: get current org for the logged-in user ───────────────
-- Returns the org_id stored in the JWT app_metadata claim (set at login).
-- Falls back to querying org_memberships if the claim is absent.

CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT organization_id
  FROM   org_memberships
  WHERE  user_id   = auth.uid()
    AND  is_active = true
  LIMIT  1;
$$;


-- ── Done ──────────────────────────────────────────────────────────────────────
-- Verify with:
--   SELECT * FROM organizations;
--   SELECT count(*) FROM branches WHERE organization_id IS NULL;  -- should be 0
--   SELECT count(*) FROM partners WHERE organization_id IS NULL;  -- should be 0
--   SELECT * FROM org_memberships;
