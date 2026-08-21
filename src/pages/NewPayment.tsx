import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ChevronDown } from 'lucide-react'

import { getAllPeople, getPersonById } from '@/services/peopleService'
import type { Person } from '@/types'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/utils/currency'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { PersonBrowserModal } from '@/components/people/PersonBrowserModal'
import { RecordPaymentForm } from '@/components/people/RecordPaymentForm'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function NewPayment() {
  const { t, i18n } = useTranslation()
  const { isRTL } = useLanguage()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const prePersonId = searchParams.get('personId')

  const canCreate = useFeatureEnabled('people.recordPayment')
  const [selected, setSelected] = useState<Person | null>(null)
  const [browserOpen, setBrowserOpen] = useState(false)

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getAllPeople(),
  })

  const { data: preloaded } = useQuery({
    queryKey: ['person', prePersonId],
    queryFn: () => getPersonById(prePersonId!),
    enabled: !!prePersonId && !selected,
  })

  useEffect(() => {
    if (preloaded && !selected) {
      setSelected({
        id: preloaded.id,
        name: preloaded.name,
        phone: preloaded.phone,
        external_code: preloaded.external_code,
        address: preloaded.address,
        notes: preloaded.notes,
        roles: preloaded.roles,
        balance: preloaded.balance,
        discount_rate: preloaded.discount_rate,
        credit_limit: preloaded.credit_limit,
        created_at: preloaded.created_at,
        updated_at: preloaded.updated_at,
      })
    }
  }, [preloaded, selected])

  useEffect(() => {
    document.title = `${t('payments.newPayment')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return
      if (browserOpen) return
      e.preventDefault()
      setBrowserOpen(true)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [browserOpen])

  const fc = useMemo(() => (n: number) => formatCurrency(n, lang), [lang])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['people'] })
    qc.invalidateQueries({ queryKey: ['balanceTransactions'] })
    qc.invalidateQueries({ queryKey: ['dashboardStats'] })
    qc.invalidateQueries({ queryKey: ['personTxs'] })
    qc.invalidateQueries({ queryKey: ['person', prePersonId] })
  }

  if (!canCreate) {
    return <Navigate to="/payments" replace />
  }

  return (
    <div className="mx-auto max-w-lg space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <Link
        to="/payments"
        className="-ms-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {t('payments.backToHub')}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('payments.newPayment')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('payments.newPaymentHint')}
        </p>
      </div>

      <PersonBrowserModal
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        people={people}
        isRTL={isRTL}
        formatCurrency={fc}
        onPick={(p) => setSelected(p)}
      />

      <div
        data-payment-person-zone
        className="rounded-xl border border-border bg-card p-4 md:p-6"
      >
        <Label className="text-sm font-medium">
          {t('payments.personForPayment')}
        </Label>
        <button
          type="button"
          className={cn(
            'mt-2 flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-start text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
          )}
          onClick={() => setBrowserOpen(true)}
        >
          <span className="truncate">
            {selected ? selected.name : t('payments.choosePerson')}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
        <p className="mt-2 text-[10px] text-muted-foreground sm:text-xs">
          {t('payments.pressF1Person')}
        </p>

        {selected && (
          <div className="mt-6 border-t border-border pt-6">
            <RecordPaymentForm
              person={selected}
              formatCurrency={fc}
              showDialogFooter={false}
              onCancel={() => setSelected(null)}
              onSuccess={() => {
                invalidate()
                toast.success(t('people.toastPayment'))
                setSelected(null)
              }}
              onError={(m) => toast.error(m || t('people.toastError'))}
            />
          </div>
        )}
      </div>
    </div>
  )
}
