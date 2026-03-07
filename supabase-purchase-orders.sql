-- Run this in Supabase SQL Editor to create Purchase Orders tables.

-- purchase_orders: one row per purchase order
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null,
  supplier_name text,
  note text,
  total_amount numeric not null default 0,
  status text not null check (status in ('received', 'cancelled')) default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- purchase_order_items: line items with product, quantity, cost, and whether default cost was updated
create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity integer not null check (quantity >= 1),
  cost_price numeric not null check (cost_price >= 0),
  total_price numeric not null check (total_price >= 0),
  previous_cost_price numeric,
  cost_price_updated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_order_items_order on purchase_order_items(purchase_order_id);
create index if not exists idx_purchase_orders_created_at on purchase_orders(created_at desc);

-- RLS: enable if you use Row Level Security (adjust policies as needed)
-- alter table purchase_orders enable row level security;
-- alter table purchase_order_items enable row level security;
