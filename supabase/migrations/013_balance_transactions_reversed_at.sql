-- Mark original ledger rows as reversed; supports idempotent payment reversal flow.

alter table public.balance_transactions
  add column if not exists reversed_at timestamptz;

create index if not exists balance_transactions_reversed_at_idx
  on public.balance_transactions (reversed_at)
  where reversed_at is not null;

notify pgrst, 'reload schema';
