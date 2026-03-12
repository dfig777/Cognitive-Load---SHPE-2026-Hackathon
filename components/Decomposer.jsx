import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { tasksActions } from '../store'
import { decompose, createSession } from '../utils/api'
import TimerRing from './TimerRing'

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Decomposer() {
  const dispatch = useDispatch()
  const { goal, steps, loading, error } = useSelector(s => s.tasks)
  const prefs = useSelector(s => s.prefs)
  const [localGoal, setLocalGoal] = useState('')
  const [activeStep, setActiveStep] = useState(null)

  async function handleDecompose() {
    if (!localGoal.trim()) return
    dispatch(tasksActions.setGoal(localGoal))
    dispatch(tasksActions.setLoading(true))
    dispatch(tasksActions.setError(null))
    try {
      const res = await decompose({ goal: localGoal, granularity: prefs.granularity })
      dispatch(tasksActions.setSteps(res.steps))
      // Persist session
      await createSession({ goal: localGoal, steps: res.steps }).catch(() => {})
    } catch (e) {
      dispatch(tasksActions.setError(e.message))
    } finally {
      dispatch(tasksActions.setLoading(false))
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDecompose() }
  }

  const done = steps.filter(s => s.done).length

  return (
    <div className="card" style={{ flex: 1 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
        Task Decomposer
      </h2>

      {/* Goal input */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <textarea
          rows={2}
          placeholder="What do you want to get done? e.g. Study for my biology exam"
          value={localGoal}
          onChange={e => setLocalGoal(e.target.value)}
          onKeyDown={handleKey}
          aria-label="Enter your goal"
          style={{ resize: 'none', flex: 1 }}
        />
        <button
          className="btn btn-primary"
          onClick={handleDecompose}
          disabled={loading || !localGoal.trim()}
          aria-busy={loading}
          style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
        >
          {loading ? 'Breaking it down…' : 'Break it down'}
        </button>
      </div>

      {/* Calm error */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ padding: '0.75rem 1rem', background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          We're taking a tiny break — {error}
        </motion.div>
      )}

      {/* Progress bar */}
      {steps.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            <span>{done} of {steps.length} steps complete</span>
            <span>{Math.round((done / steps.length) * 100)}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', background: 'var(--accent-2)', borderRadius: 99 }}
              animate={{ width: `${(done / steps.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      {/* Step list */}
      <AnimatePresence>
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`step-item ${step.done ? 'done' : ''} ${activeStep === i ? 'active' : ''}`}
            onClick={() => setActiveStep(activeStep === i ? null : i)}
            role="button"
            tabIndex={0}
            aria-expanded={activeStep === i}
            onKeyDown={e => e.key === 'Enter' && setActiveStep(activeStep === i ? null : i)}
          >
            {/* Checkbox */}
            <div
              className={`step-checkbox ${step.done ? 'checked' : ''}`}
              onClick={e => { e.stopPropagation(); dispatch(tasksActions.toggleStep(i)) }}
              role="checkbox"
              aria-checked={step.done}
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && dispatch(tasksActions.toggleStep(i))}
            >
              {step.done && <CheckIcon />}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 500, fontSize: '0.95rem', color: step.done ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: step.done ? 'line-through' : 'none' }}>
                  {step.task_name}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.5rem', flexShrink: 0 }}>
                  {step.duration_minutes} min
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                {step.motivation_nudge}
              </p>

              {/* Timer — only shown when expanded */}
              <AnimatePresence>
                {activeStep === i && !step.done && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden', marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}
                  >
                    <TimerRing
                      durationMinutes={step.duration_minutes}
                      taskName={step.task_name}
                      onComplete={() => dispatch(tasksActions.toggleStep(i))}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {steps.length > 0 && (
        <button
          className="btn btn-ghost"
          style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}
          onClick={() => { dispatch(tasksActions.clearTasks()); setLocalGoal('') }}
        >
          Start fresh
        </button>
      )}
    </div>
  )
}