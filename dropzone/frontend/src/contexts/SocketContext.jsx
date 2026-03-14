import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

// Named export so consumers can import { SocketContext }
export const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Connect to backend server (default port 3000)
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

    const newSocket = io(backendUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelayMax: 2000,
    })

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id)
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected')
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message)
      setIsConnected(false)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
