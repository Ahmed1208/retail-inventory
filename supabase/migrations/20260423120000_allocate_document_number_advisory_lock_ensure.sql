-- Idempotent re-apply: local DBs (or restores) may still have the broken
-- pg_advisory_xact_lock(842001, hashtextextended(...)) (int + bigint) form from an
-- older allocate_document_number. That breaks PO/order inserts during sync.

CREATE OR REPLACE FUNCTION public.allocate_document_number(p_scope text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v bigint;
  v_floor bigint := 0;
BEGIN
  IF p_scope IS NULL OR btrim(p_scope) = '' THEN
    RAISE EXCEPTION 'allocate_document_number: scope required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('allocate_document_number:' || p_scope, 0));

  IF p_scope = 'sales_order' THEN
    SELECT COALESCE(MAX(order_number), 0) INTO v_floor FROM public.orders;
  ELSIF p_scope = 'purchase_order' THEN
    SELECT COALESCE(MAX(order_number), 0) INTO v_floor FROM public.purchase_orders;
  ELSIF p_scope = 'inventory_transfer' THEN
    SELECT COALESCE(MAX(transfer_number), 0) INTO v_floor FROM public.inventory_transfers;
  END IF;

  INSERT INTO public.order_number_counters (scope, last_value)
  VALUES (p_scope, v_floor)
  ON CONFLICT (scope) DO UPDATE
  SET last_value = GREATEST(
    public.order_number_counters.last_value,
    EXCLUDED.last_value
  );

  UPDATE public.order_number_counters
  SET last_value = last_value + 1
  WHERE scope = p_scope
  RETURNING last_value INTO v;

  RETURN v;
END;
$$;

ALTER FUNCTION public.allocate_document_number(text) SET row_security TO off;

COMMENT ON FUNCTION public.allocate_document_number(text) IS
  'Atomically returns next document number; single-bigint advisory lock; syncs floor from live max.';

NOTIFY pgrst, 'reload schema';
