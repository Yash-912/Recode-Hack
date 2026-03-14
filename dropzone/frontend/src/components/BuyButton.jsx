import { motion } from 'framer-motion'
import { ShoppingCart, Clock, Zap, AlertCircle, Check, Loader } from 'lucide-react'

export default function BuyButton({
  state = 'idle',
  isDropLive = false,
  isSoldOut = false,
  queuePosition = null,
  onBuyClick = () => {},
  disabled = false,
}) {
  const states = {
    idle: {
      icon: <ShoppingCart size={18} />,
      text: isDropLive ? 'Join Queue' : 'Waiting for Drop',
      bg: isDropLive ? 'from-blue-600 to-blue-500' : 'from-gray-700 to-gray-600',
      hover: isDropLive ? 'hover:from-blue-500 hover:to-blue-400' : '',
    },
    loading: {
      icon: <Loader size={18} className="animate-spin" />,
      text: 'Joining Queue...',
      bg: 'from-blue-600 to-blue-500',
      hover: '',
    },
    queued: {
      icon: <Clock size={18} className="animate-pulse" />,
      text: queuePosition ? `In Queue (${queuePosition})` : 'In Queue...',
      bg: 'from-amber-600 to-amber-500',
      hover: '',
    },
    processing: {
      icon: <Loader size={18} className="animate-spin" />,
      text: 'Processing...',
      bg: 'from-purple-600 to-purple-500',
      hover: '',
    },
    confirmed: {
      icon: <Check size={18} />,
      text: 'Order Confirmed! 🎉',
      bg: 'from-green-600 to-green-500',
      hover: '',
    },
    soldout: {
      icon: <AlertCircle size={18} />,
      text: 'Sold Out',
      bg: 'from-red-600 to-red-500',
      hover: '',
    },
  }

  const stateConfig = states[state] || states.idle

  return (
    <motion.button
      onClick={onBuyClick}
      disabled={disabled || isSoldOut || !isDropLive || state !== 'idle'}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`
        relative w-full py-4 px-6 rounded-xl font-bold text-lg
        bg-gradient-to-r ${stateConfig.bg} ${stateConfig.hover}
        text-white shadow-lg
        flex items-center justify-center gap-3
        transition-all duration-200
        ${disabled || isSoldOut || !isDropLive || state !== 'idle' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {stateConfig.icon}
      <span>{stateConfig.text}</span>
    </motion.button>
  )
}
