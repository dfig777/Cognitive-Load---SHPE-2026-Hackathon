import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { tasksActions } from '../store'
import { uploadDocument, summariseStream, explainSentence, decompose, loadDocuments, chatStream, deleteDocument } from '../utils/api'
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
  { id: 'actions',    dot: 'var(--color-active)',   title: 'pull out what I need to do',      sub: 'action items and deadlines, nothing extra' },
  { id: 'simplify',   dot: 'var(--color-done)',     title: 'make it easier to read',          sub: 'simplify the language and shorten it' },
  { id: 'highlights', dot: 'var(--color-upcoming)', title: 'show me what matters most',       sub: 'highlight the key sections to focus on' },
  { id: 'auto',       dot: 'var(--color-paused)',   title: "not sure — you decide",           sub: "i'll figure out the best way to help" },
]

// ── Animation variants ────────────────────────────────────────────────────── //

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const stagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.12 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
}

// ── Sub-components ────────────────────────────────────────────────────────── //

function PebbleDot() {
  return (
    <motion.div
      animate={{ scale: [0.88, 1.08, 0.88], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width: 8, height: 8, borderRadius: '50%', background: '#5A8A80', flexShrink: 0, marginTop: '0.65rem' }}
    />
  )
}

function UserAvatar({ name }) {
  const initial = name ? name.charAt(0).toUpperCase() : 'Y'
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
      background: 'var(--accent-2-soft)', color: 'var(--color-done)',
      fontSize: '0.68rem', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1.5px solid var(--border)',
    }}>
      {initial}
    </div>
  )
}

function AIBubble({ children, orange = false }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <PebbleDot />
      <div style={{
        flex: 1,
        background: orange ? 'rgba(200,148,80,0.07)' : 'rgba(200,148,80,0.05)',
        border: `1px solid ${orange ? 'rgba(200,148,80,0.2)' : 'rgba(200,148,80,0.12)'}`,
        borderRadius: '18px 18px 18px 5px',
        padding: '0.9rem 1.1rem',
        fontSize: '0.9rem',
        color: 'var(--text-primary)',
        lineHeight: 1.65,
        boxShadow: '0 3px 14px rgba(200,148,80,0.07)',
      }}>
        {children}
      </div>
    </div>
  )
}

function UserBubble({ text, userName }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexDirection: 'row-reverse' }}>
      <UserAvatar name={userName} />
      <div style={{
        background: 'var(--accent-2-soft)',
        border: '1px solid rgba(80,148,106,0.2)',
        borderRadius: '18px 18px 5px 18px',
        padding: '0.9rem 1.1rem',
        fontSize: '0.9rem',
        color: 'var(--text-primary)',
        lineHeight: 1.65,
        maxWidth: '80%',
        boxShadow: '0 3px 14px rgba(42,122,144,0.06)',
      }}>
        {text}
      </div>
    </div>
  )
}

// Sentence with dashed underline + explain tooltip (click-based, mobile-safe)
function SentenceTooltip({ text }) {
  const [tip, setTip] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Close when clicking outside this sentence
  const handleOutside = (e) => {
    if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
  }

  async function handleClick(e) {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    setOpen(true)
    if (tip || loading) return
    setLoading(true)
    document.addEventListener('mousedown', handleOutside, { once: false })
    try {
      const res = await explainSentence(text)
      if (!res.flagged) setTip(res)
    } catch {}
    setLoading(false)
  }

  return (
    <span
      ref={wrapperRef}
      className="tooltip-wrapper"
      onClick={handleClick}
      style={{ borderBottom: '1.5px dashed var(--color-active)', cursor: 'pointer' }}
    >
      {text}{' '}
      {open && (
        <span className="tooltip-box" role="tooltip">
          {loading
            ? 'thinking…'
            : tip
              ? <><strong>why simplified:</strong> {tip.reason}<br /><em>{tip.simplified}</em></>
              : null}
        </span>
      )}
    </span>
  )
}

// ── Document type heuristics (P3-3) ──────────────────────────────────────── //

