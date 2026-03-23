import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { tasksActions } from '../store'
import { fetchNudge, decompose, createSession } from '../utils/api'
import FocusTimer from '../components/FocusTimer'
import TopNav from '../components/TopNav'

// ── Fallback pools ──────────────────────────────────────────────────────── //

const NUDGE_FALLBACKS = [
  'take this one step at a time.',
  'you already know more about this than you think.',
  'start with the smallest piece.',
  "this doesn't have to be perfect.",
  'just getting started is the hardest part.',
]

const COMPLETION_FALLBACKS = [
  'nice. the next one builds on that.',
  "that's one more handled.",
  "done. you're making progress.",
  'solid. moving on.',
]

const OVERTIME_FALLBACKS = [
  "running over? no pressure. finish when you're ready.",
  'take the time you need.',
  'almost there. no rush.',
]

const BREAK_TIPS = [
  'look away from the screen for a moment. let your eyes rest on something far away.',
  'stretch your arms above your head and hold for a few seconds.',
  'roll your shoulders back slowly. release the tension.',
  'close your eyes and take three deep breaths on your own.',
  'wiggle your fingers and toes. reconnect with your body.',
  'stand up and stretch if you can. your body will thank you.',
  'drink some water if you have it nearby.',
]

const SUMMARY_FALLBACKS = [
  'that was a good one.',
  'solid session.',
  'nice work in there.',
  'you showed up. that matters.',
]

const TIRED_FALLBACKS = [
  'maybe do a shorter one next.',
  "you've been going for a while. a break after this one might help.",
  "take it slow. there's no deadline on this.",
]

function pickRandom(arr, exclude = null) {
  const pool = exclude !== null ? arr.filter(x => x !== exclude) : arr
  return pool[Math.floor(Math.random() * pool.length)]
}

// ── State transition animation ──────────────────────────────────────────── //

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const fadeUpSlow = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } },
}

// ── Motivational quotes (standalone timer) ─────────────────────────────── //

const MOTIVATIONAL_QUOTES = [
  'deep work. one thing at a time.',
  'the work in front of you is the only work.',
  'focus is the art of knowing what to ignore.',
  'you don\'t have to be fast. you have to start.',
  'progress, not perfection.',
  'one hour of focus moves more than a day of distraction.',
  'show up. stay. see what happens.',
  'the hardest part is already done — you started.',
  'wherever you are, be fully there.',
  'small steps. real progress.',
]

// Preset options — minutes only (hrs shown in custom)
const DURATION_PRESETS = [5, 10, 15, 25, 45, 60]

// Format seconds as [+][H:]MM:SS
function formatCountdown(secs) {
  const neg = secs < 0
  const abs = Math.abs(secs)
  const h   = Math.floor(abs / 3600)
  const m   = Math.floor((abs % 3600) / 60)
  const s   = abs % 60
  const mm  = String(m).padStart(2, '0')
  const ss  = String(s).padStart(2, '0')
  const prefix = neg ? '+' : ''
  return h > 0 ? `${prefix}${h}:${mm}:${ss}` : `${prefix}${mm}:${ss}`
}

// Clamp a number input value
function clamp(val, min, max) { return Math.max(min, Math.min(max, val || 0)) }

