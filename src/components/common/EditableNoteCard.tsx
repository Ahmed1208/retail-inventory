import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Pencil, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { NoteRichText } from '@/components/common/NoteWithDocLinks'
import { NoteMentionEditor } from '@/components/common/NoteMentionEditor'

type Props = {
  label?: string
  value: string
  canEdit: boolean
  isPending?: boolean
  onSave: (text: string) => void | Promise<void>
  /** Shown in view mode when note is empty and editing is allowed */
  emptyPlaceholder?: string
  className?: string
  fieldId?: string
}

export function EditableNoteCard({
  label,
  value,
  canEdit,
  isPending,
  onSave,
  emptyPlaceholder,
  className,
  fieldId = 'editable-note-field',
}: Props) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(value)
    setEditing(false)
  }

  const save = async () => {
    try {
      await onSave(draft.trim())
      setEditing(false)
    } catch {
      /* mutation shows toast; stay in edit mode */
    }
  }

  const dirty = draft.trim() !== (value ?? '').trim()

  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={fieldId}>{label}</Label>
          {canEdit && !editing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5"
              disabled={isPending}
              onClick={startEdit}
              aria-label={t('notes.editNote')}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {t('notes.editNote')}
            </Button>
          ) : null}
        </div>
      ) : (
        canEdit &&
        !editing && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5"
              disabled={isPending}
              onClick={startEdit}
              aria-label={t('notes.editNote')}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {t('notes.editNote')}
            </Button>
          </div>
        )
      )}

      {!editing ? (
        <div
          className={cn(
            'min-h-[5rem] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm',
            !value?.trim() && 'text-muted-foreground'
          )}
          aria-readonly
        >
          {value?.trim() ? (
            <NoteRichText note={value} />
          ) : canEdit ? (
            emptyPlaceholder ?? t('notes.emptyNotePlaceholder')
          ) : (
            '—'
          )}
        </div>
      ) : (
        <>
          <NoteMentionEditor
            id={fieldId}
            value={draft}
            onChange={setDraft}
            disabled={isPending}
            rows={5}
            placeholder={t('notes.editorPlaceholder')}
            aria-label={label ?? t('notes.editorAria')}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || !dirty}
              onClick={() => void save()}
              className="gap-1.5"
              aria-label={t('notes.saveNote')}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {t('notes.saveNote')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={cancelEdit}
              className="gap-1.5"
              aria-label={t('notes.cancelEdit')}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {t('notes.cancelEdit')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
