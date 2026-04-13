-- Conflict-free document numbers, stock replay reconciliation, alerts, sync queue, realtime.
-- Note: a file named 010_conflict_resolution.sql was requested but 010_* already exists; this migration is the canonical one.

-- -----------------------------------------------------------------------------
-- Central counters (single source for human-facing document numbers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_number_counters (
  scope text PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0
);

INSERT INTO public.order_number_counters (scope, last_value)
VALUES
  ('sales_order', COALESCE((SELECT MAX(order_number) FROM public.orders), 0)),
  ('purchase_order', COALESCE((SELECT MAX(order_number) FROM public.purchase_orders), 0)),
  ('inventory_transfer', COALESCE((SELECT MAX(transfer_number) FROM public.inventory_transfers), 0))
ON CONFLICT (scope) DO UPDATE
SET last_value = GREATEST(public.order_number_counters.last_value, EXCLUDED.last_value);

CREATE OR REPLACE FUNCTION public.allocate_document_number(p_scope text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v bigint;
BEGIN
  IF p_scope IS NULL OR btrim(p_scope) = '' THEN
    RAISE EXCEPTION 'allocate_document_number: scope required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('allocate_document_number:' || p_scope, 0));

  UPDATE public.order_number_counters
  SET last_value = last_value + 1
  WHERE scope = p_scope
  RETURNING last_value INTO v;

  IF NOT FOUND THEN
    INSERT INTO public.order_number_counters (scope, last_value)
    VALUES (p_scope, 1)
    ON CONFLICT (scope) DO UPDATE
    SET last_value = public.order_number_counters.last_value + 1
    RETURNING last_value INTO v;
  END IF;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_document_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_document_number(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_document_number(text) TO service_role;

COMMENT ON FUNCTION public.allocate_document_number(text) IS
  'Atomically returns the next integer for a logical document stream (sales_order, purchase_order, inventory_transfer).';

-- Allow negative on-hand after movement replay (alerts surface the issue).
ALTER TABLE public.product_warehouse_stock
  DROP CONSTRAINT IF EXISTS product_warehouse_stock_quantity_non_negative;

-- -----------------------------------------------------------------------------
-- Stock alerts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL CHECK (
    alert_type = ANY (
      ARRAY[
        'negative_stock'::text,
        'low_stock'::text,
        'order_number_repair'::text,
        'sync_conflict'::text,
        'info'::text
      ]
    )
  ),
  title text NOT NULL,
  message text NOT NULL,
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  quantity_after integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_alerts_unread_idx
  ON public.stock_alerts (created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS stock_alerts_product_idx
  ON public.stock_alerts (product_id)
  WHERE product_id IS NOT NULL;

ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_alerts_select_authenticated ON public.stock_alerts;
CREATE POLICY stock_alerts_select_authenticated
  ON public.stock_alerts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS stock_alerts_insert_authenticated ON public.stock_alerts;
CREATE POLICY stock_alerts_insert_authenticated
  ON public.stock_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS stock_alerts_update_authenticated ON public.stock_alerts;
CREATE POLICY stock_alerts_update_authenticated
  ON public.stock_alerts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.stock_alerts IS
  'Operator-visible alerts (negative stock, repairs, sync conflicts). Browser + Realtime.';

-- -----------------------------------------------------------------------------
-- Sync queue (per-device outbox / inbox for post-mutation work)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_device_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text
);

CREATE INDEX IF NOT EXISTS sync_event_queue_pending_idx
  ON public.sync_event_queue (target_device_id, created_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.sync_event_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_event_queue_select ON public.sync_event_queue;
CREATE POLICY sync_event_queue_select
  ON public.sync_event_queue
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS sync_event_queue_insert ON public.sync_event_queue;
CREATE POLICY sync_event_queue_insert
  ON public.sync_event_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS sync_event_queue_update ON public.sync_event_queue;
CREATE POLICY sync_event_queue_update
  ON public.sync_event_queue
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.enqueue_sync_event(
  p_target_device_id text,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.sync_event_queue (target_device_id, event_type, payload)
  VALUES (p_target_device_id, p_event_type, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_sync_event(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_sync_event(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_sync_event(text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_sync_events(
  p_target_device_id text,
  p_limit integer DEFAULT 100
)
RETURNS SETOF public.sync_event_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id
    FROM public.sync_event_queue
    WHERE target_device_id = p_target_device_id
      AND processed_at IS NULL
    ORDER BY created_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 500))
    FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE public.sync_event_queue q
    SET processed_at = now()
    FROM cte
    WHERE q.id = cte.id
    RETURNING q.*
  )
  SELECT * FROM upd;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_sync_events(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_sync_events(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sync_events(text, integer) TO service_role;

-- -----------------------------------------------------------------------------
-- Orders / PO: server-assigned numbers (drop sequence defaults; trigger assigns)
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ALTER COLUMN order_number DROP DEFAULT;

ALTER TABLE public.purchase_orders
  ALTER COLUMN order_number DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.assign_order_document_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'orders' THEN
    IF COALESCE(NEW.is_historical_snapshot, false) AND NEW.order_number IS NOT NULL THEN
      RETURN NEW;
    END IF;
    v_scope := 'sales_order';
  ELSIF TG_TABLE_NAME = 'purchase_orders' THEN
    IF COALESCE(NEW.is_historical_snapshot, false) AND NEW.order_number IS NOT NULL THEN
      RETURN NEW;
    END IF;
    v_scope := 'purchase_order';
  ELSE
    RETURN NEW;
  END IF;

  NEW.order_number := public.allocate_document_number(v_scope)::integer;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_assign_number ON public.orders;
CREATE TRIGGER trg_orders_assign_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_order_document_number();

DROP TRIGGER IF EXISTS trg_purchase_orders_assign_number ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_assign_number
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_order_document_number();

-- -----------------------------------------------------------------------------
-- Replay stock_movements -> product_warehouse_stock (+ products.quantity via trigger)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reapply_pws_from_movements(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mov record;
  kv record;
  bal jsonb := '{}'::jsonb;
  w text;
  cur int;
  newq int;
  wid bigint;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  FOR wid IN
    SELECT DISTINCT warehouse_id
    FROM public.stock_movements
    WHERE product_id = p_product_id
    UNION
    SELECT warehouse_id
    FROM public.product_warehouse_stock
    WHERE product_id = p_product_id
  LOOP
    bal := jsonb_set(
      bal,
      ARRAY[wid::text],
      '0'::jsonb,
      true
    );
  END LOOP;

  FOR mov IN
    SELECT id, warehouse_id, type, quantity, created_at
    FROM public.stock_movements
    WHERE product_id = p_product_id
    ORDER BY created_at ASC NULLS LAST, id ASC
  LOOP
    w := mov.warehouse_id::text;
    cur := COALESCE((bal->>w)::integer, 0);

    IF mov.type = 'in' THEN
      newq := cur + mov.quantity;
    ELSIF mov.type = 'out' THEN
      newq := cur - mov.quantity;
    ELSIF mov.type = 'adjustment' THEN
      newq := mov.quantity;
    ELSE
      newq := cur;
    END IF;

    bal := jsonb_set(bal, ARRAY[w], to_jsonb(newq), true);
  END LOOP;

  DELETE FROM public.product_warehouse_stock WHERE product_id = p_product_id;

  FOR kv IN
    SELECT key::bigint AS wh_id, value::text AS qty_text
    FROM jsonb_each_text(bal)
  LOOP
    newq := COALESCE(kv.qty_text::integer, 0);
    INSERT INTO public.product_warehouse_stock (product_id, warehouse_id, quantity, updated_at)
    VALUES (p_product_id, kv.wh_id, newq, now())
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      updated_at = EXCLUDED.updated_at;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.product_warehouse_stock
    WHERE product_id = p_product_id AND quantity < 0
  ) THEN
    INSERT INTO public.stock_alerts (
      alert_type,
      title,
      message,
      product_id,
      quantity_after,
      meta
    )
    SELECT
      'negative_stock',
      'Negative stock after reconciliation',
      format('Product %s has negative quantity in at least one warehouse after replaying movements.', p_product_id),
      p_product_id,
      (SELECT MIN(quantity) FROM public.product_warehouse_stock WHERE product_id = p_product_id),
      jsonb_build_object('source', 'reapply_pws_from_movements');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reapply_pws_from_movements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reapply_pws_from_movements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reapply_pws_from_movements(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.recalculate_stock_from_movements(p_product_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
  n int := 0;
BEGIN
  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    FOR pid IN SELECT id FROM public.products LOOP
      PERFORM public.reapply_pws_from_movements(pid);
      n := n + 1;
    END LOOP;
  ELSE
    FOREACH pid IN ARRAY p_product_ids LOOP
      PERFORM public.reapply_pws_from_movements(pid);
      n := n + 1;
    END LOOP;
  END IF;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_stock_from_movements(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_stock_from_movements(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_stock_from_movements(uuid[]) TO service_role;

COMMENT ON FUNCTION public.recalculate_stock_from_movements(uuid[]) IS
  'Replay stock_movements into product_warehouse_stock per product; NULL array = all products.';

-- -----------------------------------------------------------------------------
-- Inventory transfers: explicit number from counter (drop default)
-- -----------------------------------------------------------------------------
ALTER TABLE public.inventory_transfers
  ALTER COLUMN transfer_number DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.create_inventory_transfer(
  p_from_warehouse_id bigint,
  p_to_warehouse_id bigint,
  p_note text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_num integer;
  v_note text;
  v_len integer;
  v_i integer;
  v_el jsonb;
  v_pid uuid;
  v_qty integer;
  v_have integer;
BEGIN
  IF p_from_warehouse_id = p_to_warehouse_id THEN
    RAISE EXCEPTION 'source and destination warehouse must differ';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'at least one line item is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_from_warehouse_id) THEN
    RAISE EXCEPTION 'source warehouse not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_to_warehouse_id) THEN
    RAISE EXCEPTION 'destination warehouse not found';
  END IF;

  v_note := NULLIF(trim(COALESCE(p_note, '')), '');

  v_num := public.allocate_document_number('inventory_transfer')::integer;

  INSERT INTO public.inventory_transfers (transfer_number, from_warehouse_id, to_warehouse_id, note)
  VALUES (v_num, p_from_warehouse_id, p_to_warehouse_id, v_note)
  RETURNING id INTO v_id;

  v_len := jsonb_array_length(p_items);
  FOR v_i IN 0..v_len - 1 LOOP
    v_el := p_items->v_i;
    v_pid := (v_el->>'product_id')::uuid;
    v_qty := (v_el->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'invalid quantity for product %', v_pid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_pid) THEN
      RAISE EXCEPTION 'product not found: %', v_pid;
    END IF;

    SELECT COALESCE(pws.quantity, 0) INTO v_have
    FROM public.product_warehouse_stock pws
    WHERE pws.product_id = v_pid AND pws.warehouse_id = p_from_warehouse_id;

    IF v_have IS NULL THEN
      v_have := 0;
    END IF;

    IF v_have < v_qty THEN
      RAISE EXCEPTION 'insufficient stock for product % in source warehouse (have %, need %)',
        v_pid, v_have, v_qty;
    END IF;

    INSERT INTO public.inventory_transfer_items (transfer_id, product_id, quantity)
    VALUES (v_id, v_pid, v_qty);
  END LOOP;

  FOR v_i IN 0..v_len - 1 LOOP
    v_el := p_items->v_i;
    v_pid := (v_el->>'product_id')::uuid;
    v_qty := (v_el->>'quantity')::integer;

    INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, note)
    VALUES (
      v_pid,
      p_from_warehouse_id,
      'out',
      v_qty,
      format('Transfer #%s (out)', v_num)
    );

    INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, note)
    VALUES (
      v_pid,
      p_to_warehouse_id,
      'in',
      v_qty,
      format('Transfer #%s (in)', v_num)
    );

    UPDATE public.product_warehouse_stock
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE product_id = v_pid AND warehouse_id = p_from_warehouse_id;

    INSERT INTO public.product_warehouse_stock (product_id, warehouse_id, quantity, updated_at)
    VALUES (v_pid, p_to_warehouse_id, v_qty, now())
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET
      quantity = public.product_warehouse_stock.quantity + EXCLUDED.quantity,
      updated_at = EXCLUDED.updated_at;
  END LOOP;

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Realtime (best-effort; ignore if publication differs)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_alerts;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
