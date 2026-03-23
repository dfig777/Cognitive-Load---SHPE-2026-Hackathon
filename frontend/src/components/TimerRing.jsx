import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { fetchNudge } from '../utils/api'

const SIZE = 120
const STROKE = 8
const R = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * R

export default function TimerRing({ durationMinutes = 25, taskName = '', onComplete }) {
  const total = durationMinutes * 60
  const [remaining, setRemaining] = useState(total)
  const [running, setRunning] = useState(false)
  const [nudge, setNudge] = useState(null)

  const reset = useCallback(() => {
    setRemaining(total)
    setRunning(false)
    setNudge(null)
  }, [total])

  useEffect(() => { reset() }, [durationMinutes, reset])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(id)
          setRunning(false)
          onComplete?.()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, onComplete])

  // Contextual nudge when 20% over time
  useEffect(() => {
    if (!running || remaining > 0 || !taskName) return
    const elapsed = durationMinutes + Math.round((total - remaining) / 60)
    fetchNudge(taskName, elapsed)
      .then(d => setNudge(d.message))
      .catch(() => {})
  }, [remaining, running, taskName, durationMinutes, total])

  const progress = remaining / total
  const offset = CIRCUMFERENCE * (1 - progress)
  const mins = String(Math.floor(remaining / 60)).padStart(2, '0')
  const secs = String(remaining % 60).padStart(2, '0')

  const color = progress > 0.5 ? 'var(--accent-2)' : progress > 0.2 ? 'var(--accent)' : '#E07A5F'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="timer-ring">
          {/* Track */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R} stroke="var(--border)" strokeWidth={STROKE} />
          {/* Progress */}
          <circle
            cx={SIZE/2} cy={SIZE/2} r={R}
            stroke={color}
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text-primary)' }}>
            {mins}:{secs}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem' }} onClick={() => setRunning(r => !r)}>
          {running ? 'pause' : remaining === total ? 'start' : 'resume'}
        </button>
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem' }} onClick={reset}>
          reset
        </button>
      </div>

      {nudge && (
        <motion.p
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: '0.82rem', color: 'var(--text-secondary)',
            textAlign: 'center', maxWidth: 200,
            background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)',
            padding: '0.5rem 0.75rem',
          }}
        >
          {nudge}
        </motion.p>
      )}
    </div>
  )
}