import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { InventoryTransferWithItems } from '@/services/inventoryTransferService'

type Props = {
  transfer: InventoryTransferWithItems | null
  fromWarehouseName: string
  toWarehouseName: string
  /** Increment to trigger print */
  printTrigger: number
  onPrinted: () => void
}

export function PrintInventoryTransfer({
  transfer,
  fromWarehouseName,
  toWarehouseName,
  printTrigger,
  onPrinted,
}: Props) {
  const { i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const isRTL = lang === 'ar'
  const lastTrigger = useRef(0)

  useEffect(() => {
    if (
      !transfer ||
      printTrigger === 0 ||
      printTrigger === lastTrigger.current
    )
      return
    lastTrigger.current = printTrigger
    document.body.classList.add('printing-transfer')
    const timer = window.setTimeout(() => {
      window.print()
      document.body.classList.remove('printing-transfer')
      onPrinted()
    }, 100)
    return () => window.clearTimeout(timer)
  }, [printTrigger, transfer, onPrinted])

  if (!transfer) return null

  const formattedDate = new Intl.DateTimeFormat(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { dateStyle: 'full', timeStyle: 'short' }
  ).format(new Date(transfer.created_at))

  return (
    <div
      className="print-transfer-root"
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-hidden
    >
      <header className="border-b border-black pb-4 mb-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">StockPilot</h1>
        <p className="text-sm mt-1">
          {lang === 'ar' ? 'تحويل مخزون' : 'Stock transfer'} #
          {transfer.transfer_number}
        </p>
        <p className="text-xs text-gray-700">{formattedDate}</p>
      </header>

      <section className="mb-4 text-sm space-y-1">
        <p>
          <span className="font-semibold">
            {lang === 'ar' ? 'من' : 'From'}:
          </span>{' '}
          {fromWarehouseName}
        </p>
        <p>
          <span className="font-semibold">
            {lang === 'ar' ? 'إلى' : 'To'}:
          </span>{' '}
          {toWarehouseName}
        </p>
      </section>

      <table className="w-full border-collapse text-sm mb-6">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1 px-1 text-start w-8">#</th>
            <th className="py-1 px-1 text-start">
              {lang === 'ar' ? 'المنتج' : 'Product'}
            </th>
            <th className="py-1 px-1 text-start font-mono text-xs">
              {lang === 'ar' ? 'الرمز' : 'Code'}
            </th>
            <th className="py-1 px-1 text-end">
              {lang === 'ar' ? 'الكمية' : 'Qty'}
            </th>
          </tr>
        </thead>
        <tbody>
          {transfer.items.map((it, i) => (
            <tr key={it.id} className="border-b border-gray-400">
              <td className="py-1 px-1">{i + 1}</td>
              <td className="py-1 px-1">{it.product.name}</td>
              <td className="py-1 px-1 font-mono text-xs">
                {it.product.product_code}
              </td>
              <td className="py-1 px-1 text-end tabular-nums">
                {it.quantity} {it.product.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {transfer.note ? (
        <p className="mt-4 text-sm border-t border-gray-400 pt-2 whitespace-pre-wrap">
          <span className="font-semibold">
            {lang === 'ar' ? 'ملاحظة' : 'Note'}:
          </span>{' '}
          {transfer.note}
        </p>
      ) : null}

      <footer className="mt-10 pt-4 border-t border-black text-center text-sm space-y-1">
        <p dir="ltr">StockPilot</p>
      </footer>
    </div>
  )
}
