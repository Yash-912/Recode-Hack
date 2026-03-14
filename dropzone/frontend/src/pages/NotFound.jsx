import { motion } from 'framer-motion'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'
import Navbar from '../components/Navbar'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f0f8ff]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-20 pt-28 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {/* 404 Illustration */}
          <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 rounded-full mb-8">
            <FileQuestion size={48} className="text-blue-600" />
          </div>

          <h1 className="text-6xl md:text-7xl font-black text-gray-900 mb-2">404</h1>
          <p className="text-2xl font-bold text-gray-700 mb-4">Page Not Found</p>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            The page you're looking for doesn't exist. It might have been moved or deleted.
          </p>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300 transition flex items-center justify-center gap-2"
              aria-label="Go back to previous page"
            >
              <ArrowLeft size={18} /> Go Back
            </button>
            <a
              href="/"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
              aria-label="Return to home page"
            >
              <Home size={18} /> Home
            </a>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
