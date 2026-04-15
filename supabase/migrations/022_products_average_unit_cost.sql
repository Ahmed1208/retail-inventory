-- Weighted average unit cost for on-hand inventory (updated on receipts with unit cost).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS average_unit_cost numeric(10, 2) NULL;

COMMENT ON COLUMN public.products.average_unit_cost IS
  'Moving weighted average cost of current quantity; updated on stock-in with inbound unit cost; cleared when quantity hits zero.';

UPDATE public.products
SET average_unit_cost = cost_price
WHERE quantity > 0
  AND average_unit_cost IS NULL;
