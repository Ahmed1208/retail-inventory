import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { Products } from '@/pages/Products'
import { StockMovements } from '@/pages/StockMovements'
import { Orders } from '@/pages/Orders'
import { Categories } from '@/pages/Categories'
import { Brands } from '@/pages/Brands'
import { Reports } from '@/pages/Reports'
import { NotFound } from '@/pages/NotFound'

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="flex items-center justify-center p-8">Loading...</div>}>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/movements" element={<StockMovements />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
