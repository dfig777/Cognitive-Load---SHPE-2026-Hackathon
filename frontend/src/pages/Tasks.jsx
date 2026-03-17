import { motion } from 'framer-motion'

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
}

export default function Tasks() {
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
          My Tasks
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          Break any goal into calm, time-boxed steps you can actually do.
        </p>
      </div>

      {/* Goal input placeholder */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>What do you want to get done?</p>
        <textarea
          placeholder="e.g. Write my lab report introduction, prepare for tomorrow's presentation…"
          rows={3}
          style={{ resize: 'none' }}
          aria-label="Describe your goal"
        />
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-primary">Break it down</button>
          <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>Granularity:</span>
          {['Micro', 'Normal', 'Broad'].map(g => (
            <button key={g} className="btn btn-ghost" style={{ fontSize: '0.83rem', padding: '0.35rem 0.75rem' }}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Task list placeholder */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {[
          'Step 1 will appear here',
          'Step 2 will appear here',
          'Step 3 will appear here',
        ].map((label, i) => (
          <div key={i} className="step-item" style={{ opacity: 0.4 }}>
            <div className="step-checkbox" aria-hidden="true" />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Full task decomposer built in Session 3
      </p>
    </motion.div>
  )
}
