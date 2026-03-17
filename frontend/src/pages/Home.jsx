import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.12 } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
}

const itemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
}

export default function Home() {
  const navigate = useNavigate()
  const greeting = getGreeting()

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: '4rem 2rem',
        gap: '2rem',
        maxWidth: '560px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Greeting */}
      <motion.div variants={itemVariants} style={{ textAlign: 'center' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2.1rem',
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
          lineHeight: 1.2,
        }}>
          Good {greeting}, Diego.
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          What would you like to work on?
        </p>
      </motion.div>

      {/* Quick action buttons */}
      <motion.div
        variants={itemVariants}
        style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}
      >
        <button
          className="btn"
          style={{
            background: 'var(--accent-soft)',
            color: 'var(--color-active)',
            border: '1.5px solid rgba(42,122,144,0.2)',
            fontSize: '0.88rem',
          }}
          onClick={() => navigate('/documents')}
        >
          I have a document
        </button>
        <button
          className="btn"
          style={{
            background: 'rgba(200,148,80,0.1)',
            color: 'var(--color-ai)',
            border: '1.5px solid rgba(200,148,80,0.2)',
            fontSize: '0.88rem',
          }}
          onClick={() => navigate('/tasks')}
        >
          Break down a task
        </button>
        <button
          className="btn"
          style={{
            background: 'var(--accent-2-soft)',
            color: 'var(--color-done)',
            border: '1.5px solid rgba(80,148,106,0.2)',
            fontSize: '0.88rem',
          }}
          onClick={() => navigate('/focus')}
        >
          Start focus mode
        </button>
      </motion.div>

      {/* Chat input */}
      <motion.div
        variants={itemVariants}
        style={{ width: '100%', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}
      >
        <textarea
          placeholder="What's on your mind?"
          rows={2}
          style={{ resize: 'none', flex: 1, borderRadius: '12px' }}
          aria-label="Chat input"
        />
        <button className="btn btn-primary" aria-label="Send message">
          Send
        </button>
      </motion.div>
    </motion.div>
  )
}
