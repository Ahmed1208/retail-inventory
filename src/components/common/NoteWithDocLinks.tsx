import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { splitNoteIntoParts } from '@/utils/noteMentions'

type Props = {
  note: string | null | undefined
  className?: string
}

/**
 * Renders note text with:
 * - `@[pay:id]` → payment operation
 * - `@[person:uuid]` → `/people/{uuid}` person page
 * - `O-#` / `PO-#` linked when ` · doc:{uuid}` suffix is present (ledger pattern)
 */
export function NoteRichText({ note, className }: Props) {
  if (note == null || note.trim() === '') return null
  const parts = splitNoteIntoParts(note)
  const nodes: ReactNode[] = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!
    if (p.type === 'text') {
      nodes.push(<span key={i}>{p.text}</span>)
    } else {
      nodes.push(
        <Link
          key={i}
          to={p.href}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {p.label}
        </Link>
      )
    }
  }
  return (
    <span className={className ?? 'text-sm leading-snug whitespace-pre-wrap'}>
      {nodes}
    </span>
  )
}

/** Kept for existing imports; same rendering as `NoteRichText`. */
export function NoteWithDocLinks(props: Props) {
  return <NoteRichText {...props} />
}
