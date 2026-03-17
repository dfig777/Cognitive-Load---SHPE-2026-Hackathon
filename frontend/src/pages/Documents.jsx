import { useRef } from 'react'
import { motion } from 'framer-motion'

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.12 } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
}

const itemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
}

export default function Documents() {
  const fileInputRef = useRef(null)

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
        padding: '4rem 2rem',
        gap: '1.5rem',
        maxWidth: '720px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Heading */}
      <motion.div variants={itemVariants} style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.75rem',
          color: 'var(--text-primary)',
          marginBottom: '0.4rem',
        }}>
          Share what's overwhelming you.
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          We'll make it make sense.
        </p>
      </motion.div>

      {/* Upload zone with breathing animation */}
      <motion.div variants={itemVariants} style={{ width: '100%' }}>
        <div className="upload-zone">
          <textarea
            placeholder="Paste text, drop a file, or describe what you need help with..."
            rows={9}
            style={{
              resize: 'none',
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: '1.25rem',
              fontSize: '0.95rem',
              outline: 'none',
              color: 'var(--text-primary)',
              display: 'block',
            }}
            aria-label="Paste or describe document content"
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border)',
          }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.83rem', padding: '0.35rem 0.75rem', gap: '0.3rem' }}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload file"
            >
              + Upload file
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PDF, Word, image</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.png,.jpg,.tiff"
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            <button className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
              Go
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
