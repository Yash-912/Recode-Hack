import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Monitor, Server, Database, HardDrive, Layers, ArrowRight, Zap, Info, X } from 'lucide-react'
import Navbar from '../components/Navbar'
import './Architecture.css'

const NODES = [
  {
    id: 'client',
    label: 'Client Layer',
    icon: <Monitor size={28} />,
    color: '#3b82f6',
    desc: 'React SPA with Socket.io client. Connects via WebSocket for real-time updates. Sends checkout requests via HTTP POST.',
    x: 50, y: 10,
  },
  {
    id: 'api',
    label: 'API Gateway',
    icon: <Server size={28} />,
    color: '#8b5cf6',
    desc: 'Fastify server with rate limiting (5 req/s per IP), JWT auth, idempotency checks, and checkout token validation. Returns 202 Accepted with job ID.',
    x: 50, y: 30,
  },
  {
    id: 'queue',
    label: 'Bull Queue',
    icon: <Layers size={28} />,
    color: '#f59e0b',
    desc: 'Redis-backed job queue. FIFO ordering ensures first-come, first-served. Concurrency: 1 per product. Jobs timeout after 5s.',
    x: 50, y: 50,
  },
  {
    id: 'gate',
    label: 'Atomic Gate',
    icon: <Zap size={28} />,
    color: '#ef4444',
    desc: 'Redis Lua script — 8 lines that make check-and-decrement atomic. Redis executes Lua scripts in a single-threaded model. Zero race conditions possible.',
    x: 50, y: 70,
  },
  {
    id: 'db',
    label: 'PostgreSQL',
    icon: <Database size={28} />,
    color: '#10b981',
    desc: 'Persistent store for confirmed orders, user data, and audit trail. ACID transactions ensure data integrity. Compensating transactions on failure.',
    x: 30, y: 90,
  },
  {
    id: 'redis',
    label: 'Redis',
    icon: <HardDrive size={28} />,
    color: '#ec4899',
    desc: 'In-memory data store for inventory counters, rate limits, idempotency keys, checkout tokens, and queue backend. Single-threaded = atomic operations.',
    x: 70, y: 90,
  },
]

const CONNECTIONS = [
  { from: 'client', to: 'api', label: 'HTTP + WS' },
  { from: 'api', to: 'queue', label: 'Enqueue job' },
  { from: 'queue', to: 'gate', label: 'Process job' },
  { from: 'gate', to: 'db', label: 'On success' },
  { from: 'gate', to: 'redis', label: 'Atomic DECR' },
]

export default function Architecture() {
  const [activeNode, setActiveNode] = useState(null)
  const [animatingFlow, setAnimatingFlow] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)

  const startAnimation = () => {
    setAnimatingFlow(true)
    setActiveStep(0)

    let step = 0
    const timer = setInterval(() => {
      step++
      if (step >= NODES.length) {
        clearInterval(timer)
        setTimeout(() => {
          setAnimatingFlow(false)
          setActiveStep(-1)
        }, 1000)
        return
      }
      setActiveStep(step)
    }, 800)
  }

  return (
    <div className="architecture-page">
      <Navbar />

      <div className="arch-container">
        <motion.div
          className="arch-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="arch-badge">System Design</span>
          <h1 className="arch-title">Architecture</h1>
          <p className="arch-subtitle">
            Click any node to learn more. Hit "Animate" to see the data flow.
          </p>
          <button
            className="arch-animate-btn"
            onClick={startAnimation}
            disabled={animatingFlow}
          >
            {animatingFlow ? 'Animating...' : '▶ Animate Flow'}
          </button>
        </motion.div>

        {/* Flow Diagram */}
        <div className="arch-diagram">
          <div className="arch-flow">
            {NODES.map((node, i) => (
              <motion.div
                key={node.id}
                className={`arch-node ${activeStep === i ? 'active' : ''} ${activeNode === node.id ? 'selected' : ''}`}
                style={{ '--node-color': node.color }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setActiveNode(activeNode === node.id ? null : node.id)}
              >
                <div className="arch-node-icon" style={{ color: node.color }}>
                  {node.icon}
                </div>
                <div className="arch-node-label">{node.label}</div>
                {activeStep === i && (
                  <motion.div
                    className="arch-node-pulse"
                    initial={{ scale: 0.8, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    style={{ borderColor: node.color }}
                  />
                )}
              </motion.div>
            ))}

            {/* Connection arrows */}
            {NODES.slice(0, -2).map((_, i) => (
              <div key={i} className={`arch-connector ${activeStep > i ? 'lit' : ''}`}>
                <div className="connector-line" />
                <span className="connector-label">{CONNECTIONS[i]?.label}</span>
              </div>
            ))}

            {/* Fork to DB and Redis */}
            <div className="arch-fork">
              <div className={`arch-fork-arm left ${activeStep >= 4 ? 'lit' : ''}`}>
                <span className="connector-label">On success → Write order</span>
              </div>
              <div className={`arch-fork-arm right ${activeStep >= 5 ? 'lit' : ''}`}>
                <span className="connector-label">Atomic DECR</span>
              </div>
            </div>

            {/* Bottom nodes */}
            <div className="arch-bottom-nodes">
              {NODES.slice(-2).map((node, i) => (
                <motion.div
                  key={node.id}
                  className={`arch-node ${activeStep >= 4 + i ? 'active' : ''} ${activeNode === node.id ? 'selected' : ''}`}
                  style={{ '--node-color': node.color }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  onClick={() => setActiveNode(activeNode === node.id ? null : node.id)}
                >
                  <div className="arch-node-icon" style={{ color: node.color }}>
                    {node.icon}
                  </div>
                  <div className="arch-node-label">{node.label}</div>
                  {activeStep >= 4 + i && animatingFlow && (
                    <motion.div
                      className="arch-node-pulse"
                      initial={{ scale: 0.8, opacity: 1 }}
                      animate={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      style={{ borderColor: node.color }}
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {activeNode && (
            <motion.div
              className="arch-detail"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className="arch-detail-header">
                <div className="arch-detail-icon" style={{ color: NODES.find(n => n.id === activeNode)?.color }}>
                  {NODES.find(n => n.id === activeNode)?.icon}
                </div>
                <h3>{NODES.find(n => n.id === activeNode)?.label}</h3>
                <button className="arch-detail-close" onClick={() => setActiveNode(null)}>
                  <X size={16} />
                </button>
              </div>
              <p className="arch-detail-desc">
                {NODES.find(n => n.id === activeNode)?.desc}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lua Script Highlight */}
        <div className="arch-code-section">
          <h3 className="arch-code-title">The Atomic Gate — 8 Lines That Change Everything</h3>
          <pre className="arch-code-block">
            <code>{`-- inventory_gate.lua
local key = KEYS[1]
local requested = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key))

if current == nil then
  return -1  -- product not found
end

if current >= requested then
  local remaining = redis.call('DECRBY', key, requested)
  return remaining  -- success: new stock level
else
  return -2  -- sold out
end`}</code>
          </pre>
          <p className="arch-code-caption">
            Redis executes Lua scripts atomically. While this script runs, no other Redis command can execute.
            Two workers calling this simultaneously are serialized by Redis. Zero race conditions. Zero overselling.
          </p>
        </div>
      </div>
    </div>
  )
}
