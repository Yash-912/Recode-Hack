import { useState, useEffect, useCallback } from 'react'

export function useServerTime() {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    // 1. Fetch server time
    // 2. Calculate latency RTT / 2
    // 3. Compute offset = serverTime - localTime + (RTT / 2)
    const syncTime = async () => {
      try {
        const start = Date.now()
        const res = await fetch('/api/server-time')
        if (!res.ok) return
        
        const data = await res.json()
        const end = Date.now()
        const rtt = end - start
        
        const serverTime = data.timestamp
        const estimatedServerTimeNow = serverTime + (rtt / 2)
        const newOffset = estimatedServerTimeNow - Date.now()
        
        setOffset(newOffset)
      } catch (err) {
        console.error('Failed to sync server time:', err)
      }
    }

    syncTime()
    // Sync every 30 seconds
    const interval = setInterval(syncTime, 30000)
    return () => clearInterval(interval)
  }, [])

  const getAdjustedNow = useCallback(() => {
    return Date.now() + offset
  }, [offset])

  return { getAdjustedNow, offset }
}
