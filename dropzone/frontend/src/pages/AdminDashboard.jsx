import { useState, useEffect, useContext } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { SocketContext } from '../contexts/SocketContext'
import Navbar from '../components/Navbar'
import MetricsPanel from '../components/MetricsPanel'
import LiveFeed from '../components/LiveFeed'

export default function AdminDashboard() {
  const { socket, isConnected } = useContext(SocketContext)
  
  // Real-time state
  const [metrics, setMetrics] = useState({
    qps: 0,
    successCount: 0,
    rejectCount: 0,
    queueDepth: 0,
    latencyP50: 0,
    latencyP99: 0
  })
  
  const [chartData, setChartData] = useState(
    Array.from({ length: 30 }, (_, i) => ({ time: i, requests: 0 }))
  )
  
  const [liveEvents, setLiveEvents] = useState([])
  const [currentStock, setCurrentStock] = useState(0)

  // Socket Subscriptions
  useEffect(() => {
    if (!socket) return

    // Auto-join admin room (in a real app, pass admin auth token)
    socket.emit('subscribe_admin', 'dev-admin-token')

    const handleMetricsTick = (data) => {
      setMetrics(data)
      
      // Update chart (shift left, push new QPS)
      setChartData(prev => {
        const newData = [...prev.slice(1), { 
          time: new Date().toLocaleTimeString('en-US', { hour12: false, second: '2-digit', minute: '2-digit' }), 
          requests: data.qps 
        }]
        return newData
      })
    }

    const handleFeedEvent = (event) => {
      setLiveEvents(prev => {
        const newEvents = [event, ...prev]
        if (newEvents.length > 30) newEvents.pop() // Keep last 30
        return newEvents
      })
    }

    const handleInventoryUpdate = (data) => {
      setCurrentStock(data.remaining)
    }

    socket.on('metrics_tick', handleMetricsTick)
    socket.on('feed_event', handleFeedEvent)
    // Also listen to general inventory updates (assuming a known product ID for the demo, or global updates)
    socket.on('inventory_update', handleInventoryUpdate)

    return () => {
      socket.off('metrics_tick', handleMetricsTick)
      socket.off('feed_event', handleFeedEvent)
      socket.off('inventory_update', handleInventoryUpdate)
    }
  }, [socket])

  // Optional: Mock Data Generator for Frontend-Only Demo
  useEffect(() => {
    if (isConnected) return

    let currentQps = 1500
    let totalConfirmed = 1420
    let totalRejected = 3400
    let depth = 8500
    let stock = 1000

    const interval = setInterval(() => {
      // Simulate fluctuating metrics
      currentQps = Math.floor(currentQps * 0.9 + (Math.random() * 500))
      depth = Math.max(0, depth - Math.floor(currentQps * 0.2))
      
      const newSuccess = Math.floor(Math.random() * 10)
      const newReject = Math.floor(Math.random() * 40)
      
      totalConfirmed += newSuccess
      totalRejected += newReject
      stock = Math.max(-50, stock - newSuccess) // Allow going slightly negative to show naive mode

      const mockMetrics = {
        qps: currentQps,
        successCount: totalConfirmed,
        rejectCount: totalRejected,
        queueDepth: depth,
        latencyP50: 45 + Math.floor(Math.random() * 20),
        latencyP99: 120 + Math.floor(Math.random() * 50)
      }

      setMetrics(mockMetrics)
      setCurrentStock(stock)

      setChartData(prev => {
        const newData = [...prev.slice(1), { 
          time: new Date().toLocaleTimeString('en-US', { hour12: false, second: '2-digit', minute: '2-digit' }), 
          requests: currentQps 
        }]
        return newData
      })

      // Chance to add a feed event
      if (Math.random() > 0.5) {
        const isSuccess = Math.random() > 0.7
        setLiveEvents(prev => {
          const newEvents = [{
            id: Math.random().toString(36).substr(2, 9),
            status: isSuccess ? 'success' : 'reject',
            userId: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            latencyMs: isSuccess ? 45 + Math.floor(Math.random()*10) : 15 + Math.floor(Math.random()*5)
          }, ...prev]
          if (newEvents.length > 30) newEvents.pop()
          return newEvents
        })
      }

    }, 1000)

    setCurrentStock(1000)

    return () => clearInterval(interval)
  }, [isConnected])

  return (
    <div className="min-h-screen bg-[#020617] text-gray-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto flex flex-col pt-24">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              DropZone War Room
              {!isConnected && (
                <span className="text-sm font-medium px-3 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                  DISCONNECTED
                </span>
              )}
            </h1>
            <p className="text-gray-400 mt-2 text-lg">Live telemetry and real-time flash sale performance</p>
          </div>
          
          <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-800">
            <button className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/20">
              Live View
            </button>
            <button className="px-6 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition-colors">
              Configuration
            </button>
          </div>
        </div>

        {/* Top Metrics Row */}
        <MetricsPanel metrics={metrics} stock={currentStock} isNaiveMode={false} />

        {/* Bottom Split Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px]">
          
          {/* Main Chart (2/3 width) */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Throughput Velocity</h2>
                <p className="text-sm text-gray-400 mt-1">Requests processed per second (rolling 30s)</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Peak QPS</p>
                <p className="text-2xl font-mono font-bold text-blue-400">
                  {Math.max(...chartData.map(d => d.requests), 0).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="flex-1 w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorQps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="time" 
                    stroke="#334155" 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    stroke="#334155" 
                    tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'monospace' }} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                    itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorQps)" 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Live Feed Sidebar (1/3 width) */}
          <div className="h-[400px] lg:h-auto">
            <LiveFeed events={liveEvents} />
          </div>

        </div>
      </main>
    </div>
  )
}
