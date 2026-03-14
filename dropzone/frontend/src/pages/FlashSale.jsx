import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'
import useStore from '../stores/cartStore'
import Navbar from '../components/Navbar'
import ProductCard from '../components/ProductCard'
import './FlashSale.css'

export default function FlashSale() {
  const products = useStore(s => s.products)
  const categories = useStore(s => s.categories)

  const [activeCategory, setActiveCategory] = useState('All')

  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter(p => p.category === activeCategory)

  return (
    <div className="products-page">
      <Navbar />

      <div className="products-container">
        {/* Header */}
        <div className="products-header">
          <motion.h1
            className="products-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Shop All Products
          </motion.h1>
          <p className="products-subtitle">
            Exclusive drops are queue-protected. Regular items ship instantly.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="category-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
              {cat === 'Exclusive' && <Zap size={14} />}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="product-grid">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
