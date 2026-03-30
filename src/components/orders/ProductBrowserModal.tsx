import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'

import type { Category, ProductWithRelations } from '@/types'
import type { OrderType } from '@/types'
import { formatCurrency } from '@/utils/currency'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: ProductWithRelations[]
  categories: Category[]
  /** Used when purpose is \"sale\" (POS) to show retail vs wholesale list price. */
  orderType?: OrderType
  /** \"sale\" = customer/business price; \"purchase\" = cost price (PO). */
  purpose?: 'sale' | 'purchase'
  lang: 'en' | 'ar'
  isRTL: boolean
  onPick: (product: ProductWithRelations) => void
}

export function ProductBrowserModal({
  open,
  onOpenChange,
  products,
  categories,
  orderType = 'retail',
  purpose = 'sale',
  lang,
  isRTL,
  onPick,
}: Props) {
  const { t } = useTranslation()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [brandId, setBrandId] = useState<string>('all')
  const [highlight, setHighlight] = useState(0)

  const brands = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of products) {
      if (p.brand?.id) m.set(p.brand.id, p.brand.name)
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (categoryId !== 'all' && p.category?.id !== categoryId) return false
      if (brandId !== 'all' && p.brand?.id !== brandId) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      )
    })
  }, [products, search, categoryId, brandId])

  useEffect(() => {
    if (open) {
      setSearch('')
      setCategoryId('all')
      setBrandId('all')
      setHighlight(0)
      const t = window.setTimeout(() => searchRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    setHighlight((h) =>
      filtered.length === 0 ? 0 : Math.min(h, filtered.length - 1)
    )
  }, [filtered.length])

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
          filtered.length === 0 ? 0 : (h + 1) % filtered.length
        )
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) =>
          filtered.length === 0
            ? 0
            : (h - 1 + filtered.length) % filtered.length
        )
      }
      if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault()
        pickAt(highlight)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered.length, highlight, pickAt, onOpenChange])

  const price = (p: ProductWithRelations) =>
    purpose === 'purchase'
      ? p.cost_price
      : orderType === 'retail'
        ? p.customer_price
        : p.business_price

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
            {purpose === 'purchase'
              ? t('purchaseOrders.productBrowser')
              : t('orders.productBrowser')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-2 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('orders.searchProducts')}
              className="ps-9"
            />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('products.filterByCategory')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('products.allCategories')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('products.filterByBrand')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('products.allBrands')}</SelectItem>
              {brands.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="shrink-0 px-4 py-2 text-xs text-muted-foreground">
          {purpose === 'purchase'
            ? t('purchaseOrders.pressF1Products')
            : t('orders.pressF1')}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t('common.noResults')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickAt(i)}
                  className={cn(
                    'rounded-lg border p-3 text-start text-sm transition-colors hover:bg-muted/80',
                    i === highlight && 'ring-2 ring-primary'
                  )}
                >
                  <div className="font-mono text-xs text-muted-foreground">
                    {p.product_code}
                  </div>
                  <div className="font-medium leading-snug">{p.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      {t('orders.availableStock')}: {p.quantity}
                    </span>
                    <span className="tabular-nums">
                      {purpose === 'purchase'
                        ? t('products.costPrice')
                        : orderType === 'retail'
                          ? t('products.customerPrice')
                          : t('products.businessPrice')}
                      : {formatCurrency(price(p), lang)}
                    </span>
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
