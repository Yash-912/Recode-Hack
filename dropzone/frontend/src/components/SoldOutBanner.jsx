import { motion } from 'framer-motion'
import { AlertTriangle, Bell } from 'lucide-react'

export default function SoldOutBanner({ onWaitlistClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-6 p-6 bg-gradient-to-r from-red-600/20 to-red-500/20 border-2 border-red-500/50 rounded-xl text-center"
    >
      <div className="flex items-center justify-center gap-3 mb-3">
        <AlertTriangle size={24} className="text-red-400 animate-pulse" />
        <h3 className="text-xl font-bold text-red-300">Sold Out</h3>
      </div>

      <p className="text-gray-300 mb-4">
        This drop has sold out. Join the waitlist to be notified when stock becomes available.
      </p>

      <motion.button
        onClick={onWaitlistClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
      >
        <Bell size={18} />
        Join Waitlist
      </motion.button>
    </motion.div>
  )
}
