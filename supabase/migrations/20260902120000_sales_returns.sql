-- Sales returns: the mirror of a sales order. Stock comes back IN, money goes OUT
-- (register refund) or is credited to the customer account.
--
-- Kept in dedicated tables rather than a doc_kind column on orders so every existing
-- sales read (revenue reports, product/person analytics, CSV export, cloud sync)
-- keeps its "every row is a sale" assumption.

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.returns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  return_number integer NOT NULL,
  source_order_id uuid NOT NULL,
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
  CONSTRAINT returns_source_order_id_fkey FOREIGN KEY (source_order_id)
    REFERENCES public.orders(id),
  CONSTRAINT returns_person_id_fkey FOREIGN KEY (person_id)
    REFERENCES public.people(id) ON DELETE SET NULL,
  CONSTRAINT returns_warehouse_id_fkey FOREIGN KEY (warehouse_id)
    REFERENCES public.warehouses(id),
  CONSTRAINT returns_status_flow_check CHECK (
    status_flow = ANY (ARRAY['draft'::text, 'confirmed'::text, 'cancelled'::text])
  ),
  CONSTRAINT returns_settlement_check CHECK (
    settlement IS NULL
    OR settlement = ANY (ARRAY['refund_to_register'::text, 'credit_to_account'::text])
  )
);

CREATE TABLE IF NOT EXISTS public.return_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL,
  source_order_item_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT return_items_return_id_fkey FOREIGN KEY (return_id)
    REFERENCES public.returns(id) ON DELETE CASCADE,
  CONSTRAINT return_items_source_order_item_id_fkey FOREIGN KEY (source_order_item_id)
    REFERENCES public.order_items(id),
  CONSTRAINT return_items_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products(id),
  CONSTRAINT return_items_quantity_check CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS returns_source_order_id_idx
  ON public.returns (source_order_id);
CREATE INDEX IF NOT EXISTS returns_person_id_idx
  ON public.returns (person_id);
CREATE INDEX IF NOT EXISTS return_items_return_id_idx
  ON public.return_items (return_id);
-- Drives the over-return guard lookup on every confirm.
CREATE INDEX IF NOT EXISTS return_items_source_order_item_id_idx
  ON public.return_items (source_order_item_id);

-- -----------------------------------------------------------------------------
-- RLS (match existing permissive pattern)
-- -----------------------------------------------------------------------------
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for now" ON public.returns;
CREATE POLICY "Allow all for now" ON public.returns
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for now" ON public.return_items;
CREATE POLICY "Allow all for now" ON public.return_items
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
VALUES ('sales_return', COALESCE((SELECT MAX(return_number) FROM public.returns), 0))
ON CONFLICT (scope) DO UPDATE
SET last_value = GREATEST(public.order_number_counters.last_value, EXCLUDED.last_value);

-- assign_order_document_number hardcodes NEW.order_number, so returns get their own
-- (otherwise identical) trigger rather than making the shared one generic.
CREATE OR REPLACE FUNCTION public.assign_return_document_number()
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

  NEW.return_number := public.allocate_document_number('sales_return')::integer;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_returns_assign_number ON public.returns;
CREATE TRIGGER trg_returns_assign_number
  BEFORE INSERT ON public.returns
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_return_document_number();

-- Sync upserts hit ON CONFLICT UPDATE; keep the existing number so they cannot
-- collide with another document (mirrors preserve_document_order_number_on_update).
CREATE OR REPLACE FUNCTION public.preserve_return_number_on_update()
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

DROP TRIGGER IF EXISTS trg_returns_preserve_return_number ON public.returns;
CREATE TRIGGER trg_returns_preserve_return_number
  BEFORE UPDATE ON public.returns
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_return_number_on_update();

-- -----------------------------------------------------------------------------
-- Confirm: over-return guard + stock IN movements, one transaction.
-- Mirror of confirm_order_apply_stock_strict with the stock direction inverted;
-- there is no availability check because stock is arriving, not leaving.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_return_apply_stock(p_return_id uuid)
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
  rec_need record;
  v_sold integer;
  v_already integer;
  rec_line record;
  v_note text;
