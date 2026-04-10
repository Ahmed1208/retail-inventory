/**
 * CSV import: document date from a cell. Empty or unparseable values use the current instant (ISO).
 */
export function resolveCsvImportedDocumentDate(raw: string): string {
  const s = raw.trim()
  if (!s) return new Date().toISOString()
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}
