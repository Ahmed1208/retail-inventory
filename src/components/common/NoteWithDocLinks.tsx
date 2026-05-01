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
  let offset = 0
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!
    if (p.type === 'text') {
      const key = `t-${i}-${offset}-${p.text.length}`
      nodes.push(<span key={key}>{p.text}</span>)
      offset += p.text.length
    } else {
      const key = `l-${i}-${offset}-${p.href}`
      nodes.push(
        <Link
          key={key}
          to={p.href}
          className="relative z-[1] font-medium text-primary underline-offset-4 hover:underline"
        >
          {p.label}
        </Link>
      )
      offset += p.label.length
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
