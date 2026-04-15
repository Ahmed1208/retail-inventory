import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Query flag used by /admin/migration “Import CSV” shortcuts. */
export const MIGRATION_IMPORT_PARAM = 'migrationImport'

/**
 * When the URL contains `migrationImport=1`, opens the CSV import dialog once
 * the page is ready, then removes the param (replace) so refresh does not reopen.
 *
 * - If `ready` is false, the param is left in place until a later run.
 * - If `ready` is true and `allowed` is false, the param is cleared without opening.
 */
export function useMigrationImportDialog(
  setOpen: (open: boolean) => void,
  ready: boolean,
  allowed: boolean
): void {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get(MIGRATION_IMPORT_PARAM) !== '1') return
    if (!ready) return

    if (allowed) setOpen(true)

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(MIGRATION_IMPORT_PARAM)
        return next
      },
      { replace: true }
    )
  }, [allowed, ready, searchParams, setOpen, setSearchParams])
}
