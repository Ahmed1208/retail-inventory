-- Asserts the things about purchase returns that would silently corrupt data if broken:
--   1. Confirming a return writes an 'out' stock movement and lowers warehouse stock by
--      exactly the returned quantity.
--   2. A return exceeding what the source PO received is rejected with a violations
--      payload and leaves stock untouched.
--   3. A cancelled return frees its quantity again.
--   4. Stock is allowed below zero and the products that went negative are reported.
--   5. Product cost is never touched by a return.
--
-- Everything runs inside a transaction that is rolled back, so no fixtures survive.

BEGIN;

DO $$
DECLARE
  v_wh bigint;
  v_product uuid;
  v_po uuid;
  v_po_item uuid;
  v_return_a uuid;
  v_return_b uuid;
  v_stock_before integer;
  v_stock_after integer;
  v_movements integer;
  v_cost numeric;
  v_avg numeric;
  v_res jsonb;
BEGIN
  SELECT id INTO v_wh FROM public.warehouses ORDER BY is_default DESC, id ASC LIMIT 1;
  IF v_wh IS NULL THEN
    RAISE EXCEPTION 'verify-purchase-returns: no warehouse found; run migrations and seed first';
  END IF;

  INSERT INTO public.products (
    product_code, name, customer_price, business_price, cost_price, average_unit_cost
  )
  VALUES ('VERIFY-PRETURNS-TMP', 'Verify purchase returns fixture', 100, 90, 60, 55)
  RETURNING id INTO v_product;

  INSERT INTO public.product_warehouse_stock (product_id, warehouse_id, quantity, updated_at)
  VALUES (v_product, v_wh, 20, now())
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET quantity = 20, updated_at = now();

  INSERT INTO public.purchase_orders (status, total_amount, subtotal, warehouse_id)
  VALUES ('received', 300, 300, v_wh)
  RETURNING id INTO v_po;

  INSERT INTO public.purchase_order_items (
    purchase_order_id, product_id, quantity, cost_price, total_price
  )
  VALUES (v_po, v_product, 5, 60, 300)
  RETURNING id INTO v_po_item;

  SELECT quantity INTO v_stock_before
  FROM public.product_warehouse_stock
  WHERE product_id = v_product AND warehouse_id = v_wh;

  -- 1. Confirming a return of 2 takes exactly 2 back out.
  INSERT INTO public.purchase_returns (
    source_purchase_order_id, warehouse_id, status_flow, total_amount
  )
  VALUES (v_po, v_wh, 'draft', 120)
  RETURNING id INTO v_return_a;

  INSERT INTO public.purchase_return_items (
    purchase_return_id, source_purchase_order_item_id, product_id,
    quantity, cost_price, total_price
  )
  VALUES (v_return_a, v_po_item, v_product, 2, 60, 120);

  v_res := public.confirm_purchase_return_apply_stock(v_return_a);
  IF COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'verify-purchase-returns: valid return was rejected: %', v_res;
  END IF;

  IF jsonb_array_length(COALESCE(v_res->'negatives', '[]'::jsonb)) <> 0 THEN
    RAISE EXCEPTION
      'verify-purchase-returns: reported negatives while stock stayed positive: %', v_res;
  END IF;

  SELECT quantity INTO v_stock_after
  FROM public.product_warehouse_stock
  WHERE product_id = v_product AND warehouse_id = v_wh;

  IF v_stock_after <> v_stock_before - 2 THEN
    RAISE EXCEPTION
      'verify-purchase-returns: stock should have dropped from % to %, got %',
      v_stock_before, v_stock_before - 2, v_stock_after;
  END IF;

  SELECT count(*) INTO v_movements
  FROM public.stock_movements
  WHERE product_id = v_product
    AND warehouse_id = v_wh
    AND type = 'out'
    AND quantity = 2;

  IF v_movements <> 1 THEN
    RAISE EXCEPTION
      'verify-purchase-returns: expected exactly 1 out-movement of 2, found %', v_movements;
  END IF;

  IF (SELECT status_flow FROM public.purchase_returns WHERE id = v_return_a) <> 'confirmed' THEN
    RAISE EXCEPTION 'verify-purchase-returns: return was not marked confirmed';
  END IF;

  -- 5. Cost must be untouched by the confirm.
  SELECT cost_price, average_unit_cost INTO v_cost, v_avg
  FROM public.products WHERE id = v_product;

  IF v_cost <> 60 OR v_avg <> 55 THEN
    RAISE EXCEPTION
      'verify-purchase-returns: cost changed (cost_price %, average_unit_cost %)', v_cost, v_avg;
  END IF;

  -- 2. A second return of 4 breaches the cap (5 received, 2 already returned).
  INSERT INTO public.purchase_returns (
    source_purchase_order_id, warehouse_id, status_flow, total_amount
  )
  VALUES (v_po, v_wh, 'draft', 240)
  RETURNING id INTO v_return_b;

  INSERT INTO public.purchase_return_items (
    purchase_return_id, source_purchase_order_item_id, product_id,
    quantity, cost_price, total_price
  )
  VALUES (v_return_b, v_po_item, v_product, 4, 60, 240);

  v_res := public.confirm_purchase_return_apply_stock(v_return_b);

  IF COALESCE((v_res->>'ok')::boolean, false) IS TRUE THEN
    RAISE EXCEPTION
      'verify-purchase-returns: over-return was accepted (5 received, 2 + 4 requested)';
  END IF;

  IF v_res->'violations' IS NULL OR jsonb_array_length(v_res->'violations') <> 1 THEN
    RAISE EXCEPTION
      'verify-purchase-returns: expected one violation entry, got %', v_res;
  END IF;

  IF (v_res->'violations'->0->>'received')::integer <> 5
     OR (v_res->'violations'->0->>'already_returned')::integer <> 2
     OR (v_res->'violations'->0->>'requested')::integer <> 4 THEN
    RAISE EXCEPTION 'verify-purchase-returns: violation payload is wrong: %', v_res;
  END IF;

  SELECT quantity INTO v_stock_after
  FROM public.product_warehouse_stock
  WHERE product_id = v_product AND warehouse_id = v_wh;

  IF v_stock_after <> v_stock_before - 2 THEN
    RAISE EXCEPTION
      'verify-purchase-returns: rejected return still moved stock (expected %, got %)',
      v_stock_before - 2, v_stock_after;
  END IF;

  IF (SELECT status_flow FROM public.purchase_returns WHERE id = v_return_b) <> 'draft' THEN
    RAISE EXCEPTION 'verify-purchase-returns: rejected return should stay a draft';
  END IF;

  -- 3 + 4. Cancelling A frees the full 5 again, and with only 1 unit left on hand the
  -- confirm still goes through, reporting the product it drove negative.
  UPDATE public.purchase_returns SET status_flow = 'cancelled' WHERE id = v_return_a;
  UPDATE public.purchase_return_items
  SET quantity = 5, total_price = 300
  WHERE purchase_return_id = v_return_b;

  UPDATE public.product_warehouse_stock
  SET quantity = 1, updated_at = now()
  WHERE product_id = v_product AND warehouse_id = v_wh;

  v_res := public.confirm_purchase_return_apply_stock(v_return_b);
  IF COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION
      'verify-purchase-returns: cancelled return still counted against the cap: %', v_res;
  END IF;

  SELECT quantity INTO v_stock_after
  FROM public.product_warehouse_stock
  WHERE product_id = v_product AND warehouse_id = v_wh;

  IF v_stock_after <> -4 THEN
    RAISE EXCEPTION
      'verify-purchase-returns: stock should be -4 after returning 5 of 1 on hand, got %',
      v_stock_after;
  END IF;

  IF jsonb_array_length(COALESCE(v_res->'negatives', '[]'::jsonb)) <> 1
     OR (v_res->'negatives'->0->>'product_id')::uuid <> v_product
     OR (v_res->'negatives'->0->>'quantity_after')::integer <> -4 THEN
    RAISE EXCEPTION
      'verify-purchase-returns: negative stock was not reported correctly: %', v_res;
  END IF;

  SELECT cost_price, average_unit_cost INTO v_cost, v_avg
  FROM public.products WHERE id = v_product;

  IF v_cost <> 60 OR v_avg <> 55 THEN
    RAISE EXCEPTION
      'verify-purchase-returns: cost changed on the negative-stock path (% / %)', v_cost, v_avg;
  END IF;

  RAISE NOTICE 'verify-purchase-returns: OK (stock out, over-return guard, cap release, negative stock reported, cost untouched)';
END;
$$;

ROLLBACK;
