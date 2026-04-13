-- Keep client-supplied order_number on INSERT when it does not collide (local → cloud sync).
-- If null or taken, use allocate_document_number (POS inserts, conflicts).

CREATE OR REPLACE FUNCTION public.assign_order_document_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_scope text;
  v_busy boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'orders' THEN
    v_scope := 'sales_order';
  ELSIF TG_TABLE_NAME = 'purchase_orders' THEN
    v_scope := 'purchase_order';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('allocate_document_number:' || v_scope, 0));

  IF NEW.order_number IS NOT NULL THEN
    IF TG_TABLE_NAME = 'orders' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.orders o WHERE o.order_number = NEW.order_number
      ) INTO v_busy;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.purchase_orders o WHERE o.order_number = NEW.order_number
      ) INTO v_busy;
    END IF;

    IF NOT v_busy THEN
      RETURN NEW;
    END IF;
  END IF;

  NEW.order_number := public.allocate_document_number(v_scope)::integer;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assign_order_document_number() IS
  'INSERT: keep NEW.order_number when non-null and unused; else allocate. row_security off for collision visibility.';

NOTIFY pgrst, 'reload schema';
