-- POS-style orders (requested filename note: use 005 because 004_add_people_and_balance exists)

alter table orders
add column if not exists status_flow text check (
  status_flow in ('draft', 'confirmed', 'completed', 'cancelled')
) default 'draft';

alter table orders
add column if not exists paid_amount decimal(10,2) not null default 0;

alter table orders
add column if not exists remaining_amount decimal(10,2) not null default 0;

alter table orders
add column if not exists discount_amount decimal(10,2) not null default 0;

alter table orders
add column if not exists discount_rate decimal(5,2) not null default 0;

alter table orders
add column if not exists subtotal decimal(10,2) not null default 0;

alter table orders
add column if not exists allow_remaining_on_account boolean not null default false;

alter table order_items
add column if not exists line_discount_rate decimal(5,2) not null default 0;

create table if not exists payment_installments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references orders(id) on delete cascade,
  method text check (method in ('cash', 'card', 'transfer', 'other')) not null,
  amount decimal(10,2) not null,
  note text,
  created_at timestamptz default now()
);

alter table payment_installments enable row level security;
drop policy if exists "Allow all for now" on payment_installments;
create policy "Allow all for now" on payment_installments for all using (true);

-- Fix legacy rows (column default 'draft' applies to existing rows until updated)
update orders
set status_flow = case
  when status = 'cancelled' then 'cancelled'
  when status = 'completed' then 'completed'
  else 'confirmed'
end;

update orders
set
  subtotal = case when coalesce(subtotal, 0) = 0 then total_amount else subtotal end,
  discount_amount = 0,
  discount_rate = 0;

update orders o
set paid_amount = coalesce(
  (select sum(op.amount) from order_payments op where op.order_id = o.id),
  0
);

update orders
set remaining_amount = greatest(0::numeric, total_amount - paid_amount);

update orders
set paid_amount = total_amount,
    remaining_amount = 0
where status = 'completed';

insert into payment_installments (order_id, method, amount, note)
select op.order_id, op.payment_method::text, op.amount, null
from order_payments op
where not exists (
  select 1 from payment_installments pi
  where pi.order_id = op.order_id
    and pi.method = op.payment_method::text
    and pi.amount = op.amount
);
