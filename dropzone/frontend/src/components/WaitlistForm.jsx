import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, CheckCircle, AlertCircle, Loader } from 'lucide-react'

export default function WaitlistForm({ productId, onSuccess }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null) // null, 'success', 'error'
  const [message, setMessage] = useState('')

  const handleJoinWaitlist = async () => {
    if (!email) {
      setStatus('error')
      setMessage('Please enter a valid email')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, email }),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage(`You're #${data.position} on the waitlist!`)
        setEmail('')
        if (onSuccess) onSuccess(data)
      } else {
        setStatus('error')
        setMessage(data.message || 'Failed to join waitlist')
      }
    } catch (err) {
      setStatus('error')
      setMessage('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl"
    >
      <h4 className="text-lg font-bold text-white mb-2">Get Notified</h4>
      <p className="text-sm text-gray-400 mb-4">
        Join the waitlist and we'll notify you when this item is back in stock.
      </p>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Mail size={16} className="absolute left-3 top-3.5 text-gray-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setStatus(null)
            }}
            placeholder="your@email.com"
            disabled={loading || status === 'success'}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
        <motion.button
          onClick={handleJoinWaitlist}
          disabled={loading || status === 'success'}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <Loader size={16} className="animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle size={16} />
          ) : (
            'Join'
          )}
        </motion.button>
      </div>

      {status && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-3 text-xs font-semibold flex items-center gap-2 ${
            status === 'success' ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {status === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {message}
        </motion.div>
      )}
    </motion.div>
  )
}
