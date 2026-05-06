-- ══════════════════════════════════════════════════════════════════════════════
-- Add organization_id to monthly_reports
-- Missed in the initial multi-tenant migration
-- ══════════════════════════════════════════════════════════════════════════════

-- Add column (nullable first for safe backfill)
ALTER TABLE monthly_reports ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Backfill from branches
UPDATE monthly_reports mr
SET organization_id = b.organization_id
FROM branches b
WHERE mr.branch_id = b.id
  AND mr.organization_id IS NULL;

-- Make NOT NULL
ALTER TABLE monthly_reports ALTER COLUMN organization_id SET NOT NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_monthly_reports_org ON monthly_reports (organization_id);
