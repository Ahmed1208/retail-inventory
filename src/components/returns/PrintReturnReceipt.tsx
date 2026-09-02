import { useEffect, useRef } from 'react'

import type { ReturnWithItems } from '@/types'
import { formatCurrency } from '@/utils/currency'

type Props = {
  salesReturn: ReturnWithItems | null
  sourceOrderNumber: number | null
  /** Increment to trigger print */
  printTrigger: number
  personName?: string | null
  personPhone?: string | null
  lang: 'en' | 'ar'
  isRTL: boolean
  onPrinted: () => void
}

export function PrintReturnReceipt({
  salesReturn,
  sourceOrderNumber,
  printTrigger,
  personName,
  personPhone,
  lang,
  isRTL,
  onPrinted,
}: Props) {
  const lastTrigger = useRef(0)

  useEffect(() => {
    if (
      !salesReturn ||
      printTrigger === 0 ||
      printTrigger === lastTrigger.current
    )
      return
    lastTrigger.current = printTrigger
    document.body.classList.add('printing-invoice')
    const t = window.setTimeout(() => {
      window.print()
      document.body.classList.remove('printing-invoice')
      onPrinted()
    }, 100)
    return () => window.clearTimeout(t)
  }, [printTrigger, salesReturn, onPrinted])

  if (!salesReturn) return null

  const ar = lang === 'ar'
  const fc = (n: number) => formatCurrency(n, lang)

  const settlementText =
    salesReturn.settlement === 'refund_to_register'
      ? ar
        ? 'مسترد نقدًا من الخزينة'
        : 'Refunded from register'
      : salesReturn.settlement === 'credit_to_account'
        ? ar
          ? 'مضاف إلى رصيد العميل'
          : 'Credited to account'
        : '—'

  return (
    <div className="print-invoice-root" dir={isRTL ? 'rtl' : 'ltr'} aria-hidden>
      <header className="border-b border-black pb-4 mb-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">StockPilot</h1>
        <p className="text-sm mt-1">
          {ar ? 'إشعار مرتجع' : 'Return receipt'} R-
          {salesReturn.return_number}
        </p>
        {sourceOrderNumber != null && (
          <p className="text-xs text-gray-700">
            {ar ? 'عن الطلب' : 'Against order'} #{sourceOrderNumber}
          </p>
        )}
        <p className="text-xs text-gray-700">
          {new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
          }).format(new Date(salesReturn.created_at))}
        </p>
      </header>

      {(personName || personPhone) && (
        <section className="mb-4 text-sm">
          <p className="font-semibold">{personName}</p>
          {personPhone && <p>{personPhone}</p>}
        </section>
      )}

      <table className="w-full border-collapse text-sm mb-6">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1 px-1 text-start w-8">#</th>
            <th className="py-1 px-1 text-start">
              {ar ? 'المنتج' : 'Product'}
            </th>
            <th className="py-1 px-1 text-end">{ar ? 'الكمية' : 'Qty'}</th>
            <th className="py-1 px-1 text-end">
              {ar ? 'سعر الوحدة' : 'Unit'}
            </th>
            <th className="py-1 px-1 text-end">
              {ar ? 'الإجمالي' : 'Total'}
            </th>
          </tr>
        </thead>
        <tbody>
          {salesReturn.items.map((it, i) => (
            <tr key={it.id} className="border-b border-gray-400">
              <td className="py-1 px-1">{i + 1}</td>
              <td className="py-1 px-1">{it.product.name}</td>
              <td className="py-1 px-1 text-end tabular-nums">{it.quantity}</td>
              <td className="py-1 px-1 text-end tabular-nums">
                {fc(it.unit_price)}
              </td>
              <td className="py-1 px-1 text-end tabular-nums">
                {fc(it.total_price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section
        className={`text-sm space-y-1 ${isRTL ? 'text-left' : 'text-right'} ms-auto max-w-xs`}
      >
        <div className="flex justify-between gap-8 border-b-2 border-black py-1 font-bold text-base">
          <span>{ar ? 'قيمة المرتجع' : 'Refund total'}</span>
          <span className="tabular-nums">{fc(salesReturn.total_amount)}</span>
        </div>
        <div className="flex justify-between gap-8 py-0.5">
          <span>{ar ? 'طريقة التسوية' : 'Settlement'}</span>
          <span>{settlementText}</span>
        </div>
      </section>

      {salesReturn.note && (
        <p className="mt-4 text-sm border-t border-gray-400 pt-2 whitespace-pre-wrap">
          {salesReturn.note}
        </p>
      )}

      <footer className="mt-10 pt-4 border-t border-black text-center text-sm space-y-1">
        <p dir="ltr">Thank you for your business</p>
        <p dir="rtl" className="text-base">
          شكراً لتعاملكم معنا
        </p>
      </footer>
    </div>
  )
}
