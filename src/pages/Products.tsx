import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Pencil,
  Trash2,
  ArrowLeftRight,
  AlertTriangle,
  Package,
} from 'lucide-react'

import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
} from '@/services/productService'
import { getAllCategories as getCategories } from '@/services/categoryService'
import { getAllBrands as getBrands } from '@/services/brandService'
import type { ProductWithRelations } from '@/types'
import type { StockMovementType } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BackToInventoryLink } from '@/components/inventory/BackToInventoryLink'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'

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
type ProductFormValues = z.infer<typeof productSchema>

const defaultProductValues: ProductFormValues = {
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

export function Products() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const lowStockOnly = searchParams.get('lowStock') === '1'
  const lang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ar'

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductWithRelations | null>(null)
  const [stockProduct, setStockProduct] = useState<ProductWithRelations | null>(null)
  const [deleteProductState, setDeleteProductState] =
    useState<ProductWithRelations | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    document.title = 'Products | StockPilot'
    return () => {
      document.title = 'StockPilot'
    }
  }, [])

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: getAllProducts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
  })

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = debouncedSearch.toLowerCase()
      const matchSearch =
        !debouncedSearch ||
        p.name.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q)
      const matchCategory = !categoryId || p.category?.id === categoryId
      const matchBrand = !brandId || p.brand?.id === brandId
      const matchLowStock = !lowStockOnly || p.quantity <= p.low_stock_threshold
      return matchSearch && matchCategory && matchBrand && matchLowStock
    })
  }, [products, debouncedSearch, categoryId, brandId, lowStockOnly])

  const formatCurrencyDisplay = (n: number) => formatCurrency(n, lang)

  const columns = useMemo<ColumnDef<ProductWithRelations>[]>(
    () => [
      {
        accessorKey: 'product_code',
        header: t('products.productId'),
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorFn: (row) => row.brand?.name ?? '—',
        id: 'brand',
        header: t('brands.title'),
      },
      {
        accessorFn: (row) => row.category?.name ?? '—',
        id: 'category',
        header: t('categories.title'),
      },
      {
        accessorKey: 'customer_price',
        header: t('products.customerPrice'),
        cell: ({ getValue }) => formatCurrencyDisplay(getValue() as number),
      },
      {
        accessorKey: 'business_price',
        header: t('products.businessPrice'),
        cell: ({ getValue }) => formatCurrencyDisplay(getValue() as number),
      },
      {
        accessorKey: 'cost_price',
        header: t('products.costPrice'),
        cell: ({ getValue }) => formatCurrencyDisplay(getValue() as number),
      },
      {
        accessorKey: 'quantity',
        header: t('common.quantity'),
        cell: ({ row }) => {
          const qty = row.original.quantity
          const threshold = row.original.low_stock_threshold
          const isLow = qty <= threshold
          return (
            <span
              title={t('products.quantityManagedByPurchaseOrders')}
              className={cn(
                'inline-flex items-center gap-1 cursor-help',
                isLow ? 'text-red-600 font-medium' : 'text-green-600'
              )}
            >
              {isLow && <AlertTriangle className="h-4 w-4" />}
              {qty}
            </span>
          )
        },
      },
      {
        accessorKey: 'unit',
        header: t('products.unit'),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditProduct(p)}
                aria-label={t('common.edit')}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStockProduct(p)}
                aria-label={t('products.stockAdjust')}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteProductState(p)}
                aria-label={t('common.delete')}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        },
      },
    ],
    [t]
  )

  const table = useReactTable({
    data: filteredProducts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    queryClient.invalidateQueries({ queryKey: ['recentMovements'] })
  }

  return (
    <div className="space-y-4">
      <BackToInventoryLink />
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('products.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={categoryId ?? 'all'}
          onValueChange={(v) => setCategoryId(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('products.filterByCategory')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('products.allCategories')}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={brandId ?? 'all'}
          onValueChange={(v) => setBrandId(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('products.filterByBrand')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('products.allBrands')}</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setAddOpen(true)}>
          {t('products.addProduct')}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {productsLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={8} columns={9} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('products.emptyProducts')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-border bg-muted/50">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-start font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: ' ↑',
                          desc: ' ↓',
                        }[header.column.getIsSorted() as string] ?? null}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProductFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        categories={categories}
        brands={brands}
        t={t}
        mode="add"
        onSuccess={() => {
          invalidateProducts()
          toast.success(t('products.toastCreated'))
          setAddOpen(false)
        }}
        onError={() => toast.error(t('products.toastError'))}
      />

      {editProduct && (
        <ProductFormDialog
          open={!!editProduct}
          onOpenChange={(open) => !open && setEditProduct(null)}
          categories={categories}
          brands={brands}
          t={t}
          mode="edit"
          initialProduct={editProduct}
          onSuccess={() => {
            invalidateProducts()
            toast.success(t('products.toastUpdated'))
            setEditProduct(null)
          }}
          onError={() => toast.error(t('products.toastError'))}
        />
      )}

      {stockProduct && (
        <StockAdjustDialog
          open={!!stockProduct}
          onOpenChange={(open) => !open && setStockProduct(null)}
          product={stockProduct}
          t={t}
          onSuccess={() => {
            invalidateProducts()
            toast.success(t('products.toastStockAdjusted'))
            setStockProduct(null)
          }}
          onError={() => toast.error(t('products.toastError'))}
        />
      )}

      {deleteProductState && (
        <AlertDialog
          open={!!deleteProductState}
          onOpenChange={(open) => !open && setDeleteProductState(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('products.deleteConfirmTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('products.deleteConfirmMessage', {
                  name: deleteProductState.name,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await deleteProduct(deleteProductState.id)
                    invalidateProducts()
                    toast.success(t('products.toastDeleted'))
                    setDeleteProductState(null)
                  } catch {
                    toast.error(t('products.toastError'))
                  }
                }}
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

function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  brands,
  t,
  mode,
  initialProduct,
  onSuccess,
  onError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: { id: string; name: string }[]
  brands: { id: string; name: string }[]
  t: (key: string) => string
  mode: 'add' | 'edit'
  initialProduct?: ProductWithRelations
  onSuccess: () => void
  onError: () => void
}) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultProductValues,
  })

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

function StockAdjustDialog({
  open,
  onOpenChange,
  product,
  t,
  onSuccess,
  onError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductWithRelations
  t: (key: string) => string
  onSuccess: () => void
  onError: () => void
}) {
  const [type, setType] = useState<StockMovementType>('in')
  const [quantity, setQuantity] = useState<number>(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (type === 'out' && quantity > product.quantity) {
      setError(
        (t as (key: string, opts?: Record<string, number>) => string)(
          'products.validationStockOutExceeds',
          { current: product.quantity }
        )
      )
      return
    }
    if ((type === 'in' || type === 'out') && quantity < 1) {
      setError(t('products.validationMinOne'))
      return
    }
    if (type === 'adjustment' && quantity < 0) {
      setError(t('products.validationMinZero'))
      return
    }
    try {
      await adjustStock(product.id, type, quantity, note || undefined)
      onSuccess()
    } catch {
      onError()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('products.stockAdjustTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {product.name} — {t('products.currentStock')}:{' '}
          <strong className="text-foreground">{product.quantity}</strong>{' '}
          {product.unit}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-2 block">{t('dashboard.type')}</Label>
            <div className="flex gap-4">
              {(['in', 'out', 'adjustment'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    checked={type === opt}
                    onChange={() => setType(opt)}
                    className="rounded-full"
                  />
                  <span>{t(`stockMovements.${opt}`)}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>{t('common.quantity')}</Label>
            <Input
              type="number"
              min={type === 'adjustment' ? 0 : 1}
              value={quantity === 0 ? '' : quantity}
              onChange={(e) =>
                setQuantity(e.target.value === '' ? 0 : Number(e.target.value))
              }
              className="mt-1"
            />
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>
          <div>
            <Label>{t('products.noteOptional')}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 min-h-[60px]"
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
