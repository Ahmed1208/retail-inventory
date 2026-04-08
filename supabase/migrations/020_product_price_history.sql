-- Append-only price snapshots when catalog prices change (see productService).

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  customer_price numeric(10, 2) NOT NULL DEFAULT 0,
  business_price numeric(10, 2) NOT NULL DEFAULT 0,
  cost_price numeric(10, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT product_price_history_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS product_price_history_product_recorded_idx
  ON public.product_price_history (product_id, recorded_at DESC);

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.product_price_history
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Baseline row per product from current catalog (safe to re-run: skips products that already have a row).
INSERT INTO public.product_price_history (
  product_id,
  recorded_at,
  customer_price,
  business_price,
  cost_price
)
SELECT
  p.id,
  COALESCE(p.updated_at, p.created_at, now()),
  p.customer_price,
  p.business_price,
  COALESCE(p.cost_price, 0)
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_price_history h
  WHERE h.product_id = p.id
);
