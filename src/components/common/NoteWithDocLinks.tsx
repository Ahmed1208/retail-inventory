import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { stripLedgerDocSuffix } from '@/utils/ledgerDocSuffix'

const TOKEN_RE = /\b(O-\d+|PO-\d+)\b/gi

type Props = {
  note: string | null | undefined
  className?: string
}

/**
 * Renders note text with O-#/PO-# segments linked when a trailing ` · doc:{uuid}` suffix is present.
 */
export function NoteWithDocLinks({ note, className }: Props) {
  if (note == null || note === '') return null
  const { body, documentId } = stripLedgerDocSuffix(note)
  const parts: ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  const re = new RegExp(TOKEN_RE.source, 'gi')
  while ((m = re.exec(body)) !== null) {
    parts.push(body.slice(last, m.index))
    const token = m[0]
    const href =
      documentId != null
        ? /^PO-/i.test(token)
          ? `/purchase-orders/${documentId}`
          : `/orders/${documentId}`
        : null
    if (href) {
      parts.push(
        <Link
          key={key++}
          to={href}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {token}
        </Link>
      )
    } else {
      parts.push(<span key={key++}>{token}</span>)
    }
    last = m.index + token.length
  }
  parts.push(body.slice(last))
  return (
    <span className={className ?? 'text-sm leading-snug whitespace-pre-wrap'}>
      {parts}
    </span>
  )
}
