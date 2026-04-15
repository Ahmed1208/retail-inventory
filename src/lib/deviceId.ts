const STORAGE_KEY = 'stockpilot.device_id_v1'

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

/** Stable per-browser device id for sync queue + diagnostics. */
export function getDeviceId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'ssr'
  }
  try {
    let id = localStorage.getItem(STORAGE_KEY)?.trim()
    if (!id) {
      id = randomId()
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return randomId()
  }
}
