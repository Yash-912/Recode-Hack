import { useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import useDropStore from '../stores/dropStore'

export function useCheckout(productId, socket, token) {
  const checkoutState = useDropStore(s => s.checkoutState)
  const setCheckoutState = useDropStore(s => s.setCheckoutState)
  
  const jobId = useDropStore(s => s.jobId)
  const orderId = useDropStore(s => s.orderId)
  const queuePosition = useDropStore(s => s.queuePosition)

  useEffect(() => {
    if (!socket) return

    const onResult = (data) => {
      if (data.success) {
        useDropStore.setState({ orderId: data.orderId, checkoutState: 'CONFIRMED' })
      } else {
        useDropStore.setState({ checkoutState: 'SOLD_OUT' })
      }
    }

    const onQueuePosition = (data) => {
      if (data.jobId === jobId) {
        useDropStore.setState({ queuePosition: data.position })
      }
    }

    socket.on('checkout_result', onResult)
    socket.on('queue_position', onQueuePosition)

    return () => {
      socket.off('checkout_result', onResult)
      socket.off('queue_position', onQueuePosition)
    }
  }, [socket, jobId])

  const submit = async () => {
    if (checkoutState !== 'UNLOCKED' && checkoutState !== 'ERROR') return

    setCheckoutState('LOADING')
    
    try {
      // 1. Get single-use checkout token (PoW/captcha equivalent)
      const tokenRes = await fetch(`/api/products/${productId}/checkout-token`)
      if (!tokenRes.ok) throw new Error('Failed to get checkout token')
      const { token: checkoutToken } = await tokenRes.json()

      // 2. Submit to queue
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': uuidv4(),
          'X-Checkout-Token': checkoutToken
        },
        body: JSON.stringify({ productId, quantity: 1 })
      })

      if (res.status === 202) {
        const data = await res.json()
        useDropStore.setState({ 
          jobId: data.jobId, 
          queuePosition: data.position,
          checkoutState: 'QUEUED' 
        })
      } else if (res.status === 409) {
        // Already attempted/bought
        const data = await res.json()
        if (data.orderId) {
          useDropStore.setState({ orderId: data.orderId, checkoutState: 'CONFIRMED' })
        } else {
          setCheckoutState('SOLD_OUT')
        }
      } else if (res.status === 503) {
        // Drop not started or completely closed
        setCheckoutState('LOCKED')
      } else {
        throw new Error('Checkout failed')
      }
      
    } catch (err) {
      console.error(err)
      setCheckoutState('ERROR')
    }
  }

  return { state: checkoutState, submit, jobId, orderId, queuePosition }
}
