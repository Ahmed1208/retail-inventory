-- CSV / backfill: completed-looking documents that must not drive stock, register, or ledger.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_historical_snapshot boolean NOT NULL DEFAULT false;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS is_historical_snapshot boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.is_historical_snapshot IS
  'When true, order is analysis-only import: no stock/register/ledger; confirm/complete/cancel blocked in app.';
COMMENT ON COLUMN public.purchase_orders.is_historical_snapshot IS
  'When true, PO is analysis-only import: no stock/register/ledger; confirm/receive/cancel blocked in app.';

-- PostgREST schema cache (avoids "Could not find ... in the schema cache" until refresh).
NOTIFY pgrst, 'reload schema';
