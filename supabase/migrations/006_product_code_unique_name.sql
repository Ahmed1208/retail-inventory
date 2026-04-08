-- Human-readable product code (unique). UUID id remains the primary key for FKs.
-- Unique product names (case-insensitive, trimmed).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_code text;

-- Backfill existing rows
UPDATE public.products
SET product_code = 'AUTO-' || upper(substring(replace(id::text, '-', ''), 1, 10))
WHERE product_code IS NULL OR trim(product_code) = '';

ALTER TABLE public.products
  ALTER COLUMN product_code SET NOT NULL;

-- Resolve duplicate names before unique index (keep oldest per normalized name)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(trim(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.products
)
UPDATE public.products p
SET name = trim(p.name) || ' — ' || substring(p.id::text, 1, 8)
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS products_product_code_lower_unique
  ON public.products (lower(trim(product_code)));

CREATE UNIQUE INDEX IF NOT EXISTS products_name_lower_unique
  ON public.products (lower(trim(name)));
