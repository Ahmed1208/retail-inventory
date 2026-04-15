import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MEMBER_BASE_DENY_ADMIN,
  MEMBER_ONBOARDING_QUESTIONS,
} from '@/config/memberOnboardingRules'
import { createMemberViaEdge } from '@/services/memberAdminService'
import { listWarehouses } from '@/services/warehouseService'

type Step = 'account' | 'question' | 'review'

export function AdminMemberNew() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('account')
  const [qIndex, setQIndex] = useState(0)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<number[]>([])
  const [answers, setAnswers] = useState<boolean[]>(() =>
    MEMBER_ONBOARDING_QUESTIONS.map(() => true)
  )
  const [submitting, setSubmitting] = useState(false)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', 'member-form'],
    queryFn: listWarehouses,
  })

  const totalQuestions = MEMBER_ONBOARDING_QUESTIONS.length

  const featureOverrides = useMemo(() => {
    const acc: Record<string, boolean> = { ...MEMBER_BASE_DENY_ADMIN }
    MEMBER_ONBOARDING_QUESTIONS.forEach((q, i) => {
      const yes = answers[i] === true
      const patch = yes ? q.whenYes : q.whenNo
      Object.assign(acc, patch)
    })
    return acc
  }, [answers])

  useEffect(() => {
    document.title = `${t('members.newTitle')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  function toggleWarehouse(id: number) {
    setSelectedWarehouseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function validateAccount(): string | null {
    const u = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    if (u.length < 2) return t('members.errorUsername')
    if (password.length < 8) return t('members.errorPasswordShort')
    if (password !== password2) return t('members.errorPasswordMatch')
    if (selectedWarehouseIds.length === 0) return t('members.errorWarehouses')
    return null
  }

  async function submit() {
    const err = validateAccount()
    if (err) {
      toast.error(err)
      return
    }
    setSubmitting(true)
    const slug = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const { error, user_id } = await createMemberViaEdge({
      username: slug,
      password,
      feature_overrides: featureOverrides,
      allowed_warehouse_ids: selectedWarehouseIds,
    })
    setSubmitting(false)
    if (error) {
      toast.error(error)
      return
    }
    if (user_id) toast.success(t('members.createSuccess'))
    navigate('/admin/members')
  }

  const question =
    step === 'question' ? MEMBER_ONBOARDING_QUESTIONS[qIndex] : null

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <Link
          to="/admin/members"
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: 'mb-2 -ms-2',
          })}
        >
          {t('members.backToList')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('members.newTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('members.newSubtitle')}
        </p>
      </div>

      {step === 'account' && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="m-username">{t('members.fieldUsername')}</Label>
            <Input
              id="m-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-password">{t('members.fieldPassword')}</Label>
            <Input
              id="m-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-password2">{t('members.fieldPasswordConfirm')}</Label>
            <Input
              id="m-password2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label>{t('members.fieldWarehouses')}</Label>
            <p className="text-xs text-muted-foreground">{t('members.warehousesHint')}</p>
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
              {warehouses.map((w) => (
                <li key={w.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={selectedWarehouseIds.includes(w.id)}
                      onChange={() => toggleWarehouse(w.id)}
                    />
                    <span>{w.name}</span>
                    <span className="text-muted-foreground">#{w.id}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={() => {
                const e = validateAccount()
                if (e) {
                  toast.error(e)
                  return
                }
                setStep('question')
                setQIndex(0)
              }}
            >
              {t('members.next')}
            </Button>
          </div>
        </div>
      )}

      {step === 'question' && question && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">
            {t('members.questionProgress', {
              current: qIndex + 1,
              total: totalQuestions,
            })}
          </p>
          <h2 className="text-lg font-medium">{t(question.titleKey)}</h2>
          <p className="text-sm text-muted-foreground">
            {t(question.descriptionKey)}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant={answers[qIndex] ? 'default' : 'outline'}
              onClick={() => {
                const next = [...answers]
                next[qIndex] = true
                setAnswers(next)
              }}
            >
              {t('common.yes')}
            </Button>
            <Button
              type="button"
              variant={!answers[qIndex] ? 'default' : 'outline'}
              onClick={() => {
                const next = [...answers]
                next[qIndex] = false
                setAnswers(next)
              }}
            >
              {t('common.no')}
            </Button>
          </div>
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (qIndex <= 0) setStep('account')
                else setQIndex((i) => i - 1)
              }}
            >
              {t('members.back')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (qIndex >= totalQuestions - 1) setStep('review')
                else setQIndex((i) => i + 1)
              }}
            >
              {t('members.next')}
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium">{t('members.reviewTitle')}</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              {t('members.reviewUsername')}:{' '}
              <span className="font-medium text-foreground">
                {username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}
              </span>
            </li>
            <li>
              {t('members.fieldWarehouses')}:{' '}
              <span className="font-medium text-foreground">
                {selectedWarehouseIds
                  .map(
                    (id) =>
                      warehouses.find((w) => w.id === id)?.name ?? String(id)
                  )
                  .join(', ')}
              </span>
            </li>
            <li>{t('members.reviewPermissionsHint')}</li>
          </ul>
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep('question')
                setQIndex(totalQuestions - 1)
              }}
            >
              {t('members.back')}
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submit()}>
              {submitting ? t('common.loading') : t('members.createMember')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
