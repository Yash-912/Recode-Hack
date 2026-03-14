import { create } from 'zustand'

const useDropStore = create((set) => ({
  // Product state
  product: null,
  setProduct: (product) => set({ product }),
  
  // Inventory state
  remaining: 0,
  total: 0,
  isSoldOut: false,
  setInventory: (remaining, total) => set({ remaining, total, isSoldOut: remaining === 0 }),
  
  // Real-time metrics
  viewerCount: 0,
  setViewerCount: (count) => set({ viewerCount: count }),
  
  // Checkout State Machine
  // States: LOCKED | UNLOCKED | LOADING | QUEUED | PROCESSING | CONFIRMED | SOLD_OUT | ERROR
  checkoutState: 'LOCKED',
  setCheckoutState: (state) => set({ checkoutState: state }),
  
  // Order details
  jobId: null,
  orderId: null,
  queuePosition: null,
  
  // Admin demo toggle
  gateMode: 'protected',
  setGateMode: (mode) => set({ gateMode: mode }),
}))

export default useDropStore
