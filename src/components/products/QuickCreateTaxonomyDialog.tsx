import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { createBrand } from '@/services/brandService'
import { createCategory } from '@/services/categoryService'
import type { Brand, Category } from '@/types'
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

export type QuickCreateKind = 'brand' | 'category'

type Props = {
  kind: QuickCreateKind
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (entity: Brand | Category, kind: QuickCreateKind) => void
}

export function QuickCreateTaxonomyDialog({
  kind,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setError('')
    }
  }, [open, kind])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError(
        t(
          kind === 'brand'
            ? 'brands.validationNameMin'
            : 'categories.validationNameMin'
        )
      )
      return
    }
    try {
      const entity =
        kind === 'brand'
          ? await createBrand(trimmed)
          : await createCategory(trimmed)
      toast.success(
        t(kind === 'brand' ? 'brands.toastCreated' : 'categories.toastCreated')
      )
      onCreated(entity, kind)
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('already exists')) {
        setError(
          t(
            kind === 'brand'
              ? 'brands.validationNameExists'
              : 'categories.validationNameExists'
          )
        )
      } else {
        toast.error(
          t(kind === 'brand' ? 'brands.toastError' : 'categories.toastError')
        )
      }
    }
  }

  const title =
    kind === 'brand' ? t('brands.addBrand') : t('categories.addCategory')
  const nameLabel =
    kind === 'brand' ? t('brands.brandName') : t('categories.categoryName')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="quick-taxonomy-name">{nameLabel}</Label>
            <Input
              id="quick-taxonomy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              autoComplete="off"
              autoFocus
            />
            {error && (
              <p className="mt-1 text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
