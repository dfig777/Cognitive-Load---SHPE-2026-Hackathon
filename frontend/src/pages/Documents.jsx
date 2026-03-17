import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { tasksActions } from '../store'
import { uploadDocument, summariseStream, explainSentence, decompose } from '../utils/api'
import { bionicify } from '../utils/bionic'

// ── Constants ─────────────────────────────────────────────────────────────── //

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/png',
  'image/jpeg',
])
const MAX_BYTES = 20 * 1024 * 1024

const CHOICES = [
  { id: 'actions',    dot: 'var(--color-active)',   title: 'Just tell me what I need to do',  sub: 'Pull out the action items and deadlines only' },
  { id: 'simplify',   dot: 'var(--color-done)',     title: 'Make it easier to read',          sub: 'Simplify the language and shorten it' },
  { id: 'highlights', dot: 'var(--color-upcoming)', title: 'Show me what matters most',       sub: 'Highlight the key sections I should focus on' },
  { id: 'auto',       dot: 'var(--color-paused)',   title: "I'm not sure, just help me",      sub: "I'll figure out the best way to show it for you" },
]

// ── Animation variants ────────────────────────────────────────────────────── //

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
}

const stagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.09 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

// ── Sub-components ────────────────────────────────────────────────────────── //

function NAvatar({ orange = false, size = 26 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: orange ? 'rgba(200,148,80,0.15)' : 'var(--accent-soft)',
      color: orange ? 'var(--color-ai)' : 'var(--accent)',
      fontSize: '0.68rem', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1.5px solid var(--border)',
    }}>
      N
    </div>
  )
}

function UserAvatar({ size = 26 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--accent-2-soft)', color: 'var(--color-done)',
      fontSize: '0.68rem', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1.5px solid var(--border)',
    }}>
      D
    </div>
  )
}

function AIBubble({ children, orange = false }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <NAvatar orange={orange} />
      <div style={{
        flex: 1,
        background: orange ? 'rgba(200,148,80,0.07)' : 'var(--bg-card)',
        border: `1px solid ${orange ? 'rgba(200,148,80,0.2)' : 'var(--border)'}`,
        borderRadius: '12px',
        padding: '0.9rem 1.1rem',
        fontSize: '0.9rem',
        color: 'var(--text-primary)',
        lineHeight: 1.65,
      }}>
        {children}
      </div>
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexDirection: 'row-reverse' }}>
      <UserAvatar />
      <div style={{
        background: 'var(--accent-2-soft)',
        border: '1px solid rgba(80,148,106,0.2)',
        borderRadius: '12px',
        padding: '0.9rem 1.1rem',
        fontSize: '0.9rem',
        color: 'var(--text-primary)',
        lineHeight: 1.65,
        maxWidth: '80%',
      }}>
        {text}
      </div>
    </div>
  )
}

// Sentence with dashed underline + explain tooltip (adapted from Refactor.jsx)
function SentenceTooltip({ text }) {
  const [tip, setTip] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleHover() {
    if (tip || loading) return
    setLoading(true)
    try {
      const res = await explainSentence(text)
      if (!res.flagged) setTip(res)
    } catch {}
    setLoading(false)
  }

  return (
    <span
      className="tooltip-wrapper"
      onMouseEnter={handleHover}
      style={{ borderBottom: '1.5px dashed var(--color-active)', cursor: 'help' }}
    >
      {text}{' '}
      {tip && (
        <span className="tooltip-box" role="tooltip">
          <strong>Why simplified:</strong> {tip.reason}<br />
          <em>{tip.simplified}</em>
        </span>
      )}
    </span>
  )
}

function renderSimplified(text, bionicMode) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text]
  return sentences.map((s, i) => {
    const trimmed = s.trim()
    if (!trimmed) return null
    return bionicMode
      ? <span key={i}>{bionicify(trimmed)}{' '}</span>
      : <SentenceTooltip key={i} text={trimmed} />
  })
}

// ── Main component ────────────────────────────────────────────────────────── //

