-- Payment method on each balance_transactions row (cash, card, transfer, other).
-- Required for split payments, All payments filters, and the Method column in the UI.
-- Apply: `supabase db push` (or run this SQL in the Supabase SQL editor).

alter table balance_transactions
  add column if not exists payment_method text;
