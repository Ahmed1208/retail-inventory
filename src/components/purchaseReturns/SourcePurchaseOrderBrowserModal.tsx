import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'

import type { Person, PurchaseOrderWithItems } from '@/types'
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
  /** Already filtered to purchase orders that can be returned against. */
  purchaseOrders: PurchaseOrderWithItems[]
  people: Person[]
  isRTL: boolean
  lang: 'en' | 'ar'
  formatCurrency: (n: number) => string
  onPick: (po: PurchaseOrderWithItems) => void
}

export function SourcePurchaseOrderBrowserModal({
  open,
  onOpenChange,
  purchaseOrders,
  people,
  isRTL,
  lang,
  formatCurrency,
  onPick,
}: Props) {
  const { t } = useTranslation()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [highlightRaw, setHighlight] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of people) m.set(p.id, p.name)
    return m
  }, [people])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return purchaseOrders
    return purchaseOrders.filter((o) => {
      if (String(o.order_number).includes(q)) return true
      const name = o.person_id
        ? nameById.get(o.person_id)
        : (o.supplier_name ?? undefined)
      return name ? name.toLowerCase().includes(q) : false
    })
  }, [purchaseOrders, search, nameById])

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSearch('')
      setHighlight(0)
    }
  }

  /** Clamped here rather than stored, so a shrinking result list cannot strand it. */
  const highlight =
    filtered.length === 0 ? 0 : Math.min(highlightRaw, filtered.length - 1)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => searchRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [open])

  const pickAt = useCallback(
    (index: number) => {
      const o = filtered[index]
      if (!o) return
      onPick(o)
      onOpenChange(false)
    },
    [filtered, onPick, onOpenChange]
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) =>
          filtered.length === 0 ? 0 : (h + 1) % filtered.length
        )
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) =>
          filtered.length === 0 ? 0 : (h - 1 + filtered.length) % filtered.length
        )
      }
      if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault()
        pickAt(highlight)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered.length, highlight, pickAt])

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
        dateStyle: 'medium',
      }),
    [lang]
  )

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
        <DialogHeader className="shrink-0 border-b px-4 py-3 pe-12 text-start sm:pe-14 sm:text-start">
          <DialogTitle className="text-lg">
            {t('purchaseReturns.sourceOrderBrowser')}
          </DialogTitle>
        </DialogHeader>

        <div className="relative shrink-0 border-b bg-muted/30 px-4 py-3">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('purchaseReturns.searchSourceOrders')}
            className="ps-9"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-6">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search.trim()
                ? t('common.noResults')
                : t('purchaseReturns.noReturnableOrders')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pickAt(i)}
                  className={cn(
                    'rounded-lg border p-3 text-start text-sm transition-colors hover:bg-muted/80',
                    i === highlight && 'ring-2 ring-primary'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium tabular-nums">
                      #{o.order_number}
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(o.total_amount)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {(o.person_id ? nameById.get(o.person_id) : null) ??
                      o.supplier_name ??
                      t('purchaseOrders.noLinkedSupplier')}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {dateFmt.format(new Date(o.created_at))} ·{' '}
                    {t('purchaseReturns.linesCount', { count: o.items.length })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