function StandaloneFocus({ startBreak = false }) {
  const navigate = useNavigate()
  const defaultMinutes = useSelector(s => s.prefs.timerLengthMinutes) || 25

  // Break-only mode: user came here via "Take a break" from Tasks
  if (startBreak) {
    return (
      <div style={{ height: '100vh', width: '100vw', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNav />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] } }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '2rem' }}
        >
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>
            Taking a break.
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 28px' }}>
            No rush.
          </p>
          <BreathingCircle />
          <motion.button
            whileHover={{ filter: 'brightness(1.08)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/tasks')}
            style={{
              marginTop: 24,
              padding: '10px 28px', borderRadius: 8,
              background: 'var(--color-active)', color: 'white',
              fontSize: 12, fontWeight: 500,
              border: 'none', cursor: 'pointer',
            }}
          >
            I'm back
          </motion.button>
        </motion.div>
      </div>
    )
  }

  // Focus topic — blank timer is broken UX; prompt user to name what they're focusing on
  const [focusTopic, setFocusTopic] = useState('')
  const [topicInput, setTopicInput] = useState('')
  const [topicSet,   setTopicSet]   = useState(false)

  // Duration picker mode
  const [durationMode, setDurationMode] = useState('preset')
  // Which preset is active (null = custom)
  const [activePreset, setActivePreset] = useState(
    DURATION_PRESETS.includes(defaultMinutes) ? defaultMinutes : null
  )
  // Custom H:M:S inputs
  const [cH, setCH] = useState(0)
  const [cM, setCM] = useState(defaultMinutes)
  const [cS, setCS] = useState(0)

  // Timer
  const [status, setStatus]       = useState('idle')
  const [totalSecs, setTotalSecs] = useState(defaultMinutes * 60)
  const [remaining, setRemaining] = useState(defaultMinutes * 60)
  const intervalRef = useRef(null)

  // Quote
  const [quote, setQuote] = useState(() => pickRandom(MOTIVATIONAL_QUOTES))
  const lastQuoteRef      = useRef(null)

  // SVG ring
  const SIZE   = 190
  const STROKE = 3.5
  const R      = (SIZE - STROKE * 2) / 2
  const CIRC   = 2 * Math.PI * R

  const fraction   = totalSecs > 0 ? Math.max(0, remaining / totalSecs) : 1
  const dashOffset = CIRC * (1 - fraction)
  const ringColor  = fraction > 0.5 ? 'var(--color-done)' : fraction > 0.2 ? 'var(--color-active)' : 'var(--color-ai)'
  const glowHex    = fraction > 0.5 ? '#50946A'            : fraction > 0.2 ? '#2A7A90'             : '#C8A046'

  // Countdown label — real H:MM:SS
  const displaySecs  = remaining
  const countdownStr = formatCountdown(displaySecs)
  // Shrink font slightly when hours are showing (more chars)
  const hasHours     = Math.abs(remaining) >= 3600
  const labelSize    = hasHours ? 24 : 30

  // Interval tick
  useEffect(() => {
    if (status !== 'running') { clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => setRemaining(r => r - 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [status])

  // Rotate quote every 5 min
  useEffect(() => {
    const id = setInterval(() => {
      const next = pickRandom(MOTIVATIONAL_QUOTES, lastQuoteRef.current)
      lastQuoteRef.current = next
      setQuote(next)
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  function applySeconds(secs) {
    if (secs < 1) return
    clearInterval(intervalRef.current)
    setTotalSecs(secs)
    setRemaining(secs)
    setStatus('idle')
  }

  function applyPreset(mins) {
    setActivePreset(mins)
    setCH(0); setCM(mins); setCS(0)
    applySeconds(mins * 60)
  }

  function applyCustom() {
    const h = clamp(cH, 0, 23)
    const m = clamp(cM, 0, 59)
    const s = clamp(cS, 0, 59)
    const total = h * 3600 + m * 60 + s
    if (total < 1) return
    setCH(h); setCM(m); setCS(s)
    setActivePreset(null)
    applySeconds(total)
    setDurationMode('preset')
  }

  const canChange = status !== 'running'

  function handleStart()  {
    if (status === 'idle') { setTotalSecs(totalSecs); setRemaining(totalSecs) }
    setStatus('running')
  }
  function handlePause()  { setStatus('paused') }
  function handleResume() { setStatus('running') }
  function handleStop()   { clearInterval(intervalRef.current); setStatus('idle'); setRemaining(totalSecs) }
  function handleReset()  { clearInterval(intervalRef.current); setStatus('idle'); setRemaining(totalSecs) }

  // Topic prompt — show before timer if user hasn't named their focus yet
  if (!topicSet) {
    return (
      <div style={{ height: '100vh', width: '100vw', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNav />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '2rem', paddingBottom: '20vh' }}
        >
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.02em' }}>What are you focusing on?</p>
          <input
            autoFocus
            type="text"
            placeholder="name this session..."
            value={topicInput}
            onChange={e => setTopicInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (topicInput.trim() ? (setFocusTopic(topicInput.trim()), setTopicSet(true)) : setTopicSet(true))}
            style={{
              background: 'var(--bg-card)', border: '1.5px solid var(--border)',
              borderRadius: 10, padding: '0.65rem 1.2rem',
              fontSize: '1.05rem', color: 'var(--text-primary)',
              outline: 'none', textAlign: 'center',
              width: '100%', maxWidth: 300,
              transition: 'border-color 0.2s ease',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--color-active)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn color="active" onClick={() => { setFocusTopic(topicInput.trim()); setTopicSet(true) }}>
              Start
            </Btn>
            <Btn color="ghost" onClick={() => setTopicSet(true)}>
              Skip
            </Btn>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', width: '100vw', background: 'var(--bg)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(42,122,144,0.07) 0%, transparent 70%)',
        zIndex: 0,
      }} />
      <TopNav />

      <motion.div
        variants={{ initial: {}, animate: { transition: { staggerChildren: 0.12 } } }}
        initial="initial"
        animate="animate"
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem',
          paddingBottom: '22vh',
        }}
      >

        {/* ── Focus topic label (shown when timer is running) ── */}
        {focusTopic && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.5 } }}
            style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.02em', textAlign: 'center' }}
          >
            {focusTopic}
          </motion.p>
        )}

        {/* ── Duration picker ── */}
        <motion.div
          variants={{ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } } }}
          style={{ marginBottom: 32 }}
        >
          {durationMode === 'preset' ? (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              {DURATION_PRESETS.map(m => (
                <button
                  key={m}
                  onClick={() => canChange && applyPreset(m)}
                  style={{
                    padding: '6px 16px', borderRadius: 99, fontSize: 13, fontWeight: 500,
                    border: `1px solid ${activePreset === m ? 'var(--color-active)' : 'var(--border)'}`,
                    background: activePreset === m ? 'var(--accent-soft)' : 'transparent',
                    color: activePreset === m ? 'var(--color-active)' : 'var(--text-primary)',
                    cursor: canChange ? 'pointer' : 'default',
                    opacity: canChange ? 1 : 0.4,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {m}m
                </button>
              ))}
              <button
                onClick={() => canChange && setDurationMode('custom')}
                style={{
                  padding: '6px 16px', borderRadius: 99, fontSize: 13, fontWeight: 500,
                  border: `1px solid ${activePreset === null ? 'var(--color-active)' : 'var(--border)'}`,
                  background: activePreset === null ? 'var(--accent-soft)' : 'transparent',
                  color: activePreset === null ? 'var(--color-active)' : 'var(--text-muted)',
                  cursor: canChange ? 'pointer' : 'default',
                  opacity: canChange ? 1 : 0.4,
                  transition: 'all 0.2s ease',
                }}
              >
                custom
              </button>
            </div>
          ) : (
            /* H : M : S inputs */
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'h', val: cH, set: v => setCH(clamp(v, 0, 23)), max: 23 },
                { label: 'm', val: cM, set: v => setCM(clamp(v, 0, 59)), max: 59 },
                { label: 's', val: cS, set: v => setCS(clamp(v, 0, 59)), max: 59 },
              ].map(({ label, val, set, max }, i) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {i > 0 && <span style={{ fontSize: 18, color: 'var(--text-muted)', marginRight: 2 }}>:</span>}
                  <input
                    autoFocus={i === 0}
                    type="number"
                    min={0}
                    max={max}
                    value={val}
                    onChange={e => set(Number(e.target.value))}
                    onKeyDown={e => e.key === 'Enter' && applyCustom()}
                    style={{
                      width: 52, textAlign: 'center', fontSize: 16, fontWeight: 600,
                      padding: '7px 6px', borderRadius: 8,
                      border: '1px solid var(--color-active)',
                      background: 'var(--bg-card)', color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                </span>
              ))}
              <button
                onClick={applyCustom}
                style={{
                  marginLeft: 4, padding: '7px 16px', borderRadius: 99, fontSize: 13, fontWeight: 500,
                  background: 'var(--accent-soft)', border: '1px solid var(--color-active)',
                  color: 'var(--color-active)', cursor: 'pointer',
                }}
              >
                set
              </button>
              <button
                onClick={() => setDurationMode('preset')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}
              >
                ← back
              </button>
            </div>
          )}
        </motion.div>

        {/* ── Ring — breathes when running ── */}
        <motion.div
          variants={{ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } } }}
        >
        <motion.div
          animate={status === 'running'
            ? { scale: [1, 1.03, 1], transition: { duration: 8, ease: 'easeInOut', repeat: Infinity } }
            : { scale: 1, transition: { duration: 0.6 } }}
          style={{ position: 'relative', width: SIZE, height: SIZE }}
        >
          <div style={{
            position: 'absolute', top: -28, left: -28,
            width: SIZE + 56, height: SIZE + 56, borderRadius: '50%',
            background: `radial-gradient(circle, ${glowHex} 0%, transparent 70%)`,
            opacity: status === 'running' ? 0.2 : 0.07,
            transition: 'opacity 0.8s ease, background 2s ease',
            pointerEvents: 'none',
          }} />
          <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)', filter: 'var(--focus-ring-shadow, none)' }}>
            <circle cx={SIZE/2} cy={SIZE/2} r={R} stroke="var(--color-inactive)" strokeOpacity={0.08} strokeWidth={STROKE} fill="none" />
            <circle
              cx={SIZE/2} cy={SIZE/2} r={R}
              stroke={ringColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              fill="none"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 2s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              fontSize: labelSize, fontWeight: 500,
              color: 'var(--text-primary)', letterSpacing: '-1px',
              fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums',
            }}>
              {countdownStr}
            </span>
          </div>
        </motion.div>
        </motion.div>

        {/* ── Buttons ── */}
        <motion.div
          variants={{ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } } }}
          style={{ display: 'flex', gap: 10, marginTop: 30 }}
        >
          {status === 'idle'    && <Btn color="active" onClick={handleStart}>Start</Btn>}
          {status === 'running' && <><Btn color="paused" onClick={handlePause}>Pause</Btn><Btn color="stop" onClick={handleStop}>Stop</Btn></>}
          {status === 'paused'  && <><Btn color="active" onClick={handleResume}>Resume</Btn><Btn color="stop" onClick={handleStop}>Stop</Btn></>}
        </motion.div>

        {/* ── Quote ── */}
        <motion.div
          variants={{ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } } }}
          style={{ marginTop: 30 }}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={quote}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              style={{
                fontSize: 15, fontWeight: 400,
                color: 'var(--color-ai)',
                textAlign: 'center', maxWidth: 340, lineHeight: 1.7,
                textShadow: '0 0 18px rgba(200,160,70,0.38), 0 0 44px rgba(200,160,70,0.16)',
                letterSpacing: '0.01em',
              }}
            >
              {quote}
            </motion.p>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  )
}

