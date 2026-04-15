-- Warehouse RLS on orders / PO / transfers is TO authenticated. allocate_document_number
-- runs as SECURITY DEFINER (migration owner, e.g. supabase_admin), so MAX(...) saw
-- no rows unless row_security=off applies. Some hosts omit function SET options; granting
-- that role SELECT on these tables makes the floor query reliable.

DO $do$
DECLARE
  owner_name text;
BEGIN
  SELECT r.rolname
  INTO owner_name
  FROM pg_proc p
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.oid = 'public.allocate_document_number(text)'::regprocedure;

  IF owner_name IS NULL THEN
    RAISE EXCEPTION 'public.allocate_document_number(text) not found';
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS orders_select_for_allocate_doc_number ON public.orders';
  EXECUTE format(
    $sql$
    CREATE POLICY orders_select_for_allocate_doc_number ON public.orders
    FOR SELECT TO %I
    USING (true)
    $sql$,
    owner_name
  );

  EXECUTE 'DROP POLICY IF EXISTS purchase_orders_select_for_allocate_doc_number ON public.purchase_orders';
  EXECUTE format(
    $sql$
    CREATE POLICY purchase_orders_select_for_allocate_doc_number ON public.purchase_orders
    FOR SELECT TO %I
    USING (true)
    $sql$,
    owner_name
  );

  EXECUTE 'DROP POLICY IF EXISTS inventory_transfers_select_for_allocate_doc_number ON public.inventory_transfers';
  EXECUTE format(
    $sql$
    CREATE POLICY inventory_transfers_select_for_allocate_doc_number ON public.inventory_transfers
    FOR SELECT TO %I
    USING (true)
    $sql$,
    owner_name
  );
END
$do$;
