import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createProduct,
  updateProduct,
  getProductPriceHistory,
} from '@/services/productService'
import { roundMoney } from '@/services/peopleService'
import type { ProductWithRelations } from '@/types'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const productSchema = z
  .object({
    product_code: z.string().max(64, 'products.validationProductCodeMax'),
    name: z.string().min(2, 'products.validationNameMin'),
    brand_id: z.string().nullable(),
    category_id: z.string().nullable(),
    customer_price: z.number().min(0, 'products.validationMinZero'),
    business_price: z.number().min(0, 'products.validationMinZero'),
    cost_price: z.number().min(0, 'products.validationMinZero').optional(),
    low_stock_threshold: z.number().int().min(0, 'products.validationMinZero'),
    unit: z.string().min(1, 'products.validationRequired'),
    description: z.string().nullable(),
  })
  .superRefine((data, ctx) => {
    const c = data.product_code.trim()
    if (c && !/^[\p{L}\p{N}._-]+$/u.test(c)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'products.validationProductCodeFormat',
        path: ['product_code'],
      })
    }
  })

export type ProductFormValues = z.infer<typeof productSchema>

export const defaultProductValues: ProductFormValues = {
  product_code: '',
  name: '',
  brand_id: null,
  category_id: null,
  customer_price: 0,
  business_price: 0,
  cost_price: 0,
  low_stock_threshold: 5,
  unit: 'piece',
  description: null,
}

function formatDelta(
  current: number,
  older: number | undefined,
  fc: (n: number) => string
): { text: string; className: string } {
  if (older === undefined) {
    return { text: '—', className: 'text-muted-foreground' }
  }
  const d = roundMoney(current - older)
  if (d === 0) {
    return { text: '0', className: 'text-muted-foreground' }
  }
  const sign = d > 0 ? '+' : ''
  return {
    text: `${sign}${fc(d)}`,
    className: d > 0 ? 'text-green-600' : 'text-red-600',
  }
}