// Small helper to keep button styles DRY
function Btn({ color, onClick, children }) {
  const styles = {
    active: { bg: 'var(--color-active)', shadow: '0 2px 12px rgba(42,122,144,0.22)',   text: 'white' },
    paused: { bg: 'var(--color-paused)', shadow: '0 2px 12px rgba(138,120,174,0.22)', text: 'white' },
    stop:   { bg: 'var(--color-paused)',  shadow: '0 2px 12px rgba(154,136,180,0.22)', text: 'white' },
    ghost:  { bg: 'transparent',         shadow: 'none', text: 'var(--text-secondary)', border: '1px solid var(--border)' },
  }
  const s = styles[color] ?? styles.ghost
  return (
    <motion.button
      whileHover={{ filter: 'brightness(1.08)' }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      style={{
        padding: '11px 28px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        background: s.bg, color: s.text, border: s.border ?? 'none',
        boxShadow: s.shadow, cursor: 'pointer', minWidth: 90,
        transition: 'background 0.25s ease',
      }}
    >
      {children}
    </motion.button>
  )
}

// ── Pebble skip trail (calm visual progress, no gamification) ──────────── //

function RippleDot({ x, y }) {
  return (
    <g>
      <motion.circle
        cx={x} cy={y} r={3}
        fill="rgba(90,138,128,0.55)"
        initial={{ r: 3, opacity: 0.6 }}
        animate={{ r: 3, opacity: 0.55 }}
      />
      <motion.circle
        cx={x} cy={y}
        fill="none"
        stroke="rgba(90,138,128,0.35)"
        strokeWidth={1}
        initial={{ r: 3, opacity: 0.5 }}
        animate={{ r: 13, opacity: 0 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />
    </g>
  )
}

function ActiveDot({ x, y }) {
  return (
    <motion.circle
      cx={x} cy={y} r={4}
      fill="rgba(90,138,128,0.85)"
      animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    />
  )
}

function PebbleSkipTrail({ tasks, currentTaskId }) {
  const total = tasks.length
  if (total <= 1) return null

  const W       = 160
  const H       = 36
  const WATER_Y = 26
  const DOT_Y   = WATER_Y - 10
  const gap     = Math.min(22, (W - 16) / Math.max(total - 1, 1))
  const startX  = (W - gap * (total - 1)) / 2

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* Gentle water line */}
      <path
        d={`M 0 ${WATER_Y} Q ${W * 0.25} ${WATER_Y - 2} ${W * 0.5} ${WATER_Y} Q ${W * 0.75} ${WATER_Y + 2} ${W} ${WATER_Y}`}
        stroke="rgba(90,138,128,0.18)"
        strokeWidth={1}
        fill="none"
      />

      {tasks.map((task, i) => {
        const x       = startX + i * gap
        const isDone  = task.done
        const isCurr  = task.id === currentTaskId

        if (isDone)  return <RippleDot key={task.id} x={x} y={WATER_Y} />
        if (isCurr)  return <ActiveDot  key={task.id} x={x} y={DOT_Y}   />
        return (
          <circle
            key={task.id}
            cx={x} cy={DOT_Y} r={2.5}
            fill="rgba(90,138,128,0.15)"
          />
        )
      })}
    </svg>
  )
}

// ── Breathing circle (State 3 — Break) ─────────────────────────────────── //

function BreathingCircle() {
  const [phase, setPhase] = useState('in')   // 'in' | 'hold' | 'out'
  const phaseRef = useRef('in')

  useEffect(() => {
    const durations = { in: 4000, hold: 2000, out: 4000 }
    let timeout
    function advance() {
      const next = phaseRef.current === 'in' ? 'hold' : phaseRef.current === 'hold' ? 'out' : 'in'
      phaseRef.current = next
      setPhase(next)
      timeout = setTimeout(advance, durations[next])
    }
    timeout = setTimeout(advance, durations['in'])
    return () => clearTimeout(timeout)
  }, [])

  const scale     = phase === 'in' ? 1.18 : phase === 'hold' ? 1.18 : 0.82
  const ringScale = phase === 'in' ? 1.28 : phase === 'hold' ? 1.28 : 0.88
  const label = phase === 'in' ? 'breathe in' : phase === 'hold' ? 'hold' : 'breathe out'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 220, height: 220 }}>
      {/* Ghost ring — outer, more subtle */}
      <motion.div
        animate={{ scale: ringScale, opacity: phase === 'hold' ? 0.15 : 0.08 }}
        transition={{ duration: phase === 'hold' ? 0.1 : 4, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: 200, height: 200,
          borderRadius: '50%',
          border: '1px solid rgba(80,148,106,0.25)',
        }}
      />
      {/* Main circle */}
      <motion.div
        animate={{ scale }}
        transition={{ duration: phase === 'hold' ? 0.1 : 4, ease: 'easeInOut' }}
        style={{
          width: 160, height: 160,
          borderRadius: '50%',
          border: '1.5px solid rgba(80,148,106,0.3)',
          background: 'radial-gradient(circle, rgba(80,148,106,0.12) 0%, transparent 70%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.5 } }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '0 16px', letterSpacing: '0.3px' }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ── Main FocusMode ──────────────────────────────────────────────────────── //

export default function FocusMode() {
  const dispatch   = useDispatch()
  const navigate   = useNavigate()
  const location   = useLocation()
  const startBreak = location.state?.startBreak ?? false
  const { groups, focusGroupId, focusTaskId } = useSelector(s => s.tasks)
  const timerRef  = useRef(null)

  // Find the group and build task list
  const group = groups.find(g => g.id === focusGroupId) ?? null
  const groupTasks = group ? group.tasks.filter(t => !t.paused) : []

  // Session tracking
  const sessionStartRef  = useRef(Date.now())
  const breakTimeRef     = useRef(0)       // total ms spent on breaks
  const breakStartRef    = useRef(null)
  const tasksDoneThisSessionRef = useRef(0)
  const tasksSkippedRef  = useRef(0)
  const completionsSinceCheckinRef = useRef(0)
  const checkinTimerStartRef = useRef(Date.now())

  // Which task is currently focused
  const getStartTask = useCallback(() => {
    if (!group) return null
    if (focusTaskId) {
      const t = group.tasks.find(t => t.id === focusTaskId && !t.done && !t.paused)
      if (t) return t
    }
    return group.tasks.find(t => !t.done && !t.paused) ?? null
  }, [group, focusTaskId])

  const [currentTaskId, setCurrentTaskId] = useState(() => getStartTask()?.id ?? null)
  const currentTask = group?.tasks.find(t => t.id === currentTaskId) ?? null

  // App states
  // 'focusing' | 'checkin' | 'break' | 'escape' | 'after-escape' | 'summary'
  const [appState, setAppState] = useState('focusing')

  // Nudge text for current task
  const [nudgeText, setNudgeText]   = useState(null)
  const lastNudgeRef = useRef(null)

  // For completion animation
  const [completing, setCompleting] = useState(false)
  const [crossedOut, setCrossedOut] = useState(false)
  const [completionNudge, setCompletionNudge] = useState(null)

  // For skip animation direction
  const [slideDir, setSlideDir]     = useState(null) // 'skip' | 'next'

  // For escape hatch
  const [microTask, setMicroTask]   = useState(null)
  const [microTimerActive, setMicroTimerActive] = useState(false)
  const escapedTaskIdRef = useRef(null)

  // For break screen
  const [breakTip, setBreakTip]     = useState(null)
  const lastBreakTipRef = useRef(null)

  // Session summary
  const [summaryMsg, setSummaryMsg] = useState(null)
  const [summaryCtx, setSummaryCtx] = useState(null)
  const sessionSavedRef = useRef(false)

  // Overtime nudge (called once)
  const [overtimeNudgeShown, setOvertimeNudgeShown] = useState(false)

  // Energy check-in overlay visibility
  const [checkinVisible, setCheckinVisible] = useState(false)
  const checkinShownRef = useRef(false)

  // ── Load nudge when task changes ───────────────────────────────────────── //

  useEffect(() => {
    if (!currentTask || appState !== 'focusing') return
    setNudgeText(null)
    setCompletionNudge(null)
    lastNudgeRef.current = null

    let cancelled = false
    const timeout = setTimeout(() => {
      if (!cancelled) {
        const fallback = pickRandom(NUDGE_FALLBACKS, lastNudgeRef.current)
        lastNudgeRef.current = fallback
        setNudgeText(fallback)
      }
    }, 2000)

    fetchNudge(currentTask.task_name, 0)
      .then(r => {
        if (cancelled) return
        clearTimeout(timeout)
        const msg = r.nudge || r.message || r.text || pickRandom(NUDGE_FALLBACKS)
        lastNudgeRef.current = msg
        setNudgeText(msg)
      })
      .catch(() => { /* fallback already set by timeout */ })

    return () => { cancelled = true; clearTimeout(timeout) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTaskId])

  // ── Energy check-in trigger ────────────────────────────────────────────── //

  useEffect(() => {
    if (appState !== 'focusing' || checkinVisible) return
    const interval = setInterval(() => {
      const minutesSince = (Date.now() - checkinTimerStartRef.current) / 60000
      if (minutesSince >= 30) {
        if (!checkinShownRef.current) {
          checkinShownRef.current = true
          setCheckinVisible(true)
        }
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [appState, checkinVisible])

  // ── TASK COMPLETION FLOW ───────────────────────────────────────────────── //

  function handleDone() {
    if (completing || !currentTask) return
    setCompleting(true)

    // Step 1: fill ring
    timerRef.current?.forceComplete()

    // Step 3: cross out task name
    setTimeout(() => setCrossedOut(true), 400)

    // Step 4: completion nudge
    setTimeout(() => {
      const fallback = pickRandom(COMPLETION_FALLBACKS)
      setCompletionNudge(fallback)
      fetchNudge(currentTask.task_name, timerRef.current?.getElapsedMinutes?.() ?? 0)
        .then(r => {
          const msg = r.nudge || r.message || r.text || fallback
          setCompletionNudge(msg)
        })
        .catch(() => {})
    }, 600)

    // Step 5+: fade out, update Redux, advance
    const completedTaskId = currentTask.id
    const completedGroupId = group.id
    // Capture next task from current snapshot BEFORE marking done
    const nextTaskSnapshot = group.tasks.find(t => !t.done && !t.paused && t.id !== completedTaskId) ?? null

    setTimeout(() => {
      setSlideDir('next')
      dispatch(tasksActions.completeTask({ groupId: completedGroupId, taskId: completedTaskId }))
      tasksDoneThisSessionRef.current++
      completionsSinceCheckinRef.current++

      setTimeout(() => {
        setCompleting(false)
        setCrossedOut(false)
        setCompletionNudge(null)
        setSlideDir(null)
        if (nextTaskSnapshot) {
          setCurrentTaskId(nextTaskSnapshot.id)
          timerRef.current?.reset(nextTaskSnapshot.duration_minutes)
          setTimeout(() => timerRef.current?.start(), 100)
        } else {
          goToSummary()
        }
      }, 500)
    }, 1500)
  }

  // ── SKIP FLOW ──────────────────────────────────────────────────────────── //

  // We need a ref to track the skipped task id across async callbacks
  const skippedTaskIdRef = useRef(null)
  const [skipPending, setSkipPending] = useState(false)

  function handleSkipWithTransition() {
    if (completing || !currentTask) return
    setSlideDir('skip')
    skippedTaskIdRef.current = currentTask.id
    tasksSkippedRef.current++
    setSkipPending(true)
    dispatch(tasksActions.skipTask({ groupId: group.id, taskId: currentTask.id }))
  }

  useEffect(() => {
    if (!skipPending) return
    setSkipPending(false)
    setTimeout(() => {
      setSlideDir(null)
      // Find first uncompleted task in the updated group
      // The skipped task is now at the end; first uncompleted != skipped unless only one task
      const updatedGroup = groups.find(g => g.id === group?.id)
      if (!updatedGroup) return
      const undoneTasks = updatedGroup.tasks.filter(t => !t.done && !t.paused)
      // Find first that is not the just-skipped task
      const nextTask = undoneTasks.find(t => t.id !== skippedTaskIdRef.current)
        ?? (undoneTasks.length > 0 ? undoneTasks[0] : null)
      if (nextTask) {
        setCurrentTaskId(nextTask.id)
        timerRef.current?.reset(nextTask.duration_minutes)
        setTimeout(() => timerRef.current?.start(), 100)
      } else {
        goToSummary()
      }
    }, 350)
  }, [skipPending]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── BREAK ──────────────────────────────────────────────────────────────── //

  function handleBreak() {
    timerRef.current?.pause()
    breakStartRef.current = Date.now()
    const tip = pickRandom(BREAK_TIPS, lastBreakTipRef.current)
    lastBreakTipRef.current = tip
    setBreakTip(tip)
    setAppState('break')
  }

  function handleBackFromBreak() {
    if (breakStartRef.current) {
      breakTimeRef.current += Date.now() - breakStartRef.current
      breakStartRef.current = null
    }
    setAppState('focusing')
    setTimeout(() => timerRef.current?.resume(), 50)
  }

  // ── ESCAPE HATCH ───────────────────────────────────────────────────────── //

  function handleEscape() {
    timerRef.current?.pause()
    escapedTaskIdRef.current = currentTask?.id ?? null
    setMicroTask(null)
    setMicroTimerActive(false)
    setAppState('escape')

    if (!currentTask) return
    const fallback = `start: ${currentTask.task_name}`
    // Call decompose for single micro-task
    decompose({ goal: currentTask.task_name, granularity: 'micro', reading_level: 'simple' })
      .then(r => {
        if (r.flagged) { setMicroTask(fallback); return }
        const steps = r.steps || []
        const first = steps[0]?.task_name || steps[0]?.name || null
        setMicroTask(first || fallback)
      })
      .catch(() => setMicroTask(fallback))
  }

  function handleCanDo() {
    setMicroTimerActive(true)
  }

  function handleMicroDone() {
    // Mark escaped original task as complete
    if (escapedTaskIdRef.current && group) {
      dispatch(tasksActions.completeTask({ groupId: group.id, taskId: escapedTaskIdRef.current }))
      tasksDoneThisSessionRef.current++
    }
    setAppState('after-escape')
  }

  // ── AFTER ESCAPE ───────────────────────────────────────────────────────── //

  function handleKeepGoing() {
    // group is from selector — already reflects completed task (dispatched in handleMicroDone)
    const nextTask = group?.tasks.find(t => !t.done && !t.paused) ?? null
    setAppState('focusing')
    if (nextTask) {
      setCurrentTaskId(nextTask.id)
      timerRef.current?.reset(nextTask.duration_minutes)
      setTimeout(() => timerRef.current?.start(), 100)
    } else {
      goToSummary()
    }
  }

  // ── SUMMARY ────────────────────────────────────────────────────────────── //

  function goToSummary() {
    setAppState('summary')
  }

  useEffect(() => {
    if (appState !== 'summary') return
    // Generate heading
    const allDone = tasksDoneThisSessionRef.current > 0 &&
      (group?.tasks.filter(t => !t.paused).every(t => t.done) ?? false)
    setSummaryMsg(allDone ? 'you finished everything.' : pickRandom(SUMMARY_FALLBACKS))
    setSummaryCtx('you put in focused time on what matters. the rest can wait.')

    // Save session (once)
    if (!sessionSavedRef.current) {
      sessionSavedRef.current = true
      const totalMs = Date.now() - sessionStartRef.current - breakTimeRef.current
      const totalMinutes = Math.round(totalMs / 60000)
      createSession({
        tasks_completed: tasksDoneThisSessionRef.current,
        tasks_skipped:   tasksSkippedRef.current,
        total_minutes:   totalMinutes,
        group_name:      group?.name ?? 'Focus Session',
      }).catch(() => {})
    }
  }, [appState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start timer on mount (when focusing) ──────────────────────────────── //

  useEffect(() => {
    if (appState === 'focusing' && currentTask) {
      setTimeout(() => timerRef.current?.start(), 200)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── No tasks: show standalone timer ──────────────────────────────────── //

  if (!group || groupTasks.length === 0 || startBreak) {
    return <StandaloneFocus startBreak={startBreak} />
  }

  // Compute elapsed minutes for summary
  const totalElapsedMs   = Date.now() - sessionStartRef.current - breakTimeRef.current
  const totalMinutesSpent = Math.max(1, Math.round(totalElapsedMs / 60000))

  // ── Render ────────────────────────────────────────────────────────────── //

  return (
    <div style={{
      height: '100vh', width: '100vw',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Ambient glow — breathes at page level, color shifts with timer state */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(42,122,144,0.07) 0%, transparent 70%)',
        zIndex: 0,
      }} />
      <AnimatePresence mode="wait">

        {/* ════════════════════════════════════════ STATE 1: FOCUSING ══ */}
        {appState === 'focusing' && (
          <motion.div
            key="focusing"
            variants={fadeUp}
            initial="initial" animate="animate" exit="exit"
            style={{
              width: '100%', maxWidth: 440,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center',
              minHeight: '100vh',
              position: 'relative', zIndex: 1,
              padding: '18px',
            }}
          >
            {/* EXIT — top right */}
            <button
              onClick={goToSummary}
              style={{
                position: 'absolute', top: 18, right: 18,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, letterSpacing: '0.3px', textTransform: 'uppercase',
                color: 'var(--text-muted)', padding: '4px 8px', minHeight: 32,
              }}
            >
              EXIT
            </button>

            {/* Centered content */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 0, width: '100%',
            }}>
              {/* Task name */}
              <AnimatePresence mode="wait">
                <motion.h2
                  key={currentTaskId}
                  initial={slideDir === 'skip'
                    ? { opacity: 0, x: -40 }
                    : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, x: 0, y: 0, transition: { duration: 0.45, ease: [0.4,0,0.2,1] } }}
                  exit={slideDir === 'skip'
                    ? { opacity: 0, x: 40, transition: { duration: 0.3 } }
                    : { opacity: 0, y: -12, transition: { duration: 0.4 } }}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22, fontWeight: 400, color: 'var(--text-primary)',
                    letterSpacing: '-0.2px', textAlign: 'center',
                    maxWidth: 360, lineHeight: 1.4,
                    marginBottom: 24,
                    textDecoration: crossedOut ? 'line-through' : 'none',
                    opacity: crossedOut ? 0.5 : 1,
                    transition: 'text-decoration 0.4s ease, opacity 0.4s ease',
                  }}
                >
                  {currentTask?.task_name ?? ''}
                </motion.h2>
              </AnimatePresence>

              {/* Timer ring */}
              <FocusTimer
                ref={timerRef}
                durationMinutes={currentTask?.duration_minutes ?? 25}
                onOvertimeNudge={() => {
                  if (!overtimeNudgeShown) {
                    setOvertimeNudgeShown(true)
                    const msg = pickRandom(OVERTIME_FALLBACKS)
                    setNudgeText(msg)
                  }
                }}
              />

              {/* Done button */}
              <motion.button
                whileHover={{ filter: 'brightness(1.1)', boxShadow: '0 4px 20px rgba(80,148,106,0.35)' }}
                whileTap={{ scale: 0.97 }}
                onClick={handleDone}
                disabled={completing}
                style={{
                  marginTop: 24,
                  padding: '12px 48px',
                  borderRadius: 8,
                  background: 'var(--color-done)',
                  color: 'white',
                  fontSize: 14, fontWeight: 500,
                  border: 'none', cursor: completing ? 'default' : 'pointer',
                  boxShadow: '0 2px 12px rgba(80,148,106,0.25)',
                  opacity: completing ? 0.7 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                Done
              </motion.button>

              {/* Skip / Break links */}
              <div style={{ display: 'flex', gap: 20, marginTop: 10, alignItems: 'center' }}>
                <button
                  onClick={handleSkipWithTransition}
                  disabled={completing}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: 'var(--text-muted)',
                    padding: '6px 10px', minHeight: 36,
                  }}
                >
                  Skip
                </button>
                <button
                  onClick={handleBreak}
                  disabled={completing}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: 'var(--color-upcoming)',
                    padding: '6px 10px', minHeight: 36,
                  }}
                >
                  Break
                </button>
              </div>

              {/* Pebble skip trail */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
                <PebbleSkipTrail tasks={groupTasks} currentTaskId={currentTaskId} />
              </div>

              {/* AI nudge */}
              <AnimatePresence mode="wait">
                {(completionNudge || nudgeText) && (
                  <motion.p
                    key={completionNudge || nudgeText}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{
                      marginTop: 20,
                      fontSize: 12, color: 'var(--color-ai)',
                      textAlign: 'center', maxWidth: 340, lineHeight: 1.6,
                    }}
                  >
                    {completionNudge || nudgeText}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* "I need a pause" — bottom */}
            <button
              onClick={handleEscape}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--color-paused)',
                padding: '8px 16px', minHeight: 40,
                marginBottom: 8,
              }}
            >
              I need a pause
            </button>

            {/* ── Energy check-in overlay ── */}
            <AnimatePresence>
              {checkinVisible && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.4 } }}
                  exit={{ opacity: 0, transition: { duration: 0.3 } }}
                  style={{
                    position: 'fixed', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg)',
                    zIndex: 50,
                  }}
                >
                  {/* Ghost ring behind check-in — per spec: focusing content fades to 0.12 */}
                  <div style={{
                    position: 'absolute', inset: 0, opacity: 0.12,
                    pointerEvents: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 170, height: 170, borderRadius: '50%',
                      border: '3px solid var(--color-active)',
                    }} />
                  </div>

                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>
                      Quick check-in
                    </h3>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
                      How are you feeling?
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[
                        { label: 'Good',          bg: 'rgba(80,148,106,0.12)', border: 'rgba(80,148,106,0.2)',   color: 'var(--color-done)',   action: 'good' },
                        { label: 'Getting tired', bg: 'rgba(200,160,70,0.1)',  border: 'rgba(200,160,70,0.15)',  color: 'var(--color-ai)',     action: 'tired' },
                        { label: 'Too much',      bg: 'rgba(138,120,174,0.1)', border: 'rgba(138,120,174,0.15)', color: 'var(--color-paused)', action: 'escape' },
                      ].map(btn => (
                        <button
                          key={btn.action}
                          onClick={() => {
                            setCheckinVisible(false)
                            checkinShownRef.current = false
                            completionsSinceCheckinRef.current = 0
                            checkinTimerStartRef.current = Date.now()
                            if (btn.action === 'good') {
                              // continue — check-in dismissed, back to focusing
                            } else if (btn.action === 'tired') {
                              handleBreak()
                            } else {
                              handleEscape()
                            }
                          }}
                          style={{
                            padding: '10px 24px', borderRadius: 8,
                            background: btn.bg,
                            border: `1px solid ${btn.border}`,
                            color: btn.color,
                            fontSize: 12, fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ════════════════════════════════════════ STATE 3: BREAK ══════ */}
        {appState === 'break' && (
          <motion.div
            key="break"
            variants={fadeUp}
            initial="initial" animate="animate" exit="exit"
            style={{
              maxWidth: 440, width: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6,
              padding: '2rem',
            }}
          >
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>
              Taking a break.
            </h2>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 28px' }}>
              No rush.
            </p>

            <BreathingCircle />

            <p style={{
              marginTop: 20,
              fontSize: 12, color: 'var(--text-muted)',
              textAlign: 'center', maxWidth: 260, lineHeight: 1.65,
            }}>
              {breakTip}
            </p>

            <motion.button
              whileHover={{ filter: 'brightness(1.08)' }}
              whileTap={{ scale: 0.97 }}
              onClick={handleBackFromBreak}
              style={{
                marginTop: 24,
                padding: '10px 28px', borderRadius: 8,
                background: 'var(--color-active)',
                color: 'white',
                fontSize: 12, fontWeight: 500,
                border: 'none', cursor: 'pointer',
              }}
            >
              I'm back
            </motion.button>
          </motion.div>
        )}

        {/* ════════════════════════════════════════ STATE 4: ESCAPE ═════ */}
        {appState === 'escape' && (
          <motion.div
            key="escape"
            variants={fadeUpSlow}
            initial="initial" animate="animate" exit="exit"
            style={{
              maxWidth: 440, width: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 0,
              padding: '2rem',
            }}
          >
            {!microTimerActive ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                  One small thing:
                </p>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: 'var(--text-primary)',
                  textAlign: 'center', maxWidth: 320, lineHeight: 1.4,
                  margin: 0,
                }}>
                  {microTask ?? currentTask?.task_name ?? '…'}
                </h2>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '10px 0 28px', opacity: 0.65 }}>
                  That's it. Nothing else.
                </p>
                <motion.button
                  whileHover={{ filter: 'brightness(1.08)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCanDo}
                  style={{
                    padding: '12px 32px', borderRadius: 8,
                    background: 'var(--color-active)',
                    color: 'white',
                    fontSize: 13, fontWeight: 500,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  I can do this
                </motion.button>
              </>
            ) : (
              /* Mini focus mode for micro-task */
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.4 } }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
              >
                <h2 style={{
                  fontSize: 18, fontWeight: 500, color: 'var(--text-primary)',
                  textAlign: 'center', maxWidth: 300, lineHeight: 1.4, margin: 0,
                }}>
                  {microTask}
                </h2>
                <MiniTimer durationMinutes={5} onDone={handleMicroDone} />
                <button
                  onClick={handleMicroDone}
                  style={{
                    padding: '10px 32px', borderRadius: 8,
                    background: 'var(--color-done)',
                    color: 'white',
                    fontSize: 13, fontWeight: 500,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Done
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════ STATE 5: AFTER-ESCAPE */}
        {appState === 'after-escape' && (
          <motion.div
            key="after-escape"
            variants={fadeUp}
            initial="initial" animate="animate" exit="exit"
            style={{
              maxWidth: 440, width: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 0,
              padding: '3rem 2rem',
              position: 'relative',
            }}
          >
            {/* Pebble dot */}
            <motion.div
              animate={{ scale: [0.88, 1.1, 0.88], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 10, height: 10, borderRadius: '50%', background: '#5A8A80', marginBottom: 24 }}
            />

            {/* Breathing ring */}
            <motion.div
              animate={{ scale: [1, 1.06, 1], opacity: [0.18, 0.32, 0.18] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                width: 180, height: 180, borderRadius: '50%',
                border: '2px solid var(--color-paused)',
                pointerEvents: 'none',
              }}
            />

            <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', margin: 0, textAlign: 'center', position: 'relative' }}>
              you did something. that counts.
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0', textAlign: 'center', lineHeight: 1.6, maxWidth: 280, position: 'relative' }}>
              seriously. taking a step back takes courage.
            </p>
            {currentTask && (
              <p style={{ fontSize: 11, color: 'var(--color-paused)', margin: '12px 0 28px', position: 'relative' }}>
                paused: {currentTask.task_name}
              </p>
            )}
            {!currentTask && <div style={{ marginBottom: 28 }} />}

            <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
              <button
                onClick={handleKeepGoing}
                style={{
                  padding: '10px 24px', borderRadius: 8,
                  background: 'var(--color-done)', color: 'white',
                  fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                }}
              >
                Keep going
              </button>
              <button
                onClick={goToSummary}
                style={{
                  padding: '10px 24px', borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                I'm done for now
              </button>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════ STATE 6: SUMMARY ════ */}
        {appState === 'summary' && (
          <motion.div
            key="summary"
            variants={fadeUp}
            initial="initial" animate="animate" exit="exit"
            style={{
              maxWidth: 440, width: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 0,
              padding: '2rem',
            }}
          >
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22, fontWeight: 400, color: 'var(--text-primary)',
              textAlign: 'center', margin: '0 0 18px',
            }}>
              {summaryMsg}
            </h2>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', marginBottom: 18 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-done)', lineHeight: 1 }}>
                  {tasksDoneThisSessionRef.current}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>completed</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-active)', lineHeight: 1 }}>
                  {totalMinutesSpent}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>minutes</div>
              </div>
              {tasksSkippedRef.current > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-upcoming)', lineHeight: 1 }}>
                    {tasksSkippedRef.current}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>for later</div>
                </div>
              )}
            </div>

            {/* Context message */}
            <p style={{
              fontSize: 11, color: 'var(--text-secondary)',
              textAlign: 'center', maxWidth: 320, lineHeight: 1.6,
              margin: '0 0 24px',
            }}>
              {summaryCtx}
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => { dispatch(tasksActions.clearFocus()); navigate('/tasks') }}
                style={{
                  padding: '10px 22px', borderRadius: 8,
                  background: 'var(--color-active)', color: 'white',
                  fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                }}
              >
                Back to tasks
              </button>
              <button
                onClick={() => { dispatch(tasksActions.clearFocus()); navigate('/') }}
                style={{
                  padding: '10px 22px', borderRadius: 8,
                  background: 'rgba(200,148,80,0.08)',
                  border: '1px solid rgba(200,148,80,0.12)',
                  color: 'var(--color-ai)',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                Talk to Pebble
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── MiniTimer (escape hatch 5-minute timer) ─────────────────────────────── //

function MiniTimer({ durationMinutes = 5, onDone }) {
  const SIZE   = 80
  const STROKE = 2.5
  const R      = (SIZE - STROKE * 2) / 2
  const CIRC   = 2 * Math.PI * R

  const totalMs = durationMinutes * 60 * 1000
  const [fraction, setFraction] = useState(1)
  const startRef = useRef(Date.now())
  const doneRef  = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed    = Date.now() - startRef.current
      const remaining  = Math.max(0, totalMs - elapsed)
      const newFraction = remaining / totalMs
      setFraction(newFraction)
      if (remaining <= 0 && !doneRef.current) {
        doneRef.current = true
        clearInterval(id)
        onDone?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [totalMs, onDone])

  const dashOffset = CIRC * (1 - fraction)

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={SIZE/2} cy={SIZE/2} r={R} stroke="var(--color-inactive)" strokeOpacity={0.1} strokeWidth={STROKE} fill="none" />
        <circle
          cx={SIZE/2} cy={SIZE/2} r={R}
          stroke="var(--color-active)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={dashOffset}
          fill="none"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          ~{Math.max(1, Math.ceil(fraction * durationMinutes))}m
        </span>
      </div>
    </div>
  )
}
