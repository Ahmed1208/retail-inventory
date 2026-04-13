-- Robust parsing of allowed_warehouse_ids from auth raw_user_meta_data.
-- GoTrue / clients may store the list as a JSON array of numbers, as strings, or (in some
-- cases) as a JSON string value containing a serialized array. The previous trigger only
-- handled jsonb_typeof(...) = 'array', so profiles could get '{}' and RLS would hide all
-- warehouses, orders, and register data for that operator.
--
-- Also backfills profiles that still have empty allowed_warehouse_ids when auth metadata
-- contains a non-empty list.

CREATE OR REPLACE FUNCTION public.parse_allowed_warehouse_ids_from_auth_meta(meta jsonb)
RETURNS bigint[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  arr jsonb;
BEGIN
  IF meta IS NULL OR NOT (meta ? 'allowed_warehouse_ids') THEN
    RETURN '{}'::bigint[];
  END IF;

  arr := meta -> 'allowed_warehouse_ids';

  IF jsonb_typeof(arr) = 'string' THEN
    BEGIN
      arr := (meta ->> 'allowed_warehouse_ids')::jsonb;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN '{}'::bigint[];
    END;
    IF jsonb_typeof(arr) <> 'array' THEN
      RETURN '{}'::bigint[];
    END IF;
  ELSIF jsonb_typeof(arr) <> 'array' THEN
    RETURN '{}'::bigint[];
  END IF;

  RETURN COALESCE(
    (
      SELECT array_agg(DISTINCT s.v)
      FROM (
        SELECT (NULLIF(trim(elem #>> '{}'), ''))::bigint AS v
        FROM jsonb_array_elements(arr) AS elem
        WHERE (elem #>> '{}') ~ '^[0-9]+$'
      ) AS s
      WHERE s.v IS NOT NULL AND s.v > 0
    ),
    '{}'::bigint[]
  );
END;
$$;

REVOKE ALL ON FUNCTION public.parse_allowed_warehouse_ids_from_auth_meta(jsonb) FROM PUBLIC;

COMMENT ON FUNCTION public.parse_allowed_warehouse_ids_from_auth_meta(jsonb) IS
  'Extracts positive bigint warehouse ids from auth user_metadata / raw_user_meta_data; supports JSON array and string-encoded JSON array.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  fo jsonb;
  awids bigint[];
BEGIN
  uname := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    split_part(NEW.email, '@', 1)
  );
  IF NEW.raw_user_meta_data ? 'feature_overrides'
     AND jsonb_typeof(NEW.raw_user_meta_data -> 'feature_overrides') = 'object' THEN
    fo := NEW.raw_user_meta_data -> 'feature_overrides';
  ELSE
    fo := '{}'::jsonb;
  END IF;

  awids := public.parse_allowed_warehouse_ids_from_auth_meta(NEW.raw_user_meta_data);

  INSERT INTO public.profiles (id, username, is_admin, feature_overrides, allowed_warehouse_ids)
  VALUES (
    NEW.id,
    uname,
    COALESCE((NEW.raw_user_meta_data ->> 'is_admin')::boolean, false),
    fo,
    COALESCE(awids, '{}'::bigint[])
  );
  RETURN NEW;
END;
$$;

-- Repair existing operators: profile warehouses empty but JWT metadata has ids.
UPDATE public.profiles p
SET allowed_warehouse_ids = parsed.ids
FROM (
  SELECT
    u.id,
    public.parse_allowed_warehouse_ids_from_auth_meta(COALESCE(u.raw_user_meta_data, '{}'::jsonb)) AS ids
  FROM auth.users u
) AS parsed
WHERE p.id = parsed.id
  AND p.is_admin IS NOT TRUE
  AND COALESCE(cardinality(p.allowed_warehouse_ids), 0) = 0
  AND COALESCE(cardinality(parsed.ids), 0) > 0;

NOTIFY pgrst, 'reload schema';
