import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'

import type { Person } from '@/types'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: Person[]
  isRTL: boolean
  formatCurrency: (n: number) => string
  onPick: (person: Person) => void
}

export function PersonBrowserModal({
  open,
  onOpenChange,
  people,
  isRTL,
  formatCurrency,
  onPick,
}: Props) {
  const { t } = useTranslation()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) => {
      const name = p.name.toLowerCase()
      const phone = (p.phone ?? '').toLowerCase()
      return (
        name.includes(q) ||
        phone.includes(q) ||
        p.id.toLowerCase().includes(q)
      )
    })
  }, [people, search])

  const rowCount = filtered.length

  useEffect(() => {
    if (open) {
      setSearch('')
      setHighlight(0)
      const timer = window.setTimeout(() => searchRef.current?.focus(), 50)
      return () => window.clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    setHighlight((h) =>
      rowCount === 0 ? 0 : Math.min(h, rowCount - 1)
    )
  }, [rowCount])

  const pickAt = useCallback(
    (index: number) => {
      const p = filtered[index]
      if (p) {
        onPick(p)
        onOpenChange(false)
      }
    },
    [filtered, onPick, onOpenChange]
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) =>
          rowCount === 0 ? 0 : (h + 1) % rowCount
        )
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) =>
          rowCount === 0 ? 0 : (h - 1 + rowCount) % rowCount
        )
      }
      if (e.key === 'Enter' && rowCount > 0) {
        e.preventDefault()
        pickAt(highlight)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, rowCount, highlight, pickAt, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none p-0 sm:h-[90vh] sm:max-h-[90vh] sm:max-w-4xl sm:rounded-lg',
          isRTL && 'rtl'
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-start sm:text-start">
          <DialogTitle className="text-lg">
            {t('payments.selectPersonBrowser')}
          </DialogTitle>
        </DialogHeader>

        <div className="relative shrink-0 border-b bg-muted/30 px-4 py-3">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('payments.searchPeople')}
            className="ps-9"
          />
        </div>

        <p className="shrink-0 px-4 py-2 text-xs text-muted-foreground">
          {t('payments.pressF1Person')}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filtered.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground sm:col-span-2">
                {search.trim() ? t('common.noResults') : t('people.emptyPeople')}
              </p>
            ) : (
              filtered.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickAt(i)}
                  className={cn(
                    'rounded-lg border p-3 text-start text-sm transition-colors hover:bg-muted/80',
                    i === highlight && 'ring-2 ring-primary'
                  )}
                >
                  <div className="font-medium leading-snug">{c.name}</div>
                  {c.phone && (
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {c.phone}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {c.roles.includes('customer') && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        {t('people.customer')}
                      </span>
                    )}
                    {c.roles.includes('supplier') && (
                      <span className="rounded bg-orange-100 px-1.5 py-0.5 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                        {t('people.supplier')}
                      </span>
                    )}
                    <span className="tabular-nums">
                      {t('people.balance')}: {formatCurrency(c.balance)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
