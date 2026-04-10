-- Pick up new columns (e.g. purchase_orders.discount_amount from 030) without waiting
-- for the default PostgREST cache refresh.
NOTIFY pgrst, 'reload schema';
