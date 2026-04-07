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
} from 'lucide-react'

import {
  getAllProducts,
  deleteProduct,
  getProductQuantitiesByWarehouse,
} from '@/services/productService'
import { listWarehouses } from '@/services/warehouseService'
import { getAllCategories as getCategories } from '@/services/categoryService'
import { getAllBrands as getBrands } from '@/services/brandService'
import type { ProductWithRelations } from '@/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { ProductFormDialog } from '@/components/products/ProductFormDialog'
import { ProductStockAdjustDialog } from '@/components/products/ProductStockAdjustDialog'
import { BackToInventoryLink } from '@/components/inventory/BackToInventoryLink'
import { WarehouseCombobox } from '@/components/warehouses/WarehouseCombobox'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { useFeatureEnabled } from '@/context/FeatureControlContext'

export function Products() {
  const { t, i18n } = useTranslation()
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
  const [sorting, setSorting] = useState<SortingState>([])
  const warehouseInitRef = useRef(false)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(1)

  const canAddProduct = useFeatureEnabled('products.addProduct')
  const canEditProduct = useFeatureEnabled('products.editProduct')
  const canDeleteProduct = useFeatureEnabled('products.deleteProduct')
  const canStockAdjust = useFeatureEnabled('products.stockAdjust')

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

  const { data: whStockMap = new Map<string, number>() } = useQuery({
    queryKey: ['warehouseStock', selectedWarehouseId],
    queryFn: () => getProductQuantitiesByWarehouse(selectedWarehouseId),
  })

  useEffect(() => {
    if (warehouseInitRef.current || warehouses.length === 0) return
    const d = warehouses.find((w) => w.is_default)
    setSelectedWarehouseId(d?.id ?? 1)
    warehouseInitRef.current = true
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
      const whQty = whStockMap.get(p.id) ?? 0
      const matchLowStock =
        !lowStockOnly || whQty <= p.low_stock_threshold
      return matchSearch && matchCategory && matchBrand && matchLowStock
    })
  }, [
    products,
    debouncedSearch,
    categoryId,
    brandId,
    lowStockOnly,
    whStockMap,
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
      {
        id: 'quantityWh',
        accessorFn: (row) => whStockMap.get(row.id) ?? 0,
        header: t('warehouses.quantityAtWarehouse'),
        cell: ({ row }) => {
          const qty = whStockMap.get(row.original.id) ?? 0
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
      whStockMap,
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

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] })
    queryClient.invalidateQueries({ queryKey: ['warehouseStock'] })
    queryClient.invalidateQueries({ queryKey: ['productWhStock'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    queryClient.invalidateQueries({ queryKey: ['recentMovements'] })
    queryClient.invalidateQueries({ queryKey: ['productPriceHistory'] })
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
          id="products-list-warehouse"
          label={t('warehouses.title')}
          warehouses={warehouses}
          value={selectedWarehouseId}
          onChange={setSelectedWarehouseId}
          className="min-w-[220px] max-w-xs"
        />
        {canAddProduct && (
          <Button onClick={() => setAddOpen(true)}>
            {t('products.addProduct')}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {productsLoading ? (
          <div className="p-4">
            <LoadingSkeleton
              rows={8}
              columns={
                canEditProduct || canStockAdjust || canDeleteProduct ? 9 : 8
              }
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
          initialWarehouseId={selectedWarehouseId}
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
