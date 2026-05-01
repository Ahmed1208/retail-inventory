/**
 * Note mention / link grammar (stored in plain text):
 *
 * - `@[admin]` — pings admins when saving notes (notifications hub only); shown as plain text in notes.
 * - `@[pay:{operationRouteId}]` — ledger payment operation (`balance_transactions.id` or
 *   `payment_group_id`). Renders as a link to `/payments/operations/{id}`.
 * - `@[person:{uuid}]` — person profile page `/people/{uuid}`.
 * - `O-{n} · doc:{orderUuid}` / `PO-{n} · doc:{poUuid}` — inline anywhere in the note (also `.` or
 *   bullets instead of `·`, and `O-{n} doc:{uuid}` with a space). Link label is only `O-{n}` /
 *   `PO-{n}`; the ` · doc:…` part is not shown as loose text.
 *   When that pattern appears only at the very end, stripLedgerDocSuffix still hides a lone trailing
 *   suffix for legacy notes.
 * - Plain `O-`/`PO-` without ` · doc:{uuid}` can still link if the whole note ends with a trailing
 *   ` · doc:{uuid}` (legacy single-document hint).
 */

import { stripLedgerDocSuffix } from '@/utils/ledgerDocSuffix'

const UUID_RE =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

/** Map common Unicode dashes to ASCII so UUID capture matches pasted / OS-substituted hyphens. */
function normalizeUuidHyphens(s: string): string {
  return s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
}

/**
 * Normalize note text for O-/PO- doc link matching only (1:1 code units → indices stay aligned).
 */
function normalizeForOrderDocMatch(s: string): string {
  return normalizeUuidHyphens(s)
}

const RE_ADMIN = /@\[admin\]/g
const RE_PAY = new RegExp(`@\\[pay:([^\\]]+)\\]`, 'g')
const RE_PERSON = new RegExp(`@\\[person:(${UUID_RE})\\]`, 'g')
const RE_ORDER_PO = /\b(O-\d+|PO-\d+)\b/gi

/** True if note text pings admins (`@[admin]` or a loose `@admin` token). */
export function containsAdminMention(text: string): boolean {
  RE_ADMIN.lastIndex = 0
  if (RE_ADMIN.test(text)) return true
  return /(^|[\s(,;:])@admin\b/i.test(text)
}

export type NoteLinkRun = {
  from: number
  to: number
  href: string
  label: string
}

function collectPayRuns(body: string): NoteLinkRun[] {
  const runs: NoteLinkRun[] = []
  const re = new RegExp(RE_PAY.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const id = m[1]!.trim()
    if (!id) continue
    runs.push({
      from: m.index,
      to: m.index + m[0].length,
      href: `/payments/operations/${encodeURIComponent(id)}`,
      label: m[0],
    })
  }
  return runs
}

function collectPersonRuns(body: string): NoteLinkRun[] {
  const runs: NoteLinkRun[] = []
  const re = new RegExp(RE_PERSON.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const id = m[1]!
    runs.push({
      from: m.index,
      to: m.index + m[0].length,
      href: `/people/${encodeURIComponent(id)}`,
      label: m[0],
    })
  }
  return runs
}

function collectOrderPoRuns(body: string, documentId: string | null): NoteLinkRun[] {
  if (!documentId) return []
  const runs: NoteLinkRun[] = []
  const re = new RegExp(RE_ORDER_PO.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const token = m[0]
    const href = /^PO-/i.test(token)
      ? `/purchase-orders/${documentId}`
      : `/orders/${documentId}`
    runs.push({
      from: m.index,
      to: m.index + token.length,
      href,
      label: token,
    })
  }
  return runs
}

/**
 * `O-12 · doc:uuid` / `PO-3 · doc:uuid` at any position (also `.` / bullets / `O-12 doc:`).
 * Indices are for the original `displayBody` / `fullNote` (normalization is 1:1 for length).
 */
function collectInlineOrderPoDocRuns(
  fullNote: string,
  displayBody: string
): NoteLinkRun[] {
  const runs: NoteLinkRun[] = []
  const src = normalizeForOrderDocMatch(fullNote)
  const bodyLen = displayBody.length
  const re = new RegExp(
    `\\b(O-\\d+|PO-\\d+)(?:\\s*(?:[·•∙\\u00B7\\u2022\\u2219]|\\.)\\s*doc\\s*:|\\s+doc\\s*:)(${UUID_RE})(?=\\W|$)`,
    'gi'
  )
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const from = m.index
    if (from >= bodyLen) continue
    const endInNote = m.index + m[0].length
    const to = Math.min(endInNote, bodyLen)
    if (to <= from) continue
    const token = m[1]!
    const docUuid = normalizeUuidHyphens(m[2]!)
    const href = /^PO-/i.test(token)
      ? `/purchase-orders/${encodeURIComponent(docUuid)}`
      : `/orders/${encodeURIComponent(docUuid)}`
    runs.push({ from, to, href, label: token })
  }
  return runs
}

/** Sort by start, then longer run first so overlaps prefer the longer token. */
function sortRuns(runs: NoteLinkRun[]): NoteLinkRun[] {
  return [...runs].sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from
    return b.to - b.from - (a.to - a.from)
  })
}

/** Drop overlaps: first run in sorted order wins. */
function mergeNonOverlapping(sorted: NoteLinkRun[]): NoteLinkRun[] {
  const out: NoteLinkRun[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.from < last.to) continue
    out.push(r)
  }
  return out
}

export function findNoteLinkRuns(
  body: string,
  documentId: string | null,
  /** Original stored note (before stripping a trailing ` · doc:`); used for inline O-/PO- doc links. */
  fullNote?: string
): NoteLinkRun[] {
  const noteSrc = fullNote ?? body
  const all = [
    ...collectPayRuns(body),
    ...collectPersonRuns(body),
    ...collectInlineOrderPoDocRuns(noteSrc, body),
    ...collectOrderPoRuns(body, documentId),
  ]
  return mergeNonOverlapping(sortRuns(all))
}

/**
 * Full note string (may include ` · doc:{uuid}` suffix). Returns pieces for rendering.
 */
/** If caret is inside `@query` (no whitespace), returns `@` index and query string. */
export function getActiveMention(
  text: string,
  caret: number
): { atIndex: number; query: string } | null {
  if (caret <= 0) return null
  let i = caret - 1
  while (i >= 0) {
    const c = text[i]!
    if (c === '@') {
      const q = text.slice(i + 1, caret)
      if (/[\s\n]/.test(q)) return null
      return { atIndex: i, query: q }
    }
    if (c === '\n' || c === ' ') return null
    i--
  }
  return null
}

export function splitNoteIntoParts(note: string): Array<
  { type: 'text'; text: string } | { type: 'link'; href: string; label: string }
> {
  const { body, documentId } = stripLedgerDocSuffix(note)
  const runs = findNoteLinkRuns(body, documentId, note)
  const parts: Array<
    { type: 'text'; text: string } | { type: 'link'; href: string; label: string }
  > = []
  let pos = 0
  for (const r of runs) {
    if (r.from > pos) {
      parts.push({ type: 'text', text: body.slice(pos, r.from) })
    }
    parts.push({ type: 'link', href: r.href, label: r.label })
    pos = r.to
  }
  if (pos < body.length) {
    parts.push({ type: 'text', text: body.slice(pos) })
  }
  return parts
}
