-- Runs after migrations on `supabase db reset` when [db.seed] enabled = true (see supabase/config.toml).
-- Idempotent: warehouse defaults + local dev operator for login.

SELECT public.ensure_default_warehouse();

-- ---------------------------------------------------------------------------
-- Local dev operator: username `admin` → admin@members.stockpilot.local
-- Password (local Supabase only): devpass123
-- Uses placeholder id 11111111-… (local only). Never push that id to hosted —
-- on shop PCs run mirror:cloud-auth-to-local then Reset local from cloud.
-- If this user already exists (any id), only the missing identity row may be added.
-- ---------------------------------------------------------------------------

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone_change,
  phone_change_token,
  email_change_token_current,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'authenticated',
  'authenticated',
  'admin@members.stockpilot.local',
  extensions.crypt('devpass123', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"admin","is_admin":true}'::jsonb,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users u
  WHERE lower(u.email::text) = lower('admin@members.stockpilot.local')
);

INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub',
    u.id::text,
    'email',
    u.email,
    'email_verified',
    true,
    'phone_verified',
    false
  ),
  'email',
  now(),
  now(),
  now()
FROM auth.users u
WHERE lower(u.email::text) = lower('admin@members.stockpilot.local')
  AND NOT EXISTS (
    SELECT 1
    FROM auth.identities i
    WHERE i.user_id = u.id
  );
