import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'
import Landing from './pages/Landing'
import FlashSale from './pages/FlashSale'
import AdminDashboard from './pages/AdminDashboard'
import Admin from './pages/Admin'
import DemoComparison from './pages/DemoComparison'
import Architecture from './pages/Architecture'
import DropPage from './pages/DropPage'
import NotFound from './pages/NotFound'
import ErrorBoundary from './components/ErrorBoundary'

import { SocketProvider } from './contexts/SocketContext'

// Loading skeleton component
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#f0f8ff] flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"
      />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <SocketProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sale" element={<FlashSale />} />
            <Route path="/drops/:productId" element={<DropPage />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/control" element={<Admin />} />
            <Route path="/demo" element={<DemoComparison />} />
            <Route path="/architecture" element={<Architecture />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </SocketProvider>
    </ErrorBoundary>
  )
}

export default App
