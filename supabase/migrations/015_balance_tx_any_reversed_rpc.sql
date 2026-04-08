-- Server-side check so reversal stays idempotent even when PostgREST omits `reversed_at` from SELECT responses.

create or replace function public.balance_tx_any_reversed(p_ids uuid[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.balance_transactions
    where id = any (p_ids)
      and reversed_at is not null
  );
$$;

revoke all on function public.balance_tx_any_reversed(uuid[]) from public;
grant execute on function public.balance_tx_any_reversed(uuid[]) to anon;
grant execute on function public.balance_tx_any_reversed(uuid[]) to authenticated;
grant execute on function public.balance_tx_any_reversed(uuid[]) to service_role;

notify pgrst, 'reload schema';
