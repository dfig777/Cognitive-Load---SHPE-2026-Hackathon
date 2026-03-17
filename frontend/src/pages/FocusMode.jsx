import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

export default function FocusMode() {
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.3 } }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      style={{
        height: '100vh',
        width: '100vw',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
        padding: '2rem',
      }}
      aria-label="Focus Mode"
    >
      {/* Timer placeholder */}
      <div style={{
        width: '220px',
        height: '220px',
        borderRadius: '50%',
        border: '4px solid var(--accent-2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--text-primary)' }}>
          25:00
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>minutes left</span>
      </div>

      {/* Current task placeholder */}
      <div style={{ textAlign: 'center', maxWidth: '420px' }}>
        <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Working on
        </p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-primary)' }}>
          Your current task will appear here
        </h2>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button className="btn btn-primary">Done</button>
        <button className="btn btn-ghost">Take a break</button>
        <button className="btn btn-ghost">Skip</button>
      </div>

      {/* Escape hatch */}
      <button
        className="btn btn-ghost"
        style={{ fontSize: '0.83rem', color: 'var(--text-muted)', border: 'none' }}
        aria-label="Everything is too much — get help"
      >
        Everything is too much
      </button>

      {/* Exit — top left */}
      <button
        className="btn btn-ghost"
        style={{ position: 'fixed', top: '1.5rem', left: '1.5rem', fontSize: '0.83rem' }}
        onClick={() => navigate('/tasks')}
        aria-label="Exit Focus Mode"
      >
        ← Exit Focus Mode
      </button>

      <p style={{ position: 'fixed', bottom: '1.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Full Focus Mode built in Session 4
      </p>
    </motion.div>
  )
}
