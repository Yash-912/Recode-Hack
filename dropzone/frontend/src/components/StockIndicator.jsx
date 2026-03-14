import { motion } from 'framer-motion'

export default function StockIndicator({ remaining, total }) {
  const percentage = Math.max(0, (remaining / total) * 100)
  const urgency = remaining === 0 ? 'critical' : remaining < 5 ? 'urgent' : remaining < total * 0.2 ? 'low' : 'normal'
  const color = {
    critical: 'from-red-600 to-red-500',
    urgent: 'from-orange-600 to-orange-500',
    low: 'from-amber-600 to-amber-500',
    normal: 'from-green-600 to-green-500',
  }[urgency]

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-bold text-gray-300">Stock Available</span>
        <span className={`text-sm font-bold ${remaining === 0 ? 'text-red-400' : 'text-blue-400'}`}>
          {remaining} / {total}
        </span>
      </div>
      <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
        <motion.div
          className={`h-full bg-gradient-to-r ${color} shadow-lg shadow-${urgency === 'critical' ? 'red' : urgency === 'urgent' ? 'orange' : urgency === 'low' ? 'amber' : 'green'}-500/50`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {remaining === 0
          ? '❌ Sold Out'
          : remaining <= 5
          ? `⚠️ Only ${remaining} left - grab yours now!`
          : `✓ ${remaining} remaining`}
      </p>
    </div>
  )
}
