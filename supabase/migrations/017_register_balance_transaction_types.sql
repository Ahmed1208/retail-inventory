-- Register-only movements (cash drawer): manual add / remove by tender type.
-- Convention: amount is always positive (magnitude). register_deposit adds to register;
-- register_withdraw subtracts. person_id is null; payment_method is required.

alter table public.balance_transactions
  drop constraint if exists balance_transactions_type_check;

alter table public.balance_transactions
  add constraint balance_transactions_type_check check (
    type = any (
      array[
        'order',
        'purchase_order',
        'payment_in',
        'payment_out',
        'adjustment',
        'wallet',
        'register_deposit',
        'register_withdraw'
      ]::text[]
    )
  );
