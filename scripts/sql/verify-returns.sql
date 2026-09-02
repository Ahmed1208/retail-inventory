-- Asserts the two things about sales returns that would silently corrupt data if broken:
--   1. Confirming a return writes an 'in' stock movement and raises warehouse stock by
--      exactly the returned quantity.
--   2. A return exceeding what the source order sold is rejected with a violations payload
--      and leaves stock untouched — including when split across two return documents.
--
-- Everything runs inside a transaction that is rolled back, so no fixtures survive.

BEGIN;

DO $$
DECLARE
  v_wh bigint;
  v_product uuid;
  v_order uuid;
  v_order_item uuid;
  v_return_a uuid;
  v_return_b uuid;
  v_stock_before integer;
  v_stock_after integer;
  v_movements integer;
  v_res jsonb;
BEGIN
  SELECT id INTO v_wh FROM public.warehouses ORDER BY is_default DESC, id ASC LIMIT 1;
  IF v_wh IS NULL THEN
    RAISE EXCEPTION 'verify-returns: no warehouse found; run migrations and seed first';
  END IF;

  INSERT INTO public.products (product_code, name, customer_price, business_price, cost_price)
  VALUES ('VERIFY-RETURNS-TMP', 'Verify returns fixture', 100, 90, 60)
  RETURNING id INTO v_product;

  INSERT INTO public.product_warehouse_stock (product_id, warehouse_id, quantity, updated_at)
  VALUES (v_product, v_wh, 20, now())
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET quantity = 20, updated_at = now();

  INSERT INTO public.orders (
    type, status, status_flow, total_amount, subtotal, warehouse_id
  )
  VALUES ('retail', 'pending', 'confirmed', 500, 500, v_wh)
  RETURNING id INTO v_order;

  INSERT INTO public.order_items (
    order_id, product_id, quantity, unit_price, total_price
  )
  VALUES (v_order, v_product, 5, 100, 500)
  RETURNING id INTO v_order_item;

  SELECT quantity INTO v_stock_before
  FROM public.product_warehouse_stock
  WHERE product_id = v_product AND warehouse_id = v_wh;

  -- 1. Confirming a return of 2 puts exactly 2 back.
  INSERT INTO public.returns (source_order_id, warehouse_id, status_flow, total_amount)
  VALUES (v_order, v_wh, 'draft', 200)
  RETURNING id INTO v_return_a;

  INSERT INTO public.return_items (
    return_id, source_order_item_id, product_id, quantity, unit_price, total_price
  )
  VALUES (v_return_a, v_order_item, v_product, 2, 100, 200);

  v_res := public.confirm_return_apply_stock(v_return_a);
  IF COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'verify-returns: valid return was rejected: %', v_res;
  END IF;

  SELECT quantity INTO v_stock_after
  FROM public.product_warehouse_stock
  WHERE product_id = v_product AND warehouse_id = v_wh;

  IF v_stock_after <> v_stock_before + 2 THEN
    RAISE EXCEPTION
      'verify-returns: stock should have risen from % to %, got %',
      v_stock_before, v_stock_before + 2, v_stock_after;
  END IF;

  SELECT count(*) INTO v_movements
  FROM public.stock_movements
  WHERE product_id = v_product
    AND warehouse_id = v_wh
    AND type = 'in'
    AND quantity = 2;

  IF v_movements <> 1 THEN
    RAISE EXCEPTION
      'verify-returns: expected exactly 1 in-movement of 2, found %', v_movements;
  END IF;

  IF (SELECT status_flow FROM public.returns WHERE id = v_return_a) <> 'confirmed' THEN
    RAISE EXCEPTION 'verify-returns: return was not marked confirmed';
  END IF;

  -- 2. A second return of 4 breaches the cap (5 sold, 2 already returned).
  INSERT INTO public.returns (source_order_id, warehouse_id, status_flow, total_amount)
  VALUES (v_order, v_wh, 'draft', 400)
  RETURNING id INTO v_return_b;

  INSERT INTO public.return_items (
    return_id, source_order_item_id, product_id, quantity, unit_price, total_price
  )
  VALUES (v_return_b, v_order_item, v_product, 4, 100, 400);

  v_res := public.confirm_return_apply_stock(v_return_b);

  IF COALESCE((v_res->>'ok')::boolean, false) IS TRUE THEN
    RAISE EXCEPTION 'verify-returns: over-return was accepted (5 sold, 2 + 4 requested)';
  END IF;

  IF v_res->'violations' IS NULL OR jsonb_array_length(v_res->'violations') <> 1 THEN
    RAISE EXCEPTION
      'verify-returns: expected one violation entry, got %', v_res;
  END IF;

  IF (v_res->'violations'->0->>'sold')::integer <> 5
     OR (v_res->'violations'->0->>'already_returned')::integer <> 2
     OR (v_res->'violations'->0->>'requested')::integer <> 4 THEN
    RAISE EXCEPTION 'verify-returns: violation payload is wrong: %', v_res;
  END IF;

  SELECT quantity INTO v_stock_after
  FROM public.product_warehouse_stock
  WHERE product_id = v_product AND warehouse_id = v_wh;

  IF v_stock_after <> v_stock_before + 2 THEN
    RAISE EXCEPTION
      'verify-returns: rejected return still moved stock (expected %, got %)',
      v_stock_before + 2, v_stock_after;
  END IF;

  IF (SELECT status_flow FROM public.returns WHERE id = v_return_b) <> 'draft' THEN
    RAISE EXCEPTION 'verify-returns: rejected return should stay a draft';
  END IF;

  -- Cancelled returns must free their quantity again: 3 is the remaining cap.
  UPDATE public.returns SET status_flow = 'cancelled' WHERE id = v_return_a;
  UPDATE public.return_items SET quantity = 5, total_price = 500 WHERE return_id = v_return_b;

  v_res := public.confirm_return_apply_stock(v_return_b);
  IF COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION
      'verify-returns: cancelled return still counted against the cap: %', v_res;
  END IF;

  RAISE NOTICE 'verify-returns: OK (restock, over-return guard, cancelled-return cap release)';
END;
$$;

ROLLBACK;
