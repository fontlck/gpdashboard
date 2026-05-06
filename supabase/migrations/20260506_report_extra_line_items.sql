-- ══════════════════════════════════════════════════════════════════════════════
-- Add optional extra line items to monthly_reports
--   compensation_amount / _note   — extra payment added to partner
--   service_fee_amount / _note    — extra payment, optional 3% WHT
--   service_fee_wht               — whether to deduct 3% WHT on service fee
--   fee_deduction_amount / _note  — amount deducted from partner payout
-- All are optional (nullable), admin enters final amounts directly (VAT-inclusive)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS compensation_amount   NUMERIC,
  ADD COLUMN IF NOT EXISTS compensation_note     TEXT,
  ADD COLUMN IF NOT EXISTS service_fee_amount    NUMERIC,
  ADD COLUMN IF NOT EXISTS service_fee_note      TEXT,
  ADD COLUMN IF NOT EXISTS service_fee_wht       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_deduction_amount  NUMERIC,
  ADD COLUMN IF NOT EXISTS fee_deduction_note    TEXT;
