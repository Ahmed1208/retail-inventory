-- Purchase returns: the mirror of a purchase order. Stock goes back OUT to the
-- supplier and money comes IN (register refund) or reduces what we owe them.
--
-- Kept in dedicated tables rather than a doc_kind column on purchase_orders so every
-- existing purchase read (supplier analytics, cost history, CSV export, cloud sync)
-- keeps its "every row is a receipt" assumption.

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_returns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  return_number integer NOT NULL,
  source_purchase_order_id uuid NOT NULL,
  person_id uuid,
  warehouse_id bigint NOT NULL DEFAULT 1,
  status_flow text NOT NULL DEFAULT 'draft',
  settlement text,
  refund_method public.payment_method_t,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  note text,
  is_historical_snapshot boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (return_number),
  CONSTRAINT purchase_returns_source_purchase_order_id_fkey FOREIGN KEY (source_purchase_order_id)
    REFERENCES public.purchase_orders(id),
  CONSTRAINT purchase_returns_person_id_fkey FOREIGN KEY (person_id)
    REFERENCES public.people(id) ON DELETE SET NULL,
  CONSTRAINT purchase_returns_warehouse_id_fkey FOREIGN KEY (warehouse_id)
    REFERENCES public.warehouses(id),
  CONSTRAINT purchase_returns_status_flow_check CHECK (
    status_flow = ANY (ARRAY['draft'::text, 'confirmed'::text, 'cancelled'::text])
  ),
  CONSTRAINT purchase_returns_settlement_check CHECK (
    settlement IS NULL
    OR settlement = ANY (ARRAY['refund_to_register'::text, 'debit_from_account'::text])
  )
);

