-- assign_order_document_number is BEFORE INSERT only. Sync upserts often hit ON CONFLICT
-- UPDATE, which would otherwise apply payload order_number and can violate UNIQUE(order_number)
-- against another row. Preserve the existing number on UPDATE.

CREATE OR REPLACE FUNCTION public.preserve_document_order_number_on_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.order_number IS NOT NULL THEN
    NEW.order_number := OLD.order_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_preserve_order_number ON public.orders;
CREATE TRIGGER trg_orders_preserve_order_number
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_document_order_number_on_update();

DROP TRIGGER IF EXISTS trg_purchase_orders_preserve_order_number ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_preserve_order_number
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_document_order_number_on_update();

COMMENT ON FUNCTION public.preserve_document_order_number_on_update() IS
  'Keeps order_number unchanged on UPDATE so sync upserts cannot duplicate another document number.';

NOTIFY pgrst, 'reload schema';
