-- Idempotent: ensures warehouse id 1, PWS rows, and valid document warehouse FKs.
-- Runs after migrations when using `supabase db reset`.
SELECT public.ensure_default_warehouse();
