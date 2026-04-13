-- Data sync: upsert public.profiles when auth.users already has the same id (local and hosted are separate Auth projects).

CREATE OR REPLACE FUNCTION public.upsert_profile_for_data_sync(
  p_id uuid,
  p_username text,
  p_is_admin boolean,
  p_feature_overrides jsonb,
  p_allowed_warehouse_ids bigint[],
  p_created_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'auth_user_missing');
  END IF;

  INSERT INTO public.profiles (
    id,
    username,
    is_admin,
    feature_overrides,
    allowed_warehouse_ids,
    created_at
  )
  VALUES (
    p_id,
    btrim(COALESCE(p_username, '')),
    COALESCE(p_is_admin, false),
    COALESCE(p_feature_overrides, '{}'::jsonb),
    COALESCE(p_allowed_warehouse_ids, '{}'::bigint[]),
    COALESCE(p_created_at, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    is_admin = EXCLUDED.is_admin,
    feature_overrides = EXCLUDED.feature_overrides,
    allowed_warehouse_ids = EXCLUDED.allowed_warehouse_ids;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.upsert_profile_for_data_sync(uuid, text, boolean, jsonb, bigint[], timestamptz) IS
  'Used by Admin data sync: insert/update profiles only when auth.users contains p_id. Skips when ok=false and reason=auth_user_missing.';

REVOKE ALL ON FUNCTION public.upsert_profile_for_data_sync(uuid, text, boolean, jsonb, bigint[], timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_profile_for_data_sync(uuid, text, boolean, jsonb, bigint[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_profile_for_data_sync(uuid, text, boolean, jsonb, bigint[], timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
