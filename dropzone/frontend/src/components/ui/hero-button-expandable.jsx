import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, Globe2, Check, Loader2, ArrowRight } from 'lucide-react'

export default function HeroButtonExpandable() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [formState, setFormState] = useState('idle') // idle | loading | success

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormState('loading')
    setTimeout(() => setFormState('success'), 1500)
  }

  // If the form is closed, reset the state after a delay
  const closeFullscreen = () => {
    setIsExpanded(false)
    setTimeout(() => setFormState('idle'), 500)
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-white selection:bg-blue-100">
      {/* Background glow effects */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#e6f2ff] via-[#dbeafe] to-[#bfdbfe] blur-[120px] opacity-60" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#f8fafc] to-[#dbeafe] blur-[100px] opacity-40" />
      </div>

      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            className="relative z-10 flex flex-col items-center text-center max-w-4xl px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          >
            {/* Top Badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50/50 border border-blue-100 shadow-sm mb-8 backdrop-blur-sm"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-medium text-blue-900">New: Q3 Enterprise Report</span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]">
              Orchestrate your entire{' '}
              <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400">
                revenue engine
              </span>
            </h1>

            {/* Subtext */}
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
              Stop wrestling with disconnected tools. Nexus provides infrastructure to build, measure, and scale your digital products with enterprise-grade security.
            </p>

            {/* Expandable CTA Button */}
            <motion.button
              layoutId="expandable-card"
              onClick={() => setIsExpanded(true)}
              className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-full font-medium text-lg shadow-[0_0_40px_-10px_rgba(59,130,246,0.6)] hover:bg-blue-500 hover:shadow-[0_0_60px_-15px_rgba(59,130,246,0.8)] transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.span layoutId="btn-text">Start your journey</motion.span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
            initial={{ backgroundColor: 'rgba(255, 255, 255, 0)' }}
            animate={{ backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
            exit={{ backgroundColor: 'rgba(255, 255, 255, 0)' }}
          >
            <div className="absolute inset-0 backdrop-blur-md" onClick={closeFullscreen} />
            
            <motion.div
              layoutId="expandable-card"
              className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-blue-50"
              transition={{ type: 'spring', bounce: 0.15, duration: 0.7 }}
            >
              {/* Modal Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-[#eff6ff] to-[#e0f2fe] opacity-50 pointer-events-none" />

              {/* Close button */}
              <button
                onClick={closeFullscreen}
                className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/50 hover:bg-white text-slate-500 transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>

              {/* Left Side: Features & Testimonial */}
              <div className="relative z-10 w-full md:w-5/12 p-8 md:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-blue-100/50 bg-blue-50/30">
                <div>
                  <motion.h2 
                    layoutId="btn-text"
                    className="text-3xl font-bold text-slate-900 mb-8"
                  >
                    Ready to scale?
                  </motion.h2>

                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                        <BarChart3 size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg">Analytics First</h3>
                        <p className="text-slate-600 text-sm mt-1">Real-time insights across your entire revenue pipeline.</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
                        <Globe2 size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg">Global Edge Network</h3>
                        <p className="text-slate-600 text-sm mt-1">Deploy closer to your customers with sub-50ms latency.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Testimonial */}
                <div className="mt-12 pt-8 border-t border-blue-100/50">
                  <div className="flex gap-4 items-start">
                    <img 
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150" 
                      alt="Sarah Jenkins" 
                      className="w-12 h-12 rounded-full border border-white shadow-sm"
                    />
                    <div>
                      <p className="text-sm text-slate-700 italic font-medium leading-snug">
                        "Nexus helped us increase our deployment speed by 400% while maintaining absolute stability."
                      </p>
                      <p className="text-xs text-slate-500 mt-2 font-medium">— Sarah J., VP of Engineering</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Form */}
              <div className="relative z-10 w-full md:w-7/12 p-8 md:p-12 bg-white">
                <AnimatePresence mode="wait">
                  {formState === 'success' ? (
                    <motion.div 
                      key="success"
                      className="w-full h-full flex flex-col items-center justify-center text-center py-12"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', bounce: 0.5 }}
                    >
                      <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
                        <Check size={40} strokeWidth={3} />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">Request Received!</h3>
                      <p className="text-slate-600 max-w-sm mb-8">
                        Our enterprise team will reach out within 2 hours to schedule your personalized demo.
                      </p>
                      <button 
                        onClick={closeFullscreen}
                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                      >
                        Back to site
                      </button>
                    </motion.div>
                  ) : (
                    <motion.form 
                      key="form"
                      onSubmit={handleSubmit}
                      className="space-y-4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="mb-6">
                        <h3 className="text-2xl font-bold text-slate-900">Request a Demo</h3>
                        <p className="text-slate-500 text-sm mt-1">Tell us a bit about your needs to get started.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Full Name</label>
                          <input required type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Jane Doe" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Work Email</label>
                          <input required type="email" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="jane@company.com" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Company</label>
                          <input required type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Acme Corp" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Company Size</label>
                          <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-700">
                            <option>1-50 employees</option>
                            <option>51-200 employees</option>
                            <option>201-1000 employees</option>
                            <option>1000+ employees</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5 py-2">
                        <label className="text-sm font-medium text-slate-700">Project Needs</label>
                        <textarea rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none" placeholder="Tell us about the challenges you're trying to solve..." />
                      </div>

                      <button 
                        type="submit" 
                        disabled={formState === 'loading'}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-4 shadow-md shadow-slate-200"
                      >
                        {formState === 'loading' ? (
                          <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                        ) : (
                          'Submit Request'
                        )}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
