import { motion } from 'framer-motion'

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
}

export default function Settings() {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          Settings
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          Adjust how NeuroFocus looks and behaves — changes apply instantly.
        </p>
      </div>

      {/* Reading & Display */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Reading & Display</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Font</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['Default (DM Sans)', 'OpenDyslexic', 'Atkinson Hyperlegible'].map(f => (
              <button key={f} className="btn btn-ghost" style={{ fontSize: '0.83rem' }}>{f}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Theme</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['Warm', 'Dark', 'High Contrast'].map(t => (
              <button key={t} className="btn btn-ghost" style={{ fontSize: '0.83rem' }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Focus & Timer */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Focus & Timer</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Timer length, granularity defaults, and more — built in Session 6
        </p>
      </div>

      <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Full settings panel built in Session 6
      </p>
    </motion.div>
  )
}
