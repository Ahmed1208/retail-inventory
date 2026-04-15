-- Per-warehouse cash register flag + ledger attribution (register_warehouse_id).

-- -----------------------------------------------------------------------------
-- warehouses.has_register (default WH must have register)
-- -----------------------------------------------------------------------------
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS has_register boolean NOT NULL DEFAULT false;

UPDATE public.warehouses SET has_register = true WHERE id = 1;

ALTER TABLE public.warehouses DROP CONSTRAINT IF EXISTS warehouses_default_has_register;
ALTER TABLE public.warehouses
  ADD CONSTRAINT warehouses_default_has_register
  CHECK (NOT is_default OR has_register = true);

-- -----------------------------------------------------------------------------
-- balance_transactions.register_warehouse_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.balance_transactions
  ADD COLUMN IF NOT EXISTS register_warehouse_id bigint REFERENCES public.warehouses(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS balance_transactions_register_warehouse_id_idx
  ON public.balance_transactions(register_warehouse_id)
  WHERE register_warehouse_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.balance_transactions_register_wh_check()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.register_warehouse_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.warehouses w
      WHERE w.id = NEW.register_warehouse_id AND w.has_register = true
    ) THEN
      RAISE EXCEPTION 'register_warehouse_id must reference a warehouse with has_register = true';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_balance_tx_register_wh ON public.balance_transactions;
CREATE TRIGGER trg_balance_tx_register_wh
  BEFORE INSERT OR UPDATE OF register_warehouse_id ON public.balance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.balance_transactions_register_wh_check();

-- -----------------------------------------------------------------------------
-- Backfill: legacy rows → WH 1, then refine from order/PO warehouse when register WH
-- -----------------------------------------------------------------------------
UPDATE public.balance_transactions
SET register_warehouse_id = 1
WHERE register_warehouse_id IS NULL
  AND type IN ('payment_in', 'payment_out', 'register_deposit', 'register_withdraw');

UPDATE public.balance_transactions bt
SET register_warehouse_id = o.warehouse_id
FROM public.orders o
JOIN public.warehouses w ON w.id = o.warehouse_id AND w.has_register = true
WHERE bt.reference_id = o.id
  AND bt.type IN ('payment_in', 'payment_out')
  AND bt.reference_number IS NOT NULL
  AND bt.reference_number LIKE 'O-%';

UPDATE public.balance_transactions bt
SET register_warehouse_id = po.warehouse_id
FROM public.purchase_orders po
JOIN public.warehouses w ON w.id = po.warehouse_id AND w.has_register = true
WHERE bt.reference_id = po.id
  AND bt.type IN ('payment_in', 'payment_out')
  AND bt.reference_number IS NOT NULL
  AND bt.reference_number LIKE 'PO-%';

-- -----------------------------------------------------------------------------
-- ensure_default_warehouse: default row has register
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_default_warehouse()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.warehouses (id, name, location, is_default, has_register)
  VALUES (1, 'default', NULL, true, true)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.warehouses SET has_register = true WHERE id = 1;

  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE is_default = true) THEN
    UPDATE public.warehouses SET is_default = false WHERE is_default = true;
    UPDATE public.warehouses SET is_default = true WHERE id = 1;
  END IF;

  PERFORM setval(
    pg_get_serial_sequence('public.warehouses', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.warehouses), 1)
  );

  INSERT INTO public.product_warehouse_stock (product_id, warehouse_id, quantity)
  SELECT p.id, 1, GREATEST(0, COALESCE(p.quantity, 0)::integer)
  FROM public.products p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.product_warehouse_stock s
    WHERE s.product_id = p.id AND s.warehouse_id = 1
  );

  UPDATE public.orders o
  SET warehouse_id = 1
  WHERE NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = o.warehouse_id);

  UPDATE public.purchase_orders po
  SET warehouse_id = 1
  WHERE NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = po.warehouse_id);

  UPDATE public.stock_movements sm
  SET warehouse_id = 1
  WHERE NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = sm.warehouse_id);
END;
$$;
