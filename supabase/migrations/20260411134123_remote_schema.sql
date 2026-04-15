drop extension if exists "pg_net";

drop policy "Allow all for now" on "public"."brands";

drop policy "Allow all for now" on "public"."categories";

drop policy "Allow all for now" on "public"."order_items";

drop policy "Allow all for now" on "public"."orders";

drop policy "Allow all for now" on "public"."products";

drop policy "Allow all for now" on "public"."purchase_order_items";

drop policy "Allow all for now" on "public"."purchase_orders";

drop policy "Allow all for now" on "public"."stock_movements";

drop function if exists "public"."person_phone_conflict"(p_phone text, p_exclude_person_id uuid);

drop function if exists "public"."person_phone_is_duplicate"(p_phone text, p_exclude_person_id uuid);

drop index if exists "public"."people_phone_lower_trim_unique";

alter table "public"."order_payments" enable row level security;

alter sequence "public"."orders_order_number_seq" owned by "public"."orders"."order_number";

alter sequence "public"."purchase_orders_order_number_seq" owned by "public"."purchase_orders"."order_number";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;


  create policy "Allow all for now"
  on "public"."order_payments"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Allow all for now"
  on "public"."brands"
  as permissive
  for all
  to public
using (true);



  create policy "Allow all for now"
  on "public"."categories"
  as permissive
  for all
  to public
using (true);



  create policy "Allow all for now"
  on "public"."order_items"
  as permissive
  for all
  to public
using (true);



  create policy "Allow all for now"
  on "public"."orders"
  as permissive
  for all
  to public
using (true);



  create policy "Allow all for now"
  on "public"."products"
  as permissive
  for all
  to public
using (true);



  create policy "Allow all for now"
  on "public"."purchase_order_items"
  as permissive
  for all
  to public
using (true);



  create policy "Allow all for now"
  on "public"."purchase_orders"
  as permissive
  for all
  to public
using (true);



  create policy "Allow all for now"
  on "public"."stock_movements"
  as permissive
  for all
  to public
using (true);



