-- Wallet ledger rows (overpayment credit) + PO paid/remaining tracking
-- Apply after 007 (payment_method on balance_transactions) and 008 (payment_group_id).
-- Adds type `wallet`, wallet_direction, and optional PO paid_amount / remaining_amount.

alter table balance_transactions
  add column if not exists wallet_direction text;

alter table balance_transactions drop constraint if exists balance_transactions_type_check;

alter table balance_transactions add constraint balance_transactions_type_check check (
  type = any (
    array[
      'order',
      'purchase_order',
      'payment_in',
      'payment_out',
      'adjustment',
      'wallet'
    ]::text[]
  )
);

alter table balance_transactions add constraint balance_transactions_wallet_direction_check check (
  wallet_direction is null
  or wallet_direction = any (array['in', 'out']::text[])
);

alter table purchase_orders
  add column if not exists paid_amount decimal(10,2) not null default 0;

alter table purchase_orders
  add column if not exists remaining_amount decimal(10,2) not null default 0;

update purchase_orders po
set
  paid_amount = coalesce((
    select sum(p.amount)
    from purchase_order_payments p
    where p.purchase_order_id = po.id
  ), 0),
  remaining_amount = greatest(
    0::numeric,
    po.total_amount - coalesce((
      select sum(p.amount)
      from purchase_order_payments p
      where p.purchase_order_id = po.id
    ), 0)
  )
where true;
