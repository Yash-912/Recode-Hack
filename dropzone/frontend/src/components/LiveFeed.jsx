import { motion, AnimatePresence } from 'framer-motion'
import { Check, X } from 'lucide-react'

export default function LiveFeed({ events }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col h-full overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Live Activity Feed</h2>
          <p className="text-sm text-gray-400 mt-1">Real-time checkout stream</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm text-green-400 font-mono tracking-widest uppercase">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {events.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-500 text-sm text-center py-10 font-mono italic"
              >
                Waiting for drop to begin...
              </motion.div>
            ) : (
              events.map((evt) => (
                <motion.div
                  key={evt.id}
                  layout
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    evt.status === 'success' 
                      ? 'bg-green-500/10 border-green-500/20' 
                      : 'bg-red-500/10 border-red-500/20'
                  }`}
                >
                  <div className={`p-2 rounded-full ${evt.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {evt.status === 'success' ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      User <span className="font-mono text-gray-400">{evt.userId.substring(0, 8)}</span>
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {new Date(evt.timestamp).toISOString().split('T')[1].replace('Z', '')}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-mono font-bold ${evt.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {evt.latencyMs}ms
                    </span>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Latency</p>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
