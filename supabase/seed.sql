-- Runs after migrations on `supabase db reset` when [db.seed] enabled = true (see supabase/config.toml).
-- Idempotent: warehouse defaults + local admin with is_admin for Control / Admin / Notifications / Data sync.

SELECT public.ensure_default_warehouse();

-- ---------------------------------------------------------------------------
-- Local / second-PC operator: username `admin` → admin@members.stockpilot.local
-- Password (local Supabase only): devpass123
-- Uses placeholder id 11111111-… when inserting fresh (local only). Never push that
-- id to hosted — on shop PCs that connect to cloud, run mirror then Data sync.
-- Re-running seed always repairs admin metadata + profiles.is_admin = true.
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

-- Always ensure password, confirmation, and admin metadata for the local admin email.
UPDATE auth.users u
SET
  encrypted_password = extensions.crypt('devpass123', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(u.email_confirmed_at, now()),
  raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    || '{"provider":"email","providers":["email"]}'::jsonb,
  raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb)
    || '{"username":"admin","is_admin":true}'::jsonb,
  updated_at = now()
WHERE lower(u.email::text) = lower('admin@members.stockpilot.local');

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
      AND i.provider = 'email'
  );

-- Ensure profiles row: admin UI (Control / Admin / Notifications / Data sync) requires is_admin.
INSERT INTO public.profiles (id, username, is_admin, feature_overrides)
SELECT
  u.id,
  'admin',
  true,
  '{}'::jsonb
FROM auth.users u
WHERE lower(u.email::text) = lower('admin@members.stockpilot.local')
ON CONFLICT (id) DO UPDATE
SET
  username = EXCLUDED.username,
  is_admin = true,
  feature_overrides = COALESCE(public.profiles.feature_overrides, '{}'::jsonb);
