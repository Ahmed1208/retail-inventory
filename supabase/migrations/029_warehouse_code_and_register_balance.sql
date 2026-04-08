-- Human-readable warehouse codes (e.g. NASR-CITY-01) + ensure default row has code.

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS code text;

UPDATE public.warehouses
SET code = CASE
  WHEN id = 1 THEN 'DEFAULT-01'
  ELSE 'WH-' || LPAD(id::text, 4, '0')
END
WHERE code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS warehouses_code_unique
  ON public.warehouses (code);

ALTER TABLE public.warehouses
  ALTER COLUMN code SET NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_default_warehouse()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.warehouses (id, name, location, is_default, has_register, code)
  VALUES (1, 'default', NULL, true, true, 'DEFAULT-01')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.warehouses SET has_register = true WHERE id = 1;

  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE is_default = true) THEN
    UPDATE public.warehouses SET is_default = false WHERE is_default = true;
    UPDATE public.warehouses SET is_default = true WHERE id = 1;
  END IF;

  UPDATE public.warehouses SET has_register = true WHERE is_default = true;

  PERFORM setval(
    pg_get_serial_sequence('public.warehouses', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.warehouses), 1)
  );

  INSERT INTO public.product_warehouse_stock (product_id, warehouse_id, quantity)
  SELECT p.id, 1, GREATEST(0, COALESCE(p.quantity, 0)::integer)
  FROM public.products p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.product_warehouse_stock s
    WHERE s.product_id = p.id AND s.warehouse_id = 1
  );

  UPDATE public.orders o
  SET warehouse_id = 1
  WHERE NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = o.warehouse_id);

  UPDATE public.purchase_orders po
  SET warehouse_id = 1
  WHERE NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = po.warehouse_id);

  UPDATE public.stock_movements sm
  SET warehouse_id = 1
  WHERE NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = sm.warehouse_id);

  UPDATE public.warehouses SET has_register = true WHERE id = 1;
  UPDATE public.warehouses SET has_register = true WHERE is_default = true;
END;
$$;
