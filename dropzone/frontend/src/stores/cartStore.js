/* Simple cart store using Zustand */
import { create } from 'zustand'

const PRODUCTS = [
  {
    id: 1,
    name: 'Midnight Hoodie',
    price: 2999,
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"%3E%3Crect fill="%23f0f8ff" width="300" height="300"/%3E%3Crect fill="%231a1a1a" x="50" y="80" width="200" height="160" rx="10"/%3E%3Ctext x="150" y="150" font-size="24" font-weight="bold" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3EMidnight%3C/text%3E%3Ctext x="150" y="180" font-size="20" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3EHoodie%3C/text%3E%3Crect fill="%233b82f6" x="50" y="260" width="200" height="30" rx="5"/%3E%3Ctext x="150" y="275" font-size="16" font-weight="bold" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3E%E2%82%A92999%3C/text%3E%3C/svg%3E',
    category: 'Exclusive',
    exclusive: true,
    stock: 5,
    badge: '🔥 EXCLUSIVE DROP',
    desc: 'Limited edition streetwear. Only 5 units worldwide.',
  },
  {
    id: 2,
    name: 'Pro Wireless Earbuds',
    price: 4999,
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"%3E%3Crect fill="%23f0f8ff" width="300" height="300"/%3E%3Ccircle cx="100" cy="120" r="30" fill="%23333"/%3E%3Ccircle cx="100" cy="120" r="20" fill="%23666"/%3E%3Ccircle cx="200" cy="120" r="30" fill="%23333"/%3E%3Ccircle cx="200" cy="120" r="20" fill="%23666"/%3E%3Cpath d="M 100 150 Q 150 180 200 150" stroke="%23666" stroke-width="2" fill="none"/%3E%3Ctext x="150" y="210" font-size="18" font-weight="bold" fill="%23333" text-anchor="middle"%3EPro Earbuds%3C/text%3E%3Crect fill="%233b82f6" x="50" y="260" width="200" height="30" rx="5"/%3E%3Ctext x="150" y="275" font-size="16" font-weight="bold" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3E%E2%82%A94999%3C/text%3E%3C/svg%3E',
    category: 'Electronics',
    exclusive: false,
    stock: 120,
    badge: null,
    desc: 'Active noise cancellation with 36-hour battery life.',
  },
  {
    id: 3,
    name: 'Ultra Slim Laptop Stand',
    price: 1499,
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"%3E%3Crect fill="%23f0f8ff" width="300" height="300"/%3E%3Crect fill="%23c0c0c0" x="60" y="80" width="180" height="120" rx="8"/%3E%3Crect fill="%23808080" x="70" y="90" width="160" height="100"/%3E%3Ctext x="150" y="135" font-size="14" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3E16in Laptop%3C/text%3E%3Cpolygon points="80,210 220,210 200,240 100,240" fill="%23999"/%3E%3Ctext x="150" y="230" font-size="14" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3EAluminium%3C/text%3E%3Crect fill="%233b82f6" x="50" y="260" width="200" height="30" rx="5"/%3E%3Ctext x="150" y="275" font-size="16" font-weight="bold" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3E%E2%82%A91499%3C/text%3E%3C/svg%3E',
    category: 'Accessories',
    exclusive: false,
    stock: 85,
    badge: 'BESTSELLER',
    desc: 'Ergonomic aluminium stand for laptops up to 16".',
  },
  {
    id: 4,
    name: 'Limited Edition Sneakers',
    price: 8999,
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"%3E%3Crect fill="%23f0f8ff" width="300" height="300"/%3E%3Cellipse cx="110" cy="140" rx="35" ry="40" fill="%23e74c3c"/%3E%3Cellipse cx="110" cy="140" rx="20" ry="30" fill="%23c0392b"/%3E%3Cellipse cx="190" cy="140" rx="35" ry="40" fill="%232ecc71"/%3E%3Cellipse cx="190" cy="140" rx="20" ry="30" fill="%2327ae60"/%3E%3Crect fill="%23333" x="90" y="175" width="120" height="15" rx="8"/%3E%3Ctext x="150" y="215" font-size="18" font-weight="bold" fill="%23333" text-anchor="middle"%3ELim. Sneakers%3C/text%3E%3Crect fill="%233b82f6" x="50" y="260" width="200" height="30" rx="5"/%3E%3Ctext x="150" y="275" font-size="16" font-weight="bold" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3E%E2%82%A98999%3C/text%3E%3C/svg%3E',
    category: 'Exclusive',
    exclusive: true,
    stock: 3,
    badge: '🔥 EXCLUSIVE DROP',
    desc: 'Only 3 pairs available. Queue-protected checkout.',
  },
  {
    id: 5,
    name: 'Smart Water Bottle',
    price: 999,
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"%3E%3Crect fill="%23f0f8ff" width="300" height="300"/%3E%3Crect fill="%2387ceeb" x="100" y="70" width="100" height="140" rx="10"/%3E%3Crect fill="%2360a5fa" x="110" y="80" width="80" height="120"/%3E%3Crect fill="%23444" x="130" y="50" width="40" height="25" rx="5"/%3E%3Ctext x="150" y="125" font-size="16" fill="%23fff" text-anchor="middle" dominant-baseline="middle" font-weight="bold"%3E38°C%3C/text%3E%3Ctext x="150" y="220" font-size="18" font-weight="bold" fill="%23333" text-anchor="middle"%3ESmart Bottle%3C/text%3E%3Crect fill="%233b82f6" x="50" y="260" width="200" height="30" rx="5"/%3E%3Ctext x="150" y="275" font-size="16" font-weight="bold" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3E%E2%82%A9999%3C/text%3E%3C/svg%3E',
    category: 'Lifestyle',
    exclusive: false,
    stock: 200,
    badge: 'NEW',
    desc: 'Temperature tracking. Hydration reminders. LED display.',
  },
  {
    id: 6,
    name: 'Mechanical Keyboard RGB',
    price: 3499,
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"%3E%3Crect fill="%23f0f8ff" width="300" height="300"/%3E%3Crect fill="%23222" x="40" y="100" width="220" height="100" rx="8"/%3E%3Crect fill="%23ff00ff" x="60" y="120" width="15" height="15"/%3E%3Crect fill="%2300ff00" x="85" y="120" width="15" height="15"/%3E%3Crect fill="%230099ff" x="110" y="120" width="15" height="15"/%3E%3Crect fill="%23ffff00" x="135" y="120" width="15" height="15"/%3E%3Crect fill="%23ff00ff" x="60" y="150" width="15" height="15"/%3E%3Crect fill="%2300ff00" x="85" y="150" width="15" height="15"/%3E%3Crect fill="%230099ff" x="110" y="150" width="15" height="15"/%3E%3Crect fill="%23ffff00" x="135" y="150" width="15" height="15"/%3E%3Ctext x="150" y="230" font-size="16" font-weight="bold" fill="%23333" text-anchor="middle"%3ERGB Keyboard%3C/text%3E%3Crect fill="%233b82f6" x="50" y="260" width="200" height="30" rx="5"/%3E%3Ctext x="150" y="275" font-size="16" font-weight="bold" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3E%E2%82%A93499%3C/text%3E%3C/svg%3E',
    category: 'Electronics',
    exclusive: false,
    stock: 45,
    badge: null,
    desc: 'Hot-swappable keys with per-key RGB lighting.',
  },
  {
    id: 7,
    name: 'Designer Backpack',
    price: 5499,
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"%3E%3Crect fill="%23f0f8ff" width="300" height="300"/%3E%3Crect fill="%23000" x="70" y="60" width="160" height="150" rx="8"/%3E%3Crect fill="%23333" x="80" y="70" width="140" height="130"/%3E%3Crect fill="%236b4226" x="110" y="45" width="80" height="25"/%3E%3Ccircle cx="120" cy="85" r="12" fill="%231a1a1a"/%3E%3Ccircle cx="180" cy="85" r="12" fill="%231a1a1a"/%3E%3Ctext x="150" y="220" font-size="16" font-weight="bold" fill="%23333" text-anchor="middle"%3EDesigner Bag%3C/text%3E%3Crect fill="%233b82f6" x="50" y="260" width="200" height="30" rx="5"/%3E%3Ctext x="150" y="275" font-size="16" font-weight="bold" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3E%E2%82%A95499%3C/text%3E%3C/svg%3E',
    category: 'Exclusive',
    exclusive: true,
    stock: 8,
    badge: '🔥 EXCLUSIVE DROP',
    desc: 'Handcrafted limited run. Queue-based purchase only.',
  },
  {
    id: 8,
    name: 'USB-C Hub 7-in-1',
    price: 1999,
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"%3E%3Crect fill="%23f0f8ff" width="300" height="300"/%3E%3Crect fill="%23999" x="60" y="110" width="180" height="80" rx="10"/%3E%3Crect fill="%23ddd" x="70" y="120" width="160" height="60"/%3E%3Ccircle cx="90" cy="150" r="8" fill="%23333"/%3E%3Ccircle cx="115" cy="150" r="8" fill="%23333"/%3E%3Ccircle cx="140" cy="150" r="8" fill="%23333"/%3E%3Ccircle cx="165" cy="150" r="8" fill="%23333"/%3E%3Ccircle cx="190" cy="150" r="8" fill="%23333"/%3E%3Crect fill="%23333" x="200" y="140" width="20" height="20"/%3E%3Ctext x="150" y="220" font-size="16" font-weight="bold" fill="%23333" text-anchor="middle"%3EUSB-C Hub 7in1%3C/text%3E%3Crect fill="%233b82f6" x="50" y="260" width="200" height="30" rx="5"/%3E%3Ctext x="150" y="275" font-size="16" font-weight="bold" fill="%23fff" text-anchor="middle" dominant-baseline="middle"%3E%E2%82%A91999%3C/text%3E%3C/svg%3E',
    category: 'Electronics',
    exclusive: false,
    stock: 150,
    badge: 'POPULAR',
    desc: 'HDMI, SD card, USB 3.0, PD charging — all in one.',
  },
]

