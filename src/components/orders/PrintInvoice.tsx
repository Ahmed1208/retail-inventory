import { useEffect, useRef } from 'react'
import type { OrderWithItemsAndPayments } from '@/types'
import { formatCurrency } from '@/utils/currency'

type Props = {
  order: OrderWithItemsAndPayments | null
  /** Increment to trigger print */
  printTrigger: number
  personName?: string | null
  personPhone?: string | null
  lang: 'en' | 'ar'
  isRTL: boolean
  onPrinted: () => void
}

export function PrintInvoice({
  order,
  printTrigger,
  personName,
  personPhone,
  lang,
  isRTL,
  onPrinted,
}: Props) {
  const lastTrigger = useRef(0)

  useEffect(() => {
    if (!order || printTrigger === 0 || printTrigger === lastTrigger.current) return
    lastTrigger.current = printTrigger
    document.body.classList.add('printing-invoice')
    const t = window.setTimeout(() => {
      window.print()
      document.body.classList.remove('printing-invoice')
      onPrinted()
    }, 100)
    return () => window.clearTimeout(t)
  }, [printTrigger, order, onPrinted])

  if (!order) return null

  const fc = (n: number) => formatCurrency(n, lang)

  return (
    <div
      className="print-invoice-root"
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-hidden
    >
      <header className="border-b border-black pb-4 mb-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">StockPilot</h1>
        <p className="text-sm mt-1">
          {lang === 'ar' ? 'فاتورة' : 'Invoice'} #{order.order_number}
        </p>
        <p className="text-xs text-gray-700">
          {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
          }).format(new Date(order.created_at))}
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
              {lang === 'ar' ? 'المنتج' : 'Product'}
            </th>
            <th className="py-1 px-1 text-end">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
            <th className="py-1 px-1 text-end">
              {lang === 'ar' ? 'سعر الوحدة' : 'Unit'}
            </th>
            <th className="py-1 px-1 text-end">%</th>
            <th className="py-1 px-1 text-end">
              {lang === 'ar' ? 'الإجمالي' : 'Total'}
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={it.id} className="border-b border-gray-400">
              <td className="py-1 px-1">{i + 1}</td>
              <td className="py-1 px-1">{it.product.name}</td>
              <td className="py-1 px-1 text-end tabular-nums">{it.quantity}</td>
              <td className="py-1 px-1 text-end tabular-nums">
                {fc(it.unit_price)}
              </td>
              <td className="py-1 px-1 text-end tabular-nums">
                {it.line_discount_rate > 0 ? `${it.line_discount_rate}%` : '—'}
              </td>
              <td className="py-1 px-1 text-end tabular-nums">
                {fc(it.total_price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className={`text-sm space-y-1 ${isRTL ? 'text-left' : 'text-right'} ms-auto max-w-xs`}>
        <div className="flex justify-between gap-8 border-b border-gray-400 py-0.5">
          <span>{lang === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
          <span className="tabular-nums">{fc(order.subtotal)}</span>
        </div>
        {order.discount_amount > 0.005 && (
          <div className="flex justify-between gap-8 border-b border-gray-400 py-0.5">
            <span>
              {lang === 'ar' ? 'الخصم' : 'Discount'} ({order.discount_rate}%)
            </span>
            <span className="tabular-nums">−{fc(order.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between gap-8 border-b-2 border-black py-1 font-bold text-base">
          <span>{lang === 'ar' ? 'الإجمالي' : 'Total'}</span>
          <span className="tabular-nums">{fc(order.total_amount)}</span>
        </div>
        <div className="flex justify-between gap-8 py-0.5">
          <span>{lang === 'ar' ? 'المدفوع' : 'Paid'}</span>
          <span className="tabular-nums">{fc(order.paid_amount)}</span>
        </div>
        {order.remaining_amount > 0.005 && (
          <div className="flex justify-between gap-8 py-0.5">
            <span>{lang === 'ar' ? 'المتبقي' : 'Remaining'}</span>
            <span className="tabular-nums">{fc(order.remaining_amount)}</span>
          </div>
        )}
      </section>

      {order.payment_installments.length > 0 && (
        <section className="mt-6 text-sm">
          <p className="font-semibold mb-1">
            {lang === 'ar' ? 'الدفعات' : 'Payments'}
          </p>
          <ul className="list-disc ps-4 space-y-0.5">
            {order.payment_installments.map((p) => (
              <li key={p.id} className="tabular-nums">
                {p.method}: {fc(p.amount)}
                {p.note ? ` — ${p.note}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {order.note && (
        <p className="mt-4 text-sm border-t border-gray-400 pt-2 whitespace-pre-wrap">
          {order.note}
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