CREATE TABLE IF NOT EXISTS public.purchase_return_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_return_id uuid NOT NULL,
  source_purchase_order_item_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT purchase_return_items_purchase_return_id_fkey FOREIGN KEY (purchase_return_id)
    REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  CONSTRAINT purchase_return_items_source_item_id_fkey FOREIGN KEY (source_purchase_order_item_id)
    REFERENCES public.purchase_order_items(id),
  CONSTRAINT purchase_return_items_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products(id),
  CONSTRAINT purchase_return_items_quantity_check CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS purchase_returns_source_po_id_idx
  ON public.purchase_returns (source_purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_returns_person_id_idx
  ON public.purchase_returns (person_id);
CREATE INDEX IF NOT EXISTS purchase_return_items_return_id_idx
  ON public.purchase_return_items (purchase_return_id);
-- Drives the over-return guard lookup on every confirm.
CREATE INDEX IF NOT EXISTS purchase_return_items_source_item_id_idx
  ON public.purchase_return_items (source_purchase_order_item_id);

-- -----------------------------------------------------------------------------
-- RLS (match existing permissive pattern)
-- -----------------------------------------------------------------------------
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for now" ON public.purchase_returns;
CREATE POLICY "Allow all for now" ON public.purchase_returns
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for now" ON public.purchase_return_items;
CREATE POLICY "Allow all for now" ON public.purchase_return_items
  FOR ALL TO public USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Document numbering (reuse the central counter)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_document_number(p_scope text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v bigint;
  v_floor bigint := 0;
BEGIN
  IF p_scope IS NULL OR btrim(p_scope) = '' THEN
    RAISE EXCEPTION 'allocate_document_number: scope required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('allocate_document_number:' || p_scope, 0));

  IF p_scope = 'sales_order' THEN
    SELECT COALESCE(MAX(order_number), 0) INTO v_floor FROM public.orders;
  ELSIF p_scope = 'purchase_order' THEN
    SELECT COALESCE(MAX(order_number), 0) INTO v_floor FROM public.purchase_orders;
  ELSIF p_scope = 'inventory_transfer' THEN
    SELECT COALESCE(MAX(transfer_number), 0) INTO v_floor FROM public.inventory_transfers;
  ELSIF p_scope = 'sales_return' THEN
    SELECT COALESCE(MAX(return_number), 0) INTO v_floor FROM public.returns;
  ELSIF p_scope = 'purchase_return' THEN
    SELECT COALESCE(MAX(return_number), 0) INTO v_floor FROM public.purchase_returns;
  END IF;

  INSERT INTO public.order_number_counters (scope, last_value)
  VALUES (p_scope, v_floor)
  ON CONFLICT (scope) DO UPDATE
  SET last_value = GREATEST(
    public.order_number_counters.last_value,
    EXCLUDED.last_value
  );

  UPDATE public.order_number_counters
  SET last_value = last_value + 1
  WHERE scope = p_scope
  RETURNING last_value INTO v;

  RETURN v;
END;
$$;

ALTER FUNCTION public.allocate_document_number(text) SET row_security TO off;

INSERT INTO public.order_number_counters (scope, last_value)
VALUES ('purchase_return', COALESCE((SELECT MAX(return_number) FROM public.purchase_returns), 0))
ON CONFLICT (scope) DO UPDATE
SET last_value = GREATEST(public.order_number_counters.last_value, EXCLUDED.last_value);

CREATE OR REPLACE FUNCTION public.assign_purchase_return_document_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_historical_snapshot, false) AND NEW.return_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.return_number := public.allocate_document_number('purchase_return')::integer;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_returns_assign_number ON public.purchase_returns;
CREATE TRIGGER trg_purchase_returns_assign_number
  BEFORE INSERT ON public.purchase_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_purchase_return_document_number();

-- Sync upserts hit ON CONFLICT UPDATE; keep the existing number so they cannot
-- collide with another document (mirrors preserve_return_number_on_update).
CREATE OR REPLACE FUNCTION public.preserve_purchase_return_number_on_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.return_number IS NOT NULL THEN
    NEW.return_number := OLD.return_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_returns_preserve_return_number ON public.purchase_returns;
CREATE TRIGGER trg_purchase_returns_preserve_return_number
  BEFORE UPDATE ON public.purchase_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_purchase_return_number_on_update();

-- -----------------------------------------------------------------------------
-- Confirm: over-return guard + stock OUT movements, one transaction.
--
-- Mirror of confirm_return_apply_stock with the stock direction inverted. Unlike a
-- sales return, this one can drive stock below zero when the goods were already
-- sold. That is allowed on purpose (the non-negative constraint was dropped in
-- 20260416120000_conflict_resolution.sql), so instead of refusing, the function
-- reports which products ended negative and the caller pings the admin.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_purchase_return_apply_stock(p_purchase_return_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  r_return record;
  v_wh bigint;
  v_num integer;
  v_violations jsonb := '[]'::jsonb;
  v_negatives jsonb := '[]'::jsonb;
  rec_need record;
  v_received integer;
  v_already integer;
  rec_line record;
  v_note text;
BEGIN
  IF p_purchase_return_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_return_id');
  END IF;

  SELECT
    r.id,
    r.warehouse_id,
    r.return_number,
    r.status_flow,
    COALESCE(r.is_historical_snapshot, false) AS is_hist
  INTO r_return
  FROM public.purchase_returns r
  WHERE r.id = p_purchase_return_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'return_not_found');
  END IF;

  IF r_return.is_hist THEN
    RETURN jsonb_build_object('ok', false, 'error', 'historical_snapshot');
  END IF;

  IF r_return.status_flow IS DISTINCT FROM 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_draft');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_return_items ri
    WHERE ri.purchase_return_id = p_purchase_return_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_lines');
  END IF;

  v_wh := r_return.warehouse_id;
  v_num := r_return.return_number;
  v_note := format('Purchase return #%s', v_num);

  -- Lock the source PO line before reading how much of it is already returned,
  -- so two concurrent returns cannot both pass the cap.
  FOR rec_need IN
    SELECT
      ri.source_purchase_order_item_id AS source_item_id,
      ri.product_id,
      SUM(ri.quantity)::integer AS qty_req
    FROM public.purchase_return_items ri
    WHERE ri.purchase_return_id = p_purchase_return_id
    GROUP BY ri.source_purchase_order_item_id, ri.product_id
    ORDER BY ri.source_purchase_order_item_id
  LOOP
    SELECT poi.quantity
    INTO v_received
    FROM public.purchase_order_items poi
    WHERE poi.id = rec_need.source_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'source_line_not_found');
    END IF;

    SELECT COALESCE(SUM(ri.quantity), 0)::integer
    INTO v_already
    FROM public.purchase_return_items ri
    JOIN public.purchase_returns r ON r.id = ri.purchase_return_id
    WHERE ri.source_purchase_order_item_id = rec_need.source_item_id
      AND r.id <> p_purchase_return_id
      AND r.status_flow <> 'cancelled';

    IF v_already + rec_need.qty_req > v_received THEN
      v_violations := v_violations || jsonb_build_array(
        jsonb_build_object(
          'product_id', rec_need.product_id,
          'product_name', COALESCE((SELECT pr.name FROM public.products pr WHERE pr.id = rec_need.product_id), ''),
          'received', v_received,
          'already_returned', v_already,
          'requested', rec_need.qty_req
        )
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_violations) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'violations', v_violations);
  END IF;

  FOR rec_line IN
    SELECT ri.id, ri.product_id, ri.quantity
    FROM public.purchase_return_items ri
    WHERE ri.purchase_return_id = p_purchase_return_id
    ORDER BY ri.created_at ASC NULLS LAST, ri.id ASC
  LOOP
    INSERT INTO public.product_warehouse_stock (product_id, warehouse_id, quantity, updated_at)
    VALUES (rec_line.product_id, v_wh, 0, now())
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, note)
    VALUES (rec_line.product_id, v_wh, 'out', rec_line.quantity, v_note);

    UPDATE public.product_warehouse_stock pws
    SET
      quantity = pws.quantity - rec_line.quantity,
      updated_at = now()
    WHERE pws.product_id = rec_line.product_id
      AND pws.warehouse_id = v_wh;
  END LOOP;

  -- Read the settled totals rather than each line: several lines can share a
  -- product, and only the final on-hand tells you whether it went negative.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', s.product_id,
        'product_name', COALESCE(p.name, ''),
        'quantity_after', s.quantity
      )
      ORDER BY p.name
    ),
    '[]'::jsonb
  )
  INTO v_negatives
  FROM public.product_warehouse_stock s
  JOIN public.products p ON p.id = s.product_id
  WHERE s.warehouse_id = v_wh
    AND s.quantity < 0
    AND s.product_id IN (
      SELECT DISTINCT ri.product_id
      FROM public.purchase_return_items ri
      WHERE ri.purchase_return_id = p_purchase_return_id
    );

  -- Cost is deliberately untouched. A partial return cannot say which receipt the
  -- units came from, so reversing the weighted average would be a guess; the goods
  -- leave valued exactly as they sit.

  UPDATE public.purchase_returns r
  SET
    status_flow = 'confirmed',
    updated_at = now()
  WHERE r.id = p_purchase_return_id;

  RETURN jsonb_build_object('ok', true, 'negatives', v_negatives);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_purchase_return_apply_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_return_apply_stock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_return_apply_stock(uuid) TO service_role;

COMMENT ON FUNCTION public.confirm_purchase_return_apply_stock(uuid) IS
  'Locks the purchase return and its source PO lines, rejects over-returns, applies out movements, reports products left negative, sets the return confirmed — one transaction.';

COMMENT ON TABLE public.purchase_returns IS
  'Purchase returns against a source purchase order: stock back out to the supplier, money refunded to the register or taken off the supplier balance.';

NOTIFY pgrst, 'reload schema';
