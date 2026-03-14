import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Play, Sparkles } from 'lucide-react'

const LOGOS = ['Zoom', 'Google', 'Adobe', 'Notion', 'Figma']

export default function IceHero() {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
  const sphereRef = useRef(null)

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    })
  }

  return (
    <section
      className="relative min-h-screen w-full overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(160deg, #F8FBFF 0%, #EAF6FF 60%, #DCEFFF 100%)' }}
      onMouseMove={handleMouseMove}
    >
      {/* ── subtle grid lines ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      />

      {/* ── god‑ray blobs ── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-32 right-0 w-[700px] h-[700px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, #BFDBFE 0%, #93C5FD 40%, transparent 70%)',
            filter: 'blur(80px)',
            transform: `translate(${(mousePos.x - 0.5) * 30}px, ${(mousePos.y - 0.5) * 20}px)`,
            transition: 'transform 0.6s ease-out'
          }}
        />
        <div
          className="absolute top-1/2 right-[10%] w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #60A5FA, transparent 70%)',
            filter: 'blur(60px)'
          }}
        />
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 flex-1 flex items-center max-w-7xl mx-auto w-full px-6 lg:px-12 pt-28 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center w-full">

          {/* ───── LEFT: Text ───── */}
          <div className="flex flex-col gap-7">
            {/* badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 self-start px-4 py-1.5 rounded-full border border-blue-200 bg-white/60 backdrop-blur-sm shadow-sm"
            >
              <Sparkles size={14} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-700 tracking-wider uppercase">AI-Powered Platform</span>
            </motion.div>

            {/* heading */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <h1 className="text-6xl lg:text-7xl xl:text-8xl font-black leading-[1.02] tracking-tight text-slate-900">
                Visionary
                <br />
                <span
                  className="text-transparent bg-clip-text italic"
                  style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #38BDF8 100%)' }}
                >
                  Intelligence
                </span>
              </h1>
            </motion.div>

            {/* subtext */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-slate-500 leading-relaxed max-w-md"
            >
              AI-powered tools designed with visionary intelligence, helping modern teams build, analyze, and scale faster.
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <Link to="/sale">
                <button
                  className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white text-base overflow-hidden transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)',
                    boxShadow: '0 4px 24px rgba(59,130,246,0.35)'
                  }}
                >
                  <span className="relative z-10">Free Consultation</span>
                  <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                  {/* hover shimmer */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'linear-gradient(135deg, #93C5FD 0%, #60A5FA 100%)' }}
                  />
                </button>
              </Link>

              <button className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-slate-700 text-base bg-white/70 border border-blue-100 hover:bg-white hover:border-blue-200 backdrop-blur-sm transition-all duration-200 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                  <Play size={12} className="text-blue-600 translate-x-0.5" />
                </div>
                Watch Demo
              </button>
            </motion.div>

            {/* social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center gap-3"
            >
              <div className="flex -space-x-2.5">
                {['#60A5FA', '#93C5FD', '#BFDBFE', '#38BDF8'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white" style={{ background: `radial-gradient(circle at 30% 30%, white, ${c})` }} />
                ))}
              </div>
              <span className="text-sm text-slate-500 font-medium">
                <strong className="text-slate-700">430+</strong> Trustbase
              </span>
            </motion.div>
          </div>

          {/* ───── RIGHT: Ice Sphere ───── */}
          <motion.div
            ref={sphereRef}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="flex items-center justify-center relative"
            style={{ minHeight: '480px' }}
          >
            {/* Outer glow halo */}
            <div
              className="absolute w-[420px] h-[420px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(147,197,253,0.25) 0%, rgba(96,165,250,0.1) 50%, transparent 70%)',
                filter: 'blur(30px)',
                transform: `translate(${(mousePos.x - 0.5) * -15}px, ${(mousePos.y - 0.5) * -10}px)`,
                transition: 'transform 0.8s ease-out'
              }}
            />

            {/* The sphere itself */}
            <motion.div
              animate={{ y: [0, -16, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-[340px] h-[340px] lg:w-[400px] lg:h-[400px] rounded-full flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #DBEAFE 20%, #93C5FD 55%, #60A5FA 80%, #3B82F6 100%)',
                boxShadow: `
                  0 0 80px rgba(96,165,250,0.35),
                  0 0 160px rgba(59,130,246,0.2),
                  inset 0 0 60px rgba(255,255,255,0.4),
                  inset -20px -20px 60px rgba(59,130,246,0.3)
                `,
                transform: `perspective(800px) rotateX(${(mousePos.y - 0.5) * 12}deg) rotateY(${(mousePos.x - 0.5) * -12}deg)`,
                transition: 'transform 0.4s ease-out'
              }}
            >
              {/* Inner frosted highlight */}
              <div
                className="absolute w-[55%] h-[45%] rounded-full top-[12%] left-[18%]"
                style={{
                  background: 'radial-gradient(ellipse, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.2) 60%, transparent 100%)',
                  filter: 'blur(6px)'
                }}
              />

              {/* Vertical light streaks */}
              {[30, 50, 70].map((left, i) => (
                <div
                  key={i}
                  className="absolute h-[60%] rounded-full top-[20%]"
                  style={{
                    left: `${left}%`,
                    width: i === 1 ? '3px' : '2px',
                    background: `linear-gradient(180deg, transparent, rgba(255,255,255,${i === 1 ? 0.7 : 0.35}), transparent)`,
                    filter: 'blur(1px)'
                  }}
                />
              ))}

              {/* Bottom rim light */}
              <div
                className="absolute bottom-[10%] left-[20%] right-[20%] h-[8px] rounded-full"
                style={{
                  background: 'radial-gradient(ellipse, rgba(56,189,248,0.5) 0%, transparent 100%)',
                  filter: 'blur(4px)'
                }}
              />

              {/* Image on top of sphere */}
              <motion.img
                src="/developers.png"
                alt="Team"
                className="absolute w-[85%] h-[85%] object-cover rounded-full"
                style={{
                  zIndex: 5,
                  boxShadow: 'inset 0 0 30px rgba(59,130,246,0.2)'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </motion.div>

            {/* Light rays behind sphere */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: `
                  conic-gradient(from 200deg at 50% 50%,
                    transparent 0deg, rgba(147,197,253,0.08) 15deg,
                    transparent 30deg, rgba(96,165,250,0.06) 50deg,
                    transparent 80deg, rgba(147,197,253,0.05) 100deg,
                    transparent 130deg)
                `,
                transform: 'scale(1.8)',
                filter: 'blur(20px)'
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* ── LOGO BAR ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="relative z-10 border-t border-blue-100/60 px-6 lg:px-12 py-6"
        style={{ background: 'rgba(248,251,255,0.8)', backdropFilter: 'blur(10px)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">Trusted by teams at</p>
          <div className="flex items-center gap-8 flex-wrap justify-center sm:justify-start">
            {LOGOS.map(logo => (
              <span
                key={logo}
                className="text-base font-bold tracking-tight"
                style={{ color: '#94A3B8' }}
              >
                {logo}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  )
}
