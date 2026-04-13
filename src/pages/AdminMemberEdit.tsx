import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FEATURE_CONTROL_IDS,
  FEATURE_CONTROL_REGISTRY,
  mergeFeatureState,
  type FeatureControlId,
} from '@/config/featureControls'
import { supabase } from '@/lib/supabase'
import { updateMemberPasswordViaEdge } from '@/services/memberAdminService'
import { listWarehouses } from '@/services/warehouseService'
import type { OperatorProfile } from '@/types/profile'

async function fetchProfileById(id: string): Promise<OperatorProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, is_admin, feature_overrides, allowed_warehouse_ids, created_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const wh = data.allowed_warehouse_ids
  const warehouseIds = Array.isArray(wh)
    ? wh.map((x) => Number(x)).filter((n) => Number.isFinite(n))
    : []

  return {
    id: data.id,
    username: data.username,
    is_admin: data.is_admin,
    feature_overrides:
      data.feature_overrides &&
      typeof data.feature_overrides === 'object' &&
      !Array.isArray(data.feature_overrides)
        ? (data.feature_overrides as Record<string, boolean>)
        : {},
    allowed_warehouse_ids: warehouseIds,
    created_at: data.created_at,
  }
}

export function AdminMemberEdit() {
  const { t } = useTranslation()
  const { id: memberId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [features, setFeatures] = useState<Record<FeatureControlId, boolean> | null>(
    null
  )
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [warehouseIds, setWarehouseIds] = useState<number[]>([])

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin', 'profiles', memberId],
    queryFn: () => fetchProfileById(memberId!),
    enabled: Boolean(memberId),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', 'member-edit'],
    queryFn: listWarehouses,
  })

  useEffect(() => {
    document.title = `${t('members.editTitle')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  useEffect(() => {
    if (!profile) return
    setFeatures(mergeFeatureState(profile.feature_overrides))
    setWarehouseIds([...profile.allowed_warehouse_ids])
  }, [profile])

  const saveWarehousesMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (ids.length === 0) throw new Error('warehouses')
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ allowed_warehouse_ids: ids })
        .eq('id', memberId!)
      if (upErr) throw new Error(upErr.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'profiles'] })
      toast.success(t('members.warehousesSaved'))
    },
    onError: (e: Error) => {
      const msg =
        e.message === 'warehouses'
          ? t('members.errorWarehouses')
          : e.message || t('members.saveError')
      toast.error(msg)
    },
  })

  const saveFeaturesMutation = useMutation({
    mutationFn: async (next: Record<FeatureControlId, boolean>) => {
      const payload: Record<string, boolean> = {}
      for (const fid of FEATURE_CONTROL_IDS) {
        payload[fid] = next[fid]
      }
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ feature_overrides: payload })
        .eq('id', memberId!)
      if (upErr) throw new Error(upErr.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'profiles'] })
      toast.success(t('members.featuresSaved'))
    },
    onError: (e: Error) => toast.error(e.message || t('members.saveError')),
  })

  async function handleSavePassword() {
    if (!password && !password2) return
    if (password.length < 8) {
      toast.error(t('members.errorPasswordShort'))
      return
    }
    if (password !== password2) {
      toast.error(t('members.errorPasswordMatch'))
      return
    }
    const { error: pwErr } = await updateMemberPasswordViaEdge(memberId!, password)
    if (pwErr) {
      toast.error(pwErr)
      return
    }
    toast.success(t('members.passwordUpdated'))
    setPassword('')
    setPassword2('')
  }

  if (!memberId) {
    navigate('/admin/members', { replace: true })
    return null
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">
          {(error as Error).message || t('members.loadError')}
        </p>
        <Link to="/admin/members" className={buttonVariants({ variant: 'outline' })}>
          {t('members.backToList')}
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('members.notFound')}</p>
        <Link to="/admin/members" className={buttonVariants({ variant: 'outline' })}>
          {t('members.backToList')}
        </Link>
      </div>
    )
  }

  if (!features) {
    return (
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/members"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('members.backToList')}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {t('members.editTitle')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('members.editSubtitle', { username: profile.username })}
          </p>
        </div>
      </div>

      <section
        className="space-y-4 rounded-xl border border-border bg-card/40 p-4 md:p-6"
        aria-labelledby="member-password-heading"
      >
        <h2 id="member-password-heading" className="text-lg font-semibold">
          {t('members.sectionPassword')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('members.passwordHint')}</p>
        <div className="grid max-w-md gap-3 sm:grid-cols-1">
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t('members.fieldPassword')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              {t('members.fieldPasswordConfirm')}
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleSavePassword}
          disabled={!password.trim()}
        >
          {t('members.updatePassword')}
        </Button>
      </section>

      {!profile.is_admin && (
        <section
          className="space-y-4 rounded-xl border border-border bg-card/40 p-4 md:p-6"
          aria-labelledby="member-warehouses-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 id="member-warehouses-heading" className="text-lg font-semibold">
                {t('members.sectionWarehouses')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {t('members.warehousesHint')}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => saveWarehousesMutation.mutate(warehouseIds)}
              disabled={saveWarehousesMutation.isPending}
            >
              {t('members.saveWarehouses')}
            </Button>
          </div>
          <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-3">
            {warehouses.map((w) => (
              <li key={w.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={warehouseIds.includes(w.id)}
                    onChange={() =>
                      setWarehouseIds((prev) =>
                        prev.includes(w.id)
                          ? prev.filter((x) => x !== w.id)
                          : [...prev, w.id]
                      )
                    }
                  />
                  <span>{w.name}</span>
                  <span className="text-muted-foreground">#{w.id}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        className="space-y-6 rounded-xl border border-border bg-card/40 p-4 md:p-6"
        aria-labelledby="member-features-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 id="member-features-heading" className="text-lg font-semibold">
              {t('members.sectionFeatures')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t('members.featuresHint')}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => saveFeaturesMutation.mutate(features)}
            disabled={saveFeaturesMutation.isPending}
          >
            {t('members.saveFeatures')}
          </Button>
        </div>

        <div className="space-y-10">
          {FEATURE_CONTROL_REGISTRY.map((area) => (
            <div key={area.titleKey}>
              <h3 className="text-base font-semibold text-foreground">
                {t(area.titleKey)}
              </h3>
              <div className="mt-4 space-y-8 border-s-2 border-muted ps-4">
                {area.groups.map((group) => (
                  <div key={group.titleKey}>
                    <h4 className="text-sm font-medium text-muted-foreground">
                      {t(group.titleKey)}
                    </h4>
                    <ul className="mt-3 space-y-4">
                      {group.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex gap-3 rounded-lg border border-border/80 bg-background/60 p-3"
                        >
                          <input
                            id={`member-fc-${item.id}`}
                            type="checkbox"
                            className="mt-1 h-4 w-4 shrink-0 rounded border-input"
                            checked={features[item.id]}
                            onChange={(e) =>
                              setFeatures((prev) =>
                                prev
                                  ? { ...prev, [item.id]: e.target.checked }
                                  : prev
                              )
                            }
                          />
                          <label
                            htmlFor={`member-fc-${item.id}`}
                            className={cn(
                              'min-w-0 flex-1 cursor-pointer',
                              !features[item.id] && 'text-muted-foreground'
                            )}
                          >
                            <span className="font-medium text-foreground">
                              {t(item.titleKey)}
                            </span>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t(item.descriptionKey)}
                            </p>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
