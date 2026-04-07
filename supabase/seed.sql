-- Idempotent: ensures warehouse id 1 exists after a destructive data reset.
-- Runs after migrations when using `supabase db reset`.

INSERT INTO public.warehouses (id, name, location, is_default)
VALUES (1, 'default', NULL, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  is_default = EXCLUDED.is_default;

SELECT setval(
  pg_get_serial_sequence('public.warehouses', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.warehouses), 1)
);
