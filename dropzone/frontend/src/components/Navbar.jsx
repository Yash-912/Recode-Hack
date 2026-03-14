import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Search, ShoppingCart, User, Menu, X, Zap } from 'lucide-react'
import useStore from '../stores/cartStore'
import './Navbar.css'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const cartCount = useStore(state => state.getCartCount())

  const links = [
    { to: '/', label: 'Home' },
    { to: '/sale', label: 'Products' },
    { to: '/demo', label: 'Flash Deals' },
    { to: '/dashboard', label: 'Orders' },
    { to: '/architecture', label: 'How It Works' },
  ]

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">⚡</span>
          <span>DropCart</span>
        </Link>

        {/* Nav links */}
        <div className={`navbar-links ${menuOpen ? 'open' : ''}`} role="navigation" aria-label="Main navigation">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`navbar-link ${location.pathname === link.to ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
              aria-current={location.pathname === link.to ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side: Search + Cart + Account + CTA */}
        <div className="navbar-actions">
          {/* Search */}
          <div className={`navbar-search ${searchOpen ? 'open' : ''}`}>
            <input
              type="text"
              placeholder="Search products..."
              className="search-input"
              aria-label="Search products"
            />
          </div>
          <button
            className="navbar-icon-btn"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            aria-expanded={searchOpen}
          >
            <Search size={20} />
          </button>

          {/* Cart */}
          <Link 
            to="/dashboard" 
            className="navbar-icon-btn cart-btn"
            aria-label={`View shopping cart (${cartCount} items)`}
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="cart-badge" aria-label={`${cartCount} items in cart`}>{cartCount}</span>
            )}
          </Link>

          {/* Account */}
          <button className="navbar-icon-btn" aria-label="Account">
            <User size={20} />
          </button>

          {/* CTA */}
          <Link to="/sale" className="navbar-cta">
            Start Shopping
            <span className="cta-arrow">→</span>
          </Link>

          {/* Mobile menu */}
          <button
            className="navbar-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </nav>
  )
}