export default function Documents() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const prefs = useSelector(s => s.prefs)
  const fileInputRef = useRef(null)

  // Phase: 'input' | 'question' | 'results'
  const [phase, setPhase] = useState('input')

  // Input phase
  const [inputText, setInputText] = useState('')
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Shared document data (set after "Go")
  const [docText, setDocText] = useState('')
  const [docName, setDocName] = useState('')
  const [pageCount, setPageCount] = useState(null)
  const [aiDesc, setAiDesc] = useState('')

  // Results
  const [chosenMode, setChosenMode] = useState(null)
  const [actionItems, setActionItems] = useState([])
  const [streamText, setStreamText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [bionicMode, setBionicMode] = useState(false)

  // Q&A
  const [qaMessages, setQaMessages] = useState([])
  const [qaInput, setQaInput] = useState('')
  const [qaStreaming, setQaStreaming] = useState(false)

  // ── File validation ──────────────────────────────────────────────────── //

  function validateFile(f) {
    if (!ACCEPTED_MIME.has(f.type)) return "I can work with PDFs, Word docs, and images. Try one of those?"
    if (f.size > MAX_BYTES) return "That file is a bit large. Try one under 20MB?"
    return null
  }

  function attachFile(f) {
    const err = validateFile(f)
    if (err) { setFileError(err); return }
    setFileError(null)
    setFile(f)
    setDocName(f.name)
    setInputText('')
  }

  // ── Drag & drop ──────────────────────────────────────────────────────── //

  function handleDragOver(e) { e.preventDefault(); setIsDragging(true) }
  function handleDragLeave(e) { e.preventDefault(); setIsDragging(false) }
  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) attachFile(dropped)
  }

  // ── Go → State 2 ────────────────────────────────────────────────────── //

  async function handleGo() {
    if (isLoading) return
    setIsLoading(true)
    setFileError(null)
    try {
      if (file) {
        const res = await uploadDocument(file)
        if (res.flagged) {
          setFileError(res.message || "This content couldn't be processed right now.")
          setIsLoading(false)
          return
        }
        const text = res.text || ''
        const pages = res.page_count || 1
        const ext = file.name.split('.').pop().toUpperCase()
        setDocText(text)
        setPageCount(pages)
        setAiDesc(`This looks like a ${ext} document, ${pages} page${pages !== 1 ? 's' : ''} long. What would help you most right now?`)
      } else {
        const words = inputText.trim().split(/\s+/).filter(Boolean).length
        setDocText(inputText.trim())
        setDocName('Pasted text')
        setAiDesc(`I can see about ${words} word${words !== 1 ? 's' : ''} here. What would help you most right now?`)
      }
      setPhase('question')
    } catch {
      setFileError("Something went quiet. Try again or paste the text directly.")
    }
    setIsLoading(false)
  }

  // ── Mode selection → State 3 ─────────────────────────────────────────── //

  async function handleModeSelect(modeId) {
    // Resolve 'auto' to a concrete mode based on user prefs
    const effectiveMode = modeId === 'auto'
      ? (prefs.readingLevel === 'simple' ? 'simplify' : 'actions')
      : modeId

    setChosenMode(effectiveMode)
    setPhase('results')
    // Reset previous results
    setActionItems([])
    setStreamText('')
    setIsStreaming(false)
    setStreamError(null)

    if (effectiveMode === 'actions' || effectiveMode === 'highlights') {
      try {
        const res = await decompose({
          goal: docText.slice(0, 3000),
          granularity: effectiveMode === 'highlights' ? 'broad' : 'normal',
          reading_level: prefs.readingLevel || 'standard',
        })
        if (res.flagged) {
          setStreamError("This content couldn't be processed. Try pasting a different section.")
          return
        }
        setActionItems(res.steps || [])
      } catch {
        setStreamError("Something went quiet. Here's what I could find so far.")
      }
    } else {
      // 'simplify' — stream the simplified text
      setIsStreaming(true)
      await summariseStream(
        { text: docText.slice(0, 3000), reading_level: prefs.readingLevel || 'simple' },
        chunk => setStreamText(prev => prev + chunk),
        () => setIsStreaming(false),
        err => { setStreamError(err); setIsStreaming(false) },
      )
    }
  }

  // ── Turn into tasks ───────────────────────────────────────────────────── //

  async function handleTurnIntoTasks() {
    if (actionItems.length > 0) {
      dispatch(tasksActions.setGoal(docName || 'From document'))
      dispatch(tasksActions.setSteps(actionItems))
      navigate('/tasks')
      return
    }
    try {
      const res = await decompose({
        goal: docText.slice(0, 3000),
        granularity: 'normal',
        reading_level: prefs.readingLevel || 'standard',
      })
      if (!res.flagged && res.steps?.length) {
        dispatch(tasksActions.setGoal(docName || 'From document'))
        dispatch(tasksActions.setSteps(res.steps))
        navigate('/tasks')
      }
    } catch {}
  }

  // ── Q&A submit ────────────────────────────────────────────────────────── //

  async function handleQaSubmit() {
    const q = qaInput.trim()
    if (!q || qaStreaming) return
    setQaMessages(prev => [...prev, { role: 'user', text: q }])
    setQaInput('')
    setQaStreaming(true)
    const context = `Answer this question about the document below. Question: "${q}"\n\nDocument:\n${docText.slice(0, 2000)}`
    await summariseStream(
      { text: context, reading_level: prefs.readingLevel || 'standard' },
      chunk => setQaMessages(prev => {
        const msgs = [...prev]
        const last = msgs[msgs.length - 1]
        if (last?.role === 'ai') {
          msgs[msgs.length - 1] = { role: 'ai', text: last.text + chunk }
        } else {
          msgs.push({ role: 'ai', text: chunk })
        }
        return msgs
      }),
      () => setQaStreaming(false),
      () => {
        setQaMessages(prev => [...prev, { role: 'ai', text: "I wasn't able to answer that right now. Try rephrasing?" }])
        setQaStreaming(false)
      },
    )
  }

  // ── Shared layout wrapper ─────────────────────────────────────────────── //

  const pageStyle = {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '4rem 2rem', gap: '1.5rem',
    maxWidth: '720px', margin: '0 auto', width: '100%',
  }

  // ── Render ────────────────────────────────────────────────────────────── //

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <AnimatePresence mode="wait">

        {/* ── STATE 1: Input ──────────────────────────────────────────────── */}
        {phase === 'input' && (
          <motion.div key="input" {...fadeUp} style={pageStyle}>
            <motion.div
              variants={stagger} initial="initial" animate="animate"
              style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}
            >
              {/* Heading */}
              <motion.div variants={staggerItem} style={{ textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Share what's overwhelming you.
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                  We'll make it make sense.
                </p>
              </motion.div>

              {/* Upload zone */}
              <motion.div
                variants={staggerItem}
                className={`upload-zone${isDragging ? ' dragging' : ''}`}
                style={{ width: '100%' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* File attached view */}
                {file ? (
                  <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📄</span>
                    <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {file.name}
                    </span>
                    <button
                      onClick={() => { setFile(null); setDocName('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0 0.25rem', lineHeight: 1 }}
                      aria-label="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <textarea
                    placeholder="Paste text, drop a file, or describe what you need help with..."
                    rows={9}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    style={{
                      resize: 'none', width: '100%', background: 'transparent',
                      border: 'none', padding: '1.25rem', fontSize: '0.9rem',
                      outline: 'none', color: 'var(--text-primary)', display: 'block',
                    }}
                    aria-label="Paste or describe document content"
                  />
                )}

                {/* Footer row */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Upload file"
                    >
                      + Upload file
                    </button>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PDF, Word, image</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                    style={{ display: 'none' }}
                    onChange={e => e.target.files[0] && attachFile(e.target.files[0])}
                    aria-hidden="true"
                  />
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1.5rem', opacity: (!inputText.trim() && !file) || isLoading ? 0.45 : 1 }}
                    disabled={(!inputText.trim() && !file) || isLoading}
                    onClick={handleGo}
                    aria-label="Process document"
                  >
                    {isLoading ? 'Reading…' : 'Go'}
                  </button>
                </div>
              </motion.div>

              {/* Validation error */}
              {fileError && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ fontSize: '0.85rem', color: 'var(--color-ai)', textAlign: 'center' }}
                >
                  {fileError}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ── STATE 2: Guided question ────────────────────────────────────── */}
        {phase === 'question' && (
          <motion.div key="question" {...fadeUp} style={{ ...pageStyle, alignItems: 'stretch' }}>
            <motion.div
              variants={stagger} initial="initial" animate="animate"
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              {/* File/text indicator */}
              <motion.div variants={staggerItem} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {file ? (
                  <>
                    <span>📄</span>
                    <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{file.name}</span>
                    {pageCount && <span>· {pageCount} page{pageCount !== 1 ? 's' : ''}</span>}
                    <span>· uploaded just now</span>
                  </>
                ) : (
                  <>
                    <span>Your pasted text</span>
                    <span>· {docText.split(/\s+/).filter(Boolean).length} words</span>
                    <span>· ready to process</span>
                  </>
                )}
              </motion.div>

              {/* AI message */}
              <motion.div variants={staggerItem}>
                <AIBubble>{aiDesc}</AIBubble>
              </motion.div>

              {/* Choice cards */}
              <motion.div variants={stagger} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {CHOICES.map(choice => (
                  <motion.button
                    key={choice.id}
                    variants={staggerItem}
                    onClick={() => handleModeSelect(choice.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.85rem',
                      padding: '0.9rem 1.1rem',
                      background: 'var(--bg-card)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '10px',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'background 0.2s ease, border-color 0.2s ease',
                    }}
                    whileHover={{ scale: 1.005 }}
                    whileTap={{ scale: 0.99 }}
                    aria-label={choice.title}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: choice.dot, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>{choice.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{choice.sub}</div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* ── STATE 3: Results as conversation ────────────────────────────── */}
        {phase === 'results' && (
          <motion.div key="results" {...fadeUp} style={{ ...pageStyle, alignItems: 'stretch', paddingBottom: '6rem' }}>
            <motion.div
              variants={stagger} initial="initial" animate="animate"
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >

              {/* Main results bubble */}
              <motion.div variants={staggerItem}>
                <AIBubble>
                  {/* Mode headline */}
                  <p style={{ marginBottom: '0.85rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {chosenMode === 'actions' && `I found ${actionItems.length > 0 ? actionItems.length : '…'} things you need to do. Everything else is background info you don't need right now.`}
                    {chosenMode === 'simplify' && "Here's a simplified version at your reading level."}
                    {chosenMode === 'highlights' && `Here are ${actionItems.length > 0 ? `${actionItems.length} sections` : 'the sections'} that matter most.`}
                  </p>

                  {/* Actions / Highlights mode */}
                  {(chosenMode === 'actions' || chosenMode === 'highlights') && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {actionItems.length === 0 && !streamError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                          <span className="streaming-cursor" aria-hidden="true" />
                          <span>Working through it…</span>
                        </div>
                      )}
                      {actionItems.map((step, i) => (
                        <div key={i} style={{
                          display: 'flex', gap: '0.85rem', alignItems: 'flex-start',
                          padding: '0.75rem 0',
                          borderBottom: i < actionItems.length - 1 ? '1px solid var(--border)' : 'none',
                        }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--accent-soft)', color: 'var(--accent)',
                            fontSize: '0.72rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                              {step.task_name}
                            </div>
                            {step.motivation_nudge && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {step.motivation_nudge}
                              </div>
                            )}
                            {step.duration_minutes && (
                              <span style={{
                                display: 'inline-block', marginTop: '0.35rem',
                                fontSize: '0.72rem', fontWeight: 500,
                                color: 'var(--color-upcoming)',
                                background: 'rgba(106,150,184,0.12)',
                                padding: '0.15rem 0.55rem',
                                borderRadius: '99px',
                                border: '1px solid rgba(106,150,184,0.2)',
                              }}>
                                ~{step.duration_minutes} min
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Simplify mode */}
                  {chosenMode === 'simplify' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.65rem' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.78rem', padding: '0.2rem 0.65rem' }}
                          onClick={() => setBionicMode(b => !b)}
                          aria-pressed={bionicMode}
                        >
                          {bionicMode ? 'Normal reading' : 'Bionic reading'}
                        </button>
                      </div>
                      <div
                        style={{ fontSize: '0.9rem', lineHeight: 'var(--line-height)', letterSpacing: 'var(--letter-spacing)' }}
                        aria-live="polite"
                        aria-atomic="false"
                      >
                        {isStreaming
                          ? <>{streamText}<span className="streaming-cursor" aria-hidden="true" /></>
                          : renderSimplified(streamText, bionicMode)
                        }
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {streamError && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ai)', marginTop: '0.5rem' }}>
                      {streamError}
                    </p>
                  )}
                </AIBubble>
              </motion.div>

              {/* AI follow-up (orange) — appears after results settle */}
              {!isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                >
                  <AIBubble orange>
                    <p style={{ marginBottom: '0.75rem', fontSize: '0.88rem' }}>
                      Want me to do anything else with this document?
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}
                        onClick={handleTurnIntoTasks}
                      >
                        Turn into tasks
                      </button>
                      {chosenMode !== 'simplify' && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}
                          onClick={() => handleModeSelect('simplify')}
                        >
                          Simplify full text
                        </button>
                      )}
                      {chosenMode !== 'highlights' && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}
                          onClick={() => handleModeSelect('highlights')}
                        >
                          Highlight key parts
                        </button>
                      )}
                    </div>
                  </AIBubble>
                </motion.div>
              )}

              {/* Q&A thread */}
              {qaMessages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {qaMessages.map((msg, i) =>
                    msg.role === 'user'
                      ? <UserBubble key={i} text={msg.text} />
                      : (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                          <AIBubble>
                            {msg.text}
                            {qaStreaming && i === qaMessages.length - 1 && (
                              <span className="streaming-cursor" aria-hidden="true" />
                            )}
                          </AIBubble>
                        </motion.div>
                      )
                  )}
                </div>
              )}

              {/* Q&A input — sticky at bottom */}
              {!isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  style={{
                    display: 'flex', gap: '0.65rem', alignItems: 'center',
                    position: 'sticky', bottom: '1.5rem',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Ask anything about this document..."
                    value={qaInput}
                    onChange={e => setQaInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleQaSubmit()}
                    style={{ flex: 1, borderRadius: '99px', padding: '0.65rem 1.1rem', fontSize: '0.88rem' }}
                    aria-label="Ask a question about this document"
                  />
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.65rem 1.25rem', borderRadius: '99px', flexShrink: 0, opacity: !qaInput.trim() || qaStreaming ? 0.45 : 1 }}
                    disabled={!qaInput.trim() || qaStreaming}
                    onClick={handleQaSubmit}
                  >
                    Ask
                  </button>
                </motion.div>
              )}

            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
