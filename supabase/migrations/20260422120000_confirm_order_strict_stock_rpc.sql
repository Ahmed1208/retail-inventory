-- Online confirm: single-transaction stock check + movements + order status (FOR UPDATE on PWS).
-- stock_alerts: type for post-offline-sync negative stock messaging.
-- reapply_pws_from_movements: stop inserting alerts here (callers create targeted alerts in app).

ALTER TABLE public.stock_alerts DROP CONSTRAINT IF EXISTS stock_alerts_alert_type_check;

ALTER TABLE public.stock_alerts
  ADD CONSTRAINT stock_alerts_alert_type_check CHECK (
    alert_type = ANY (
      ARRAY[
        'negative_stock'::text,
        'negative_stock_offline_sync'::text,
        'low_stock'::text,
        'order_number_repair'::text,
        'sync_conflict'::text,
        'info'::text,
        'wallet_direction_changed'::text,
        'register_negative_balance'::text
      ]
    )
  );

CREATE OR REPLACE FUNCTION public.reapply_pws_from_movements(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
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
END;
$$;

COMMENT ON FUNCTION public.reapply_pws_from_movements(uuid) IS
  'Replay stock_movements into product_warehouse_stock; negatives allowed. App creates alerts after merge/reconcile.';

CREATE OR REPLACE FUNCTION public.confirm_order_apply_stock_strict(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  r_order record;
  v_wh bigint;
  v_num integer;
  v_violations jsonb := '[]'::jsonb;
  rec_need record;
  v_have integer;
  rec_line record;
  v_note text;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_order_id');
  END IF;

  SELECT
    o.id,
    o.warehouse_id,
    o.order_number,
    o.status_flow,
    COALESCE(o.is_historical_snapshot, false) AS is_hist
  INTO r_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF r_order.is_hist THEN
    RETURN jsonb_build_object('ok', false, 'error', 'historical_snapshot');
  END IF;

  IF r_order.status_flow IS DISTINCT FROM 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_draft');
  END IF;

  v_wh := r_order.warehouse_id;
  v_num := r_order.order_number;
  v_note := format('Order #%s', v_num);

  FOR rec_need IN
    SELECT oi.product_id, SUM(oi.quantity)::integer AS qty_need
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    GROUP BY oi.product_id
    ORDER BY oi.product_id
  LOOP
    INSERT INTO public.product_warehouse_stock (product_id, warehouse_id, quantity, updated_at)
    VALUES (rec_need.product_id, v_wh, 0, now())
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    SELECT pws.quantity
    INTO v_have
    FROM public.product_warehouse_stock pws
    WHERE pws.product_id = rec_need.product_id
      AND pws.warehouse_id = v_wh
    FOR UPDATE;

    v_have := COALESCE(v_have, 0);

    IF v_have < rec_need.qty_need THEN
      v_violations := v_violations || jsonb_build_array(
        jsonb_build_object(
          'product_id', rec_need.product_id,
          'product_name', COALESCE((SELECT pr.name FROM public.products pr WHERE pr.id = rec_need.product_id), ''),
          'available', v_have,
          'needed', rec_need.qty_need
        )
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_violations) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'violations', v_violations);
  END IF;

  FOR rec_line IN
    SELECT oi.id, oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    ORDER BY oi.created_at ASC NULLS LAST, oi.id ASC
  LOOP
    INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, note)
    VALUES (rec_line.product_id, v_wh, 'out', rec_line.quantity, v_note);

    UPDATE public.product_warehouse_stock pws
    SET
      quantity = pws.quantity - rec_line.quantity,
      updated_at = now()
    WHERE pws.product_id = rec_line.product_id
      AND pws.warehouse_id = v_wh;
  END LOOP;

  UPDATE public.products p
  SET
    average_unit_cost = NULL,
    updated_at = now()
  WHERE p.id IN (SELECT DISTINCT oi.product_id FROM public.order_items oi WHERE oi.order_id = p_order_id)
    AND (
      SELECT COALESCE(SUM(s.quantity), 0)
      FROM public.product_warehouse_stock s
      WHERE s.product_id = p.id
    ) = 0;

  UPDATE public.orders o
  SET
    status_flow = 'confirmed',
    status = 'pending',
    updated_at = now()
  WHERE o.id = p_order_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_apply_stock_strict(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order_apply_stock_strict(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_apply_stock_strict(uuid) TO service_role;

COMMENT ON FUNCTION public.confirm_order_apply_stock_strict(uuid) IS
  'Locks order + PWS rows, verifies aggregate stock per product for the order warehouse, applies out movements, sets order confirmed — one transaction.';

NOTIFY pgrst, 'reload schema';
