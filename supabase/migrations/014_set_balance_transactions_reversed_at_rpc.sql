-- PostgREST can serve a stale schema cache after adding `reversed_at`; REST updates may fail until reload.
-- This RPC updates the column inside Postgres so reversal still works once the function exists.

create or replace function public.set_balance_transactions_reversed_at(
  p_ids uuid[],
  p_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return;
  end if;
  update public.balance_transactions
  set reversed_at = p_at
  where id = any (p_ids);
end;
$$;

revoke all on function public.set_balance_transactions_reversed_at(uuid[], timestamptz) from public;
grant execute on function public.set_balance_transactions_reversed_at(uuid[], timestamptz) to anon;
grant execute on function public.set_balance_transactions_reversed_at(uuid[], timestamptz) to authenticated;
grant execute on function public.set_balance_transactions_reversed_at(uuid[], timestamptz) to service_role;

notify pgrst, 'reload schema';
