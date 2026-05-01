import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { searchNoteMentions } from '@/services/noteMentionSearch'
import { getActiveMention } from '@/utils/noteMentions'

const DEBOUNCE_MS = 200

type Props = {
  id?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  rows?: number
  placeholder?: string
  className?: string
  'aria-label'?: string
}

export function NoteMentionEditor({
  id,
  value,
  onChange,
  disabled,
  rows = 4,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: Props) {
  const { t } = useTranslation()
  const taRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [mentionAt, setMentionAt] = useState<number | null>(null)
  const [mentionQuery, setMentionQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const debouncedMentionQuery = useDebouncedValue(mentionQuery, DEBOUNCE_MS)

  const mentionActive = mentionAt !== null

  const { data: suggestions = [], isFetching } = useQuery({
    queryKey: ['noteMentionSearch', debouncedMentionQuery],
    queryFn: () => searchNoteMentions(debouncedMentionQuery),
    enabled: mentionActive,
  })

  useEffect(() => {
    setHighlightIdx(0)
  }, [debouncedMentionQuery, suggestions.length])

  const syncMentionFromCaret = useCallback(() => {
    const el = taRef.current
    if (!el || disabled) {
      setMentionAt(null)
      setMentionQuery('')
      return
    }
    const caret = el.selectionStart ?? 0
    const m = getActiveMention(value, caret)
    if (m) {
      setMentionAt(m.atIndex)
      setMentionQuery(m.query)
    } else {
      setMentionAt(null)
      setMentionQuery('')
    }
  }, [value, disabled])

  const insertMention = useCallback(
    (insertText: string) => {
      const el = taRef.current
      if (!el || mentionAt === null) return
      const caret = el.selectionStart ?? value.length
      const before = value.slice(0, mentionAt)
      const after = value.slice(caret)
      const next = before + insertText + after
      onChange(next)
      setMentionAt(null)
      setMentionQuery('')
      const pos = mentionAt + insertText.length
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(pos, pos)
      })
    },
    [value, onChange, mentionAt]
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionActive || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const item = suggestions[highlightIdx]
      if (item) insertMention(item.insertText)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMentionAt(null)
      setMentionQuery('')
    }
  }

  useEffect(() => {
    if (!mentionActive || suggestions.length === 0) return
    const row = listRef.current?.querySelector(`[data-idx="${highlightIdx}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, mentionActive, suggestions.length])

  return (
    <div className={cn('relative', className)}>
      <Textarea
        ref={taRef}
        id={id}
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={mentionActive && suggestions.length > 0}
        aria-controls={mentionActive ? 'note-mention-listbox' : undefined}
        aria-autocomplete="list"
        className="resize-y min-h-[5rem]"
        onChange={(e) => {
          onChange(e.target.value)
          requestAnimationFrame(syncMentionFromCaret)
        }}
        onKeyUp={syncMentionFromCaret}
        onClick={syncMentionFromCaret}
        onKeyDown={onKeyDown}
      />
      {mentionActive && (suggestions.length > 0 || isFetching) ? (
        <div
          className="absolute start-0 end-0 top-full z-50 mt-1 max-h-48 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
          role="presentation"
        >
          <p className="border-b border-border px-2 py-1 text-[11px] text-muted-foreground">
            {t('notes.mentionHint')}
          </p>
          {isFetching && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {t('common.loading')}
            </p>
          ) : (
            <ul
              ref={listRef}
              id="note-mention-listbox"
              role="listbox"
              className="max-h-40 overflow-y-auto py-1"
            >
              {suggestions.map((item, idx) => (
                <li
                  key={`${item.kind}-${item.kind === 'admin' ? 'admin' : item.kind === 'payment' ? item.operationRouteId : item.kind === 'person' ? item.id : item.kind === 'order' || item.kind === 'purchase_order' ? item.id : idx}`}
                  role="option"
                  aria-selected={idx === highlightIdx}
                  data-idx={idx}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-sm',
                    idx === highlightIdx && 'bg-accent text-accent-foreground'
                  )}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    insertMention(item.insertText)
                  }}
                  onMouseEnter={() => setHighlightIdx(idx)}
                >
                  <span className="font-medium capitalize text-muted-foreground">
                    {item.kind === 'admin'
                      ? t('notes.mentionKindAdmin')
                      : item.kind === 'order'
                        ? t('notes.mentionKindOrder')
                        : item.kind === 'purchase_order'
                          ? t('notes.mentionKindPO')
                          : item.kind === 'payment'
                            ? t('notes.mentionKindPayment')
                            : t('notes.mentionKindPerson')}
                  </span>{' '}
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
