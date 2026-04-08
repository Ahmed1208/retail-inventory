-- =============================================================================
-- Ledger payment reversal — apply once on your Supabase project
-- Run in: Dashboard → SQL Editor → New query → paste → Run
--
-- Fixes: "Could not find the 'reversed_at' column ... in the schema cache"
--        "Could not find the function set_balance_transactions_reversed_at ..."
--
-- After this runs, wait ~1 minute or restart the project (Settings → General)
-- if the app still errors; NOTIFY usually reloads PostgREST immediately.
-- =============================================================================

-- 013: column + index
alter table public.balance_transactions
  add column if not exists reversed_at timestamptz;

create index if not exists balance_transactions_reversed_at_idx
  on public.balance_transactions (reversed_at)
  where reversed_at is not null;

-- 014: RPC to set reversed_at (bypasses stale column cache on PATCH)
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

-- 015: RPC idempotency check
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

-- Verify (optional — run separately; should return 1 row each)
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'balance_transactions' and column_name = 'reversed_at';
-- select proname, pg_get_function_identity_arguments(oid) from pg_proc
--   where pronamespace = 'public'::regnamespace and proname in ('set_balance_transactions_reversed_at', 'balance_tx_any_reversed');
