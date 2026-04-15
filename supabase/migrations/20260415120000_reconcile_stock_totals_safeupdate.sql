-- Hosted enables pg-safeupdate: UPDATE must include a WHERE clause.
-- Same semantics as before (all product rows are updated).

CREATE OR REPLACE FUNCTION public.reconcile_product_stock_totals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products p
  SET
    quantity = COALESCE(
      (
        SELECT SUM(s.quantity)::integer
        FROM public.product_warehouse_stock s
        WHERE s.product_id = p.id
      ),
      0
    ),
    updated_at = now()
  WHERE p.id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_product_stock_totals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_product_stock_totals() TO authenticated;

COMMENT ON FUNCTION public.reconcile_product_stock_totals() IS
  'Sets products.quantity to the sum of product_warehouse_stock for each product.';

NOTIFY pgrst, 'reload schema';
