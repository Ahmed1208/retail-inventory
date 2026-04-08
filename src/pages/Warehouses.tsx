import { useEffect, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

import {
  createWarehouse,
  DEFAULT_WAREHOUSE_ID,
  deleteWarehouse,
  getWarehouseDeleteBlockers,
  listWarehouses,
  setDefaultWarehouse,
  updateWarehouse,
} from '@/services/warehouseService'
import { getRegisterBalances, type RegisterBalances } from '@/services/registerService'
import type { Warehouse } from '@/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { BackToInventoryLink } from '@/components/inventory/BackToInventoryLink'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/currency'
import { paymentLabel, PAYMENT_METHODS } from '@/components/orders/ordersShared'

export function Warehouses() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const canManage = useFeatureEnabled('inventory.hubWarehouses')

  const [addOpen, setAddOpen] = useState(false)
  const [editRow, setEditRow] = useState<Warehouse | null>(null)
  const [newName, setNewName] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editHasRegister, setEditHasRegister] = useState(true)
  const [newHasRegister, setNewHasRegister] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null)
  const [registerBlockOpen, setRegisterBlockOpen] = useState(false)
  const [registerBlockBalances, setRegisterBlockBalances] =
    useState<RegisterBalances | null>(null)
  const [registerBlockWarehouseId, setRegisterBlockWarehouseId] = useState<
    number | null
  >(null)
  const [registerToggleLoading, setRegisterToggleLoading] = useState(false)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
    enabled: canManage,
  })

  useEffect(() => {
    document.title = `${t('warehouses.title')} | StockPilot`
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  useEffect(() => {
    if (editRow) {
      setEditName(editRow.name)
      setEditLocation(editRow.location ?? '')
      setEditHasRegister(editRow.has_register)
    }
  }, [editRow])

  const deleteBlockersQuery = useQuery({
    queryKey: ['warehouseDeleteBlockers', deleteTarget?.id],
    queryFn: () => getWarehouseDeleteBlockers(deleteTarget!.id),
    enabled: !!deleteTarget,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['warehouses'] })
  }

  const createMut = useMutation({
    mutationFn: () =>
      createWarehouse({
        name: newName,
        location: newLocation.trim(),
        has_register: newHasRegister,
      }),
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
      setNewName('')
      setNewLocation('')
      setNewHasRegister(false)
      toast.success(t('warehouses.toastCreated'))
    },
    onError: (e: Error) => toast.error(e.message || t('warehouses.toastError')),
  })

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editRow) throw new Error('No row')
      return updateWarehouse(editRow.id, {
        name: editName,
        location: editLocation.trim() || null,
        has_register: editHasRegister,
      })
    },
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['registerBalances'] })
      setEditRow(null)
      toast.success(t('warehouses.toastUpdated'))
    },
    onError: (e: Error) => toast.error(e.message || t('warehouses.toastError')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteWarehouse(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success(t('warehouses.toastDeleted'))
    },
    onError: (e: Error) => toast.error(e.message || t('warehouses.toastError')),
  })

  const defaultMut = useMutation({
    mutationFn: ({ id, checked }: { id: number; checked: boolean }) =>
      setDefaultWarehouse(checked ? id : null),
    onSuccess: () => {
      invalidate()
      toast.success(t('warehouses.toastDefaultUpdated'))
    },
    onError: (e: Error) => toast.error(e.message || t('warehouses.toastError')),
  })

  const onAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) {
      toast.error(t('warehouses.validationName'))
      return
    }
    if (!newLocation.trim()) {
      toast.error(t('warehouses.validationLocation'))
      return
    }
    createMut.mutate()
  }

  const fc = (n: number) => formatCurrency(n, lang)

  const handleEditRegisterToggle = async (checked: boolean) => {
    if (!editRow) return
    if (
      !checked &&
      editRow.has_register &&
      !editRow.is_default &&
      editRow.id !== DEFAULT_WAREHOUSE_ID
    ) {
      setRegisterToggleLoading(true)
      try {
        const b = await getRegisterBalances(editRow.id)
        if (b.total > 0.01) {
          setRegisterBlockBalances(b)
          setRegisterBlockWarehouseId(editRow.id)
          setRegisterBlockOpen(true)
          return
        }
      } catch {
        toast.error(t('warehouses.toastError'))
        return
      } finally {
        setRegisterToggleLoading(false)
      }
    }
    setEditHasRegister(checked)
  }

  const openWithdrawAllShortcut = () => {
    if (registerBlockWarehouseId == null) return
    const id = registerBlockWarehouseId
    setRegisterBlockOpen(false)
    setEditRow(null)
    navigate(
      `/register?registerWarehouseId=${id}&withdrawAll=1&disableRegisterAfter=1`
    )
  }

  if (!canManage) {
    return (
      <div className="space-y-4 p-4">
        <BackToInventoryLink />
        <p className="text-sm text-muted-foreground">
          {t('control.disabled.warehouses')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <BackToInventoryLink />
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {t('warehouses.title')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('warehouses.description')}
          </p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t('warehouses.addWarehouse')}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center p-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t('warehouses.empty')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-start">
                <th className="px-4 py-3 font-medium">
                  {t('warehouses.colCode')}
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  {t('warehouses.colInternalId')}
                </th>
                <th className="px-4 py-3 font-medium">{t('common.name')}</th>
                <th className="px-4 py-3 font-medium">
                  {t('warehouses.colLocation')}
                </th>
                <th className="px-4 py-3 font-medium w-28">
                  {t('warehouses.colDefault')}
                </th>
                <th className="px-4 py-3 font-medium w-32">
                  {t('warehouses.colHasRegister')}
                </th>
                <th className="px-4 py-3 font-medium w-28">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-sm font-medium">
                    {w.code}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground text-xs">
                    {w.id}
                  </td>
                  <td className="px-4 py-3 font-medium">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {w.location ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-primary"
                        checked={w.is_default}
                        disabled={defaultMut.isPending}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          defaultMut.mutate({
                            id: w.id,
                            checked: e.target.checked,
                          })
                        }}
                        aria-label={t('warehouses.setAsDefault')}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {w.has_register ? t('common.yes') : t('common.no')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditRow(w)}
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {w.id !== 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(w)}
                          aria-label={t('warehouses.deleteWarehouse')}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <form onSubmit={onAddSubmit}>
            <DialogHeader>
              <DialogTitle>{t('warehouses.addWarehouse')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                {t('warehouses.codeAutoHint')}
              </p>
              <div>
                <Label>{t('warehouses.colLocation')} *</Label>
                <Input
                  className="mt-1"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder={t('warehouses.locationPlaceholder')}
                  required
                />
              </div>
              <div>
                <Label>{t('common.name')} *</Label>
                <Input
                  className="mt-1"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={newHasRegister}
                  onChange={(e) => setNewHasRegister(e.target.checked)}
                />
                <span>{t('warehouses.hasRegisterLabel')}</span>
              </label>
              <p className="text-xs text-muted-foreground">
                {t('warehouses.hasRegisterHint')}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                )}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editRow)} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('warehouses.editWarehouse')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-mono font-medium text-foreground">
                {editRow?.code}
              </span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-xs">
                {t('warehouses.colInternalId')}: {editRow?.id}
              </span>
            </p>
            <div>
              <Label>{t('common.name')} *</Label>
              <Input
                className="mt-1"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('warehouses.colLocation')}</Label>
              <Input
                className="mt-1"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                checked={editHasRegister}
                disabled={
                  registerToggleLoading ||
                  editRow?.is_default ||
                  editRow?.id === DEFAULT_WAREHOUSE_ID
                }
                onChange={(e) => handleEditRegisterToggle(e.target.checked)}
              />
              <span>{t('warehouses.hasRegisterLabel')}</span>
              {registerToggleLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </label>
            {editRow?.is_default || editRow?.id === DEFAULT_WAREHOUSE_ID ? (
              <p className="text-xs text-muted-foreground">
                {editRow?.id === DEFAULT_WAREHOUSE_ID
                  ? t('warehouses.primaryWarehouseMustHaveRegister')
                  : t('warehouses.defaultMustHaveRegister')}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending || !editName.trim()}
            >
              {updateMut.isPending && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={registerBlockOpen}
        onOpenChange={(o) => {
          if (!o) {
            setRegisterBlockOpen(false)
            setRegisterBlockBalances(null)
            setRegisterBlockWarehouseId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('warehouses.registerNotEmptyTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-start text-muted-foreground">
                <p>{t('warehouses.registerNotEmptyBody')}</p>
                {registerBlockBalances ? (
                  <ul className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                    {PAYMENT_METHODS.map((m) => (
                      <li
                        key={m}
                        className="flex justify-between gap-4 tabular-nums"
                      >
                        <span>{paymentLabel(m, t)}</span>
                        <span>{fc(registerBlockBalances[m])}</span>
                      </li>
                    ))}
                    <li className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
                      <span>{t('register.totalInRegister')}</span>
                      <span>{fc(registerBlockBalances.total)}</span>
                    </li>
                  </ul>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>{t('common.close')}</AlertDialogCancel>
            <Button type="button" onClick={openWithdrawAllShortcut}>
              {t('warehouses.withdrawAllRegisterShortcut')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('warehouses.deleteWarehouseTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-start text-muted-foreground">
                {deleteBlockersQuery.isLoading ? (
                  <p>{t('common.loading')}</p>
                ) : deleteBlockersQuery.data &&
                  (deleteBlockersQuery.data.stockUnits > 0 ||
                    deleteBlockersQuery.data.registerLedgerRows > 0) ? (
                  <>
                    {deleteBlockersQuery.data.stockUnits > 0 ? (
                      <p>{t('warehouses.deleteBlockedStock')}</p>
                    ) : null}
                    {deleteBlockersQuery.data.registerLedgerRows > 0 ? (
                      <p>{t('warehouses.deleteBlockedRegister')}</p>
                    ) : null}
                    <Link
                      className={cn(
                        buttonVariants({ variant: 'secondary' }),
                        'inline-flex w-full items-center justify-center'
                      )}
                      to={
                        deleteTarget
                          ? `/inventory-transfers/new?fromWarehouseId=${deleteTarget.id}&prefill=all&promptDeleteWarehouse=${deleteTarget.id}`
                          : '#'
                      }
                      onClick={() => setDeleteTarget(null)}
                    >
                      {t('warehouses.openTransferToEmpty')}
                    </Link>
                  </>
                ) : (
                  <p>{t('warehouses.deleteWarehouseConfirm')}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            {deleteBlockersQuery.data &&
            deleteBlockersQuery.data.stockUnits <= 0 &&
            deleteBlockersQuery.data.registerLedgerRows <= 0 ? (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMut.isPending}
                onClick={(e) => {
                  e.preventDefault()
                  if (deleteTarget) deleteMut.mutate(deleteTarget.id)
                }}
              >
                {deleteMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('warehouses.deleteWarehouse')
                )}
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
