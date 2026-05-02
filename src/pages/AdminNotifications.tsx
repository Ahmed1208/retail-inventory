import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react'

import type { AdminNotificationRow } from '@/services/adminNotificationService'
import {
  ADMIN_NOTIFICATIONS_QUERY_KEY,
  ADMIN_NOTIFICATIONS_UNREAD_QUERY_KEY,
  insertAdminNotificationComment,
  listAdminNotificationComments,
  listAdminNotifications,
  updateAdminNotificationRead,
  updateAdminNotificationResolved,
} from '@/services/adminNotificationService'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/hooks/useLanguage'
import { NoteRichText } from '@/components/common/NoteWithDocLinks'
import {
  appendOpenedNotificationId,
  readOpenedNotificationIds,
} from '@/utils/adminNotificationOpenedIds'

export function AdminNotifications() {
  const { t } = useTranslation()
  const { isRTL } = useLanguage()
  const qc = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread' | 'unresolved'>('all')
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [openedTick, setOpenedTick] = useState(0)
  const openedIds = useMemo(() => {
    void openedTick
    return readOpenedNotificationIds()
  }, [openedTick])

  const markOpenedFromList = useCallback((id: string) => {
    appendOpenedNotificationId(id)
    setOpenedTick((t) => t + 1)
  }, [])

  const {
    data: rows = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ADMIN_NOTIFICATIONS_QUERY_KEY,
    queryFn: () => listAdminNotifications(200),
  })

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'unread') return r.read_at == null
      if (filter === 'unresolved') return r.resolved_at == null
      return true
    })
  }, [rows, filter])

  const readMut = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      updateAdminNotificationRead(id, read),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ADMIN_NOTIFICATIONS_QUERY_KEY })
      void qc.invalidateQueries({
        queryKey: ADMIN_NOTIFICATIONS_UNREAD_QUERY_KEY,
      })
    },
    onError: () => toast.error(t('notifications.toastError')),
  })

  const resolvedMut = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      updateAdminNotificationResolved(id, resolved),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ADMIN_NOTIFICATIONS_QUERY_KEY }),
    onError: () => toast.error(t('notifications.toastError')),
  })

  const commentMut = useMutation({
    mutationFn: async ({
      notificationId,
      body,
    }: {
      notificationId: string
      body: string
    }) => {
      await insertAdminNotificationComment({ notificationId, body })
    },
    onSuccess: (_, v) => {
      void qc.invalidateQueries({
        queryKey: ['adminNotificationComments', v.notificationId],
      })
      setCommentDraft((d) => ({ ...d, [v.notificationId]: '' }))
      toast.success(t('notifications.commentAdded'))
    },
    onError: () => toast.error(t('notifications.toastError')),
  })

  return (
    <div
      className={cn('mx-auto max-w-4xl space-y-4 p-4', isRTL && 'rtl')}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('notifications.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('notifications.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'unread', 'unresolved'] as const).map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {t(`notifications.filter_${f}`)}
          </Button>
        ))}
      </div>

      {isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <p className="text-destructive">{t('notifications.loadError')}</p>
          <p className="mt-1 text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching && (
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
            )}
            {t('notifications.retry')}
          </Button>
        </div>
      ) : isLoading ? (
        <LoadingSkeleton className="h-40" />
      ) : filtered.length === 0 ? (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t('notifications.empty')}</p>
          <p className="leading-snug">{t('notifications.emptyHintHeaderBell')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              expanded={expandedId === n.id}
              onToggle={() =>
                setExpandedId((cur) => (cur === n.id ? null : n.id))
              }
              commentText={commentDraft[n.id] ?? ''}
              setCommentText={(text) =>
                setCommentDraft((d) => ({ ...d, [n.id]: text }))
              }
              onToggleRead={(read) => readMut.mutate({ id: n.id, read })}
              onToggleResolved={(resolved) =>
                resolvedMut.mutate({ id: n.id, resolved })
              }
              onSubmitComment={(body) =>
                commentMut.mutate({ notificationId: n.id, body })
              }
              commentSubmitting={
                commentMut.isPending &&
                commentMut.variables?.notificationId === n.id
              }
              readPending={
                readMut.isPending && readMut.variables?.id === n.id
              }
              resolvedPending={
                resolvedMut.isPending && resolvedMut.variables?.id === n.id
              }
              linkOpened={openedIds.has(n.id)}
              onOpenLink={() => markOpenedFromList(n.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function NotificationRow({
  n,
  expanded,
  onToggle,
  commentText,
  setCommentText,
  onToggleRead,
  onToggleResolved,
  onSubmitComment,
  commentSubmitting,
  readPending,
  resolvedPending,
  linkOpened,
  onOpenLink,
}: {
  n: AdminNotificationRow
  expanded: boolean
  onToggle: () => void
  commentText: string
  setCommentText: (s: string) => void
  onToggleRead: (read: boolean) => void
  onToggleResolved: (resolved: boolean) => void
  onSubmitComment: (body: string) => void
  commentSubmitting: boolean
  readPending: boolean
  resolvedPending: boolean
  linkOpened: boolean
  onOpenLink: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'

  const { data: comments = [], isFetching: commentsLoading } = useQuery({
    queryKey: ['adminNotificationComments', n.id],
    queryFn: () => listAdminNotificationComments(n.id),
    enabled: expanded,
  })

  const formatDt = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

  const unread = n.read_at == null
  const unresolved = n.resolved_at == null

  return (
    <li
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground',
        unread && 'border-primary/40 bg-primary/5',
        linkOpened && 'ring-1 ring-muted-foreground/25'
      )}
    >
      <div className="flex flex-wrap items-start gap-2 p-3">
        <button
          type="button"
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{n.title}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {n.source_type}
            </span>
            {unread ? (
              <span className="text-[10px] font-medium text-primary">
                {t('notifications.badgeUnread')}
              </span>
            ) : null}
            {linkOpened ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t('notifications.badgeOpenedFromList')}
              </span>
            ) : null}
            {unresolved ? (
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                {t('notifications.badgeUnresolved')}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                {t('notifications.badgeResolved')}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {n.body_preview || '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatDt(n.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Link
            to={n.redirect_path}
            onClick={() => onOpenLink()}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'h-8 gap-1'
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('notifications.open')}
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8"
            disabled={readPending}
            onClick={() => onToggleRead(unread)}
          >
            {unread ? t('notifications.markRead') : t('notifications.markUnread')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8"
            disabled={resolvedPending}
            onClick={() => onToggleResolved(unresolved)}
          >
            {unresolved
              ? t('notifications.markResolved')
              : t('notifications.markUnresolved')}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-border px-3 pb-3 pt-2">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            {t('notifications.commentsHeading')}
          </h3>
          {commentsLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('notifications.noComments')}
            </p>
          ) : (
            <ul className="mb-3 space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-sm"
                >
                  <div className="text-sm leading-snug">
                    <NoteRichText note={c.body} />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDt(c.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Label htmlFor={`comment-${n.id}`} className="text-xs">
            {t('notifications.addComment')}
          </Label>
          <Textarea
            id={`comment-${n.id}`}
            className="mt-1 min-h-[72px] text-sm"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t('notifications.commentPlaceholder')}
          />
          <Button
            type="button"
            size="sm"
            className="mt-2"
            disabled={
              commentSubmitting || commentText.trim().length === 0
            }
            onClick={() => onSubmitComment(commentText)}
          >
            {commentSubmitting && (
              <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            {t('notifications.postComment')}
          </Button>
        </div>
      ) : null}
    </li>
  )
}
