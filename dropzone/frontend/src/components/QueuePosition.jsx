import { useState, useEffect, useContext } from 'react'
import { motion } from 'framer-motion'
import { Clock, Users } from 'lucide-react'
import { SocketContext } from '../contexts/SocketContext'

export default function QueuePosition({ jobId, isActive }) {
  const [position, setPosition] = useState(null)
  const [estimatedWait, setEstimatedWait] = useState(null)
  const { socket } = useContext(SocketContext)

  useEffect(() => {
    if (!socket || !jobId || !isActive) return

    socket.on('queue_position', (data) => {
      if (data.jobId === jobId) {
        setPosition(data.position)
        setEstimatedWait(data.estimatedWait)
      }
    })

    return () => socket.off('queue_position')
  }, [socket, jobId, isActive])

  if (!isActive || position === null) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-amber-400" />
          <span className="font-bold text-white">Queue Position</span>
        </div>
        <span className="text-2xl font-black text-amber-400">#{position}</span>
      </div>

      {/* Progress visualization */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(5, Math.min(100 - position, 100))}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-300">
        <Clock size={14} />
        <span>
          {estimatedWait ? `Estimated wait: ~${Math.ceil(estimatedWait / 1000)}s` : 'Calculating...'}
        </span>
      </div>
    </motion.div>
  )
}
