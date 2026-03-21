-- Order payments: multiple payment methods with amounts per order
CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_method text NOT NULL,
  amount numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT order_payments_payment_method_check CHECK (
    payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'transfer'::text, 'other'::text])
  ),
  CONSTRAINT order_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON public.order_payments(order_id);
