-- Ensure the primary inventory location (id 1) and any default warehouse always host a register.
-- Repairs rows created before register flags or if flags were cleared incorrectly.

UPDATE public.warehouses SET has_register = true WHERE id = 1;

UPDATE public.warehouses
SET has_register = true
WHERE is_default = true AND (has_register IS DISTINCT FROM true);

-- Strengthen RPC: always re-apply after other repairs (covers any code path that omitted the flag).
CREATE OR REPLACE FUNCTION public.ensure_default_warehouse()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.warehouses (id, name, location, is_default, has_register)
  VALUES (1, 'default', NULL, true, true)
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
