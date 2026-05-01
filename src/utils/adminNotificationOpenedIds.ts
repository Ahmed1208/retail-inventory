/** Tracks notification ids the user opened via the inbox "Open" link (local browser only). */

const STORAGE_KEY = 'stockpilot.adminNotifications.openedIds'
const MAX_IDS = 400

export function readOpenedNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed.filter((x): x is string => typeof x === 'string' && x.length > 0)
    )
  } catch {
    return new Set()
  }
}

export function appendOpenedNotificationId(id: string): void {
  try {
    const existing = [...readOpenedNotificationIds()].filter((x) => x !== id)
    const next = [id, ...existing].slice(0, MAX_IDS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // quota / private mode
  }
}
