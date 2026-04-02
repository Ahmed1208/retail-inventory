-- Human-readable refs for standalone balance payments: PI-*, PY-* (see recordPayment).

create sequence if not exists public.ledger_standalone_pi_seq
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create sequence if not exists public.ledger_standalone_py_seq
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create or replace function public.next_standalone_ledger_ref(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type = 'payment_in' then
    return 'PI-' || nextval('public.ledger_standalone_pi_seq')::text;
  elsif p_type = 'payment_out' then
    return 'PY-' || nextval('public.ledger_standalone_py_seq')::text;
  else
    raise exception 'next_standalone_ledger_ref: invalid type %', p_type;
  end if;
end;
$$;

revoke all on function public.next_standalone_ledger_ref(text) from public;
grant execute on function public.next_standalone_ledger_ref(text) to anon;
grant execute on function public.next_standalone_ledger_ref(text) to authenticated;
grant execute on function public.next_standalone_ledger_ref(text) to service_role;

notify pgrst, 'reload schema';