function detectDocType(text, fileName) {
  const sample = (text + ' ' + (fileName || '')).toLowerCase()
  if (/syllabus|course|lecture|assignment|midterm|final exam|office hours|grading|prerequisite|semester|credit/.test(sample)) return 'academic'
  if (/contract|agreement|terms|privacy policy|clause|hereby|indemnif|liability|warrant|obligations|party|signator/.test(sample)) return 'legal'
  if (/step \d|steps to|how to|instructions|tutorial|guide|follow these|first,|next,|then,|finally,/.test(sample)) return 'instructions'
  if (/wikipedia|retrieved from|references\n|this article|birth|death|founded|century|historical|biography/.test(sample)) return 'article'
  if (/meeting|agenda|action items|discussion|standup|sprint|status update|project|deadline|deliverable|q[1-4]/.test(sample)) return 'work'
  return 'unknown'
}

function buildAiDesc(docType, ext, pages, wordCount, isFile) {
  if (isFile) {
    const base = `${ext} · ${pages} page${pages !== 1 ? 's' : ''}`
    switch (docType) {
      case 'academic': return `looks like course material. ${base}. want me to pull out what you need to do and when?`
      case 'legal':    return `looks like a legal document. ${base}. want me to find the parts that need your action?`
      case 'instructions': return `looks like a how-to guide. ${base}. want me to turn these into steps you can track?`
      case 'work':     return `looks like work notes or a doc. ${base}. want me to find the action items?`
      case 'article':  return `looks like an article or reference. ${base}. want the key points, or something else?`
      default:         return `${base} loaded. what would help you most right now?`
    }
  } else {
    const base = `${wordCount} word${wordCount !== 1 ? 's' : ''} pasted`
    switch (docType) {
      case 'academic': return `looks like course material — ${base}. want me to find what you need to do?`
      case 'legal':    return `this reads like a legal document — ${base}. want me to find what needs your attention?`
      case 'instructions': return `this looks like a how-to — ${base}. want me to turn it into trackable steps?`
      case 'work':     return `${base}. looks like a work doc — want me to pull out the action items?`
      case 'article':  return `${base}. looks like an article — want the key points, or something else?`
      default:         return `${base}. what would help you most right now?`
    }
  }
}

// Strip markdown from document AI responses (bold/italic/headers leak through)
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g,   '$1')     // *italic*
    .replace(/^#+\s+/gm,     '')       // # headers
    .replace(/^[-*]\s+/gm,   '')       // - bullet points
}

