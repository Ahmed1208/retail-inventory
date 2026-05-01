-- Prefer auth.users for created_by / author_id so mentions work even if public.profiles row is missing.

ALTER TABLE public.admin_notification_comments
  DROP CONSTRAINT IF EXISTS admin_notification_comments_author_id_fkey;

ALTER TABLE public.admin_notification_comments
  ADD CONSTRAINT admin_notification_comments_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.admin_notifications
  DROP CONSTRAINT IF EXISTS admin_notifications_created_by_fkey;

ALTER TABLE public.admin_notifications
  ADD CONSTRAINT admin_notifications_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
