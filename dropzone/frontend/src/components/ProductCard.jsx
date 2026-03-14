import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShoppingCart, Zap, Check, Clock, Users, AlertCircle, ExternalLink } from 'lucide-react'
import { useSocket } from '../contexts/SocketContext'
import { useInventory } from '../hooks/useInventory'
import { useCheckout } from '../hooks/useCheckout'
import useStore from '../stores/cartStore'

const fadeUp = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function ProductCard({ product }) {
  const navigate = useNavigate()
  const { socket } = useSocket()
  
  // Real backend connections (for exclusive items)
  const { remaining, total, isSoldOut } = useInventory(product.id, socket)
  const { state: checkoutState, submit, queuePosition } = useCheckout(product.id, socket, 'guest-token')

  // Mock store connection (for non-exclusive standard cart items)
  const addToCart = useStore((s) => s.addToCart)
  const cart = useStore((s) => s.cart)
  
  const [added, setAdded] = useState(false)
  const isInCart = cart.some(c => c.productId === product.id)

  // Use actual backend inventory for exclusive drops, fallback to mock DB stock for standard
  const stockLimit = product.exclusive ? (total || product.stock) : product.stock
  const stockRemaining = product.exclusive ? (remaining || product.stock) : product.stock
  const isCurrentlySoldOut = product.exclusive ? isSoldOut : stockRemaining === 0

  const handleAction = () => {
    if (product.exclusive) {
      submit() // Calls real backend API
    } else {
      addToCart(product.id) // Fallback behavior for standard items
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
    }
  }

  // Determine button appearance
  let btnIcon = <ShoppingCart size={16} />
  let btnText = 'Add to Cart'
  let btnClass = 'add-btn'

  if (product.exclusive) {
    if (checkoutState === 'LOCKED') {
      btnIcon = <Clock size={16} />
      btnText = 'Waiting for Drop'
      btnClass = 'add-btn in-queue' // Disabled style
    } else if (checkoutState === 'UNLOCKED' || checkoutState === 'ERROR') {
      btnIcon = <Zap size={16} />
      btnText = 'Join Queue'
      btnClass = 'add-btn queue-btn'
    } else if (checkoutState === 'LOADING') {
      btnIcon = <Clock size={16} className="animate-spin" />
      btnText = 'Submitting...'
      btnClass = 'add-btn in-queue'
    } else if (checkoutState === 'QUEUED') {
      btnIcon = <Clock size={16} />
      btnText = `In Queue — #${queuePosition || '...'}`
      btnClass = 'add-btn in-queue'
    } else if (checkoutState === 'CONFIRMED') {
      btnIcon = <Check size={16} />
      btnText = 'Order Confirmed!'
      btnClass = 'add-btn added'
    } else if (checkoutState === 'SOLD_OUT' || isCurrentlySoldOut) {
      btnIcon = <AlertCircle size={16} />
      btnText = 'Sold Out'
      btnClass = 'add-btn in-queue'
    }
  } else {
    if (added) {
      btnIcon = <Check size={16} />
      btnText = 'Added!'
      btnClass = 'add-btn added'
    } else if (isInCart) {
      btnClass = 'add-btn in-cart'
    }
  }

  return (
    <motion.div
      className={`product-card ${product.exclusive ? 'exclusive' : ''}`}
      layout
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      exit="hidden"
      role="region"
      aria-label={`Product: ${product.name}`}
    >
      {/* Image */}
      <div className="product-card-image">
        <img 
          src={product.image} 
          alt={`${product.name} product image`}
          loading="lazy"
        />
        {product.badge && (
          <span className={`product-badge ${product.exclusive ? 'exclusive-badge' : ''}`}>
            {product.badge}
          </span>
        )}
        {product.exclusive && (
          <div className="exclusive-overlay">
            <Clock size={14} />
            <span>Queue Protected</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="product-card-info">
        <span className="product-card-category">{product.category}</span>
        <h3 className="product-card-name">{product.name}</h3>
        <p className="product-card-desc">{product.desc}</p>

        <div className="product-card-footer">
          <div className="product-card-price">
            <span className="price-symbol">₹</span>
            <span className="price-value">{product.price.toLocaleString()}</span>
          </div>

          <div className={`stock-indicator ${product.exclusive && remaining < stockLimit * 0.2 ? 'low-stock' : ''}`}>
            <Users size={12} />
            <span>{isCurrentlySoldOut ? 'SOLD OUT' : `Only ${stockRemaining} left`}</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex gap-2 w-full">
          <button
            className={btnClass}
            onClick={handleAction}
            disabled={product.exclusive && (checkoutState !== 'UNLOCKED' && checkoutState !== 'ERROR' && checkoutState !== 'LOCKED')}
            style={{ flex: 1 }}
            aria-label={`${btnText} for ${product.name}`}
          >
            {btnIcon} {btnText}
          </button>
          {product.exclusive && (
            <button
              onClick={() => navigate(`/drops/${product.id}`)}
              className="add-btn flex items-center justify-center gap-1 px-2"
              title={`View drop details for ${product.name}`}
              aria-label={`View drop details for ${product.name}`}
            >
              <ExternalLink size={16} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
