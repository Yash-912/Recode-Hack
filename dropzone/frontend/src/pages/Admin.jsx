import { useState, useEffect, useContext, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, ShieldOff, Zap, RotateCcw, Package, Timer,
  Play, Terminal, Download, Eye, EyeOff, Loader2,
  CheckCircle, AlertTriangle, Activity
} from 'lucide-react'
import { SocketContext } from '../contexts/SocketContext'
import Navbar from '../components/Navbar'
import MetricsPanel from '../components/MetricsPanel'

const ADMIN_TOKEN_KEY = 'dropzone_admin_token'
const API = '/api'
const ADMIN_API = '/admin'

function callAdmin(endpoint, { method = 'GET', body, adminToken } = {}) {
  return fetch(`${ADMIN_API}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  }).then(r => r.json())
}

export default function Admin() {
  // Auth
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || '')
  const [tokenInput, setTokenInput] = useState('')
  const [isAuthed, setIsAuthed] = useState(false)
  const [showToken, setShowToken] = useState(false)

  // Product form
  const [productForm, setProductForm] = useState({ name: '', totalStock: 10, pricePaise: 299900, dropOffsetSeconds: 60 })
  const [createdProduct, setCreatedProduct] = useState(null)
  const [productLoading, setProductLoading] = useState(false)

  // Drop controls
  const [resetStock, setResetStock] = useState(10)
  const [resetLoading, setResetLoading] = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)

  // Gate mode
  const [gateMode, setGateMode] = useState('protected')
  const [modeLoading, setModeLoading] = useState(false)

  // Load test
  const [loadTestRunning, setLoadTestRunning] = useState(false)
  const [loadTestOutput, setLoadTestOutput] = useState([])
  const terminalRef = useRef(null)

  // Metrics
  const [metrics, setMetrics] = useState({ qps: 0, successCount: 0, rejectCount: 0, queueDepth: 0, latencyP50: 0, latencyP99: 0 })
  const [currentStock, setCurrentStock] = useState(0)

  const { socket, isConnected } = useContext(SocketContext)

  // Verify admin token
  const handleAuth = async () => {
    try {
      const res = await callAdmin('/metrics', { adminToken: tokenInput })
      if (res.error) throw new Error(res.error)
      localStorage.setItem(ADMIN_TOKEN_KEY, tokenInput)
      setAdminToken(tokenInput)
      setIsAuthed(true)
    } catch {
      alert('Invalid admin token. Default is: dropzone-admin-secret')
    }
  }

  useEffect(() => {
    if (adminToken) {
      callAdmin('/metrics', { adminToken }).then(() => setIsAuthed(true)).catch(() => {})
      callAdmin('/mode', { adminToken }).then(data => {
        if (data.mode) setGateMode(data.mode)
      }).catch(() => {})
    }
  }, [adminToken])

  useEffect(() => {
    if (!socket) return
    socket.emit('subscribe_admin', adminToken)
    const onMetrics = (data) => setMetrics(data)
    const onInventory = (data) => setCurrentStock(data.remaining)
    const onModeChange = (data) => setGateMode(data.mode)
    const onLoadOutput = (data) => {
      setLoadTestOutput(prev => [...prev, data])
      if (data.type === 'done') setLoadTestRunning(false)
      setTimeout(() => {
        if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }, 50)
    }
    socket.on('metrics_tick', onMetrics)
    socket.on('inventory_update', onInventory)
    socket.on('mode_changed', onModeChange)
    socket.on('load_test_output', onLoadOutput)
    return () => {
      socket.off('metrics_tick', onMetrics)
      socket.off('inventory_update', onInventory)
      socket.off('mode_changed', onModeChange)
      socket.off('load_test_output', onLoadOutput)
    }
  }, [socket, adminToken])

  // Actions
  const createProduct = async () => {
    setProductLoading(true)
    try {
      const res = await callAdmin('/products', {
        method: 'POST', body: productForm, adminToken
      })
      if (res.error) throw new Error(res.message || res.error)
      setCreatedProduct(res)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setProductLoading(false)
    }
  }

  const resetInventory = async () => {
    if (!createdProduct?.productId) return alert('Create a product first')
    setResetLoading(true)
    try {
      await callAdmin(`/products/${createdProduct.productId}/reset`, {
        method: 'POST', body: { stock: resetStock }, adminToken
      })
      setCurrentStock(resetStock)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setResetLoading(false)
    }
  }

  const unlockDrop = async () => {
    if (!createdProduct?.productId) return alert('Create a product first')
    setUnlockLoading(true)
    try {
      await callAdmin(`/products/${createdProduct.productId}/unlock`, {
        method: 'POST', adminToken
      })
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setUnlockLoading(false)
    }
  }

  const toggleMode = async (mode) => {
    setModeLoading(true)
    try {
      await callAdmin('/mode', { method: 'PUT', body: { mode }, adminToken })
      setGateMode(mode)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setModeLoading(false)
    }
  }

  const runLoadTest = async () => {
    setLoadTestRunning(true)
    setLoadTestOutput([])
    try {
      await callAdmin('/run-load-test', { method: 'POST', adminToken })
    } catch (err) {
      setLoadTestRunning(false)
      alert('Error starting load test: ' + err.message)
    }
  }

  // Auth gate
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <Navbar />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl mt-16"
        >
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
              <Shield size={32} className="text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Access</h1>
            <p className="text-gray-400 text-sm mt-1">Enter your admin token to continue</p>
          </div>
          <div className="relative mb-4">
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              placeholder="dropzone-admin-secret"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
            />
            <button
              onClick={() => setShowToken(v => !v)}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-white"
            >
              {showToken ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>
          </div>
          <button
            onClick={handleAuth}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
          >
            Authenticate →
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-gray-100 font-sans">
      <Navbar />
      <main className="max-w-7xl mx-auto p-6 lg:p-8 pt-24">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Admin Panel</h1>
            <p className="text-gray-400 mt-1">Demo controls and live metrics management</p>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-bold border flex items-center gap-2 ${isConnected ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}/>
            {isConnected ? 'Socket Connected' : 'Socket Disconnected'}
          </div>
        </div>

        {/* THE CRITICAL TOGGLE — Gate Mode */}
        <div className="mb-6 p-6 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Activity size={20} className="text-blue-400" />
            Gate Mode — The Demo Toggle
          </h2>
          <p className="text-gray-400 text-sm mb-5">Toggle between Naive (race conditions) and Protected (atomic Lua gate) mode.</p>
          <div className="flex gap-4">
            <button
              onClick={() => toggleMode('naive')}
              disabled={modeLoading || gateMode === 'naive'}
              className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-xl border-2 font-bold text-lg transition-all ${gateMode === 'naive'
                ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_30px_-8px_rgba(239,68,68,0.5)]'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400'}`}
            >
              <ShieldOff size={24} />
              NAIVE MODE
              {gateMode === 'naive' && <span className="text-xs font-normal bg-red-500/20 px-2 py-0.5 rounded-full">ACTIVE</span>}
            </button>
            <button
              onClick={() => toggleMode('protected')}
              disabled={modeLoading || gateMode === 'protected'}
              className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-xl border-2 font-bold text-lg transition-all ${gateMode === 'protected'
                ? 'bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_30px_-8px_rgba(34,197,94,0.5)]'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-green-700 hover:text-green-400'}`}
            >
              <Shield size={24} />
              PROTECTED MODE
              {gateMode === 'protected' && <span className="text-xs font-normal bg-green-500/20 px-2 py-0.5 rounded-full">ACTIVE</span>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Product Creation */}
          <div className="p-6 bg-gray-900 border border-gray-800 rounded-2xl">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Package size={20} className="text-purple-400" />Create Product</h2>
            <div className="space-y-3">
              <input value={productForm.name} onChange={e => setProductForm(p => ({...p, name: e.target.value}))} placeholder="e.g. Midnight Hoodie Drop" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Stock</label>
                  <input type="number" value={productForm.totalStock} onChange={e => setProductForm(p => ({...p, totalStock: parseInt(e.target.value)}))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Price (paise)</label>
                  <input type="number" value={productForm.pricePaise} onChange={e => setProductForm(p => ({...p, pricePaise: parseInt(e.target.value)}))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Drop (sec)</label>
                  <input type="number" value={productForm.dropOffsetSeconds} onChange={e => setProductForm(p => ({...p, dropOffsetSeconds: parseInt(e.target.value)}))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              <button onClick={createProduct} disabled={productLoading || !productForm.name} className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                {productLoading ? <><Loader2 size={16} className="animate-spin" />Creating...</> : 'Create Product'}
              </button>
              <AnimatePresence>
                {createdProduct && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm">
                    <div className="flex items-center gap-2 text-green-400 font-bold mb-1"><CheckCircle size={14}/> Product Created</div>
                    <p className="text-gray-300 font-mono text-xs break-all">ID: {createdProduct.productId}</p>
                    <p className="text-gray-400 text-xs">Drop: {new Date(createdProduct.dropTime).toLocaleTimeString()}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Drop Controls */}
          <div className="p-6 bg-gray-900 border border-gray-800 rounded-2xl">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Timer size={20} className="text-amber-400" />Drop Controls</h2>
            {!createdProduct && <p className="text-gray-500 text-sm mb-4 italic">Create a product first to enable controls.</p>}
            <div className="space-y-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Reset Stock To</label>
                  <input type="number" value={resetStock} onChange={e => setResetStock(parseInt(e.target.value))} disabled={!createdProduct} className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-40" />
                </div>
                <button onClick={resetInventory} disabled={resetLoading || !createdProduct} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap">
                  {resetLoading ? <Loader2 size={16} className="animate-spin"/> : <RotateCcw size={16}/>}
                  Reset
                </button>
              </div>
              <button onClick={unlockDrop} disabled={unlockLoading || !createdProduct} className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                {unlockLoading ? <Loader2 size={16} className="animate-spin"/> : <Zap size={18}/>}
                Unlock Drop NOW
              </button>
              {createdProduct && (
                <a
                  href={`/admin/export?format=csv&productId=${createdProduct.productId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Download size={16}/> Export Checkout CSV
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Panel */}
        <MetricsPanel metrics={metrics} stock={currentStock} isNaiveMode={gateMode === 'naive'} />

        {/* Load Test */}
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Terminal size={20} className="text-blue-400"/>Load Test Runner</h2>
            <button
              onClick={runLoadTest}
              disabled={loadTestRunning || !createdProduct}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
            >
              {loadTestRunning ? <><Loader2 size={16} className="animate-spin"/>Running...</> : <><Play size={16}/>Run Load Test (500 reqs)</>}
            </button>
          </div>
          {!createdProduct && <p className="text-gray-500 text-sm italic mb-4">Create a product first to enable the load test.</p>}
          <div
            ref={terminalRef}
            className={`w-full rounded-xl border font-mono text-xs overflow-y-auto transition-colors ${loadTestOutput.length > 0 ? 'bg-gray-950 border-gray-700' : 'bg-gray-950/50 border-gray-800'}`}
            style={{ height: '240px', padding: '16px', overflowY: 'auto' }}
          >
            {loadTestOutput.length === 0 ? (
              <span className="text-gray-600">{">"} Waiting for load test to start...</span>
            ) : (
              loadTestOutput.map((item, i) => (
                <div key={i} className={`leading-relaxed whitespace-pre-wrap ${item.type === 'stderr' || item.type === 'error' ? 'text-red-400' : item.type === 'done' ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                  {item.line}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
