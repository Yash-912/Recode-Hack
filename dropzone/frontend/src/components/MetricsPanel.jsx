import { motion } from 'framer-motion'
import { Activity, Users, CheckCircle, XCircle, Package } from 'lucide-react'

export default function MetricsPanel({ metrics, stock, isNaiveMode }) {
  const cards = [
    {
      title: 'Global QPS',
      value: metrics.qps.toLocaleString(),
      icon: <Activity size={20} />,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20'
    },
    {
      title: 'Confirmed Orders',
      value: metrics.successCount.toLocaleString(),
      icon: <CheckCircle size={20} />,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      borderColor: 'border-green-500/20'
    },
    {
      title: 'Clean Rejections',
      value: metrics.rejectCount.toLocaleString(),
      icon: <XCircle size={20} />,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      borderColor: 'border-red-500/20'
    },
    {
      title: 'Queue Depth',
      value: metrics.queueDepth.toLocaleString(),
      icon: <Users size={20} />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20'
    }
  ]

  const isOversold = stock < 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* 4 Standard Metrics */}
      <div className="col-span-2 lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`flex flex-col justify-between p-5 rounded-2xl border ${card.borderColor} bg-gray-900 shadow-xl relative overflow-hidden`}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 ${card.bg.replace('/10', '')}`} />
            
            <div className="flex items-center gap-3 mb-2 z-10">
              <div className={`p-2 rounded-xl ${card.bg} ${card.color}`}>
                {card.icon}
              </div>
              <h3 className="text-gray-400 text-sm font-medium">{card.title}</h3>
            </div>
            
            <div className="z-10 mt-2">
              <span className="text-3xl font-bold font-mono text-white tracking-tight">{card.value}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Hero Metric: Final Stock */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: 'spring' }}
        className={`col-span-2 lg:col-span-1 flex flex-col justify-center items-center p-6 rounded-2xl border-2 shadow-2xl relative overflow-hidden ${
          isOversold 
            ? 'bg-red-950/40 border-red-500 shadow-[0_0_50px_-12px_rgba(239,68,68,0.5)]' 
            : 'bg-gray-900 border-gray-700'
        }`}
      >
        {isOversold && (
          <div className="absolute inset-0 bg-red-500/10 blur-xl animate-pulse" />
        )}
        
        <div className="flex items-center gap-2 text-gray-400 text-sm font-bold uppercase tracking-widest mb-2 z-10">
          <Package size={16} />
          Current Stock
        </div>
        
        <div className="z-10 flex flex-col items-center">
          <span className={`text-6xl font-black font-mono tracking-tighter ${
            isOversold ? 'text-red-500' : 'text-white'
          }`}>
            {stock}
          </span>
          {isOversold && (
            <span className="mt-2 px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full uppercase tracking-widest">
              Oversold Detected
            </span>
          )}
        </div>
      </motion.div>
    </div>
  )
}
