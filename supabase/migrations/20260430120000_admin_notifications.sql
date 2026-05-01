-- Admin notification hub (@admin mentions + threaded comments). Admins read/update; any auth user can insert mention rows as self.

CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'mention_at_admin'
    CHECK (kind = 'mention_at_admin'),
  title text NOT NULL,
  body_preview text NOT NULL DEFAULT '',
  redirect_path text NOT NULL,
  source_type text NOT NULL,
  source_entity_id text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  resolved_at timestamptz,
  CONSTRAINT admin_notifications_redirect_path_length CHECK (
    char_length(redirect_path) <= 2048
  ),
  CONSTRAINT admin_notifications_title_length CHECK (char_length(title) <= 500),
  CONSTRAINT admin_notifications_preview_length CHECK (char_length(body_preview) <= 2000)
);

CREATE INDEX admin_notifications_created_at_idx
  ON public.admin_notifications (created_at DESC);

CREATE INDEX admin_notifications_unread_idx
  ON public.admin_notifications (created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX admin_notifications_created_by_idx
  ON public.admin_notifications (created_by);

CREATE TABLE public.admin_notification_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.admin_notifications (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_notification_comments_body_length CHECK (char_length(body) <= 8000)
);

CREATE INDEX admin_notification_comments_notification_idx
  ON public.admin_notification_comments (notification_id, created_at);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_comments ENABLE ROW LEVEL SECURITY;

-- Admins: full read on notifications
CREATE POLICY admin_notifications_select_admin
  ON public.admin_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_admin = true
    )
  );

-- Any authenticated user may create mention notifications as themselves
CREATE POLICY admin_notifications_insert_self_mention
  ON public.admin_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND kind = 'mention_at_admin'
  );

-- Admins: update read/resolved (and any column — app limits fields)
CREATE POLICY admin_notifications_update_admin
  ON public.admin_notifications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_admin = true
    )
  );

CREATE POLICY admin_notification_comments_select_admin
  ON public.admin_notification_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_admin = true
    )
  );

CREATE POLICY admin_notification_comments_insert_admin_self
  ON public.admin_notification_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_admin = true
    )
  );

COMMENT ON TABLE public.admin_notifications IS
  'Admin inbox; non-admins may INSERT mention_at_admin rows only (created_by = self).';
COMMENT ON TABLE public.admin_notification_comments IS
  'Threaded comments on admin notifications; admins only.';

NOTIFY pgrst, 'reload schema';
