-- 1) Historical / sync rows may reuse an order_number already on cloud (CSV import,
--    merged devices). Re-assign via allocate when taken, under the same advisory lock
--    as allocate_document_number to avoid parallel INSERT races.
-- 2) Preserve order_number on every UPDATE so a NULL OLD.order_number cannot let
--    PostgREST upsert apply a payload number that collides with another row.

CREATE OR REPLACE FUNCTION public.preserve_document_order_number_on_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.order_number := OLD.order_number;
  RETURN NEW;
END;
$$;

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

  IF COALESCE(NEW.is_historical_snapshot, false) AND NEW.order_number IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('allocate_document_number:' || v_scope, 0));

    IF TG_TABLE_NAME = 'orders' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.orders o WHERE o.order_number = NEW.order_number
      ) INTO v_busy;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.purchase_orders o WHERE o.order_number = NEW.order_number
      ) INTO v_busy;
    END IF;

    IF v_busy THEN
      NEW.order_number := public.allocate_document_number(v_scope)::integer;
    END IF;

    RETURN NEW;
  END IF;

  NEW.order_number := public.allocate_document_number(v_scope)::integer;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assign_order_document_number() IS
  'INSERT: non-historical always allocate; historical keeps number if free else allocate. row_security off for collision visibility.';

COMMENT ON FUNCTION public.preserve_document_order_number_on_update() IS
  'Always keeps order_number from OLD on UPDATE so sync upserts cannot change or inject duplicates.';

NOTIFY pgrst, 'reload schema';
