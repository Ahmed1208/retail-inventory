const STORAGE_KEY = 'stockpilot_migration_checklist_v1'

export type MigrationChecklistPersisted = {
  v: 1
  checked: Record<string, boolean>
  updatedAt: string
}

export function readMigrationChecklist(): MigrationChecklistPersisted | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as MigrationChecklistPersisted).v !== 1
    ) {
      return null
    }
    const p = parsed as MigrationChecklistPersisted
    if (typeof p.checked !== 'object' || p.checked === null) return null
    return {
      v: 1,
      checked: { ...p.checked },
      updatedAt:
        typeof p.updatedAt === 'string'
          ? p.updatedAt
          : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function writeMigrationChecklist(
  checked: Record<string, boolean>
): void {
  if (typeof window === 'undefined') return
  const payload: MigrationChecklistPersisted = {
    v: 1,
    checked: { ...checked },
    updatedAt: new Date().toISOString(),
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearMigrationChecklist(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
