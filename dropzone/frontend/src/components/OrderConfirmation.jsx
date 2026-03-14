import { motion } from 'framer-motion'
import { CheckCircle, Copy } from 'lucide-react'
import { useState } from 'react'

export default function OrderConfirmation({ orderId, productName, price }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(orderId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-6 p-6 bg-gradient-to-br from-green-600/20 to-green-500/20 border-2 border-green-500/50 rounded-xl text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
        className="flex justify-center mb-4"
      >
        <CheckCircle size={48} className="text-green-400" />
      </motion.div>

      <h3 className="text-2xl font-black text-green-300 mb-2">Order Confirmed!</h3>
      <p className="text-gray-300 mb-4">Your order has been successfully placed.</p>

      <div className="bg-gray-800/50 rounded-lg p-4 mb-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-400">Product:</span>
          <span className="text-white font-semibold">{productName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Price:</span>
          <span className="text-green-400 font-bold">₹{price}</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-500">Order ID</p>
        <div className="flex items-center gap-2 bg-gray-800 p-3 rounded-lg">
          <code className="flex-1 font-mono text-sm text-blue-400 break-all">{orderId}</code>
          <motion.button
            onClick={handleCopy}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            <Copy size={16} className="text-white" />
          </motion.button>
        </div>
        {copied && <p className="text-xs text-green-400">✓ Copied to clipboard</p>}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        You will receive a confirmation email shortly. Check your email for tracking details.
      </p>
    </motion.div>
  )
}
