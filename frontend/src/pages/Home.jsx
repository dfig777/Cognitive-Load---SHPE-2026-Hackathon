import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { tasksActions } from '../store'
import { chatStream, decompose, loadConversation } from '../utils/api'
import WalkthroughOverlay from '../components/WalkthroughOverlay'

// ── Constants ─────────────────────────────────────────────────────────── //

const PLACEHOLDERS = [
  "What's on your mind?",
  "What feels overwhelming right now?",
  "What are you working on today?",
  "Need help breaking something down?",
  "Tell me what you're thinking...",
]

// ── Chat session history (localStorage) ───────────────────────────────── //

const SESSIONS_KEY = 'pebble_chat_sessions'

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') } catch { return [] }
}

const SKIP_TITLE_TEXTS = ['What was I working on?', 'what was i working on?']

function archiveSession(messages) {
  // Find the first real user message (skip the "What was I working on?" button text)
  const firstMeaningful = messages.find(
    m => m.role === 'user' && !SKIP_TITLE_TEXTS.includes(m.content.trim())
  )
  if (!firstMeaningful) return   // nothing worth archiving
  const sessions = loadSessions()
  const title = firstMeaningful.content.slice(0, 58)
  const session = {
    id: Math.random().toString(36).slice(2, 10),
    createdAt: new Date().toISOString(),
    title,
    msgCount: messages.filter(m => m.role === 'user').length,
    messages: messages.slice(-50),
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([session, ...sessions].slice(0, 8)))
}

const LOADING_PHRASES = [
  'pebbling...',
  'getting what you need...',
  'be right there...',
  'one moment...',
  'thinking this through...',
  'sitting with that...',
  'on it...',
]

function getLoadingPhrase() {
  return LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]
}

const QUICK_ACTIONS = [
  {
    label: 'I have a document',
    hint:  'Upload a PDF or Word doc to extract tasks and simplify text',
    route: '/documents',
    bg:    'var(--accent-soft)',
    color: 'var(--color-active)',
    border: 'rgba(42,122,144,0.2)',
  },
  {
    label: 'Break down a goal',
    hint:  'Turn anything overwhelming into small, calm steps',
    route: '/tasks',
    bg:    'rgba(200,148,80,0.1)',
    color: 'var(--color-ai)',
    border: 'rgba(200,148,80,0.2)',
  },
  {
    label: 'Start focus mode',
    hint:  'A gentle, distraction-free timer with check-ins',
    route: '/focus',
    bg:    'var(--accent-2-soft)',
    color: 'var(--color-done)',
    border: 'rgba(80,148,106,0.2)',
  },
]

// Poetic greeting pools — Pebble's voice: lowercase, warm, alive
// Each phrase pairs with the user's name: "morning, Diego." / "still up, Diego."
const HERO_GREETING_POOLS = {
  morning:   ['morning', 'fresh slate', 'a new one', 'early light', 'here we go', 'the quiet start'],
  afternoon: ['afternoon', 'hey', 'midday', 'still here', 'good to see you', 'taking a breath'],
  evening:   ['evening', 'winding down', 'almost there', 'end of things', 'settling in', 'the long day'],
  night:     ['still up', 'late night', 'burning bright', 'the quiet ones', 'here with you', 'night owl'],
}
const HERO_GREETING_SESSION_KEY = 'pebble_hero_greeting'

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h >= 6  && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

const genId = () => Math.random().toString(36).slice(2, 10)
const GREETING_DEDUPE_KEY = 'pebble_home_greeting_ts'
const GREETING_DEDUPE_WINDOW_MS = 2500

