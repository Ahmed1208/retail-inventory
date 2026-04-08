-- Inter-warehouse stock transfers (no pricing). Atomic via RPC.

CREATE SEQUENCE IF NOT EXISTS public.inventory_transfers_transfer_number_seq;

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transfer_number integer NOT NULL DEFAULT nextval('public.inventory_transfers_transfer_number_seq'::regclass),
  from_warehouse_id bigint NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id bigint NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (transfer_number),
  CONSTRAINT inventory_transfers_distinct_warehouses CHECK (from_warehouse_id <> to_warehouse_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_transfer_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (transfer_id, product_id),
  CONSTRAINT inventory_transfer_items_qty_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_created_at
  ON public.inventory_transfers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_transfer
  ON public.inventory_transfer_items(transfer_id);

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.inventory_transfers
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for now" ON public.inventory_transfer_items
  FOR ALL TO public USING (true) WITH CHECK (true);

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

  INSERT INTO public.inventory_transfers (from_warehouse_id, to_warehouse_id, note)
  VALUES (p_from_warehouse_id, p_to_warehouse_id, v_note)
  RETURNING id, transfer_number INTO v_id, v_num;

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

GRANT EXECUTE ON FUNCTION public.create_inventory_transfer(bigint, bigint, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.create_inventory_transfer(bigint, bigint, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_inventory_transfer(bigint, bigint, text, jsonb) TO service_role;
