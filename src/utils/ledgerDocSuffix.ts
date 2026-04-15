/** Appended to retained-cancel ledger notes so the UI can link O-/PO- tokens without DB reference_id. */
export const LEDGER_DOC_SUFFIX_RE = / · doc:([0-9a-f-]{36})$/i

export function appendLedgerDocSuffix(body: string, documentId: string): string {
  const b = body.trimEnd()
  return `${b} · doc:${documentId}`
}

export function stripLedgerDocSuffix(raw: string): {
  body: string
  documentId: string | null
} {
  const m = raw.match(LEDGER_DOC_SUFFIX_RE)
  if (!m || m.index === undefined) {
    return { body: raw, documentId: null }
  }
  return { body: raw.slice(0, m.index).trimEnd(), documentId: m[1]! }
}

/** Retained payment rows sort after the voided document line when the log is newest-first. */
export function retainedPaymentCreatedAt(anchorIso: string): string {
  const t = new Date(anchorIso).getTime()
  if (Number.isNaN(t)) return new Date().toISOString()
  return new Date(t + 1000).toISOString()
}

export function retainedNoteDocumentRoute(
  note: string | null | undefined
): { documentId: string; basePath: '/orders/' | '/purchase-orders/' } | null {
  const raw = note?.trim() ?? ''
  const { body, documentId } = stripLedgerDocSuffix(raw)
  if (!documentId) return null
  if (/\bPO-\d+\b/i.test(body)) {
    return { documentId, basePath: '/purchase-orders/' }
  }
  if (/\bO-\d+\b/i.test(body)) {
    return { documentId, basePath: '/orders/' }
  }
  return null
}
