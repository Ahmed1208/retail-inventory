-- Single enum for the four tender methods + unified view for reporting.
-- Apply after 008 (method normalization). PostgREST accepts string literals for enum columns.

create type public.payment_method_t as enum ('cash', 'visa', 'cheque', 'instapay');

-- order_payments
alter table public.order_payments
  drop constraint if exists order_payments_payment_method_check;
alter table public.order_payments
  alter column payment_method type public.payment_method_t
  using (payment_method::public.payment_method_t);

-- purchase_order_payments
alter table public.purchase_order_payments
  drop constraint if exists purchase_order_payments_payment_method_check;
alter table public.purchase_order_payments
  alter column payment_method type public.payment_method_t
  using (payment_method::public.payment_method_t);

-- payment_installments
alter table public.payment_installments
  drop constraint if exists payment_installments_method_check;
alter table public.payment_installments
  alter column method type public.payment_method_t
  using (method::public.payment_method_t);

-- orders (nullable aggregate method)
alter table public.orders
  drop constraint if exists orders_payment_method_check;
alter table public.orders
  alter column payment_method type public.payment_method_t
  using (payment_method::public.payment_method_t);

-- balance_transactions (nullable; ledger + wallet splits)
alter table public.balance_transactions
  alter column payment_method type public.payment_method_t
  using (payment_method::public.payment_method_t);

create or replace view public.payment_tender_lines
with (security_invoker = true) as
select
  'order'::text as source,
  op.order_id as entity_id,
  op.id as line_id,
  op.payment_method::text as payment_method,
  op.amount,
  op.created_at
from public.order_payments op
union all
select
  'purchase_order',
  pop.purchase_order_id,
  pop.id,
  pop.payment_method::text,
  pop.amount,
  pop.created_at
from public.purchase_order_payments pop
union all
select
  case bt.type
    when 'payment_in' then 'balance_payment_in'
    when 'payment_out' then 'balance_payment_out'
    when 'wallet' then 'wallet'
    else bt.type::text
  end,
  bt.reference_id,
  bt.id,
  bt.payment_method::text,
  abs(bt.amount)::numeric(10, 2),
  bt.created_at
from public.balance_transactions bt
where bt.type in ('payment_in', 'payment_out', 'wallet')
  and bt.payment_method is not null;

comment on view public.payment_tender_lines is
  'Line-level tenders: order_payments, purchase_order_payments, and balance_transactions rows with a payment method.';

grant select on public.payment_tender_lines to anon, authenticated, service_role;
