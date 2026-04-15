import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Trash2, Tag } from 'lucide-react'

import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/categoryService'
import { getAllProducts } from '@/services/productService'
import type { Category } from '@/types'
import { BackToInventoryLink } from '@/components/inventory/BackToInventoryLink'
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
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function Categories() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as string

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteCategoryState, setDeleteCategoryState] =
    useState<Category | null>(null)

  const canAddCategory = useFeatureEnabled('categories.addCategory')
  const canEditCategory = useFeatureEnabled('categories.editCategory')
  const canDeleteCategory = useFeatureEnabled('categories.deleteCategory')

  useEffect(() => {
    if (!canEditCategory) {
      setEditingId(null)
      setEditingName('')
    }
  }, [canEditCategory])

  useEffect(() => {
    document.title = 'Categories | StockPilot'
    return () => {
      document.title = 'StockPilot'
    }
  }, [])

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getAllCategories,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: getAllProducts,
  })

  const productCountByCategoryId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of products) {
      const id = p.category?.id ?? null
      if (id) map[id] = (map[id] ?? 0) + 1
    }
    return map
  }, [products])

  const filtered = useMemo(() => {
    if (!search.trim()) return categories
    const q = search.trim().toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, search])

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
    }).format(new Date(iso))

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    const name = newName.trim()
    if (name.length < 2) {
      setAddError(t('categories.validationNameMin'))
      return
    }
    try {
      await createCategory(name)
      invalidate()
      toast.success(t('categories.toastCreated'))
      setNewName('')
      setAddOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('already exists')) {
        setAddError(t('categories.validationNameExists'))
      } else {
        toast.error(t('categories.toastError'))
      }
    }
  }

  const handleEditSave = async (id: string) => {
    const name = editingName.trim()
    if (name.length < 2) {
      toast.error(t('categories.validationNameMin'))
      return
    }
    try {
      await updateCategory(id, name)
      invalidate()
      toast.success(t('categories.toastUpdated'))
      setEditingId(null)
      setEditingName('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('already exists')) {
        toast.error(t('categories.validationNameExists'))
      } else {
        toast.error(t('categories.toastError'))
      }
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteCategoryState) return
    try {
      await deleteCategory(deleteCategoryState.id)
      invalidate()
      toast.success(t('categories.toastDeleted'))
      setDeleteCategoryState(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('in use')) {
        toast.error(t('categories.toastInUse'))
      } else {
        toast.error(t('categories.toastError'))
      }
      setDeleteCategoryState(null)
    }
  }

  return (
    <div className="space-y-4">
      <BackToInventoryLink />
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('categories.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {canAddCategory && (
          <Button onClick={() => setAddOpen(true)}>
            {t('categories.addCategory')}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Tag className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {search.trim()
                ? t('common.noResults')
                : t('categories.emptyCategories')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('categories.categoryName')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('categories.productCount')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {t('categories.createdDate')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground w-24">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat) => (
                  <tr
                    key={cat.id}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      {editingId === cat.id && canEditCategory ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleEditSave(cat.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave(cat.id)
                            if (e.key === 'Escape') {
                              setEditingId(null)
                              setEditingName('')
                            }
                          }}
                          className="h-8 max-w-[200px]"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{cat.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {productCountByCategoryId[cat.id] ?? 0}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(cat.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === cat.id && canEditCategory ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSave(cat.id)}
                        >
                          {t('common.save')}
                        </Button>
                      ) : canEditCategory || canDeleteCategory ? (
                        <div className="flex items-center gap-1">
                          {canEditCategory && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingId(cat.id)
                                setEditingName(cat.name)
                              }}
                              aria-label={t('common.edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteCategory && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteCategoryState(cat)}
                              aria-label={t('common.delete')}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
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
            <DialogTitle>{t('categories.addCategory')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <Label>{t('categories.categoryName')}</Label>
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

      {deleteCategoryState && (
        <AlertDialog
          open={!!deleteCategoryState}
          onOpenChange={(open) => !open && setDeleteCategoryState(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('categories.deleteConfirmTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {(t as (key: string, opts?: Record<string, string>) => string)(
                  'categories.deleteConfirmMessage',
                  { name: deleteCategoryState.name }
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
