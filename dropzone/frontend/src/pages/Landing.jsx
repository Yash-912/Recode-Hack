import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Shield, ListOrdered, XCircle, ArrowRight, Play } from 'lucide-react'
import Navbar from '../components/Navbar'
import IceHero from '../components/IceHero'
import './Landing.css'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' },
  }),
}

const MARQUEE_ITEMS = [
  'HIGH TRAFFIC READY', 'FLASH SALE ENGINE', 'ATOMIC INVENTORY LOCK',
  'QUEUE CHECKOUT', 'REAL-TIME STOCK UPDATES', 'ZERO OVERSELLING',
  'FAIR PURCHASE ORDER', 'HIGH TRAFFIC READY', 'FLASH SALE ENGINE',
  'ATOMIC INVENTORY LOCK', 'QUEUE CHECKOUT', 'REAL-TIME STOCK UPDATES',
  'ZERO OVERSELLING', 'FAIR PURCHASE ORDER',
]

function getTimeLeft(target) {
  const diff = Math.max(0, target - Date.now())
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

function pad(n) {
  return n.toString().padStart(2, '0')
}

export default function Landing() {
  const [targetDate] = useState(() => Date.now() + 7 * 24 * 60 * 60 * 1000)
  const [time, setTime] = useState(() => getTimeLeft(Date.now() + 7 * 24 * 60 * 60 * 1000))

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(getTimeLeft(targetDate))
    }, 1000)
    return () => clearInterval(timer)
  }, [targetDate])

  const digits = [
    { label: 'DAYS', value: pad(time.days) },
    { label: 'HOURS', value: pad(time.hours) },
    { label: 'MINUTES', value: pad(time.minutes) },
    { label: 'SECONDS', value: pad(time.seconds) },
  ]

  return (
    <div className="landing">
      <Navbar />

      <IceHero />

      {/* ==================== COUNTDOWN ==================== */}
      <section className="countdown-section">
        <motion.div
          className="countdown-container"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="countdown-label">LAUNCHING IN</p>
          <div className="countdown-clock">
            {digits.map((unit, i) => (
              <div key={unit.label} className="countdown-unit">
                <div className="countdown-digits">
                  {unit.value.split('').map((d, j) => (
                    <div key={j} className="flip-card">
                      <span className="flip-digit">{d}</span>
                    </div>
                  ))}
                </div>
                <span className="countdown-unit-label">{unit.label}</span>
                {i < digits.length - 1 && <span className="countdown-colon">:</span>}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ==================== PHOTO + TRUST SECTION ==================== */}
      <section className="hero-bottom">
        <div className="hero-bottom-inner">
          {/* Left Card — Dark with marquee + trust */}
          <div className="bottom-card-left">
            {/* Marquee Overlay */}
            <div className="card-marquee-section">
              <div className="card-marquee-row">
                <div className="card-marquee-track">
                  {MARQUEE_ITEMS.map((item, i) => (
                    <span key={`a-${i}`} className="card-marquee-item">{item}</span>
                  ))}
                </div>
              </div>
              <div className="card-marquee-row faded">
                <div className="card-marquee-track reverse">
                  {MARQUEE_ITEMS.map((item, i) => (
                    <span key={`b-${i}`} className="card-marquee-item">{item}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Trust Section */}
            <div className="card-trust">
              <p className="trust-label">★ TRUSTED BY ONLINE SELLERS</p>
              <div className="trust-logos-row">
                <span className="trust-logo-item">Stripe</span>
                <span className="trust-logo-item">Shopify</span>
                <span className="trust-logo-item">Amazon Pay</span>
              </div>
              <div className="trust-logos-row">
                <span className="trust-logo-item">Razorpay</span>
                <span className="trust-logo-item">Flipkart sellers</span>
              </div>
              <div className="trust-bottom">
                <div className="avatar-stack">
                  <div className="avatar-circle">🛒</div>
                  <div className="avatar-circle">📦</div>
                  <div className="avatar-circle">💳</div>
                  <div className="avatar-circle">🚀</div>
                </div>
                <div className="trust-stat">
                  <strong>10,000+</strong>
                  <span>Concurrent checkouts handled</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Card — Photo */}
          <div className="bottom-card-right">
            <img src="/shopping.png" alt="People shopping online" />
          </div>
        </div>
      </section>

      {/* ==================== FEATURES ==================== */}
      <section className="features-section">
        <div className="features-container">
          <motion.div
            className="features-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="section-badge">Core Innovation</span>
            <h2 className="section-title">Three ideas. Zero overselling.</h2>
            <p className="section-subtitle">
              DropCart is built around three core ideas that make flash sales bulletproof.
            </p>
          </motion.div>

          <div className="features-grid">
            {[
              {
                icon: <Shield size={28} />,
                title: 'Atomic Inventory Lock',
                desc: 'A Redis Lua script that makes check-and-decrement a single, uninterruptible operation. Inventory cannot go below zero. Ever.',
                color: 'var(--accent-blue)',
              },
              {
                icon: <ListOrdered size={28} />,
                title: 'Queue Checkout',
                desc: 'Checkout requests enter a FIFO queue. First-come, first-served — regardless of server load or thread scheduling.',
                color: 'var(--accent-green)',
              },
              {
                icon: <XCircle size={28} />,
                title: 'Graceful Rejection',
                desc: 'Shoppers who miss out get a clear, immediate "Sold Out" response. No ambiguity. No partial state. Offer a waitlist slot.',
                color: 'var(--accent-red)',
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                className="feature-card"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
              >
                <div className="feature-icon" style={{ color: feature.color }}>
                  {feature.icon}
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section className="how-section">
        <div className="how-container">
          <motion.div
            className="how-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="section-badge dark">The Flow</span>
            <h2 className="section-title light">See the difference live.</h2>
            <p className="section-subtitle light">
              Toggle between Naive Mode and Protected Mode to see exactly why traditional ecommerce systems fail under load.
            </p>
          </motion.div>

          <motion.div
            className="how-cta-row"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
          >
            <Link to="/demo" className="how-btn primary">
              <Play size={18} />
              Run the Demo
            </Link>
            <Link to="/architecture" className="how-btn secondary">
              View Architecture
              <ArrowRight size={18} />
            </Link>
          </motion.div>

          <div className="how-comparison">
            <motion.div
              className="how-panel naive"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="how-panel-header">
                <span className="panel-label red">✗ Without Inventory Lock</span>
              </div>
              <div className="how-panel-body">
                <div className="stat-row">
                  <span>Final Stock</span>
                  <span className="stat-value red">-47</span>
                </div>
                <div className="stat-row">
                  <span>Confirmed Orders</span>
                  <span className="stat-value red">57</span>
                </div>
                <div className="stat-row">
                  <span>Items Available</span>
                  <span className="stat-value">10</span>
                </div>
                <div className="verdict red">BROKEN — 47 impossible orders</div>
              </div>
            </motion.div>

            <div className="how-vs">VS</div>

            <motion.div
              className="how-panel protected"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="how-panel-header">
                <span className="panel-label green">✓ With DropCart</span>
              </div>
              <div className="how-panel-body">
                <div className="stat-row">
                  <span>Final Stock</span>
                  <span className="stat-value green">0</span>
                </div>
                <div className="stat-row">
                  <span>Confirmed Orders</span>
                  <span className="stat-value green">10</span>
                </div>
                <div className="stat-row">
                  <span>Clean Rejections</span>
                  <span className="stat-value green">490</span>
                </div>
                <div className="verdict green">PERFECT — Exactly 10 orders</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER CTA ==================== */}
      <section className="footer-cta">
        <div className="footer-cta-inner">
          <motion.h2
            className="footer-cta-title"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            Ready to see it in action?
          </motion.h2>
          <motion.div
            className="footer-cta-buttons"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
          >
            <Link to="/sale" className="btn-primary-xl">
              <Zap size={20} />
              Try the Flash Sale
            </Link>
            <Link to="/admin" className="btn-secondary-xl">
              Open Dashboard
              <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span>⚡</span>
            <span>DropCart</span>
          </div>
          <p className="footer-text">
            Built for The Midnight Product Drop · PS 2 · Hackathon Edition
          </p>
        </div>
      </footer>
    </div>
  )
}