BEGIN
  IF p_return_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_return_id');
  END IF;

  SELECT
    r.id,
    r.warehouse_id,
    r.return_number,
    r.status_flow,
    COALESCE(r.is_historical_snapshot, false) AS is_hist
  INTO r_return
  FROM public.returns r
  WHERE r.id = p_return_id
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

  IF NOT EXISTS (SELECT 1 FROM public.return_items ri WHERE ri.return_id = p_return_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_lines');
  END IF;

  v_wh := r_return.warehouse_id;
  v_num := r_return.return_number;
  v_note := format('Return #%s', v_num);

  -- Lock the source order line before reading how much of it is already returned,
  -- so two concurrent returns cannot both pass the cap.
  FOR rec_need IN
    SELECT
      ri.source_order_item_id,
      ri.product_id,
      SUM(ri.quantity)::integer AS qty_req
    FROM public.return_items ri
    WHERE ri.return_id = p_return_id
    GROUP BY ri.source_order_item_id, ri.product_id
    ORDER BY ri.source_order_item_id
  LOOP
    SELECT oi.quantity
    INTO v_sold
    FROM public.order_items oi
    WHERE oi.id = rec_need.source_order_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'source_line_not_found');
    END IF;

    SELECT COALESCE(SUM(ri.quantity), 0)::integer
    INTO v_already
    FROM public.return_items ri
    JOIN public.returns r ON r.id = ri.return_id
    WHERE ri.source_order_item_id = rec_need.source_order_item_id
      AND r.id <> p_return_id
      AND r.status_flow <> 'cancelled';

    IF v_already + rec_need.qty_req > v_sold THEN
      v_violations := v_violations || jsonb_build_array(
        jsonb_build_object(
          'product_id', rec_need.product_id,
          'product_name', COALESCE((SELECT pr.name FROM public.products pr WHERE pr.id = rec_need.product_id), ''),
          'sold', v_sold,
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
    FROM public.return_items ri
    WHERE ri.return_id = p_return_id
    ORDER BY ri.created_at ASC NULLS LAST, ri.id ASC
  LOOP
    INSERT INTO public.product_warehouse_stock (product_id, warehouse_id, quantity, updated_at)
    VALUES (rec_line.product_id, v_wh, 0, now())
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, note)
    VALUES (rec_line.product_id, v_wh, 'in', rec_line.quantity, v_note);

    UPDATE public.product_warehouse_stock pws
    SET
      quantity = pws.quantity + rec_line.quantity,
      updated_at = now()
    WHERE pws.product_id = rec_line.product_id
      AND pws.warehouse_id = v_wh;
  END LOOP;

  -- Reversing a sale must not move the average cost: the goods come back from the same
  -- pool they left. Only refill it when confirm_order_apply_stock_strict cleared it at
  -- zero stock, otherwise the restocked units would be valued at NULL.
  UPDATE public.products p
  SET
    average_unit_cost = p.cost_price,
    updated_at = now()
  WHERE p.id IN (
      SELECT DISTINCT ri.product_id
      FROM public.return_items ri
      WHERE ri.return_id = p_return_id
    )
    AND p.average_unit_cost IS NULL
    AND COALESCE(p.cost_price, 0) > 0;

  UPDATE public.returns r
  SET
    status_flow = 'confirmed',
    updated_at = now()
  WHERE r.id = p_return_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_return_apply_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_return_apply_stock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_return_apply_stock(uuid) TO service_role;

COMMENT ON FUNCTION public.confirm_return_apply_stock(uuid) IS
  'Locks the return and its source order lines, rejects over-returns, applies in movements, sets the return confirmed — one transaction.';

COMMENT ON TABLE public.returns IS
  'Sales returns against a source order: stock back in, money refunded to register or credited to the customer account.';

NOTIFY pgrst, 'reload schema';
