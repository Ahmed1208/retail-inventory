-- PO-level and line-level discounts (aligned with sales orders: subtotal → order % → total).

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_rate numeric(10,2) NOT NULL DEFAULT 0;

-- Legacy rows: no historical line/order discount; subtotal equals stored total.
UPDATE public.purchase_orders
SET
  subtotal = total_amount,
  discount_amount = 0,
  discount_rate = 0;

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS line_discount_rate numeric(10,2) NOT NULL DEFAULT 0;
