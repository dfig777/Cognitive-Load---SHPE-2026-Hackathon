import { useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { summariseActions } from '../store'
import { summariseStream, explainSentence } from '../utils/api'
import { bionicify } from '../utils/bionic'

function SentenceWithTooltip({ text }) {
  const [tooltip, setTooltip] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleHover() {
    if (tooltip || loading) return
    setLoading(true)
    try {
      const res = await explainSentence(text)
      setTooltip(res)
    } catch {}
    setLoading(false)
  }

  return (
    <span
      className="tooltip-wrapper"
      onMouseEnter={handleHover}
      style={{ borderBottom: '1px dashed var(--border)', cursor: 'help' }}
    >
      {text}{' '}
      {tooltip && (
        <span className="tooltip-box" role="tooltip">
          <strong>Why simplified:</strong> {tooltip.reason}<br />
          <em>{tooltip.simplified}</em>
        </span>
      )}
    </span>
  )
}

function renderOutput(text, bionicReading) {
  // Split into sentences for tooltip support
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text]
  return sentences.map((s, i) => {
    const content = bionicReading ? bionicify(s.trim()) : s
    return <SentenceWithTooltip key={i} text={s.trim()} />
  })
}

export default function Refactor() {
  const dispatch = useDispatch()
  const { output, streaming, error } = useSelector(s => s.summarise)
  const prefs = useSelector(s => s.prefs)
  const [input, setInput] = useState('')
  const abortRef = useRef(null)

  async function handleRefactor() {
    if (!input.trim() || streaming) return
    dispatch(summariseActions.startStream())
    await summariseStream(
      { text: input, reading_level: prefs.readingLevel },
      chunk => dispatch(summariseActions.appendChunk(chunk)),
      () => dispatch(summariseActions.endStream()),
      err => dispatch(summariseActions.setError(err)),
    )
  }

  return (
    <div className="card" style={{ flex: 1 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '1rem' }}>
        Refactor Text
      </h2>

      <textarea
        rows={6}
        placeholder="Paste any text — an article, email, instructions — and we'll make it clearer for you."
        value={input}
        onChange={e => setInput(e.target.value)}
        style={{ marginBottom: '0.75rem' }}
        aria-label="Text to simplify"
      />

      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleRefactor} disabled={streaming || !input.trim()}>
          {streaming ? 'Simplifying…' : 'Simplify'}
        </button>
        {output && (
          <button className="btn btn-ghost" onClick={() => dispatch(summariseActions.clear())}>
            Clear
          </button>
        )}
      </div>

      {error && (
        <p style={{ color: 'var(--text-secondary)', background: 'var(--accent-soft)',
          padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }}>
          {error}
        </p>
      )}

      {(output || streaming) && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem 1.25rem',
            fontSize: '1rem',
            lineHeight: 'var(--line-height)',
            letterSpacing: 'var(--letter-spacing)',
          }}
          aria-live="polite"
          aria-atomic="false"
        >
          {prefs.bionicReading
            ? bionicify(output)
            : output
          }
          {streaming && <span className="streaming-cursor" aria-hidden="true" />}
        </motion.div>
      )}
    </div>
  )
}