const CATEGORIES = ['All', 'Exclusive', 'Electronics', 'Accessories', 'Lifestyle']

const useStore = create((set, get) => ({
  products: PRODUCTS,
  categories: CATEGORIES,
  cart: [],
  orders: [],
  queue: [],

  addToCart: (productId) => {
    const { cart, products } = get()
    const existing = cart.find(item => item.productId === productId)
    if (existing) {
      set({ cart: cart.map(item =>
        item.productId === productId
          ? { ...item, qty: item.qty + 1 }
          : item
      )})
    } else {
      const product = products.find(p => p.id === productId)
      set({ cart: [...cart, { productId, qty: 1, name: product.name, price: product.price, image: product.image }] })
    }
  },

  removeFromCart: (productId) => {
    set({ cart: get().cart.filter(item => item.productId !== productId) })
  },

  updateQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeFromCart(productId)
      return
    }
    set({ cart: get().cart.map(item =>
      item.productId === productId ? { ...item, qty } : item
    )})
  },

  getCartTotal: () => {
    return get().cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  },

  getCartCount: () => {
    return get().cart.reduce((sum, item) => sum + item.qty, 0)
  },

  joinQueue: (productId) => {
    const { queue, products } = get()
    if (queue.find(q => q.productId === productId)) return
    const product = products.find(p => p.id === productId)
    const position = Math.floor(Math.random() * 200) + 50
    set({
      queue: [...queue, {
        productId,
        name: product.name,
        image: product.image,
        price: product.price,
        position,
        joinedAt: Date.now(),
        status: 'waiting',
      }]
    })
  },

  placeOrder: () => {
    const { cart, orders } = get()
    if (cart.length === 0) return
    const order = {
      id: 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      items: [...cart],
      total: get().getCartTotal(),
      status: 'confirmed',
      placedAt: Date.now(),
    }
    set({ orders: [...orders, order], cart: [] })
    return order
  },
}))

export default useStore