function renderSimplified(text, bionicMode) {
  const clean = stripMarkdown(text)
  const sentences = clean.match(/[^.!?]+[.!?]*/g) || [clean]
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
  const [aiDesc, setAiDesc] = useState('')
  const [aiGroupName, setAiGroupName] = useState('')  // AI-generated group name from decompose

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

  // P3-2: visible input preview in question phase
  const [inputPreview, setInputPreview] = useState('')

  // P3-4: saved documents browser
  const [savedDocs, setSavedDocs] = useState([])
  const [deletingDocId, setDeletingDocId] = useState(null) // id in confirm-delete state

  // Detected document type — used to show contextual follow-up buttons
  const [docType, setDocType] = useState('unknown')

  // Which choice card is hovered — used for border-color accent on hover
  const [hoveredChoice, setHoveredChoice] = useState(null)

  useEffect(() => {
    loadDocuments()
      .then(docs => { if (Array.isArray(docs)) setSavedDocs(docs) })
      .catch(() => {})
  }, [])

  // ── File validation ──────────────────────────────────────────────────── //

  function validateFile(f) {
    if (!ACCEPTED_MIME.has(f.type)) return "i can work with PDFs, Word docs, and images. try one of those?"
    if (f.size > MAX_BYTES) return "that file is a bit large. try one under 20MB?"
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
          setFileError(res.message || "this content couldn't be processed right now.")
          setIsLoading(false)
          return
        }
        const text = res.extracted_text || ''
        const pages = res.page_count || 1
        const ext = file.name.split('.').pop().toUpperCase()
        const detectedType = detectDocType(text, file.name)
        setDocType(detectedType)
        setDocText(text)
        setInputPreview(file.name)
        setAiDesc(buildAiDesc(detectedType, ext, pages, 0, true))
        // Refresh saved docs list after upload
        loadDocuments().then(docs => { if (Array.isArray(docs)) setSavedDocs(docs) }).catch(() => {})
      } else {
        const trimmed = inputText.trim()
        const words = trimmed.split(/\s+/).filter(Boolean).length
        const detectedType = detectDocType(trimmed, '')
        setDocType(detectedType)
        setDocText(trimmed)
        setDocName('Pasted text')
        setInputPreview(trimmed.length > 160 ? trimmed.slice(0, 160) + '…' : trimmed)
        setAiDesc(buildAiDesc(detectedType, '', 0, words, false))
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
          setStreamError("this content couldn't be processed. try pasting a different section.")
          return
        }
        setActionItems(res.steps || [])
        setAiGroupName(res.group_name || '')
      } catch {
        setStreamError("something went quiet. here's what i could find so far.")
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
    const fallbackName = docName || 'Document'
    if (actionItems.length > 0) {
      const groupName = aiGroupName || fallbackName
      dispatch(tasksActions.addGroup({ name: groupName, source: 'document', tasks: actionItems }))
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
        const groupName = res.group_name || fallbackName
        dispatch(tasksActions.addGroup({ name: groupName, source: 'document', tasks: res.steps }))
        navigate('/tasks')
      }
    } catch {}
  }

  // ── Q&A submit ────────────────────────────────────────────────────────── //

  async function handleQaSubmit() {
    const q = qaInput.trim()
    if (!q || qaStreaming) return

    // Build conversation history for Pebble
    const history = qaMessages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }))
    const docContext = docText.slice(0, 1500)
    // Prepend doc context on first user question (history may have an initial AI message already)
    const hasUserTurn = history.some(m => m.role === 'user')
    const messageWithContext = !hasUserTurn
      ? `[document context: "${docContext}"]\n\n${q}`
      : q

    setQaMessages(prev => [...prev, { role: 'user', text: q }])
    setQaInput('')
    setQaStreaming(true)

    await chatStream(
      { message: messageWithContext, current_page: 'documents', conversation_history: history },
      {
        onToken: chunk => setQaMessages(prev => {
          const msgs = [...prev]
          const last = msgs[msgs.length - 1]
          if (last?.role === 'ai') {
            msgs[msgs.length - 1] = { role: 'ai', text: last.text + chunk }
          } else {
            msgs.push({ role: 'ai', text: chunk })
          }
          return msgs
        }),
        onReplace: content => setQaMessages(prev => {
          const msgs = [...prev]
          const last = msgs[msgs.length - 1]
          if (last?.role === 'ai') {
            msgs[msgs.length - 1] = { role: 'ai', text: content }
          } else {
            msgs.push({ role: 'ai', text: content })
          }
          return msgs
        }),
        onDone: () => setQaStreaming(false),
        onError: () => {
          setQaMessages(prev => [...prev, { role: 'ai', text: "Something went quiet. Try asking again?" }])
          setQaStreaming(false)
        },
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', minHeight: 0 }}>
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
                  share what's overwhelming you.
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                  we'll make it make sense.
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
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
                    placeholder="paste text, drop a file, or describe what you need help with..."
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
                    {isLoading ? 'reading…' : 'go'}
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

              {/* Saved documents browser (P3-4) */}
              {savedDocs.length > 0 && (
                <motion.div variants={staggerItem} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', letterSpacing: '0.2px' }}>
                    previous documents
                  </p>
                  {savedDocs.map(doc => (
                    <motion.div
                      key={doc.id}
                      whileHover={{ background: 'var(--accent-soft)' }}
                      transition={{ duration: 0.18 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderLeft: '3px solid var(--color-active)',
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.filename}
                        </div>
                        {doc.summary && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {doc.summary}
                          </div>
                        )}
                      </div>
                      {doc.page_count && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {doc.page_count}p
                        </span>
                      )}
                      {/* Delete — two-step confirm */}
                      {deletingDocId === doc.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Remove?</span>
                          <button
                            onClick={async () => {
                              try { await deleteDocument(doc.id) } catch {}
                              setSavedDocs(prev => prev.filter(d => d.id !== doc.id))
                              setDeletingDocId(null)
                            }}
                            style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-ai)', background: 'transparent', color: 'var(--color-ai)', cursor: 'pointer' }}
                          >Yes</button>
                          <button
                            onClick={() => setDeletingDocId(null)}
                            style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingDocId(doc.id)}
                          title="Remove document"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0, lineHeight: 1 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
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
              {/* User's input — shown as chat bubble (P3-2: stays visible, slides up) */}
              <motion.div variants={staggerItem}>
                <UserBubble text={inputPreview} userName={prefs.name} />
              </motion.div>

              {/* AI response — smart doc type message (P3-3) */}
              <motion.div variants={staggerItem}>
                <AIBubble>{aiDesc}</AIBubble>
              </motion.div>

              {/* Choice cards */}
              <motion.div variants={stagger} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {CHOICES.map(choice => {
                  const isHovered = hoveredChoice === choice.id
                  return (
                    <motion.button
                      key={choice.id}
                      variants={staggerItem}
                      onClick={() => handleModeSelect(choice.id)}
                      onMouseEnter={() => setHoveredChoice(choice.id)}
                      onMouseLeave={() => setHoveredChoice(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.85rem',
                        padding: '0.9rem 1.1rem',
                        background: isHovered ? 'var(--accent-soft)' : 'var(--bg-card)',
                        border: `1.5px solid ${isHovered ? choice.dot : 'var(--border)'}`,
                        borderRadius: '10px',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'background 0.2s ease, border-color 0.2s ease',
                      }}
                      whileTap={{ scale: 0.99 }}
                      aria-label={choice.title}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', background: choice.dot, flexShrink: 0,
                        transition: 'transform 0.2s ease',
                        transform: isHovered ? 'scale(1.4)' : 'scale(1)',
                      }} />
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>{choice.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{choice.sub}</div>
                      </div>
                    </motion.button>
                  )
                })}
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
                    {chosenMode === 'actions' && `found ${actionItems.length > 0 ? actionItems.length : '…'} things you need to do. everything else is background.`}
                    {chosenMode === 'simplify' && "here's a simplified version at your reading level."}
                    {chosenMode === 'highlights' && `here are ${actionItems.length > 0 ? `${actionItems.length} sections` : 'the sections'} that matter most.`}
                  </p>

                  {/* Actions / Highlights mode */}
                  {(chosenMode === 'actions' || chosenMode === 'highlights') && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {actionItems.length === 0 && !streamError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                          <span className="streaming-cursor" aria-hidden="true" />
                          <span>working through it…</span>
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
                          {bionicMode ? 'normal reading' : 'bionic reading'}
                        </button>
                      </div>
                      <div
                        style={{ fontSize: '0.9rem', lineHeight: 'var(--line-height)', letterSpacing: 'var(--letter-spacing)' }}
                        aria-live="polite"
                        aria-atomic="false"
                      >
                        {isStreaming
                          ? <>{stripMarkdown(streamText)}<span className="streaming-cursor" aria-hidden="true" /></>
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

              {/* AI follow-up (orange) — appears after results settle, contextual by doc type */}
              {!isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                >
                  <AIBubble orange>
                    <p style={{ marginBottom: '0.75rem', fontSize: '0.88rem' }}>
                      {docType === 'article'
                        ? 'want to explore this further?'
                        : 'want me to do anything else with this?'}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {/* "Turn into tasks" only makes sense for actionable doc types */}
                      {docType !== 'article' && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}
                          onClick={handleTurnIntoTasks}
                        >
                          turn into tasks
                        </button>
                      )}
                      {chosenMode !== 'simplify' && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}
                          onClick={() => handleModeSelect('simplify')}
                        >
                          simplify full text
                        </button>
                      )}
                      {chosenMode !== 'highlights' && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}
                          onClick={() => handleModeSelect('highlights')}
                        >
                          highlight key parts
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
                      ? <UserBubble key={i} text={msg.text} userName={prefs.name} />
                      : (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                          <AIBubble>
                            {stripMarkdown(msg.text)}
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
                    placeholder="ask anything about this document..."
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
                    ask
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