export function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  brands,
  mode,
  initialProduct,
  onSuccess,
  onError,
  showPriceHistoryInEdit = false,
  priceHistoryLimit = 8,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: { id: string; name: string }[]
  brands: { id: string; name: string }[]
  mode: 'add' | 'edit'
  initialProduct?: ProductWithRelations
  onSuccess: () => void
  onError: () => void
  showPriceHistoryInEdit?: boolean
  priceHistoryLimit?: number
}) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'
  const fc = (n: number) => formatCurrency(n, lang)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultProductValues,
  })

  const historyEnabled =
    showPriceHistoryInEdit &&
    open &&
    mode === 'edit' &&
    !!initialProduct?.id

  const { data: priceHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['productPriceHistory', initialProduct?.id],
    queryFn: () => getProductPriceHistory(initialProduct!.id),
    enabled: historyEnabled,
  })

  const compactHistory = priceHistory.slice(0, priceHistoryLimit)

  useEffect(() => {
    if (open && initialProduct) {
      form.reset({
        product_code: initialProduct.product_code,
        name: initialProduct.name,
        brand_id: initialProduct.brand?.id ?? null,
        category_id: initialProduct.category?.id ?? null,
        customer_price: initialProduct.customer_price,
        business_price: initialProduct.business_price,
        cost_price: initialProduct.cost_price ?? 0,
        low_stock_threshold: initialProduct.low_stock_threshold,
        unit: initialProduct.unit,
        description: initialProduct.description ?? null,
      })
    } else if (open && mode === 'add') {
      form.reset(defaultProductValues)
    }
  }, [open, initialProduct, mode, form])

  const onSubmit = async (values: ProductFormValues) => {
    const trimmedCode = values.product_code.trim()
    if (mode === 'edit' && !trimmedCode) {
      toast.error(t('products.validationProductCodeRequired'))
      return
    }
    try {
      const base = {
        name: values.name.trim(),
        brand_id: values.brand_id || null,
        category_id: values.category_id || null,
        customer_price: values.customer_price,
        business_price: values.business_price,
        cost_price: values.cost_price ?? 0,
        quantity: mode === 'add' ? 0 : initialProduct!.quantity,
        low_stock_threshold: values.low_stock_threshold,
        unit: values.unit,
        description: values.description || null,
      }
      if (mode === 'add') {
        await createProduct({
          ...base,
          product_code: trimmedCode || undefined,
        })
      } else if (initialProduct) {
        await updateProduct(initialProduct.id, {
          ...base,
          product_code: trimmedCode,
        })
      }
      onSuccess()
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : e &&
              typeof e === 'object' &&
              'message' in e &&
              typeof (e as { message: unknown }).message === 'string'
            ? (e as { message: string }).message
            : ''
      if (msg === 'PRODUCT_CODE_TAKEN') {
        toast.error(t('products.validationDuplicateCode'))
      } else if (msg === 'PRODUCT_NAME_TAKEN') {
        toast.error(t('products.validationDuplicateName'))
      } else if (msg) {
        toast.error(msg)
      } else {
        onError()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add'
              ? t('products.addProductTitle')
              : t('products.editProductTitle')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>{t('products.productId')}</Label>
            <Input
              {...form.register('product_code')}
              className="mt-1 font-mono"
              autoComplete="off"
            />
            {mode === 'add' && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('products.productIdHint')}
              </p>
            )}
            {form.formState.errors.product_code && (
              <p className="text-sm text-destructive mt-1">
                {t(form.formState.errors.product_code.message!)}
              </p>
            )}
          </div>
          <div>
            <Label>{t('common.name')}</Label>
            <Input {...form.register('name')} className="mt-1" />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">
                {t(form.formState.errors.name.message!)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('brands.title')}</Label>
              <Select
                value={form.watch('brand_id') ?? 'none'}
                onValueChange={(v) =>
                  form.setValue('brand_id', v === 'none' ? null : v)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('categories.title')}</Label>
              <Select
                value={form.watch('category_id') ?? 'none'}
                onValueChange={(v) =>
                  form.setValue('category_id', v === 'none' ? null : v)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>{t('products.customerPrice')}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                className="mt-1"
                {...form.register('customer_price', { valueAsNumber: true })}
              />
              {form.formState.errors.customer_price && (
                <p className="text-sm text-destructive mt-1">
                  {t(form.formState.errors.customer_price.message!)}
                </p>
              )}
            </div>
            <div>
              <Label>{t('products.businessPrice')}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                className="mt-1"
                {...form.register('business_price', { valueAsNumber: true })}
              />
              {form.formState.errors.business_price && (
                <p className="text-sm text-destructive mt-1">
                  {t(form.formState.errors.business_price.message!)}
                </p>
              )}
            </div>
            <div>
              <Label>{t('products.costPrice')}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                className="mt-1"
                {...form.register('cost_price', { valueAsNumber: true })}
              />
              {form.formState.errors.cost_price && (
                <p className="text-sm text-destructive mt-1">
                  {t(form.formState.errors.cost_price.message!)}
                </p>
              )}
            </div>
          </div>

          {historyEnabled && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {t('products.priceHistoryDialogSection')}
              </p>
              {historyLoading ? (
                <p className="text-xs text-muted-foreground">
                  {t('common.loading')}
                </p>
              ) : compactHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('products.priceHistoryEmpty')}
                </p>
              ) : (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground text-start">
                        <th className="py-1 pe-2 font-medium">
                          {t('products.priceHistoryColDate')}
                        </th>
                        <th className="py-1 pe-1 font-medium tabular-nums">
                          {t('products.priceHistoryColCustomerShort')}
                        </th>
                        <th className="py-1 pe-1 font-medium tabular-nums">
                          {t('products.priceHistoryColBusinessShort')}
                        </th>
                        <th className="py-1 font-medium tabular-nums">
                          {t('products.priceHistoryColCostShort')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {compactHistory.map((row, i) => {
                        const older = compactHistory[i + 1]
                        const dc = formatDelta(
                          row.customer_price,
                          older?.customer_price,
                          fc
                        )
                        const db = formatDelta(
                          row.business_price,
                          older?.business_price,
                          fc
                        )
                        const dco = formatDelta(row.cost_price, older?.cost_price, fc)
                        return (
                          <tr key={row.id} className="border-b border-border/50">
                            <td className="py-1.5 pe-2 whitespace-nowrap tabular-nums">
                              {new Intl.DateTimeFormat(
                                lang === 'ar' ? 'ar-EG' : 'en-US',
                                {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                }
                              ).format(new Date(row.recorded_at))}
                            </td>
                            <td className="py-1.5 pe-1 tabular-nums">
                              <div>{fc(row.customer_price)}</div>
                              <div className={cn('text-[10px]', dc.className)}>
                                {dc.text}
                              </div>
                            </td>
                            <td className="py-1.5 pe-1 tabular-nums">
                              <div>{fc(row.business_price)}</div>
                              <div className={cn('text-[10px]', db.className)}>
                                {db.text}
                              </div>
                            </td>
                            <td className="py-1.5 tabular-nums">
                              <div>{fc(row.cost_price)}</div>
                              <div className={cn('text-[10px]', dco.className)}>
                                {dco.text}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div>
            <Label>{t('products.lowStockThreshold')}</Label>
            <Input
              type="number"
              min={0}
              className="mt-1"
              {...form.register('low_stock_threshold', {
                valueAsNumber: true,
              })}
            />
            {form.formState.errors.low_stock_threshold && (
              <p className="text-sm text-destructive mt-1">
                {t(form.formState.errors.low_stock_threshold.message!)}
              </p>
            )}
          </div>
          <div>
            <Label>{t('products.unit')}</Label>
            <Input {...form.register('unit')} className="mt-1" />
            {form.formState.errors.unit && (
              <p className="text-sm text-destructive mt-1">
                {t(form.formState.errors.unit.message!)}
              </p>
            )}
          </div>
          <div>
            <Label>{t('common.description')}</Label>
            <Textarea
              {...form.register('description')}
              className="mt-1 min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
