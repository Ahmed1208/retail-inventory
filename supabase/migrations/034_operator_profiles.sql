-- Operator profiles linked to auth.users (members + admin bootstrap).

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX profiles_username_lower_key ON public.profiles (lower(username));

COMMENT ON TABLE public.profiles IS 'App operators; RLS: read own or all if admin; writes via trigger + service role.';
COMMENT ON COLUMN public.profiles.feature_overrides IS 'Partial map of feature control id -> boolean; merged over Control defaults (localStorage) for non-admins.';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  fo jsonb;
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

  INSERT INTO public.profiles (id, username, is_admin, feature_overrides)
  VALUES (
    NEW.id,
    uname,
    COALESCE((NEW.raw_user_meta_data ->> 'is_admin')::boolean, false),
    fo
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
