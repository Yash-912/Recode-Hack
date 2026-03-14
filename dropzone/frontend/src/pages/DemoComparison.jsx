import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ShieldOff, Play, RotateCcw, Zap } from 'lucide-react'
import { createMockEngine } from '../services/mockEngine'
import Navbar from '../components/Navbar'
import './DemoComparison.css'

export default function DemoComparison() {
  const [naiveEngine] = useState(() => createMockEngine(10))
  const [protectedEngine] = useState(() => createMockEngine(10))
  const [naiveState, setNaiveState] = useState({ stock: 10, sold: 0, rejected: 0, events: [] })
  const [protectedState, setProtectedState] = useState({ stock: 10, sold: 0, rejected: 0, events: [] })
  const [isRunning, setIsRunning] = useState(false)
  const [requestCount, setRequestCount] = useState(100)
  const cancelRefs = useRef([])

  useEffect(() => {
    const u1 = naiveEngine.on('purchase', () => {
      const s = naiveEngine.getState()
      setNaiveState({ stock: s.stock, sold: s.sold, rejected: s.rejected, events: s.events })
    })
    const u2 = protectedEngine.on('purchase', () => {
      const s = protectedEngine.getState()
      setProtectedState({ stock: s.stock, sold: s.sold, rejected: s.rejected, events: s.events })
    })
    const u3 = naiveEngine.on('load_complete', () => {
      setIsRunning(false)
    })
    return () => { u1(); u2(); u3() }
  }, [naiveEngine, protectedEngine])

  const handleRun = () => {
    naiveEngine.reset(10)
    protectedEngine.reset(10)
    setNaiveState({ stock: 10, sold: 0, rejected: 0, events: [] })
    setProtectedState({ stock: 10, sold: 0, rejected: 0, events: [] })
    setIsRunning(true)

    // Naive: simulate race conditions (overselling)
    let naiveStock = 10
    let naiveSold = 0
    let naiveRejected = 0
    const naiveEvents = []
    const names = ['Alex','Jordan','Taylor','Morgan','Casey','Riley','Quinn','Drew']

    // Run naive simulation with deliberate overselling
    let processed = 0
    const naiveTimer = setInterval(() => {
      if (processed >= requestCount) {
        clearInterval(naiveTimer)
        return
      }
      const batch = Math.min(Math.floor(Math.random() * 8) + 3, requestCount - processed)
      for (let j = 0; j < batch; j++) {
        const name = names[Math.floor(Math.random() * names.length)]
        const id = Math.random().toString(36).substring(2, 6).toUpperCase()
        const latency = Math.floor(Math.random() * 100) + 10
        const readStock = naiveStock // Read BEFORE decrement (race!)
        if (readStock > 0) {
          naiveStock--
          naiveSold++
          naiveEvents.unshift({ id: Date.now() + id, type: 'confirmed', userId: id, userName: name, latency, remaining: naiveStock, timestamp: Date.now() })
        } else {
          naiveRejected++
          naiveEvents.unshift({ id: Date.now() + id, type: 'rejected', userId: id, userName: name, latency, remaining: naiveStock, timestamp: Date.now() })
        }
        processed++
      }
      setNaiveState({ stock: naiveStock, sold: naiveSold, rejected: naiveRejected, events: naiveEvents.slice(0, 30) })
    }, 5)

    cancelRefs.current.push(() => clearInterval(naiveTimer))

    // Protected: clean simulation
    cancelRefs.current.push(protectedEngine.simulateLoad(requestCount, 'protected', 5))
  }

  const handleReset = () => {
    cancelRefs.current.forEach(fn => fn && fn())
    cancelRefs.current = []
    naiveEngine.reset(10)
    protectedEngine.reset(10)
    setNaiveState({ stock: 10, sold: 0, rejected: 0, events: [] })
    setProtectedState({ stock: 10, sold: 0, rejected: 0, events: [] })
    setIsRunning(false)
  }

  return (
    <div className="demo-page">
      <Navbar />

      <div className="demo-container">
        <div className="demo-header">
          <motion.h1
            className="demo-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Zap size={32} /> The Gate in Action
          </motion.h1>
          <p className="demo-subtitle">
            Same {requestCount} requests. Same moment. Different architecture. Watch what happens.
          </p>

          <div className="demo-controls">
            <div className="request-selector">
              <label>Requests:</label>
              {[50, 100, 200, 500].map(n => (
                <button
                  key={n}
                  className={`req-btn ${requestCount === n ? 'active' : ''}`}
                  onClick={() => !isRunning && setRequestCount(n)}
                  disabled={isRunning}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="demo-btns">
              <button className="demo-btn reset" onClick={handleReset} disabled={isRunning}>
                <RotateCcw size={16} /> Reset
              </button>
              <button className="demo-btn run" onClick={handleRun} disabled={isRunning}>
                <Play size={16} /> {isRunning ? 'Running...' : 'Run Comparison'}
              </button>
            </div>
          </div>
        </div>

        <div className="comparison-grid">
          {/* Naive Panel */}
          <div className="comparison-panel naive">
            <div className="panel-header naive">
              <ShieldOff size={20} />
              <h2>Without Gate</h2>
              <span className="panel-tag red">NAIVE MODE</span>
            </div>

            <div className="panel-stats">
              <div className="panel-stat">
                <span className="panel-stat-label">Final Stock</span>
                <span className={`panel-stat-value ${naiveState.stock < 0 ? 'negative' : ''}`}>
                  {naiveState.stock}
                </span>
              </div>
              <div className="panel-stat">
                <span className="panel-stat-label">Confirmed</span>
                <span className="panel-stat-value red">{naiveState.sold}</span>
              </div>
              <div className="panel-stat">
                <span className="panel-stat-label">Rejected</span>
                <span className="panel-stat-value">{naiveState.rejected}</span>
              </div>
            </div>

            {naiveState.sold > 10 && (
              <div className="panel-warning">
                ⚠️ {naiveState.sold - 10} impossible orders created!
                Stock went to {naiveState.stock}
              </div>
            )}

            <div className="panel-stock-bar">
              <div className="panel-bar-track">
                <div
                  className="panel-bar-fill naive"
                  style={{ width: `${Math.max(0, (naiveState.stock / 10) * 100)}%` }}
                />
              </div>
            </div>

            <div className="panel-feed">
              <AnimatePresence>
                {naiveState.events.slice(0, 15).map((event) => (
                  <motion.div
                    key={event.id}
                    className={`panel-feed-item ${event.type}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <span className="pf-icon">{event.type === 'confirmed' ? '✓' : '✗'}</span>
                    <span className="pf-user">{event.userName} #{event.userId}</span>
                    <span className="pf-latency">{event.latency}ms</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* VS Divider */}
          <div className="vs-divider">
            <span>VS</span>
          </div>

          {/* Protected Panel */}
          <div className="comparison-panel protected">
            <div className="panel-header protected">
              <Shield size={20} />
              <h2>With DropZone</h2>
              <span className="panel-tag green">PROTECTED</span>
            </div>

            <div className="panel-stats">
              <div className="panel-stat">
                <span className="panel-stat-label">Final Stock</span>
                <span className="panel-stat-value green">{protectedState.stock}</span>
              </div>
              <div className="panel-stat">
                <span className="panel-stat-label">Confirmed</span>
                <span className="panel-stat-value green">{protectedState.sold}</span>
              </div>
              <div className="panel-stat">
                <span className="panel-stat-label">Rejected</span>
                <span className="panel-stat-value">{protectedState.rejected}</span>
              </div>
            </div>

            {protectedState.sold === 10 && protectedState.stock === 0 && (
              <div className="panel-success">
                ✓ Exactly 10 orders. {protectedState.rejected} clean rejections. Perfect.
              </div>
            )}

            <div className="panel-stock-bar">
              <div className="panel-bar-track">
                <div
                  className="panel-bar-fill protected"
                  style={{ width: `${Math.max(0, (protectedState.stock / 10) * 100)}%` }}
                />
              </div>
            </div>

            <div className="panel-feed">
              <AnimatePresence>
                {protectedState.events.slice(0, 15).map((event) => (
                  <motion.div
                    key={event.id}
                    className={`panel-feed-item ${event.type}`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <span className="pf-icon">{event.type === 'confirmed' ? '✓' : '✗'}</span>
                    <span className="pf-user">{event.userName} #{event.userId}</span>
                    <span className="pf-latency">{event.latency}ms</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
