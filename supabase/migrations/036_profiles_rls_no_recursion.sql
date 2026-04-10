-- Fix infinite recursion: policies must not SELECT public.profiles while evaluating RLS on profiles.
-- Use SECURITY DEFINER so the admin check reads profiles without re-entering RLS.

CREATE OR REPLACE FUNCTION public.current_user_is_operator_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  )
  OR COALESCE(
    lower(trim((auth.jwt() -> 'user_metadata' ->> 'is_admin'))) IN ('true', '1', 't', 'yes'),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_operator_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_operator_admin() TO authenticated;

COMMENT ON FUNCTION public.current_user_is_operator_admin() IS
  'True if the session user is an app admin (profiles.is_admin or JWT user_metadata.is_admin). Used by profiles RLS; bypasses RLS to avoid recursion.';

DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_by_admin ON public.profiles;

CREATE POLICY profiles_select_own_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.current_user_is_operator_admin()
  );

CREATE POLICY profiles_update_by_admin
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_operator_admin())
  WITH CHECK (public.current_user_is_operator_admin());

NOTIFY pgrst, 'reload schema';