// Strip ###ACTIONS[...]### markers that leaked through from the token stream
// Also handles incomplete markers (stream cut off before closing ###)
function stripActions(text) {
  if (!text) return ''
  return text
    .replace(/###ACTIONS\[[\s\S]*?\]###/g, '')   // complete marker
    .replace(/###ACTIONS\[[\s\S]*/g, '')           // incomplete marker (no closing ###)
    .trim()
}

// Strip markdown formatting so raw **bold** / *italic* / # headers don't show as text
function stripMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g,   '$1')     // *italic*
    .replace(/^#+\s+/gm,     '')       // # headers
    .replace(/^[-*]\s+/gm,   '')       // - bullet list markers
}

// ── Sub-components ────────────────────────────────────────────────────── //

const AI_BUBBLE_STYLE = {
  background: 'rgba(200,148,80,0.07)',
  border: '1px solid rgba(200,148,80,0.16)',
  borderRadius: '20px 20px 20px 6px',
  padding: '1rem 1.2rem',
  color: 'var(--text-primary)',
  fontSize: '0.95rem',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  boxShadow: '0 4px 18px rgba(200,148,80,0.08)',
}

function PulseDot({ phrase }) {
  const text = phrase ?? getLoadingPhrase()
  return (
    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', maxWidth: '85%' }}>
      {/* Pebble dot avatar */}
      <motion.div
        animate={{ scale: [0.88, 1.08, 0.88], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 8, height: 8, borderRadius: '50%', background: '#5A8A80', flexShrink: 0, marginTop: '1.05rem' }}
      />
      <div style={{
        ...AI_BUBBLE_STYLE,
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.8rem 1.1rem',
      }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.35, 0.9, 0.35] }}
              transition={{ duration: 2.2, delay: i * 0.35, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: '#5A8A80' }}
            />
          ))}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontStyle: 'italic' }}>
          {text}
        </span>
      </div>
    </div>
  )
}

