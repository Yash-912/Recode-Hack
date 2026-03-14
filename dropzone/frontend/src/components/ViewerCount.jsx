import { useState, useEffect, useContext } from 'react'
import { motion } from 'framer-motion'
import { Eye } from 'lucide-react'
import { SocketContext } from '../contexts/SocketContext'

export default function ViewerCount({ productId }) {
  const [viewers, setViewers] = useState(0)
  const { socket } = useContext(SocketContext)

  useEffect(() => {
    if (!socket) return

    socket.on('viewer_count', (data) => {
      if (data.productId === productId) {
        setViewers(data.count)
      }
    })

    return () => socket.off('viewer_count')
  }, [socket, productId])

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-xs font-semibold text-blue-400"
    >
      <Eye size={13} className="animate-pulse" />
      <span>{viewers.toLocaleString()} watching</span>
    </motion.div>
  )
}
