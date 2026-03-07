import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Trash2, Layers } from 'lucide-react'

import {
  getAllBrands,
  createBrand,
  updateBrand,
  deleteBrand,
} from '@/services/brandService'
import { getAllProducts } from '@/services/productService'
import type { Brand } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

export function Brands() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as string

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteBrandState, setDeleteBrandState] = useState<Brand | null>(null)

  useEffect(() => {
    document.title = 'Brands | StockPilot'
    return () => {
      document.title = 'StockPilot'
    }
  }, [])

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: getAllBrands,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: getAllProducts,
  })

  const productCountByBrandId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of products) {
      const id = p.brand?.id ?? null
      if (id) map[id] = (map[id] ?? 0) + 1
    }
    return map
  }, [products])

  const filtered = useMemo(() => {
    if (!search.trim()) return brands
    const q = search.trim().toLowerCase()
    return brands.filter((b) => b.name.toLowerCase().includes(q))
  }, [brands, search])

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
    }).format(new Date(iso))

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['brands'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    const name = newName.trim()
    if (name.length < 2) {
      setAddError(t('brands.validationNameMin'))
      return
    }
    try {
      await createBrand(name)
      invalidate()
      toast.success(t('brands.toastCreated'))
      setNewName('')
      setAddOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('already exists')) {
        setAddError(t('brands.validationNameExists'))
      } else {
        toast.error(t('brands.toastError'))
      }
    }
  }

  const handleEditSave = async (id: string) => {
    const name = editingName.trim()
    if (name.length < 2) {
      toast.error(t('brands.validationNameMin'))
      return
    }
    try {
      await updateBrand(id, name)
      invalidate()
      toast.success(t('brands.toastUpdated'))
      setEditingId(null)
      setEditingName('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('already exists')) {
        toast.error(t('brands.validationNameExists'))
      } else {
        toast.error(t('brands.toastError'))
      }
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteBrandState) return
    try {
      await deleteBrand(deleteBrandState.id)
      invalidate()
      toast.success(t('brands.toastDeleted'))
      setDeleteBrandState(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('in use')) {
        toast.error(t('brands.toastInUse'))
      } else {
        toast.error(t('brands.toastError'))
      }
      setDeleteBrandState(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('brands.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={() => setAddOpen(true)}>{t('brands.addBrand')}</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {search.trim()
                ? t('common.noResults')
                : t('brands.emptyBrands')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('brands.brandName')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('brands.productCount')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('brands.createdDate')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground w-24">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((brand) => (
                  <tr
                    key={brand.id}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      {editingId === brand.id ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleEditSave(brand.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave(brand.id)
                            if (e.key === 'Escape') {
                              setEditingId(null)
                              setEditingName('')
                            }
                          }}
                          className="h-8 max-w-[200px]"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{brand.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {productCountByBrandId[brand.id] ?? 0}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(brand.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === brand.id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSave(brand.id)}
                        >
                          {t('common.save')}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingId(brand.id)
                              setEditingName(brand.name)
                            }}
                            aria-label={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteBrandState(brand)}
                            aria-label={t('common.delete')}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('brands.addBrand')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <Label>{t('brands.brandName')}</Label>
              <Input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setAddError('')
                }}
                className="mt-1"
                minLength={2}
                autoFocus
              />
              {addError && (
                <p className="text-sm text-destructive mt-1">{addError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {deleteBrandState && (
        <AlertDialog
          open={!!deleteBrandState}
          onOpenChange={(open) => !open && setDeleteBrandState(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('brands.deleteConfirmTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {(t as (key: string, opts?: Record<string, string>) => string)(
                  'brands.deleteConfirmMessage',
                  { name: deleteBrandState.name }
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
