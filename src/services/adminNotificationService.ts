import { toast } from 'sonner'

import i18n from '@/lib/i18n'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { containsAdminMention } from '@/utils/noteMentions'

const ADMIN_NOTIFICATIONS = 'admin_notifications'
const ADMIN_NOTIFICATION_COMMENTS = 'admin_notification_comments'

export const ADMIN_NOTIFICATIONS_QUERY_KEY = ['adminNotifications'] as const
export const ADMIN_NOTIFICATIONS_UNREAD_QUERY_KEY = [
  'adminNotificationsUnreadCount',
] as const

export type AdminNotificationSourceType =
  | 'order_note'
  | 'order_checkout_note'
  | 'po_note'
  | 'po_checkout_note'
  | 'person_form_note'
  | 'quick_create_person_note'
  | 'register_note'
  | 'inventory_transfer_note'
  | 'stock_adjust_note'
  | 'record_payment_note'
  | 'payment_operation_note'
  | 'other'

export type AdminNotificationRow = {
  id: string
  kind: string
  title: string
  body_preview: string
  redirect_path: string
  source_type: string
  source_entity_id: string | null
  created_by: string
  created_at: string
  read_at: string | null
  resolved_at: string | null
}

export type AdminNotificationCommentRow = {
  id: string
  notification_id: string
  author_id: string
  body: string
  created_at: string
}

export function buildNoteRedirectPath(
  basePath: string,
  notificationId: string
): string {
  const trimmed = basePath.trim()
  const sep = trimmed.includes('?') ? '&' : '?'
  return `${trimmed}${sep}noteFocus=1&fromNotification=${encodeURIComponent(notificationId)}`
}

function previewFromNote(text: string, max = 480): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/**
 * Inserts an admin notification when `noteText` contains `@[admin]`.
 * Uses a client-generated id so `redirect_path` can reference it in one round-trip.
 * Swallows errors so note saves are not blocked.
 */
export async function createAdminMentionNotificationIfNeeded(params: {
  noteText: string
  title: string
  redirectBasePath: string
  sourceType: AdminNotificationSourceType | string
  sourceEntityId?: string | null
}): Promise<void> {
  try {
    if (!containsAdminMention(params.noteText)) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const id = crypto.randomUUID()
    const redirect_path = buildNoteRedirectPath(
      params.redirectBasePath,
      id
    )

    const { error } = await supabase.from(ADMIN_NOTIFICATIONS).insert({
      id,
      kind: 'mention_at_admin',
      title: params.title.slice(0, 500),
      body_preview: previewFromNote(params.noteText),
      redirect_path,
      source_type: params.sourceType,
      source_entity_id: params.sourceEntityId ?? null,
      created_by: user.id,
    })

    if (error) throw error

    void queryClient.invalidateQueries({
      queryKey: ADMIN_NOTIFICATIONS_QUERY_KEY,
    })
    void queryClient.invalidateQueries({
      queryKey: ADMIN_NOTIFICATIONS_UNREAD_QUERY_KEY,
    })
  } catch (e) {
    console.error('createAdminMentionNotificationIfNeeded', e)
    toast.error(i18n.t('notifications.toastCreateFailed'))
  }
}

export async function listAdminNotifications(
  limit = 100
): Promise<AdminNotificationRow[]> {
  const { data, error } = await supabase
    .from(ADMIN_NOTIFICATIONS)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(mapNotificationRow)
}

function mapNotificationRow(row: Record<string, unknown>): AdminNotificationRow {
  return {
    id: String(row.id),
    kind: String(row.kind ?? ''),
    title: String(row.title ?? ''),
    body_preview: String(row.body_preview ?? ''),
    redirect_path: String(row.redirect_path ?? ''),
    source_type: String(row.source_type ?? ''),
    source_entity_id:
      row.source_entity_id != null ? String(row.source_entity_id) : null,
    created_by: String(row.created_by ?? ''),
    created_at: String(row.created_at ?? ''),
    read_at: row.read_at != null ? String(row.read_at) : null,
    resolved_at: row.resolved_at != null ? String(row.resolved_at) : null,
  }
}

export async function countUnreadAdminNotifications(): Promise<number> {
  const { count, error } = await supabase
    .from(ADMIN_NOTIFICATIONS)
    .select('*', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) throw error
  return count ?? 0
}

export async function updateAdminNotificationRead(
  id: string,
  read: boolean
): Promise<void> {
  const { error } = await supabase
    .from(ADMIN_NOTIFICATIONS)
    .update({
      read_at: read ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) throw error
  void queryClient.invalidateQueries({
    queryKey: ADMIN_NOTIFICATIONS_UNREAD_QUERY_KEY,
  })
}

export async function updateAdminNotificationResolved(
  id: string,
  resolved: boolean
): Promise<void> {
  const { error } = await supabase
    .from(ADMIN_NOTIFICATIONS)
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) throw error
}

export async function listAdminNotificationComments(
  notificationId: string
): Promise<AdminNotificationCommentRow[]> {
  const { data, error } = await supabase
    .from(ADMIN_NOTIFICATION_COMMENTS)
    .select('*')
    .eq('notification_id', notificationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String((row as Record<string, unknown>).id),
    notification_id: String((row as Record<string, unknown>).notification_id),
    author_id: String((row as Record<string, unknown>).author_id),
    body: String((row as Record<string, unknown>).body ?? ''),
    created_at: String((row as Record<string, unknown>).created_at ?? ''),
  }))
}

export async function insertAdminNotificationComment(params: {
  notificationId: string
  body: string
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { error } = await supabase.from(ADMIN_NOTIFICATION_COMMENTS).insert({
    notification_id: params.notificationId,
    author_id: user.id,
    body: params.body.trim(),
  })

  if (error) throw error
}
