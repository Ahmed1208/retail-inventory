import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
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
import { toast } from 'sonner'
import {
  Pencil,
  Trash2,
  ArrowLeftRight,
  AlertTriangle,
  Package,
  FileUp,
  FileDown,
} from 'lucide-react'

import {
  getAllProducts,
  deleteProduct,
  getAllProductWarehouseStock,
} from '@/services/productService'
import { listWarehouses } from '@/services/warehouseService'
import { getAllCategories as getCategories } from '@/services/categoryService'
import { getAllBrands as getBrands } from '@/services/brandService'
import type { ProductWithRelations } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useMigrationImportDialog } from '@/hooks/useMigrationImportDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ProductFormDialog } from '@/components/products/ProductFormDialog'
import { ProductStockAdjustDialog } from '@/components/products/ProductStockAdjustDialog'
import { BackToInventoryLink } from '@/components/inventory/BackToInventoryLink'
import { WarehouseCombobox } from '@/components/warehouses/WarehouseCombobox'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/hooks/useLanguage'
import { useFeatureEnabled } from '@/context/FeatureControlContext'
import { ProductCsvImportDialog } from '@/components/products/ProductCsvImportDialog'
import { downloadCsv } from '@/utils/csvDownload'

function sanitizeCsvWarehouseCode(code: string): string {
  const s = String(code)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s || 'warehouse'
}