function AiBubble({ content, buttons, navigate, onTaskNavigate }) {
  const clean = stripMarkdown(stripActions(content))
  // Split on [SPLIT] to render as multiple chat bubbles
  const parts = clean.split(/\[SPLIT\]/i).map(p => p.trim()).filter(Boolean)

  return (
    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', maxWidth: '85%' }}>
      {/* Pebble dot avatar — aligned to first bubble */}
      <motion.div
        animate={{ scale: [0.88, 1.08, 0.88], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 8, height: 8, borderRadius: '50%', background: '#5A8A80', flexShrink: 0, marginTop: '1.05rem' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {parts.map((part, i) => (
          <div key={i} style={AI_BUBBLE_STYLE}>{part}</div>
        ))}
        {buttons && buttons.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {buttons.map((btn, i) => (
              <button
                key={i}
                onClick={() => {
                  if (btn.value === '/tasks' && onTaskNavigate) {
                    onTaskNavigate(clean, btn.value)
                  } else {
                    navigate(btn.value)
                  }
                }}
                className="btn"
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--color-active)',
                  border: '1.5px solid rgba(42,122,144,0.2)',
                  fontSize: '0.85rem',
                  padding: '0.4rem 0.9rem',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UserBubble({ content, userName }) {
  const initial = userName ? userName.charAt(0).toUpperCase() : 'Y'
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', alignItems: 'flex-start' }}>
      <div style={{
        background: 'rgba(42,122,144,0.1)',
        border: '1px solid rgba(42,122,144,0.18)',
        borderRadius: '20px 20px 6px 20px',
        padding: '1rem 1.2rem',
        color: 'var(--text-primary)',
        fontSize: '0.95rem',
        lineHeight: 1.7,
        maxWidth: '80%',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxShadow: '0 2px 14px rgba(42,122,144,0.05)',
      }}>
        {content}
      </div>
      {/* User initial avatar */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'rgba(42,122,144,0.12)',
        border: '1px solid rgba(42,122,144,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.72rem',
        fontWeight: 600,
        color: 'var(--color-active)',
        flexShrink: 0,
        marginTop: '0.3rem',
        letterSpacing: '0.02em',
      }}>
        {initial}
      </div>
    </div>
  )
}

// ── Home page ─────────────────────────────────────────────────────────── //

export default function Home() {
  const navigate    = useNavigate()
  const location    = useLocation()
  const dispatch    = useDispatch()
  const prefs       = useSelector(s => s.prefs)

  // heroMode — true whenever the user navigates to Home, false once they send a message
  // location.key changes on every navigation, so this resets correctly each visit
  const [heroMode, setHeroMode] = useState(true)
  useEffect(() => { setHeroMode(true) }, [location.key])

  // Chat state — local only (no Redux slice needed for chat messages)
  // Lazy initializer loads from localStorage so chat survives page refresh
  const [messages,        setMessages]        = useState(() => {
    try {
      const saved = localStorage.getItem('pebble_chat_messages')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [streamingContent, setStreamingContent] = useState('')
  const [pendingButtons,  setPendingButtons]  = useState([])
  const [isStreaming,     setIsStreaming]      = useState(false)
  const [input,           setInput]           = useState('')
  const [placeholderIdx,  setPlaceholderIdx]  = useState(0)
  const [hoveredAction,   setHoveredAction]   = useState(null)
  // Hero greeting — streams from API into its own state, never touches messages
  const [heroText,        setHeroText]        = useState('')
  const [heroLoading,     setHeroLoading]     = useState(false)
  // Stable loading phrase per session so it doesn't flicker on re-renders
  const heroLoadingPhrase = useRef(getLoadingPhrase())

  // Chat session history
  const [showHistory, setShowHistory] = useState(false)
  const [sessions,    setSessions]    = useState(() => loadSessions())

  // Walkthrough — shown once after onboarding, gated by walkthroughComplete pref
  const [walkthroughDone, setWalkthroughDone] = useState(false)
  const showWalkthrough = prefs.loaded && prefs.onboardingComplete && !prefs.walkthroughComplete && !walkthroughDone

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const historyRef     = useRef(null)

  // Close session history dropdown on outside click
  useEffect(() => {
    if (!showHistory) return
    function handler(e) {
      if (historyRef.current && !historyRef.current.contains(e.target)) setShowHistory(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showHistory])

  // Rotate placeholder text every 15 seconds (slow enough to not be distracting)
  useEffect(() => {
    const timer = setInterval(
      () => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length),
      15000,
    )
    return () => clearInterval(timer)
  }, [])

  // Scroll to bottom whenever messages or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // ── Core streaming function ──────────────────────────────────────────── //

  const sendMessage = useCallback(async (userText, isGreeting = false, currentMsgs) => {
    setIsStreaming(true)
    setStreamingContent('')
    setPendingButtons([])

    let accumulated = ''
    let accButtons  = []
    let replaced    = false

    // Build conversation history — everything BEFORE the current message.
    // currentMsgs includes the new user message as last item; exclude it since
    // the backend also appends `message` to gpt_messages (would duplicate it).
    const history = (currentMsgs || [])
      .slice(0, -1)
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }))

    await chatStream(
      {
        message:              userText,
        is_greeting:          isGreeting,
        current_page:         'home',
        conversation_history: history,
      },
      {
        onToken: token => {
          accumulated += token
          setStreamingContent(accumulated)
        },
        onActions: buttons => {
          accButtons = buttons
          setPendingButtons(buttons)
        },
        onReplace: content => {
          replaced = true
          setStreamingContent('')
          setMessages(prev => [...prev, { id: genId(), role: 'assistant', content: stripMarkdown(stripActions(content)), buttons: [] }])
        },
        onDone: () => {
          if (!replaced && accumulated) {
            setMessages(prev => [...prev, {
              id:      genId(),
              role:    'assistant',
              content: stripMarkdown(stripActions(accumulated)),
              buttons: accButtons,
            }])
          }
          setStreamingContent('')
          setPendingButtons([])
          setIsStreaming(false)
        },
        onError: msg => {
          setMessages(prev => [...prev, {
            id:      genId(),
            role:    'assistant',
            content: msg || 'Something went quiet — please try again.',
            buttons: [],
          }])
          setStreamingContent('')
          setIsStreaming(false)
        },
      },
    )
  }, [])

  // Greeting stream — goes to heroText only, never into messages.
  // This keeps Pebble alive and contextual on every visit without polluting chat history.
  const fetchGreeting = useCallback(async (conversationHistory = []) => {
    setHeroLoading(true)
    setHeroText('')

    let accumulated = ''
    await chatStream(
      {
        message:              '',
        is_greeting:          true,
        current_page:         'home',
        conversation_history: conversationHistory.slice(-20).map(m => ({ role: m.role, content: m.content })),
      },
      {
        onToken: token => {
          accumulated += token
          setHeroText(stripActions(accumulated))
          setHeroLoading(false)
        },
        onReplace: content => {
          setHeroText(stripActions(content))
          setHeroLoading(false)
        },
        onDone: () => {
          setHeroText(stripActions(accumulated))
          setHeroLoading(false)
        },
        onError: () => {
          setHeroText('where do you want to start?')
          setHeroLoading(false)
        },
      },
    )
  }, [])

  // Persist chat to localStorage whenever messages change (skip empty to avoid wiping on mount)
  useEffect(() => {
    if (messages.length === 0) return
    try {
      localStorage.setItem('pebble_chat_messages', JSON.stringify(messages.slice(-50)))
    } catch {}
  }, [messages])

  // On mount: load real conversation history from Cosmos, then always fetch
  // a live greeting that streams into heroText — never into messages.
  // This way: returning users get their full history in chat, new users start fresh,
  // and Pebble is always alive and contextual in the hero regardless.
  useEffect(() => {
    let cancelled = false

    async function init() {
      let cosmosMessages = []

      // Load full conversation history from Cosmos (source of truth)
      try {
        const data = await loadConversation()
        if (!cancelled && data?.messages?.length > 0) {
          const raw = data.messages.map(m => ({
            id:      genId(),
            role:    m.role,
            content: m.content,
            buttons: [],
          }))
          // Deduplicate consecutive assistant messages (can appear from prior SSE bugs)
          cosmosMessages = raw.filter((msg, i) =>
            !(msg.role === 'assistant' && i > 0 && raw[i - 1].role === 'assistant')
          )
          setMessages(cosmosMessages)
          try {
            localStorage.setItem('pebble_chat_messages', JSON.stringify(cosmosMessages.slice(-50)))
          } catch {}
        }
      } catch { /* Cosmos unavailable — localStorage state stays */ }

      if (cancelled) return

      // Always fetch greeting — Pebble should be alive on every visit.
      // Pass conversation history so Pebble knows what the user was working on.
      // Dedupe prevents double-call in React Strict Mode.
      const now = Date.now()
      const lastTs = Number(sessionStorage.getItem(GREETING_DEDUPE_KEY) || 0)
      if (lastTs && now - lastTs < GREETING_DEDUPE_WINDOW_MS) return
      sessionStorage.setItem(GREETING_DEDUPE_KEY, String(now))
      fetchGreeting(cosmosMessages)
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── User actions ──────────────────────────────────────────────────────── //

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return

    // Hero screen = new session entry point. Archive whatever was in progress.
    let baseMessages = messages
    if (heroMode && messages.length > 0) {
      archiveSession(messages)
      setSessions(loadSessions())
      try { localStorage.removeItem('pebble_chat_messages') } catch {}
      baseMessages = []
    }

    const userMsg = { id: genId(), role: 'user', content: text }
    const next = [...baseMessages, userMsg]
    setMessages(next)
    setHeroMode(false)
    sendMessage(text, false, next)
    setInput('')
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = useCallback(() => {
    archiveSession(messages)
    setSessions(loadSessions())
    setMessages([])
    setHeroMode(true)
    setShowHistory(false)
    try { localStorage.removeItem('pebble_chat_messages') } catch {}
    heroLoadingPhrase.current = getLoadingPhrase()
    fetchGreeting([])
  }, [messages, fetchGreeting])

  const handlePreviousWork = () => {
    if (isStreaming) return
    const text    = 'What was I working on?'
    const userMsg = { id: genId(), role: 'user', content: text }
    const next    = [...messages, userMsg]
    setMessages(next)
    setHeroMode(false)
    sendMessage(text, false, next)
  }

  // When chat suggests tasks, decompose the AI message and dispatch before navigating
  const handleTaskNavigate = useCallback(async (content, route) => {
    try {
      const res = await decompose({
        goal: content.slice(0, 1200),
        granularity: prefs.granularity || 'normal',
        reading_level: prefs.readingLevel || 'standard',
      })
      if (!res.flagged && res.steps?.length > 0) {
        const groupName = res.group_name || 'From chat'
        dispatch(tasksActions.addGroup({ name: groupName, source: 'ai', tasks: res.steps }))
      }
    } catch { /* decompose failed — navigate anyway */ }
    navigate(route)
  }, [prefs.granularity, prefs.readingLevel, dispatch, navigate])

  // Stable poetic greeting — cached in sessionStorage but invalidates each hour
  const heroGreeting = useMemo(() => {
    const hour = new Date().getHours()
    try {
      const cached = JSON.parse(sessionStorage.getItem(HERO_GREETING_SESSION_KEY) || 'null')
      // Only reuse cache if it was generated in the same hour
      if (cached?.text && cached?.hour === hour) return cached.text
    } catch {}

    const tod    = getTimeOfDay()
    const pool   = HERO_GREETING_POOLS[tod]
    const phrase = pool[Math.floor(Math.random() * pool.length)]
    const firstName = (prefs.name && prefs.name !== 'there')
      ? prefs.name.split(' ')[0].toLowerCase()
      : null
    const text = firstName ? `${phrase}, ${firstName}.` : `${phrase}.`

    try { sessionStorage.setItem(HERO_GREETING_SESSION_KEY, JSON.stringify({ text, hour })) } catch {}
    return text
  }, [prefs.name])


  // ── Render ────────────────────────────────────────────────────────────── //

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        minHeight:     0,
        overflow:      'hidden',
      }}
    >

      <AnimatePresence mode="wait">

        {/* ── HERO VIEW — shown on every fresh navigation to Home ───────── */}
        {heroMode && (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.45 } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.3 } }}
            style={{
              flex:           1,
              overflowY:      'auto',
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        '2rem 1.5rem 1rem',
              gap:            '2rem',
              minHeight:      0,
            }}
          >
            {/* Poetic greeting — DM Serif Display */}
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.1, ease: [0.4, 0, 0.2, 1] } }}
              style={{
                fontFamily:    '"DM Serif Display", Georgia, serif',
                fontSize:      'clamp(2rem, 5vw, 3rem)',
                fontWeight:    400,
                color:         'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight:    1.15,
                textAlign:     'center',
                margin:        0,
              }}
            >
              {heroGreeting}
            </motion.h1>

            {/* Pebble's live greeting — streams from API into heroText, never into messages */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.5, delay: 0.22 } }}
              style={{
                maxWidth:       480,
                width:          '100%',
                textAlign:      'center',
                minHeight:      '3.5rem',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}
            >
              {heroLoading && !heroText
                ? (
                  <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', justifyContent: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 2.2, delay: i * 0.35, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ display: 'block', width: 7, height: 7, borderRadius: '50%', background: '#5A8A80' }}
                      />
                    ))}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontStyle: 'italic' }}>
                      {heroLoadingPhrase.current}
                    </span>
                  </div>
                )
                : (
                  <p style={{
                    margin:     0,
                    color:      'var(--text-secondary)',
                    fontSize:   '1rem',
                    lineHeight: 1.75,
                    whiteSpace: 'pre-wrap',
                    wordBreak:  'break-word',
                  }}>
                    {heroText}
                  </p>
                )
              }
            </motion.div>

            {/* Quick action pills */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.32 } }}
              style={{
                display:        'flex',
                gap:            '0.5rem',
                flexWrap:       'wrap',
                justifyContent: 'center',
              }}
            >
              {QUICK_ACTIONS.map(action => (
                <div key={action.route} style={{ position: 'relative' }}>
                  <button
                    className="btn"
                    onClick={() => navigate(action.route)}
                    onMouseEnter={() => setHoveredAction(action.route)}
                    onMouseLeave={() => setHoveredAction(null)}
                    style={{
                      background: action.bg,
                      color:      action.color,
                      border:     `1.5px solid ${action.border}`,
                      fontSize:   '0.85rem',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {action.label}
                  </button>

                  <AnimatePresence>
                    {hoveredAction === action.route && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.18 } }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        style={{
                          position:      'absolute',
                          top:           'calc(100% + 7px)',
                          left:          '50%',
                          transform:     'translateX(-50%)',
                          background:    'var(--surface)',
                          border:        '1px solid var(--border)',
                          borderRadius:  8,
                          padding:       '0.4rem 0.8rem',
                          fontSize:      '0.8rem',
                          color:         'var(--text-secondary)',
                          whiteSpace:    'nowrap',
                          zIndex:        20,
                          boxShadow:     '0 4px 16px rgba(0,0,0,0.08)',
                          pointerEvents: 'none',
                        }}
                      >
                        {action.hint}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </motion.div>

            {/* "What was I working on?" — dropdown if sessions exist, otherwise asks Pebble */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.4, delay: 0.42 } }}
              style={{ position: 'relative' }}
              ref={historyRef}
            >
              <button
                onClick={() => {
                  if (isStreaming) return
                  if (sessions.length > 0) {
                    setShowHistory(h => !h)
                  } else {
                    handlePreviousWork()
                  }
                }}
                disabled={isStreaming}
                style={{
                  background: 'none', border: 'none',
                  cursor:     isStreaming ? 'default' : 'pointer',
                  color:      'var(--color-paused, #9B8FC4)',
                  fontSize:   '0.85rem',
                  padding:    '0.25rem 0.5rem',
                  opacity:    isStreaming ? 0.45 : 0.75,
                  transition: 'opacity 0.25s ease',
                }}
                onMouseEnter={e => { if (!isStreaming) e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = isStreaming ? '0.45' : '0.75' }}
              >
                {sessions.length > 0 ? 'what was I working on? ↓' : 'what was I working on? →'}
              </button>

              {/* Session history dropdown */}
              <AnimatePresence>
                {showHistory && sessions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
                    exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
                    style={{
                      position:  'absolute',
                      top:       'calc(100% + 8px)',
                      left:      '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--bg-card)',
                      border:    '1px solid var(--border)',
                      borderRadius: 14,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      minWidth:  300,
                      maxWidth:  360,
                      overflow:  'hidden',
                      zIndex:    30,
                    }}
                  >
                    {sessions.map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setMessages(s.messages)
                          setHeroMode(false)
                          setShowHistory(false)
                          try { localStorage.setItem('pebble_chat_messages', JSON.stringify(s.messages)) } catch {}
                        }}
                        style={{
                          width: '100%', display: 'flex', flexDirection: 'column', gap: '0.12rem',
                          padding: '0.75rem 1rem', background: 'none', border: 'none',
                          borderBottom: i < sessions.length - 1 ? '1px solid var(--border)' : 'none',
                          cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                      >
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                          {s.title.length > 52 ? s.title.slice(0, 50) + '…' : s.title}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' · '}{s.msgCount} message{s.msgCount !== 1 ? 's' : ''}
                        </span>
                      </button>
                    ))}
                    {/* Fallback: ask Pebble directly */}
                    <button
                      onClick={() => { setShowHistory(false); handlePreviousWork() }}
                      style={{
                        width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)',
                        textAlign: 'center', transition: 'background 0.15s ease',
                        borderTop: '1px solid var(--border)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >
                      ask pebble instead →
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}

        {/* ── CHAT VIEW — after user sends a message ────────────────────── */}
        {!heroMode && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            style={{
              flex:          1,
              overflowY:     'auto',
              padding:       '1.5rem 1rem 0.5rem',
              display:       'flex',
              flexDirection: 'column',
              minHeight:     0,
            }}
          >
            <div
              style={{
                maxWidth:      640,
                width:         '100%',
                margin:        '0 auto',
                display:       'flex',
                flexDirection: 'column',
                gap:           '1rem',
              }}
            >
              {/* New chat button — sits at the top of the message list */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleNewChat}
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 99, cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: '0.75rem',
                    padding: '0.2rem 0.75rem', transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--accent-soft)'
                    e.currentTarget.style.color = 'var(--color-active)'
                    e.currentTarget.style.borderColor = 'rgba(42,122,144,0.3)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'none'
                    e.currentTarget.style.color = 'var(--text-muted)'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                >
                  + new chat
                </button>
              </div>

              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] } }}
                >
                  {msg.role === 'assistant'
                    ? <AiBubble content={msg.content} buttons={msg.buttons} navigate={navigate} onTaskNavigate={handleTaskNavigate} />
                    : <UserBubble content={msg.content} userName={prefs.name} />
                  }
                </motion.div>
              ))}

              {/* In-progress streaming bubble */}
              <AnimatePresence>
                {isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  >
                    {streamingContent
                      ? <AiBubble content={streamingContent} buttons={pendingButtons} navigate={navigate} onTaskNavigate={handleTaskNavigate} />
                      : <PulseDot />
                    }
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Input area — always visible ───────────────────────────────────── */}
      <div style={{ padding: '0.75rem 1rem 1.25rem', flexShrink: 0 }}>
        <div
          style={{
            maxWidth:   640,
            margin:     '0 auto',
            display:    'flex',
            gap:        '0.75rem',
            alignItems: 'flex-end',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            rows={2}
            disabled={isStreaming}
            data-walkthrough="chat-input"
            style={{
              flex:         1,
              resize:       'none',
              borderRadius: 12,
              opacity:      isStreaming ? 0.55 : 1,
              transition:   'opacity 0.25s ease',
            }}
            aria-label="Message Pebble"
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            style={{ flexShrink: 0 }}
            aria-label="Send message"
          >
            send
          </button>
        </div>
      </div>

      {showWalkthrough && (
        <WalkthroughOverlay onComplete={() => setWalkthroughDone(true)} />
      )}

    </motion.div>
  )
}
