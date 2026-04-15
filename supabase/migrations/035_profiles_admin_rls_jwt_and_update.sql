-- Align RLS with app: admins may use JWT user_metadata.is_admin when profiles row is missing or not yet is_admin.
-- Allow admins to UPDATE other operators' profiles (feature_overrides, etc.).

DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;

CREATE POLICY profiles_select_own_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles admin_row
      WHERE admin_row.id = (SELECT auth.uid())
        AND admin_row.is_admin = true
    )
    OR COALESCE(
      lower(trim((auth.jwt() -> 'user_metadata' ->> 'is_admin'))) IN ('true', '1', 't', 'yes'),
      false
    )
  );

CREATE POLICY profiles_update_by_admin
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles ar
      WHERE ar.id = (SELECT auth.uid())
        AND ar.is_admin = true
    )
    OR COALESCE(
      lower(trim((auth.jwt() -> 'user_metadata' ->> 'is_admin'))) IN ('true', '1', 't', 'yes'),
      false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles ar
      WHERE ar.id = (SELECT auth.uid())
        AND ar.is_admin = true
    )
    OR COALESCE(
      lower(trim((auth.jwt() -> 'user_metadata' ->> 'is_admin'))) IN ('true', '1', 't', 'yes'),
      false
    )
  );

NOTIFY pgrst, 'reload schema';
