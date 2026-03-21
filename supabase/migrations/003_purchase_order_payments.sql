-- Purchase order payments: multiple payment methods with amounts per purchase order
CREATE TABLE IF NOT EXISTS public.purchase_order_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  payment_method text NOT NULL,
  amount numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT purchase_order_payments_payment_method_check CHECK (
    payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'transfer'::text, 'other'::text])
  ),
  CONSTRAINT purchase_order_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_payments_po_id ON public.purchase_order_payments(purchase_order_id);

ALTER TABLE public.purchase_order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.purchase_order_payments
  FOR ALL TO public USING (true) WITH CHECK (true);
