import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserPlus } from 'lucide-react'

import type { Person } from '@/types'
import { Button } from '@/components/ui/button'
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
  customers: Person[]
  isRTL: boolean
  formatCurrency: (n: number) => string
  onPick: (person: Person | null) => void
  /** When false, window Escape handler does not close (stacked dialog owns Esc). */
  escapeClosesBrowser?: boolean
  showQuickCreate?: boolean
  onRequestQuickCreate?: () => void
  /** Increment after a new person is saved to clear search so the new row is visible. */
  listRefreshKey?: number
}

export function CustomerBrowserModal({
  open,
  onOpenChange,
  customers,
  isRTL,
  formatCurrency,
  onPick,
  escapeClosesBrowser = true,
  showQuickCreate = false,
  onRequestQuickCreate,
  listRefreshKey = 0,
}: Props) {
  const { t } = useTranslation()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => {
      const name = c.name.toLowerCase()
      const phone = (c.phone ?? '').toLowerCase()
      return (
        name.includes(q) ||
        phone.includes(q) ||
        c.id.toLowerCase().includes(q)
      )
    })
  }, [customers, search])

  const rowCount = 1 + filtered.length

  useEffect(() => {
    if (open) {
      setSearch('')
      setHighlight(0)
      const timer = window.setTimeout(() => searchRef.current?.focus(), 50)
      return () => window.clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    if (!open || listRefreshKey <= 0) return
    setSearch('')
    setHighlight(0)
    const timer = window.setTimeout(() => searchRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [listRefreshKey, open])

  useEffect(() => {
    setHighlight((h) =>
      rowCount === 0 ? 0 : Math.min(h, rowCount - 1)
    )
  }, [rowCount])

  const pickAt = useCallback(
    (index: number) => {
      if (index === 0) {
        onPick(null)
        onOpenChange(false)
        return
      }
      const c = filtered[index - 1]
      if (c) {
        onPick(c)
        onOpenChange(false)
      }
    },
    [filtered, onPick, onOpenChange]
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!escapeClosesBrowser) return
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
  }, [open, rowCount, highlight, pickAt, onOpenChange, escapeClosesBrowser])

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-lg">
              {t('orders.customerBrowser')}
            </DialogTitle>
            {showQuickCreate && onRequestQuickCreate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={onRequestQuickCreate}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t('orders.quickCreateCustomer')}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="relative shrink-0 border-b bg-muted/30 px-4 py-3">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('orders.searchCustomers')}
            className="ps-9"
          />
        </div>

        <p className="shrink-0 px-4 py-2 text-xs text-muted-foreground">
          {t('orders.pressF1Customer')}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => pickAt(0)}
              className={cn(
                'rounded-lg border p-3 text-start text-sm transition-colors hover:bg-muted/80',
                highlight === 0 && 'ring-2 ring-primary'
              )}
            >
              <div className="font-medium">{t('orders.walkIn')}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t('orders.walkInBrowserHint')}
              </div>
            </button>
            {filtered.length === 0 && search.trim() ? (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground sm:col-span-2">
                {t('common.noResults')}
              </p>
            ) : (
              filtered.map((c, i) => {
                const idx = i + 1
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickAt(idx)}
                    className={cn(
                      'rounded-lg border p-3 text-start text-sm transition-colors hover:bg-muted/80',
                      idx === highlight && 'ring-2 ring-primary'
                    )}
                  >
                    <div className="font-medium leading-snug">{c.name}</div>
                    {c.phone && (
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {c.phone}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        {t('orders.personBalance')}:{' '}
                        {formatCurrency(c.balance)}
                      </span>
                      <span className="tabular-nums">
                        {t('orders.discount')}: {c.discount_rate}%
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
