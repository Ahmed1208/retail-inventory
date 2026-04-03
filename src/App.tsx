import { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppLayout } from '@/components/layout/AppLayout'
import { FeatureControlProvider } from '@/context/FeatureControlContext'
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
import { PurchaseOrdersHome } from '@/pages/PurchaseOrdersHome'
import { PurchaseOrdersList } from '@/pages/PurchaseOrdersList'
import { NewPurchaseOrder } from '@/pages/NewPurchaseOrder'
import { PurchaseOrderDetail } from '@/pages/PurchaseOrderDetail'
import { InventoryHub } from '@/pages/InventoryHub'
import { Control } from '@/pages/Control'
import { AdminHub } from '@/pages/AdminHub'
import { Documentation } from '@/pages/Documentation'
import { PaymentsHub } from '@/pages/PaymentsHub'
import { PaymentsList } from '@/pages/PaymentsList'
import { PaymentOperationDetail } from '@/pages/PaymentOperationDetail'
import { NewPayment } from '@/pages/NewPayment'
import { Register } from '@/pages/Register'
import { NotFound } from '@/pages/NotFound'

function App() {
  return (
    <ErrorBoundary>
      <FeatureControlProvider>
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
            <Route path="/payments/list" element={<PaymentsList />} />
            <Route
              path="/payments/operations/:id"
              element={<PaymentOperationDetail />}
            />
            <Route path="/payments/new" element={<NewPayment />} />
            <Route path="/payments" element={<PaymentsHub />} />
            <Route path="/register" element={<Register />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/brands" element={<Brands />} />
            <Route
              path="/reports"
              element={<Navigate to="/?tab=reports" replace />}
            />
            <Route path="/control" element={<Control />} />
            <Route path="/admin" element={<AdminHub />} />
            <Route path="/documentation" element={<Documentation />} />
            <Route path="/purchase-orders/list" element={<PurchaseOrdersList />} />
            <Route path="/purchase-orders/new" element={<NewPurchaseOrder />} />
            <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersHome />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </Suspense>
      </FeatureControlProvider>
    </ErrorBoundary>
  )
}

export default App
