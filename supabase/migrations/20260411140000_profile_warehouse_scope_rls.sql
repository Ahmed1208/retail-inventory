-- Warehouse-scoped operators: profiles.allowed_warehouse_ids + RLS on warehouse-scoped tables.
-- Runs after 20260411134123_remote_schema.sql (replaces permissive policies recreated there).
-- Empty array = no warehouse access for non-admins. Admins bypass via current_user_is_operator_admin().
-- Existing non-admins are backfilled with all warehouse ids so they are not locked out.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_warehouse_ids bigint[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.allowed_warehouse_ids IS
  'Warehouses this operator may access (orders, stock, transfers, etc.). Empty = none for non-admins. Admins ignore this for RLS.';

-- Backfill: non-admin operators get all current warehouses
UPDATE public.profiles p
SET allowed_warehouse_ids = sub.ids
FROM (
  SELECT COALESCE(array_agg(w.id ORDER BY w.id), '{}'::bigint[]) AS ids
  FROM public.warehouses w
) sub
WHERE p.is_admin IS NOT TRUE
  AND (p.allowed_warehouse_ids IS NULL OR cardinality(p.allowed_warehouse_ids) = 0);

-- -----------------------------------------------------------------------------
-- RLS helpers (SECURITY DEFINER; avoid recursion on profiles)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_may_access_warehouse(p_warehouse_id bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_is_operator_admin() THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(cardinality(p.allowed_warehouse_ids), 0) > 0
      AND p_warehouse_id = ANY (p.allowed_warehouse_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_may_access_warehouse(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_may_access_warehouse(bigint) TO authenticated;

COMMENT ON FUNCTION public.current_user_may_access_warehouse(bigint) IS
  'True if operator admin, or non-admin with non-empty allowed_warehouse_ids containing p_warehouse_id.';

CREATE OR REPLACE FUNCTION public.current_user_may_access_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND public.current_user_may_access_warehouse(o.warehouse_id)
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_may_access_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_may_access_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_may_access_purchase_order(p_po_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.purchase_orders po
    WHERE po.id = p_po_id
      AND public.current_user_may_access_warehouse(po.warehouse_id)
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_may_access_purchase_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_may_access_purchase_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_may_access_transfer_warehouses(
  p_from bigint,
  p_to bigint
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_is_operator_admin() THEN
    RETURN true;
  END IF;
  RETURN public.current_user_may_access_warehouse(p_from)
    OR public.current_user_may_access_warehouse(p_to);
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_may_access_transfer_warehouses(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_may_access_transfer_warehouses(bigint, bigint) TO authenticated;

-- -----------------------------------------------------------------------------
-- Auth trigger: persist allowed_warehouse_ids from user_metadata
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  fo jsonb;
  awids bigint[];
BEGIN
  uname := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    split_part(NEW.email, '@', 1)
  );
  IF NEW.raw_user_meta_data ? 'feature_overrides'
     AND jsonb_typeof(NEW.raw_user_meta_data -> 'feature_overrides') = 'object' THEN
    fo := NEW.raw_user_meta_data -> 'feature_overrides';
  ELSE
    fo := '{}'::jsonb;
  END IF;

  IF NEW.raw_user_meta_data ? 'allowed_warehouse_ids'
     AND jsonb_typeof(NEW.raw_user_meta_data -> 'allowed_warehouse_ids') = 'array' THEN
    SELECT COALESCE(
      array_agg(t.e::bigint) FILTER (WHERE t.e ~ '^[0-9]+$'),
      '{}'::bigint[]
    )
    INTO awids
    FROM jsonb_array_elements_text(NEW.raw_user_meta_data -> 'allowed_warehouse_ids') AS t(e);
  ELSE
    awids := '{}'::bigint[];
  END IF;

  INSERT INTO public.profiles (id, username, is_admin, feature_overrides, allowed_warehouse_ids)
  VALUES (
    NEW.id,
    uname,
    COALESCE((NEW.raw_user_meta_data ->> 'is_admin')::boolean, false),
    fo,
    COALESCE(awids, '{}'::bigint[])
  );
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Replace permissive policies on warehouse-scoped tables
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow all for now" ON public.orders;
CREATE POLICY orders_warehouse_scope_all
  ON public.orders
  FOR ALL
  TO authenticated
  USING (public.current_user_may_access_warehouse(warehouse_id))
  WITH CHECK (public.current_user_may_access_warehouse(warehouse_id));

DROP POLICY IF EXISTS "Allow all for now" ON public.order_items;
CREATE POLICY order_items_warehouse_scope_all
  ON public.order_items
  FOR ALL
  TO authenticated
  USING (public.current_user_may_access_order(order_id))
  WITH CHECK (public.current_user_may_access_order(order_id));

DROP POLICY IF EXISTS "Allow all for now" ON public.order_payments;
CREATE POLICY order_payments_warehouse_scope_all
  ON public.order_payments
  FOR ALL
  TO authenticated
  USING (public.current_user_may_access_order(order_id))
  WITH CHECK (public.current_user_may_access_order(order_id));

DROP POLICY IF EXISTS "Allow all for now" ON public.payment_installments;
CREATE POLICY payment_installments_warehouse_scope_all
  ON public.payment_installments
  FOR ALL
  TO authenticated
  USING (public.current_user_may_access_order(order_id))
  WITH CHECK (public.current_user_may_access_order(order_id));

DROP POLICY IF EXISTS "Allow all for now" ON public.purchase_orders;
CREATE POLICY purchase_orders_warehouse_scope_all
  ON public.purchase_orders
  FOR ALL
  TO authenticated
  USING (public.current_user_may_access_warehouse(warehouse_id))
  WITH CHECK (public.current_user_may_access_warehouse(warehouse_id));

DROP POLICY IF EXISTS "Allow all for now" ON public.purchase_order_items;
CREATE POLICY purchase_order_items_warehouse_scope_all
  ON public.purchase_order_items
  FOR ALL
  TO authenticated
  USING (public.current_user_may_access_purchase_order(purchase_order_id))
  WITH CHECK (public.current_user_may_access_purchase_order(purchase_order_id));

DROP POLICY IF EXISTS "Allow all for now" ON public.purchase_order_payments;
CREATE POLICY purchase_order_payments_warehouse_scope_all
  ON public.purchase_order_payments
  FOR ALL
  TO authenticated
  USING (public.current_user_may_access_purchase_order(purchase_order_id))
  WITH CHECK (public.current_user_may_access_purchase_order(purchase_order_id));

DROP POLICY IF EXISTS "Allow all for now" ON public.stock_movements;
CREATE POLICY stock_movements_warehouse_scope_all
  ON public.stock_movements
  FOR ALL
  TO authenticated
  USING (public.current_user_may_access_warehouse(warehouse_id))
  WITH CHECK (public.current_user_may_access_warehouse(warehouse_id));

DROP POLICY IF EXISTS "Allow all for now" ON public.product_warehouse_stock;
CREATE POLICY product_warehouse_stock_warehouse_scope_all
  ON public.product_warehouse_stock
  FOR ALL
  TO authenticated
  USING (public.current_user_may_access_warehouse(warehouse_id))
  WITH CHECK (public.current_user_may_access_warehouse(warehouse_id));

DROP POLICY IF EXISTS "Allow all for now" ON public.warehouses;
CREATE POLICY warehouses_select_scope
  ON public.warehouses
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_operator_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND warehouses.id = ANY (COALESCE(p.allowed_warehouse_ids, '{}'::bigint[]))
    )
  );

CREATE POLICY warehouses_insert_admin
  ON public.warehouses
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_operator_admin());

CREATE POLICY warehouses_update_admin
  ON public.warehouses
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_operator_admin())
  WITH CHECK (public.current_user_is_operator_admin());

CREATE POLICY warehouses_delete_admin
  ON public.warehouses
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_operator_admin());

DROP POLICY IF EXISTS "Allow all for now" ON public.inventory_transfers;
CREATE POLICY inventory_transfers_warehouse_scope_all
  ON public.inventory_transfers
  FOR ALL
  TO authenticated
  USING (
    public.current_user_may_access_transfer_warehouses(from_warehouse_id, to_warehouse_id)
  )
  WITH CHECK (
    public.current_user_may_access_transfer_warehouses(from_warehouse_id, to_warehouse_id)
  );

DROP POLICY IF EXISTS "Allow all for now" ON public.inventory_transfer_items;
CREATE POLICY inventory_transfer_items_warehouse_scope_all
  ON public.inventory_transfer_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_transfers t
      WHERE t.id = inventory_transfer_items.transfer_id
        AND public.current_user_may_access_transfer_warehouses(
          t.from_warehouse_id,
          t.to_warehouse_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inventory_transfers t
      WHERE t.id = inventory_transfer_items.transfer_id
        AND public.current_user_may_access_transfer_warehouses(
          t.from_warehouse_id,
          t.to_warehouse_id
        )
    )
  );

DROP POLICY IF EXISTS "Allow all for now" ON public.balance_transactions;
CREATE POLICY balance_transactions_warehouse_scope_all
  ON public.balance_transactions
  FOR ALL
  TO authenticated
  USING (
    register_warehouse_id IS NULL
    OR public.current_user_may_access_warehouse(register_warehouse_id)
  )
  WITH CHECK (
    register_warehouse_id IS NULL
    OR public.current_user_may_access_warehouse(register_warehouse_id)
  );

NOTIFY pgrst, 'reload schema';
