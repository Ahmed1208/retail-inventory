import { useEffect, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus } from 'lucide-react'

import {
  createWarehouse,
  listWarehouses,
  setDefaultWarehouse,
  updateWarehouse,
} from '@/services/warehouseService'
import type { Warehouse } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BackToInventoryLink } from '@/components/inventory/BackToInventoryLink'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function Warehouses() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const canManage = useFeatureEnabled('inventory.hubWarehouses')

  const [addOpen, setAddOpen] = useState(false)
  const [editRow, setEditRow] = useState<Warehouse | null>(null)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')

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
    }
  }, [editRow])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['warehouses'] })
  }

  const createMut = useMutation({
    mutationFn: () =>
      createWarehouse({
        id: Number(newId),
        name: newName,
        location: newLocation.trim() || null,
      }),
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
      setNewId('')
      setNewName('')
      setNewLocation('')
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
      })
    },
    onSuccess: () => {
      invalidate()
      setEditRow(null)
      toast.success(t('warehouses.toastUpdated'))
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
    if (!newId.trim() || !newName.trim()) {
      toast.error(t('warehouses.validationIdName'))
      return
    }
    createMut.mutate()
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
                <th className="px-4 py-3 font-medium">{t('warehouses.colId')}</th>
                <th className="px-4 py-3 font-medium">{t('common.name')}</th>
                <th className="px-4 py-3 font-medium">
                  {t('warehouses.colLocation')}
                </th>
                <th className="px-4 py-3 font-medium w-28">
                  {t('warehouses.colDefault')}
                </th>
                <th className="px-4 py-3 font-medium w-20">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono tabular-nums">{w.id}</td>
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
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditRow(w)}
                      aria-label={t('common.edit')}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
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
              <div>
                <Label>{t('warehouses.colId')} *</Label>
                <Input
                  className="mt-1 font-mono"
                  inputMode="numeric"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="2"
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
              <div>
                <Label>{t('warehouses.colLocation')}</Label>
                <Input
                  className="mt-1"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                />
              </div>
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
            <p className="text-sm text-muted-foreground font-mono">
              ID: {editRow?.id}
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
    </div>
  )
}
