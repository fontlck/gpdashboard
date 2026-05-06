-- ══════════════════════════════════════════════════════════════════════════════
-- Create Org 2 — Font's Dashboard (Non-VAT)
-- Run AFTER 20260506_multi_tenant.sql
-- Run AFTER creating user "font" via Supabase Auth > Users > Invite user
--   Email: font.uddi@gmail.com  (or your preferred email)
--   Then copy the new user's UUID from auth.users and replace <FONT_USER_UUID>
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Insert Org 2 ───────────────────────────────────────────────────────────

INSERT INTO organizations (name, slug, is_vat)
VALUES ('Font''s Dashboard', 'fonts-dashboard', false)
ON CONFLICT (slug) DO NOTHING;


-- ── 2. Add font user to Org 2 ─────────────────────────────────────────────────
-- Replace <FONT_USER_UUID> with the actual UUID from Supabase Auth > Users

DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID := '<FONT_USER_UUID>';   -- ← replace this
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'fonts-dashboard';

  -- Create profile if not exists
  INSERT INTO profiles (id, full_name, role, is_active)
  VALUES (v_user_id, 'Font', 'admin', true)
  ON CONFLICT (id) DO NOTHING;

  -- Add membership
  INSERT INTO org_memberships (user_id, organization_id, role)
  VALUES (v_user_id, v_org_id, 'admin')
  ON CONFLICT (user_id, organization_id) DO NOTHING;
END $$;


-- ── Verify ────────────────────────────────────────────────────────────────────
-- SELECT * FROM organizations;
-- SELECT om.*, p.full_name FROM org_memberships om JOIN profiles p ON p.id = om.user_id;
