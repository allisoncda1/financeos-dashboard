-- Preserve exact QuickBooks Chart of Accounts metadata.
ALTER TABLE bank_transaction_qbo_lines
  ADD COLUMN IF NOT EXISTS coa_account_fully_qualified_name TEXT,
  ADD COLUMN IF NOT EXISTS coa_account_subtype TEXT,
  ADD COLUMN IF NOT EXISTS coa_account_classification TEXT;
