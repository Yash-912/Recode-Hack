import { useState, useEffect, useContext } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SocketContext } from '../contexts/SocketContext'
import Navbar from '../components/Navbar'
import CountdownTimer from '../components/CountdownTimer'
import StockIndicator from '../components/StockIndicator'
import ViewerCount from '../components/ViewerCount'
import BuyButton from '../components/BuyButton'
import QueuePosition from '../components/QueuePosition'
import SoldOutBanner from '../components/SoldOutBanner'
import OrderConfirmation from '../components/OrderConfirmation'
import WaitlistForm from '../components/WaitlistForm'

export default function DropPage() {
  const { productId } = useParams()
  const { socket } = useContext(SocketContext)

  // Product data
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)

  // Inventory state
  const [remaining, setRemaining] = useState(0)
  const [total, setTotal] = useState(0)
  const [isSoldOut, setIsSoldOut] = useState(false)

  // Checkout state
  const [checkoutState, setCheckoutState] = useState('idle') // idle, loading, queued, processing, confirmed, soldout
  const [jobId, setJobId] = useState(null)
  const [queuePosition, setQueuePosition] = useState(null)
  const [orderId, setOrderId] = useState(null)
  const [dropStartTime, setDropStartTime] = useState(null)
  const [isDropLive, setIsDropLive] = useState(false)

  // Fetch product data
  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products/${productId}`)
        const data = await res.json()
        setProduct(data)
        setRemaining(data.stock)
        setTotal(data.stock)
        setDropStartTime(new Date(data.dropTime).getTime())
      } catch (err) {
        console.error('Error fetching product:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [productId])

  // Check if drop is live
  useEffect(() => {
    const interval = setInterval(() => {
      if (dropStartTime) {
        setIsDropLive(Date.now() >= dropStartTime)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [dropStartTime])

  // Subscribe to socket events
  useEffect(() => {
    if (!socket || !productId) return

    // Inventory updates
    socket.on('inventory_update', (data) => {
      if (data.productId === productId) {
        setRemaining(data.remaining)
        if (data.remaining === 0) setIsSoldOut(true)
      }
    })

    // Personal checkout result
    socket.on('checkout_result', (data) => {
      if (data.success) {
        setCheckoutState('confirmed')
        setOrderId(data.orderId)
        setJobId(null)
      } else {
        setCheckoutState('soldout')
      }
    })

    // Queue position updates
    socket.on('queue_position', (data) => {
      if (data.jobId === jobId) {
        setQueuePosition(data.position)
      }
    })

    // Sold out event
    socket.on('sold_out', (data) => {
      if (data.productId === productId) {
        setIsSoldOut(true)
      }
    })

    return () => {
      socket.off('inventory_update')
      socket.off('checkout_result')
      socket.off('queue_position')
      socket.off('sold_out')
    }
  }, [socket, productId, jobId])

  const handleBuyClick = async () => {
    if (!isDropLive || isSoldOut) return

    setCheckoutState('loading')

    try {
      // Get guest token
      const tokenRes = await fetch('/api/auth/guest', { method: 'POST' })
      const { token } = await tokenRes.json()

      // Submit checkout
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          productId,
          quantity: 1,
        }),
      })

      if (res.status === 202) {
        const data = await res.json()
        setJobId(data.jobId)
        setQueuePosition(data.position)
        setCheckoutState('queued')
      } else if (res.status === 409) {
        setCheckoutState('soldout')
      } else {
        setCheckoutState('idle')
        alert('Error submitting checkout')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setCheckoutState('idle')
      alert('Network error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f8ff] flex items-center justify-center">
        <div className="animate-pulse text-2xl font-bold text-blue-600">Loading drop...</div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#f0f8ff] flex items-center justify-center">
        <div className="text-2xl font-bold text-red-600">Product not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f8ff]">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-20 pt-28">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-4">
            <ViewerCount productId={productId} />
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 mb-2">{product.name}</h1>
          <p className="text-xl text-gray-600">{product.description}</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-2xl p-8 border-2 border-blue-100 shadow-lg">
              <img
                src={product.image}
                alt={product.name}
                className="w-full rounded-lg"
              />
            </div>
          </motion.div>

          {/* Details & CTA */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1 space-y-6"
          >
            {/* Price */}
            <div className="bg-white rounded-xl p-6 border-2 border-blue-100">
              <span className="text-sm font-bold text-gray-600 uppercase">Price</span>
              <div className="text-4xl font-black text-blue-600 mt-2">
                ₹{(product.price / 100).toLocaleString()}
              </div>
            </div>

            {/* Countdown */}
            <div className="bg-white rounded-xl p-6 border-2 border-blue-100">
              {dropStartTime && <CountdownTimer dropTime={dropStartTime} />}
            </div>

            {/* Stock */}
            <div className="bg-white rounded-xl p-6 border-2 border-blue-100">
              <StockIndicator remaining={remaining} total={total} />
            </div>

            {/* Buy Button */}
            {checkoutState === 'confirmed' ? (
              <OrderConfirmation
                orderId={orderId}
                productName={product.name}
                price={(product.price / 100).toLocaleString()}
              />
            ) : isSoldOut ? (
              <SoldOutBanner />
            ) : (
              <>
                <BuyButton
                  state={checkoutState}
                  isDropLive={isDropLive}
                  isSoldOut={isSoldOut}
                  queuePosition={queuePosition}
                  onBuyClick={handleBuyClick}
                  disabled={!isDropLive || isSoldOut}
                />
                {jobId && (
                  <QueuePosition jobId={jobId} isActive={checkoutState === 'queued'} />
                )}
              </>
            )}

            {/* Waitlist */}
            {isSoldOut && checkoutState !== 'confirmed' && (
              <WaitlistForm productId={productId} />
            )}
          </motion.div>
        </div>

        {/* Product Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-16 p-8 bg-white rounded-2xl border-2 border-blue-100"
        >
          <h2 className="text-2xl font-black text-gray-900 mb-4">About This Drop</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <span className="text-sm font-bold text-blue-600 uppercase">Limited Stock</span>
              <p className="text-lg font-bold text-gray-900 mt-2">{total} units available</p>
            </div>
            <div>
              <span className="text-sm font-bold text-blue-600 uppercase">Drop Time</span>
              <p className="text-lg font-bold text-gray-900 mt-2">
                {new Date(product.dropTime).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-sm font-bold text-blue-600 uppercase">Status</span>
              <p className={`text-lg font-bold mt-2 ${isDropLive ? 'text-green-600' : 'text-orange-600'}`}>
                {isDropLive ? '🚀 LIVE' : '⏳ Coming Soon'}
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
