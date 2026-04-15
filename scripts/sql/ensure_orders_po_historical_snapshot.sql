-- Idempotent fix for historical CSV import (run in Supabase SQL Editor if CLI push is unavailable).
-- Same as supabase/migrations/032 + NOTIFY (see also 033).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_historical_snapshot boolean NOT NULL DEFAULT false;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS is_historical_snapshot boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
