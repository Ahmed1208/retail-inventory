import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown, Search } from 'lucide-react'

import type { Warehouse } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  warehouses: Warehouse[]
  value: number
  onChange: (id: number) => void
  disabled?: boolean
  className?: string
  id?: string
  /** Overrides default "Warehouses" field label when `id` is set. */
  label?: string
}

export function WarehouseCombobox({
  warehouses,
  value,
  onChange,
  disabled,
  className,
  id,
  label,
}: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => warehouses.find((w) => w.id === value) ?? null,
    [warehouses, value]
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return warehouses
    return warehouses.filter(
      (w) =>
        String(w.id).includes(s) ||
        w.name.toLowerCase().includes(s) ||
        (w.location?.toLowerCase().includes(s) ?? false)
    )
  }, [warehouses, q])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative w-full max-w-md', className)}>
      {id ? (
        <Label htmlFor={id} className="text-muted-foreground text-xs">
          {label ?? t('warehouses.title')}
        </Label>
      ) : null}
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn(
          'mt-1 h-9 w-full justify-between font-normal',
          !selected && 'text-muted-foreground'
        )}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate text-start">
          {selected
            ? `${selected.id} · ${selected.name}`
            : t('warehouses.selectPlaceholder')}
        </span>
        <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md"
          role="listbox"
        >
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('warehouses.searchByIdOrName')}
              className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
              autoFocus
            />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                {t('common.noResults')}
              </li>
            ) : (
              filtered.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={w.id === value}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-start text-sm hover:bg-muted',
                      w.id === value && 'bg-muted'
                    )}
                    onClick={() => {
                      onChange(w.id)
                      setOpen(false)
                      setQ('')
                    }}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        w.id === value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {w.id}
                    </span>
                    <span className="min-w-0 truncate font-medium">
                      {w.name}
                    </span>
                    {w.is_default && (
                      <span className="ms-auto shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {t('warehouses.defaultBadge')}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
