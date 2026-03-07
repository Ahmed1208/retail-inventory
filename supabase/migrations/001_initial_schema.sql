-- =============================================================================
-- StockPilot — Initial schema
-- Run this on a fresh Supabase project to create all tables, indexes,
-- and RLS policies in the correct dependency order.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sequences (used by order_number columns)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.orders_order_number_seq;

CREATE SEQUENCE IF NOT EXISTS public.purchase_orders_order_number_seq;


-- -----------------------------------------------------------------------------
-- Table: brands
-- Reference data for product brands. No foreign key dependencies.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (name)
);

-- -----------------------------------------------------------------------------
-- Table: categories
-- Reference data for product categories. No foreign key dependencies.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (name)
);

-- -----------------------------------------------------------------------------
-- Table: products
-- Core product catalog. References brands and categories.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand_id uuid,
  category_id uuid,
  customer_price numeric(10,2) NOT NULL DEFAULT 0,
  business_price numeric(10,2) NOT NULL DEFAULT 0,
  cost_price numeric(10,2) DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  low_stock_threshold integer DEFAULT 5,
  unit text DEFAULT 'piece',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id)
    REFERENCES public.brands(id) ON DELETE SET NULL,
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.categories(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- Table: orders
-- Sales orders (retail/wholesale). No FK to other app tables.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number integer NOT NULL DEFAULT nextval('public.orders_order_number_seq'::regclass),
  type text NOT NULL,
  status text DEFAULT 'pending',
  payment_method text,
  note text,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (order_number),
  CONSTRAINT orders_type_check CHECK (type = ANY (ARRAY['retail'::text, 'wholesale'::text])),
  CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])),
  CONSTRAINT orders_payment_method_check CHECK (payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'transfer'::text, 'other'::text]))
);

-- -----------------------------------------------------------------------------
-- Table: order_items
-- Line items for sales orders. References orders and products.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  product_id uuid,
  quantity integer NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id)
    REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products(id) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- Table: stock_movements
-- Inventory in/out/adjustment log. References products.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid,
  type text,
  quantity integer NOT NULL,
  note text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT stock_movements_type_check CHECK (type = ANY (ARRAY['in'::text, 'out'::text, 'adjustment'::text]))
);

-- -----------------------------------------------------------------------------
-- Table: purchase_orders
-- Purchase orders (stock intake). No FK to other app tables.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number integer NOT NULL DEFAULT nextval('public.purchase_orders_order_number_seq'::regclass),
  supplier_name text,
  note text,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text DEFAULT 'received',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (order_number),
  CONSTRAINT purchase_orders_status_check CHECK (status = ANY (ARRAY['received'::text, 'cancelled'::text]))
);

-- -----------------------------------------------------------------------------
-- Table: purchase_order_items
-- Line items for purchase orders. References purchase_orders and products.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_order_id uuid,
  product_id uuid,
  quantity integer NOT NULL,
  cost_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  previous_cost_price numeric(10,2),
  cost_price_updated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id)
    REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products(id) ON DELETE RESTRICT
);


-- -----------------------------------------------------------------------------
-- Indexes (non-constraint: not created by PRIMARY KEY / UNIQUE)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order
  ON public.purchase_order_items(purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at
  ON public.purchase_orders(created_at DESC);


-- -----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- Enable RLS on all tables and add permissive policy for public access.
-- Adjust or add policies as needed for your auth model.
-- -----------------------------------------------------------------------------
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.brands
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for now" ON public.categories
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for now" ON public.products
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for now" ON public.orders
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for now" ON public.order_items
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for now" ON public.stock_movements
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for now" ON public.purchase_orders
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for now" ON public.purchase_order_items
  FOR ALL TO public USING (true) WITH CHECK (true);
