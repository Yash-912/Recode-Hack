import { useEffect } from 'react'
import useDropStore from '../stores/dropStore'

export function useInventory(productId, socket) {
  const remaining = useDropStore(s => s.remaining)
  const total = useDropStore(s => s.total)
  const isSoldOut = useDropStore(s => s.isSoldOut)
  
  const setInventory = useDropStore(s => s.setInventory)

  useEffect(() => {
    if (!socket || !productId) return

    // 1. Join product room
    socket.emit('subscribe_product', productId)

    // 2. Listen for inventory updates
    const onUpdate = ({ remaining, total }) => {
      setInventory(remaining, total)
    }

    const onSoldOut = () => {
      setInventory(0, total) // Force zero
    }

    socket.on('inventory_update', onUpdate)
    socket.on('sold_out', onSoldOut)

    return () => {
      socket.off('inventory_update', onUpdate)
      socket.off('sold_out', onSoldOut)
    }
  }, [socket, productId, setInventory, total])

  return { remaining, total, isSoldOut }
}
