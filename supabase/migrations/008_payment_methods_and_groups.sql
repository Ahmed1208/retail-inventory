-- Payment methods: cash, visa, cheque, instapay (replaces card/transfer/other).
-- payment_group_id links split tender lines into one logical payment for the All payments list.

-- 1) Ledger: group id + normalize legacy method values (no CHECK on payment_method)
alter table balance_transactions
  add column if not exists payment_group_id uuid;

create index if not exists balance_transactions_payment_group_id_idx
  on balance_transactions (payment_group_id)
  where payment_group_id is not null;

update balance_transactions set payment_method = 'visa' where payment_method = 'card';
update balance_transactions set payment_method = 'instapay' where payment_method = 'transfer';
update balance_transactions set payment_method = 'cheque' where payment_method = 'other';

-- 2) orders — drop check, migrate, re-add
alter table orders drop constraint if exists orders_payment_method_check;

update orders set payment_method = 'visa' where payment_method = 'card';
update orders set payment_method = 'instapay' where payment_method = 'transfer';
update orders set payment_method = 'cheque' where payment_method = 'other';

alter table orders add constraint orders_payment_method_check check (
  payment_method is null
  or payment_method = any (array['cash', 'visa', 'cheque', 'instapay']::text[])
);

-- 3) order_payments
alter table order_payments drop constraint if exists order_payments_payment_method_check;

update order_payments set payment_method = 'visa' where payment_method = 'card';
update order_payments set payment_method = 'instapay' where payment_method = 'transfer';
update order_payments set payment_method = 'cheque' where payment_method = 'other';

alter table order_payments add constraint order_payments_payment_method_check check (
  payment_method = any (array['cash', 'visa', 'cheque', 'instapay']::text[])
);

-- 4) purchase_order_payments
alter table purchase_order_payments drop constraint if exists purchase_order_payments_payment_method_check;

update purchase_order_payments set payment_method = 'visa' where payment_method = 'card';
update purchase_order_payments set payment_method = 'instapay' where payment_method = 'transfer';
update purchase_order_payments set payment_method = 'cheque' where payment_method = 'other';

alter table purchase_order_payments add constraint purchase_order_payments_payment_method_check check (
  payment_method = any (array['cash', 'visa', 'cheque', 'instapay']::text[])
);

-- 5) payment_installments — drop any CHECK on the table, migrate, re-add
do $$
declare
  r record;
begin
  for r in (
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'payment_installments'
      and c.contype = 'c'
  ) loop
    execute format('alter table public.payment_installments drop constraint %I', r.conname);
  end loop;
end $$;

update payment_installments set method = 'visa' where method = 'card';
update payment_installments set method = 'instapay' where method = 'transfer';
update payment_installments set method = 'cheque' where method = 'other';

alter table payment_installments add constraint payment_installments_method_check check (
  method = any (array['cash', 'visa', 'cheque', 'instapay']::text[])
);
