-- People (contacts) and balance ledger
-- Note: repo already had 003_purchase_order_payments.sql; this is the next migration.

create table people (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  address text,
  notes text,
  roles text[] not null default '{}',
  balance decimal(10,2) not null default 0,
  discount_rate decimal(5,2) default 0,
  credit_limit decimal(10,2) default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table balance_transactions (
  id uuid default gen_random_uuid() primary key,
  person_id uuid references people(id) on delete restrict,
  type text check (type in (
    'order',
    'purchase_order',
    'payment_in',
    'payment_out',
    'adjustment'
  )) not null,
  amount decimal(10,2) not null,
  reference_id uuid default null,
  reference_number text default null,
  note text,
  created_at timestamptz default now()
);

alter table orders
add column person_id uuid references people(id) on delete set null;

alter table purchase_orders
add column person_id uuid references people(id) on delete set null;

alter table people enable row level security;
alter table balance_transactions enable row level security;
create policy "Allow all for now" on people for all using (true);
create policy "Allow all for now" on balance_transactions for all using (true);
