-- Optional full catalog price update from PO lines (retail/wholesale + cost) and rollback snapshots.

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS catalog_customer_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS catalog_business_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS previous_customer_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS previous_business_price numeric(10, 2);
