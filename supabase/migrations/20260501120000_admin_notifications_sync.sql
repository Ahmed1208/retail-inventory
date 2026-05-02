-- Data sync: mirror admin mention inbox between local ↔ cloud under an admin session.
-- Adds updated_at (LWW), admin INSERT/DELETE RLS for mirrored rows, keeps existing self-insert policies.

ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.admin_notifications
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE public.admin_notifications
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

-- updated_at is set by the app on read/resolved changes and carried intact by data-sync upserts
-- (no BEFORE UPDATE trigger — a trigger would overwrite peer timestamps and break last-write-wins).

-- Admins may INSERT rows from another operator (created_by) when mirroring from the peer DB.
CREATE POLICY admin_notifications_insert_admin_mirror
  ON public.admin_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    kind = 'mention_at_admin'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_admin = true
    )
  );

CREATE POLICY admin_notifications_delete_admin
  ON public.admin_notifications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_admin = true
    )
  );

CREATE POLICY admin_notification_comments_insert_admin_mirror
  ON public.admin_notification_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_admin = true
    )
  );

CREATE POLICY admin_notification_comments_delete_admin
  ON public.admin_notification_comments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_admin = true
    )
  );

CREATE POLICY admin_notification_comments_update_admin
  ON public.admin_notification_comments
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

COMMENT ON COLUMN public.admin_notifications.updated_at IS
  'Defaults at insert; app bumps on read/resolved; sync merges preserve peer value for LWW.';

NOTIFY pgrst, 'reload schema';
