import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function CountdownTimer({ dropTime }) {
  const [time, setTime] = useState(null)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    function updateCountdown() {
      const now = Date.now()
      const diff = Math.max(0, dropTime - now)

      if (diff === 0) {
        setIsLive(true)
        setTime(null)
        return
      }

      setIsLive(false)
      setTime({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        ms: Math.floor(diff % 1000),
      })
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 50)
    return () => clearInterval(interval)
  }, [dropTime])

  if (isLive) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
      >
        <div className="inline-block px-6 py-3 bg-green-500/20 border border-green-500/50 rounded-full">
          <span className="text-green-400 font-bold text-lg">🚀 DROP IS LIVE!</span>
        </div>
      </motion.div>
    )
  }

  if (!time) return null

  const pad = (n) => String(n).padStart(2, '0')

  return (
    <div className="text-center py-8">
      <p className="text-sm font-bold uppercase letter-spacing-wide text-gray-400 mb-4">Drop Starts In</p>
      <div className="flex justify-center gap-4 md:gap-6">
        {[
          { label: 'DAYS', value: time.days },
          { label: 'HOURS', value: time.hours },
          { label: 'MINS', value: time.minutes },
          { label: 'SECS', value: time.seconds },
        ].map((unit) => (
          <motion.div
            key={unit.label}
            className="flex flex-col items-center"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg px-3 md:px-4 py-2 md:py-3 mb-2 shadow-lg">
              <span className="text-2xl md:text-3xl font-black text-white">{pad(unit.value)}</span>
            </div>
            <span className="text-xs md:text-sm font-bold text-gray-500 uppercase">{unit.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
