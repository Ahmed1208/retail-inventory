import { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { Products } from '@/pages/Products'
import { StockMovements } from '@/pages/StockMovements'
import { Orders } from '@/pages/Orders'
import { OrdersHome } from '@/pages/OrdersHome'
import { NewOrder } from '@/pages/NewOrder'
import { OrderDetail } from '@/pages/OrderDetail'
import { People } from '@/pages/People'
import { Categories } from '@/pages/Categories'
import { Brands } from '@/pages/Brands'
import { PurchaseOrders } from '@/pages/PurchaseOrders'
import { InventoryHub } from '@/pages/InventoryHub'
import { NotFound } from '@/pages/NotFound'

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="flex items-center justify-center p-8">Loading...</div>}>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<InventoryHub />} />
            <Route path="/products" element={<Products />} />
            <Route path="/movements" element={<StockMovements />} />
            <Route path="/orders/list" element={<Orders />} />
            <Route path="/orders/new" element={<NewOrder />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/orders" element={<OrdersHome />} />
            <Route path="/people" element={<People />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/brands" element={<Brands />} />
            <Route
              path="/reports"
              element={<Navigate to="/?tab=reports" replace />}
            />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
