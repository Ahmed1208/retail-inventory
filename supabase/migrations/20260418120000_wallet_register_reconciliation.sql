-- Wallet and register reconciliation from balance_transactions ledger, sync fan-out, alerts.

-- -----------------------------------------------------------------------------
-- stock_alerts: new operator-facing types (wallet / register)
-- -----------------------------------------------------------------------------
ALTER TABLE public.stock_alerts DROP CONSTRAINT IF EXISTS stock_alerts_alert_type_check;

ALTER TABLE public.stock_alerts
  ADD CONSTRAINT stock_alerts_alert_type_check CHECK (
    alert_type = ANY (
      ARRAY[
        'negative_stock'::text,
        'low_stock'::text,
        'order_number_repair'::text,
        'sync_conflict'::text,
        'info'::text,
        'wallet_direction_changed'::text,
        'register_negative_balance'::text
      ]
    )
  );

-- -----------------------------------------------------------------------------
-- Known devices (app calls touch_sync_device) for sync_event_queue fan-out
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_known_devices (
  device_id text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_known_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_known_devices_all ON public.sync_known_devices;
CREATE POLICY sync_known_devices_all
  ON public.sync_known_devices
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.sync_known_devices IS
  'Client device ids (localStorage) for fan-out sync_event_queue rows after ledger/register changes.';

CREATE OR REPLACE FUNCTION public.touch_sync_device(p_device_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  v := nullif(btrim(coalesce(p_device_id, '')), '');
  IF v IS NULL OR v = 'ssr' THEN
    RETURN;
  END IF;
  INSERT INTO public.sync_known_devices (device_id, last_seen_at)
  VALUES (v, now())
  ON CONFLICT (device_id) DO UPDATE
  SET last_seen_at = excluded.last_seen_at;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_sync_device(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_sync_device(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_sync_device(text) TO service_role;

-- -----------------------------------------------------------------------------
-- Materialized register tender balances (updated only by reconciliation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.register_tender_balances (
  register_warehouse_id bigint NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  payment_method text NOT NULL,
  balance numeric(14, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT register_tender_balances_method_check CHECK (
    payment_method = ANY (ARRAY['cash', 'visa', 'cheque', 'instapay']::text[])
  ),
  CONSTRAINT register_tender_balances_pkey PRIMARY KEY (register_warehouse_id, payment_method)
);

CREATE INDEX IF NOT EXISTS register_tender_balances_wh_idx
  ON public.register_tender_balances (register_warehouse_id);

ALTER TABLE public.register_tender_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS register_tender_balances_select ON public.register_tender_balances;
CREATE POLICY register_tender_balances_select
  ON public.register_tender_balances
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.register_tender_balances IS
  'Per-register-warehouse tender balances derived only from balance_transactions replay.';

-- -----------------------------------------------------------------------------
-- Mirror reversal adjustment rows (must match app LEDGER_REVERSAL_ADJUSTMENT_NOTE)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.balance_tx_counts_toward_wallet_running(bt public.balance_transactions)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT bt.reversed_at IS NULL
    AND NOT (
      bt.type = 'adjustment'::text
      AND trim(coalesce(bt.note, '')) = 'Reversal of recorded payment'::text
    );
$$;

CREATE OR REPLACE FUNCTION public.register_delta_from_balance_tx(bt public.balance_transactions)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN bt.reversed_at IS NOT NULL THEN 0::numeric
    WHEN bt.type = 'payment_in'::text THEN (-bt.amount::numeric)
    WHEN bt.type = 'payment_out'::text THEN (-bt.amount::numeric)
    WHEN bt.type = 'register_deposit'::text
      AND bt.payment_method IS NOT NULL THEN abs(bt.amount::numeric)
    WHEN bt.type = 'register_withdraw'::text
      AND bt.payment_method IS NOT NULL THEN (-abs(bt.amount::numeric))
    ELSE 0::numeric
  END;
$$;

CREATE OR REPLACE FUNCTION public.register_method_for_balance_tx(bt public.balance_transactions)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN bt.type IN ('payment_in', 'payment_out') THEN coalesce(bt.payment_method::text, 'cash')
    WHEN bt.type IN ('register_deposit', 'register_withdraw') THEN bt.payment_method::text
    ELSE NULL::text
  END;
$$;

-- -----------------------------------------------------------------------------
-- Wallet: replay ledger -> people.balance (positive = person owes you)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_wallet_from_balance_transactions(p_person_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old numeric(14, 2);
  v_new numeric(14, 2);
  v_name text;
BEGIN
  IF p_person_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT round(coalesce(p.balance, 0)::numeric, 2)
  INTO v_old
  FROM public.people p
  WHERE p.id = p_person_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT round(coalesce(sum(bt.amount::numeric), 0), 2)
  INTO v_new
  FROM public.balance_transactions bt
  WHERE bt.person_id = p_person_id
    AND public.balance_tx_counts_toward_wallet_running(bt);

  UPDATE public.people p
  SET
    balance = v_new::double precision,
    updated_at = now()
  WHERE p.id = p_person_id;

  IF
    coalesce(current_setting('app.wallet_register_reconcile_skip_alerts', true), '') <> '1'
    AND v_old > 0::numeric
    AND v_new < 0::numeric
  THEN
    SELECT p.name INTO v_name FROM public.people p WHERE p.id = p_person_id;
    INSERT INTO public.stock_alerts (
      alert_type,
      title,
      message,
      product_id,
      quantity_after,
      meta
    )
    VALUES (
      'wallet_direction_changed',
      'Balance direction changed',
      format(
        'After reconciliation, %s went from a positive balance (they owed you) to negative (you may owe them). Please review.',
        coalesce(v_name, 'this person')
      ),
      NULL,
      NULL,
      jsonb_build_object(
        'person_id', p_person_id::text,
        'balance_before', v_old,
        'balance_after', v_new
      )
    );
  END IF;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_wallet_from_balance_transactions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_wallet_from_balance_transactions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_wallet_from_balance_transactions(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.recalculate_wallets_for_all_people()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
  n int := 0;
BEGIN
  FOR pid IN
    SELECT id
    FROM public.people
  LOOP
    PERFORM public.recalculate_wallet_from_balance_transactions(pid);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_wallets_for_all_people() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_wallets_for_all_people() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_wallets_for_all_people() TO service_role;

-- -----------------------------------------------------------------------------
-- Register: replay register-affecting rows -> register_tender_balances
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_register_from_balance_transactions(p_register_warehouse_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m text;
  v_bal numeric(14, 2);
  v_wh_name text;
BEGIN
  IF p_register_warehouse_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.register_tender_balances r
  WHERE r.register_warehouse_id = p_register_warehouse_id;

  FOR m IN SELECT unnest(ARRAY['cash', 'visa', 'cheque', 'instapay']::text[])
  LOOP
    SELECT round(coalesce(sum(public.register_delta_from_balance_tx(bt)), 0), 2)
    INTO v_bal
    FROM public.balance_transactions bt
    WHERE bt.register_warehouse_id = p_register_warehouse_id
      AND bt.type IN ('payment_in', 'payment_out', 'register_deposit', 'register_withdraw')
      AND coalesce(public.register_method_for_balance_tx(bt), '__skip__') = m;

    INSERT INTO public.register_tender_balances (
      register_warehouse_id,
      payment_method,
      balance,
      updated_at
    )
    VALUES (p_register_warehouse_id, m, v_bal, now());

    IF
      coalesce(current_setting('app.wallet_register_reconcile_skip_alerts', true), '') <> '1'
      AND v_bal < 0::numeric
    THEN
      SELECT w.name INTO v_wh_name FROM public.warehouses w WHERE w.id = p_register_warehouse_id;
      INSERT INTO public.stock_alerts (
        alert_type,
        title,
        message,
        product_id,
        quantity_after,
        meta
      )
      VALUES (
        'register_negative_balance',
        'Register balance negative',
        format(
          'After reconciliation, register at %s has a negative %s balance (%s). Please review.',
          coalesce(v_wh_name, 'warehouse ' || p_register_warehouse_id::text),
          m,
          trim(to_char(v_bal, '9999999990.99'))
        ),
        NULL,
        NULL,
        jsonb_build_object(
          'register_warehouse_id', p_register_warehouse_id,
          'payment_method', m,
          'balance', v_bal
        )
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_register_from_balance_transactions(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_register_from_balance_transactions(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_register_from_balance_transactions(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.recalculate_all_register_balances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid bigint;
  n int := 0;
BEGIN
  FOR wid IN
    SELECT w.id
    FROM public.warehouses w
    WHERE w.has_register = true
  LOOP
    PERFORM public.recalculate_register_from_balance_transactions(wid);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_all_register_balances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_all_register_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_register_balances() TO service_role;

-- -----------------------------------------------------------------------------
-- Fan-out payment ledger sync to all known devices
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fanout_payment_ledger_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sync_event_queue (target_device_id, event_type, payload)
  SELECT
    d.device_id,
    'payment_ledger',
    jsonb_build_object(
      'tables',
      ARRAY[
        'people',
        'balance_transactions',
        'registerBalances',
        'register_tender_balances',
        'stockAlerts',
        'payments',
        'orders',
        'purchaseOrders'
      ]::text[]
    )
  FROM public.sync_known_devices d;
END;
$$;

REVOKE ALL ON FUNCTION public.fanout_payment_ledger_sync() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fanout_payment_ledger_sync() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fanout_payment_ledger_sync() TO service_role;

-- -----------------------------------------------------------------------------
-- Trigger: reconcile wallet + register + fan-out (per row)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_balance_transactions_reconcile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.person_id IS NOT NULL THEN
      PERFORM public.recalculate_wallet_from_balance_transactions(OLD.person_id);
    END IF;
    IF OLD.register_warehouse_id IS NOT NULL THEN
      PERFORM public.recalculate_register_from_balance_transactions(OLD.register_warehouse_id);
    END IF;
    PERFORM public.fanout_payment_ledger_sync();
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.person_id IS DISTINCT FROM NEW.person_id THEN
      IF OLD.person_id IS NOT NULL THEN
        PERFORM public.recalculate_wallet_from_balance_transactions(OLD.person_id);
      END IF;
    END IF;
    IF OLD.register_warehouse_id IS DISTINCT FROM NEW.register_warehouse_id THEN
      IF OLD.register_warehouse_id IS NOT NULL THEN
        PERFORM public.recalculate_register_from_balance_transactions(OLD.register_warehouse_id);
      END IF;
    END IF;
  END IF;

  IF NEW.person_id IS NOT NULL THEN
    PERFORM public.recalculate_wallet_from_balance_transactions(NEW.person_id);
  END IF;
  IF NEW.register_warehouse_id IS NOT NULL THEN
    PERFORM public.recalculate_register_from_balance_transactions(NEW.register_warehouse_id);
  END IF;

  PERFORM public.fanout_payment_ledger_sync();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_balance_transactions_reconcile ON public.balance_transactions;
CREATE TRIGGER trg_balance_transactions_reconcile
  AFTER INSERT OR UPDATE OF reversed_at, person_id, register_warehouse_id OR DELETE
  ON public.balance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_balance_transactions_reconcile();

-- -----------------------------------------------------------------------------
-- Initial backfill (best-effort)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  pid uuid;
  wid bigint;
BEGIN
  PERFORM set_config('app.wallet_register_reconcile_skip_alerts', '1', false);
  FOR pid IN SELECT id FROM public.people
  LOOP
    PERFORM public.recalculate_wallet_from_balance_transactions(pid);
  END LOOP;

  FOR wid IN SELECT id FROM public.warehouses WHERE has_register = true
  LOOP
    PERFORM public.recalculate_register_from_balance_transactions(wid);
  END LOOP;
  PERFORM set_config('app.wallet_register_reconcile_skip_alerts', '', false);
END $$;

-- -----------------------------------------------------------------------------
-- Realtime (optional)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.balance_transactions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.register_tender_balances;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
