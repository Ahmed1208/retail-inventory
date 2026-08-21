export type ParsedClipboardTable = {
  headers: string[]
  rows: Record<string, string>[]
}

function splitRow(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((c) => c.replace(/\r$/, '').trim())
  }
  if (line.includes(';') && (line.match(/;/g)?.length ?? 0) >= (line.match(/,/g)?.length ?? 0)) {
    return line.split(';').map((c) => c.replace(/\r$/, '').trim())
  }
  return splitCsvLine(line)
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.replace(/\r$/, '').trim())
  return out
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const nonempty = cells.filter((c) => c.length > 0)
  if (nonempty.length === 0) return false
  let numeric = 0
  for (const c of nonempty) {
    if (/^[-+]?\d[\d.,]*$/.test(c)) numeric += 1
  }
  return numeric / nonempty.length < 0.5
}

function columnLabel(i: number): string {
  let n = i
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `Column ${s}`
}

/** Parse Excel/TSV or CSV clipboard text into headers + row objects. */
export function parseClipboardTable(
  text: string,
  opts?: { hasHeaderRow?: boolean }
): ParsedClipboardTable {
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = raw.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const split = lines.map(splitRow)
  const width = Math.max(...split.map((r) => r.length), 1)
  const padded = split.map((r) => {
    const next = [...r]
    while (next.length < width) next.push('')
    return next.slice(0, width)
  })

  const forceHeader = opts?.hasHeaderRow
  const useHeader =
    forceHeader === true ||
    (forceHeader !== false && looksLikeHeaderRow(padded[0]))

  let headers: string[]
  let dataStart = 0
  if (useHeader) {
    headers = padded[0].map((h, i) => (h.trim() ? h.trim() : columnLabel(i)))
    dataStart = 1
  } else {
    headers = padded[0].map((_, i) => columnLabel(i))
  }

  const used = new Map<string, number>()
  headers = headers.map((h) => {
    const n = used.get(h) ?? 0
    used.set(h, n + 1)
    return n === 0 ? h : `${h} (${n + 1})`
  })

  const rows: Record<string, string>[] = []
  for (let i = dataStart; i < padded.length; i++) {
    const rec: Record<string, string> = {}
    let any = false
    for (let c = 0; c < headers.length; c++) {
      const v = padded[i][c] ?? ''
      rec[headers[c]] = v
      if (v) any = true
    }
    if (any) rows.push(rec)
  }

  return { headers, rows }
}