export function Products() {
  const { t, i18n } = useTranslation()
  const { isRTL } = useLanguage()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
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
  const [productCsvOpen, setProductCsvOpen] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const defaultWarehouseInitRef = useRef(false)
  const [defaultStockWarehouseId, setDefaultStockWarehouseId] = useState(1)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'all' | 'one'>('all')
  const [exportWarehouseId, setExportWarehouseId] = useState(1)

  const canAddProduct = useFeatureEnabled('products.addProduct')
  const canEditProduct = useFeatureEnabled('products.editProduct')
  const canDeleteProduct = useFeatureEnabled('products.deleteProduct')
  const canStockAdjust = useFeatureEnabled('products.stockAdjust')

  useMigrationImportDialog(setProductCsvOpen, true, canAddProduct)

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

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: listWarehouses,
  })

  const { data: pwsRows = [] } = useQuery({
    queryKey: ['allWarehouseStock'],
    queryFn: getAllProductWarehouseStock,
  })

  const sortedWarehouses = useMemo(
    () => [...warehouses].sort((a, b) => a.name.localeCompare(b.name)),
    [warehouses]
  )

  const stockByProduct = useMemo(() => {
    const m = new Map<string, Map<number, number>>()
    for (const r of pwsRows) {
      let inner = m.get(r.product_id)
      if (!inner) {
        inner = new Map()
        m.set(r.product_id, inner)
      }
      inner.set(r.warehouse_id, r.quantity)
    }
    return m
  }, [pwsRows])

  useEffect(() => {
    if (defaultWarehouseInitRef.current || warehouses.length === 0) return
    const d = warehouses.find((w) => w.is_default)
    const id = d?.id ?? warehouses[0]?.id ?? 1
    setDefaultStockWarehouseId(id)
    defaultWarehouseInitRef.current = true
  }, [warehouses])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = debouncedSearch.toLowerCase()
      const matchSearch =
        !debouncedSearch ||
        p.name.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q)
      const matchCategory = !categoryId || p.category?.id === categoryId
      const matchBrand = !brandId || p.brand?.id === brandId
      const matchLowStock =
        !lowStockOnly ||
        sortedWarehouses.some((w) => {
          const whQty = stockByProduct.get(p.id)?.get(w.id) ?? 0
          return whQty <= p.low_stock_threshold
        })
      return matchSearch && matchCategory && matchBrand && matchLowStock
    })
  }, [
    products,
    debouncedSearch,
    categoryId,
    brandId,
    lowStockOnly,
    sortedWarehouses,
    stockByProduct,
  ])

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
        accessorKey: 'cost_price',
        header: t('products.costPrice'),
        cell: ({ getValue }) => formatCurrencyDisplay(getValue() as number),
      },
      {
        accessorKey: 'business_price',
        header: t('products.businessPrice'),
        cell: ({ getValue }) => formatCurrencyDisplay(getValue() as number),
      },
      {
        accessorKey: 'customer_price',
        header: t('products.customerPrice'),
        cell: ({ getValue }) => formatCurrencyDisplay(getValue() as number),
      },
      ...sortedWarehouses.map(
        (w) =>
          ({
            id: `wh_${w.id}`,
            accessorFn: (row: ProductWithRelations) =>
              stockByProduct.get(row.id)?.get(w.id) ?? 0,
            header: t('products.qtyAtWarehouseCode', { code: w.code }),
            cell: ({
              row,
            }: {
              row: { original: ProductWithRelations }
            }) => {
              const p = row.original
              const qty = stockByProduct.get(p.id)?.get(w.id) ?? 0
              const threshold = p.low_stock_threshold
              const isLow = qty <= threshold
              return (
                <span
                  title={t('products.quantityManagedByPurchaseOrders')}
                  className={cn(
                    'inline-flex items-center gap-1 cursor-help tabular-nums',
                    isLow ? 'text-red-600 font-medium' : 'text-green-600'
                  )}
                >
                  {isLow && <AlertTriangle className="h-4 w-4 shrink-0" />}
                  {qty}
                </span>
              )
            },
          }) satisfies ColumnDef<ProductWithRelations>
      ),
      {
        id: 'quantityTotal',
        accessorKey: 'quantity',
        header: t('products.totalAcrossLocations'),
        cell: ({ row }) => {
          const p = row.original
          const qty = p.quantity
          const isLow = qty <= p.low_stock_threshold
          return (
            <span
              title={t('products.quantityManagedByPurchaseOrders')}
              className={cn(
                'inline-flex items-center gap-1 cursor-help font-medium tabular-nums',
                isLow ? 'text-red-600' : 'text-green-600'
              )}
            >
              {isLow && <AlertTriangle className="h-4 w-4 shrink-0" />}
              {qty}
            </span>
          )
        },
      },
      {
        accessorKey: 'unit',
        header: t('products.unit'),
      },
      ...(canEditProduct || canStockAdjust || canDeleteProduct
        ? [
            {
              id: 'actions',
              header: t('common.actions'),
              cell: ({ row }: { row: { original: ProductWithRelations } }) => {
                const p = row.original
                return (
                  <div className="flex items-center gap-1">
                    {canEditProduct && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditProduct(p)}
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canStockAdjust && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setStockProduct(p)}
                        aria-label={t('products.stockAdjust')}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                    )}
                    {canDeleteProduct && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteProductState(p)}
                        aria-label={t('common.delete')}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )
              },
            } satisfies ColumnDef<ProductWithRelations>,
          ]
        : []),
    ],
    [
      t,
      formatCurrencyDisplay,
      canEditProduct,
      canStockAdjust,
      canDeleteProduct,
      sortedWarehouses,
      stockByProduct,
    ]
  )

  const table = useReactTable({
    data: filteredProducts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const runExportDownload = () => {
    if (
      exportScope === 'one' &&
      !warehouses.some((w) => w.id === exportWarehouseId)
    ) {
      return
    }

    const baseCols = (p: ProductWithRelations) => ({
      product_code: p.product_code,
      name: p.name,
      brand_name: p.brand?.name ?? '',
      category_name: p.category?.name ?? '',
      customer_price: p.customer_price,
      business_price: p.business_price,
      cost_price: p.cost_price,
      low_stock_threshold: p.low_stock_threshold,
      unit: p.unit,
      description: p.description ?? '',
    })

    let rows: Record<string, unknown>[]
    let filenameSuffix: string

    if (exportScope === 'all') {
      rows = products.map((p) => {
        const row: Record<string, unknown> = {
          ...baseCols(p),
          quantity_total: p.quantity,
        }
        for (const w of sortedWarehouses) {
          row[`quantity_${sanitizeCsvWarehouseCode(w.code)}`] =
            stockByProduct.get(p.id)?.get(w.id) ?? 0
        }
        return row
      })
      filenameSuffix = 'all-wh'
    } else {
      const wh = warehouses.find((w) => w.id === exportWarehouseId)
      rows = products.map((p) => ({
        ...baseCols(p),
        warehouse_code: wh?.code ?? String(exportWarehouseId),
        quantity_at_warehouse:
          stockByProduct.get(p.id)?.get(exportWarehouseId) ?? 0,
        quantity_total: p.quantity,
      }))
      filenameSuffix = `wh-${exportWarehouseId}`
    }

    downloadCsv(
      `products-export-${filenameSuffix}-${new Date().toISOString().slice(0, 10)}.csv`,
      rows
    )
    setExportDialogOpen(false)
  }

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] })
    queryClient.invalidateQueries({ queryKey: ['warehouseStock'] })
    queryClient.invalidateQueries({ queryKey: ['allWarehouseStock'] })
    queryClient.invalidateQueries({ queryKey: ['productWhStock'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    queryClient.invalidateQueries({ queryKey: ['recentMovements'] })
    queryClient.invalidateQueries({ queryKey: ['productPriceHistory'] })
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['brands'] })
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
        <WarehouseCombobox
          id="products-stock-default-warehouse"
          label={t('products.defaultWarehouseForAdjustments')}
          warehouses={warehouses}
          value={defaultStockWarehouseId}
          onChange={setDefaultStockWarehouseId}
          className="min-w-[220px] max-w-xs"
        />
        {products.length > 0 && (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            title={t('products.exportCsvHint')}
            onClick={() => {
              setExportScope('all')
              setExportWarehouseId(defaultStockWarehouseId)
              setExportDialogOpen(true)
            }}
          >
            <FileDown className="h-4 w-4 shrink-0" aria-hidden />
            {t('common.exportCsv')}
          </Button>
        )}
        {canAddProduct && (
          <>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setProductCsvOpen(true)}
            >
              <FileUp className="h-4 w-4 shrink-0" aria-hidden />
              {t('products.importCsv.button')}
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              {t('products.addProduct')}
            </Button>
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {productsLoading ? (
          <div className="p-4">
            <LoadingSkeleton
              rows={8}
              columns={Math.min(
                16,
                8 +
                  sortedWarehouses.length +
                  (canEditProduct || canStockAdjust || canDeleteProduct ? 1 : 0)
              )}
            />
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
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/products/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3"
                        onClick={
                          cell.column.id === 'actions'
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
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
        mode="add"
        onSuccess={() => {
          invalidateProducts()
          toast.success(t('products.toastCreated'))
          setAddOpen(false)
        }}
        onError={() => toast.error(t('products.toastError'))}
      />

      <ProductCsvImportDialog
        open={productCsvOpen}
        onOpenChange={setProductCsvOpen}
        existingProducts={products.map((p) => ({
          product_code: p.product_code,
          name: p.name,
        }))}
        initialBrands={brands}
        initialCategories={categories}
        warehouses={warehouses}
        isRTL={isRTL}
        onComplete={() => {
          invalidateProducts()
        }}
      />

      {editProduct && (
        <ProductFormDialog
          open={!!editProduct}
          onOpenChange={(open) => !open && setEditProduct(null)}
          categories={categories}
          brands={brands}
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
        <ProductStockAdjustDialog
          open={!!stockProduct}
          onOpenChange={(open) => !open && setStockProduct(null)}
          product={stockProduct}
          warehouses={warehouses}
          initialWarehouseId={defaultStockWarehouseId}
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

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('products.exportCsvDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('products.exportCsvDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('products.exportCsvDialog.scopeLabel')}</Label>
              <Select
                value={exportScope}
                onValueChange={(v) => setExportScope(v as 'all' | 'one')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('products.exportCsvDialog.scopeAll')}
                  </SelectItem>
                  <SelectItem value="one">
                    {t('products.exportCsvDialog.scopeOne')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {exportScope === 'one' && warehouses.length > 0 && (
              <div className="space-y-2">
                <Label>{t('products.exportCsvDialog.selectWarehouse')}</Label>
                <Select
                  value={String(exportWarehouseId)}
                  onValueChange={(v) => setExportWarehouseId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name} ({w.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => runExportDownload()}
              disabled={
                exportScope === 'one' &&
                !warehouses.some((w) => w.id === exportWarehouseId)
              }
            >
              {t('products.exportCsvDialog.export')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
