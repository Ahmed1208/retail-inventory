-- Sync run history + optional RPCs for cloud-master post-push steps.

CREATE OR REPLACE FUNCTION public.current_user_can_data_sync()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_operator_admin()
  OR COALESCE(
    (
      SELECT (p.feature_overrides ->> 'admin.dataSync')::boolean
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_data_sync() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_data_sync() TO authenticated;

COMMENT ON FUNCTION public.current_user_can_data_sync() IS
  'True if operator admin or profile feature_overrides enables admin.dataSync.';

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error', 'cancelled')),
  initiator_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  device_label text,
  mode text NOT NULL DEFAULT 'bidirectional',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text
);

CREATE INDEX IF NOT EXISTS sync_runs_started_at_idx ON public.sync_runs (started_at DESC);

COMMENT ON TABLE public.sync_runs IS
  'Audit log for Admin data sync runs (local and cloud instances each have their own rows when inserted).';

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_runs_select ON public.sync_runs;
CREATE POLICY sync_runs_select
  ON public.sync_runs
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_data_sync());

DROP POLICY IF EXISTS sync_runs_insert ON public.sync_runs;
CREATE POLICY sync_runs_insert
  ON public.sync_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    initiator_user_id = auth.uid()
    AND public.current_user_can_data_sync()
  );

-- Reassign duplicate sales order numbers (keep earliest row per number; bump the rest).
CREATE OR REPLACE FUNCTION public.repair_duplicate_order_numbers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      order_number,
      row_number() OVER (
        PARTITION BY order_number
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM public.orders
  ),
  to_fix AS (
    SELECT id FROM ranked WHERE rn > 1
  )
  UPDATE public.orders o
  SET
    order_number = nextval('public.orders_order_number_seq'::regclass),
    updated_at = now()
  FROM to_fix t
  WHERE o.id = t.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_duplicate_order_numbers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_duplicate_order_numbers() TO authenticated;

COMMENT ON FUNCTION public.repair_duplicate_order_numbers() IS
  'Fixes UNIQUE(order_number) collisions by assigning new sequence values to all but the oldest row per number.';

CREATE OR REPLACE FUNCTION public.repair_duplicate_purchase_order_numbers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      order_number,
      row_number() OVER (
        PARTITION BY order_number
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM public.purchase_orders
  ),
  to_fix AS (
    SELECT id FROM ranked WHERE rn > 1
  )
  UPDATE public.purchase_orders po
  SET
    order_number = nextval('public.purchase_orders_order_number_seq'::regclass),
    updated_at = now()
  FROM to_fix t
  WHERE po.id = t.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_duplicate_purchase_order_numbers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_duplicate_purchase_order_numbers() TO authenticated;

-- v1 reconciliation: align products.quantity with sum of per-warehouse stock.
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
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_product_stock_totals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_product_stock_totals() TO authenticated;

COMMENT ON FUNCTION public.reconcile_product_stock_totals() IS
  'Sets products.quantity to the sum of product_warehouse_stock for each product.';

NOTIFY pgrst, 'reload schema';
