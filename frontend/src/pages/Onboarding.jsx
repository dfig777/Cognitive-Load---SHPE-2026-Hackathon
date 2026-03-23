import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch } from 'react-redux'
import { prefsActions } from '../store'
import { savePreferences } from '../utils/api'

// ── Animation constants ───────────────────────────────────────────────── //

const EXIT    = { opacity: 0, y: -8,  transition: { duration: 0.4,  ease: 'easeOut' } }
const ENTER   = { opacity: 0, y:  12 }
const ENTER_T = { opacity: 1, y:   0, transition: { duration: 0.5,  ease: [0.4, 0, 0.2, 1] } }

// Stagger helper for choice cards
function cardAnim(i) {
  return {
    initial:  { opacity: 0, y: 6 },
    animate:  { opacity: 1, y: 0, transition: { delay: 0.18 + i * 0.08, duration: 0.42, ease: [0.4, 0, 0.2, 1] } },
  }
}

const SHELL_STYLE = {
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  gap:            '1.35rem',
  textAlign:      'center',
  padding:        '1.5rem 1.5rem',
  maxWidth:       440,
  width:          '100%',
}

// ── Font options ──────────────────────────────────────────────────────── //

const FONTS = [
  { value: 'default',      label: 'default',       sub: 'DM Sans — clear and friendly',          css: 'var(--font-body)' },
  { value: 'lexend',       label: 'Lexend',         sub: 'easier to read — reduced visual stress', css: '"Lexend", sans-serif' },
  { value: 'atkinson',     label: 'Atkinson',       sub: 'maximum clarity',                        css: '"Atkinson Hyperlegible", sans-serif' },
  { value: 'opendyslexic', label: 'OpenDyslexic',   sub: 'designed for dyslexia',                  css: '"OpenDyslexic", sans-serif' },
]

// ── Sub-components ────────────────────────────────────────────────────── //

function ChoiceCard({ label, sub, selected, dimmed, fontCss, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={!selected && !dimmed ? {
        background: 'var(--accent-soft)',
        borderColor: 'rgba(42,122,144,0.4)',
      } : {}}
      whileTap={{ scale: 0.98 }}
      animate={selected ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.15 }}
      style={{
        width:       '100%',
        textAlign:   'left',
        background:  selected ? 'rgba(42,122,144,0.12)' : 'var(--bg-card)',
        border:      selected ? '1.5px solid rgba(42,122,144,0.5)' : '1px solid var(--border)',
        borderLeft:  selected ? '3px solid rgba(42,122,144,0.7)' : '3px solid transparent',
        boxShadow:   selected ? '0 0 0 3px rgba(42,122,144,0.08)' : 'none',
        borderRadius: 12,
        padding:     '14px 18px',
        cursor:      'pointer',
        opacity:     dimmed ? 0.35 : 1,
        transition:  'opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        fontFamily:  fontCss || 'inherit',
        display:     'flex',
        alignItems:  'flex-start',
        gap:         10,
      }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: selected ? '#5A8A80' : 'var(--border)',
        marginTop: 5, flexShrink: 0,
        transition: 'background 0.2s ease, transform 0.2s ease',
        transform: selected ? 'scale(1.4)' : 'scale(1)',
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', fontFamily: fontCss || 'inherit' }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
      </div>
    </motion.button>
  )
}

function ThemePreviewCard({ label, themeKey, selected, onClick }) {
  const bg = {
    morning: 'linear-gradient(160deg, #F5E6D3 0%, #EDD5B8 100%)',
    night:   'linear-gradient(160deg, #1A2535 0%, #243350 100%)',
    auto:    'linear-gradient(160deg, #F2E8DC 0%, #C8D8E0 100%)',
  }
  const textColor = themeKey === 'night' ? '#DCD4DA' : '#5A5047'
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      style={{
        width:        110,
        height:       150,
        borderRadius: 14,
        background:   bg[themeKey] || bg.auto,
        border:       selected ? '2px solid rgba(42,122,144,0.65)' : '1.5px solid rgba(210,200,188,0.2)',
        cursor:       'pointer',
        overflow:     'hidden',
        position:     'relative',
        flexShrink:   0,
        display:      'flex',
        flexDirection: 'column',
        padding:      10,
        gap:          6,
        transition:   'border-color 0.2s ease',
      }}
    >
      <div style={{ height: 7,  background: themeKey === 'night' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', borderRadius: 4 }} />
      <div style={{ height: 18, background: 'rgba(200,148,80,0.22)', borderRadius: 7, marginTop: 2 }} />
      <div style={{ height: 11, background: 'rgba(200,148,80,0.12)', borderRadius: 5, width: '65%' }} />
      <div style={{ height: 14, borderRadius: 7, marginLeft: 'auto', background: themeKey === 'night' ? 'rgba(42,122,144,0.25)' : 'rgba(42,122,144,0.15)', width: '50%' }} />
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5A8A80', marginTop: 'auto' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '5px 6px',
        background: themeKey === 'night' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)',
        fontSize: 10, fontWeight: 500, color: textColor, textAlign: 'center',
      }}>
        {label}
      </div>
    </motion.button>
  )
}

function DescribeInput({ onSubmit }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 80) }, [])
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto', transition: { duration: 0.28 } }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      style={{ width: '100%', overflow: 'hidden' }}
    >
      <form onSubmit={e => { e.preventDefault(); onSubmit(val) }} style={{ display: 'flex', gap: 8 }}>
        <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
          placeholder="describe what works best for you..." style={{ flex: 1, borderRadius: 12, fontSize: 13 }} />
        <button type="submit" className="btn btn-primary" style={{ flexShrink: 0, fontSize: 13 }}>done</button>
      </form>
    </motion.div>
  )
}

function SettingsNote() {
  return (
    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.5, transition: { duration: 0.4, delay: 0.55 } }}
      style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
      you can change any of these anytime in settings
    </motion.p>
  )
}

// ── Helper ────────────────────────────────────────────────────────────── //

function resolveTheme(t) {
  if (t !== 'auto') return t
  const h = new Date().getHours()
  if (h >= 6  && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

// ── Main component ────────────────────────────────────────────────────── //

export default function Onboarding() {
  const dispatch = useDispatch()

  const [stage,        setStage]        = useState('welcome')
  const [nameInput,    setNameInput]    = useState('')
  const [name,         setName]         = useState('')
  const [readingLevel, setReadingLevel] = useState('standard')
  const [fontChoice,   setFontChoice]   = useState('default')
  const [themeChoice,  setThemeChoice]  = useState('auto')
  const [granularity,  setGranularity]  = useState('normal')
  const [commStyle,    setCommStyle]    = useState('balanced')

  // Per-stage UI state
  const [selectedCard, setSelectedCard] = useState(null)
  const [showDescribe, setShowDescribe] = useState(false)
  const [unsureMsg,    setUnsureMsg]    = useState('')

  const nameRef = useRef(null)

  // Reset per-stage UI on every stage change
  useEffect(() => {
    setSelectedCard(null)
    setShowDescribe(false)
    setUnsureMsg('')
  }, [stage])

  // Auto-focus name input
  useEffect(() => {
    if (stage === 'name') setTimeout(() => nameRef.current?.focus(), 320)
  }, [stage])

  // Welcome → name (hold ~3.5s after lines animate in)
  useEffect(() => {
    if (stage !== 'welcome') return
    const t = setTimeout(() => setStage('name'), 3600)
    return () => clearTimeout(t)
  }, [stage])

  // Meet → q2 (hold 1.5s)
  useEffect(() => {
    if (stage !== 'meet') return
    const t = setTimeout(() => setStage('q2'), 1600)
    return () => clearTimeout(t)
  }, [stage])

  // Complete → final
  useEffect(() => {
    if (stage !== 'complete') return
    const t = setTimeout(() => setStage('final'), 1600)
    return () => clearTimeout(t)
  }, [stage])

  // Final → save preferences and enter app
  useEffect(() => {
    if (stage !== 'final') return
    const t = setTimeout(async () => {
      const resolvedTheme = resolveTheme(themeChoice)
      const prefs = {
        name,
        reading_level:       readingLevel,
        font_choice:         fontChoice,
        color_theme:         resolvedTheme,
        granularity,
        communication_style: commStyle,
        onboarding_complete: true,
        walkthrough_complete: false,
      }
      try { await savePreferences(prefs) } catch { /* best effort */ }
      dispatch(prefsActions.setPrefs({
        name,
        readingLevel,
        fontChoice,
        colorTheme:         resolvedTheme,
        granularity,
        communicationStyle: commStyle,
        onboardingComplete: true,
        walkthroughComplete: false,
      }))
    }, 1100)
    return () => clearTimeout(t)
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply font immediately when picked
  useEffect(() => {
    document.documentElement.setAttribute('data-font', fontChoice)
  }, [fontChoice])

  // ── Multi-choice handler factory ─────────────────────────────────── //

  function pickChoice({ setValue, validValues, defaultVal, nextStage, unsureText }) {
    return (v) => {
      if (v === 'describe') {
        setShowDescribe(s => !s)
        setSelectedCard('describe')
        return
      }
      setValue(validValues.includes(v) ? v : defaultVal)
      if (v === 'unsure') {
        setSelectedCard('unsure')
        setUnsureMsg(unsureText)
        setTimeout(() => setStage(nextStage), 2300)
        return
      }
      setSelectedCard(v)
      setTimeout(() => setStage(nextStage), 500)
    }
  }

  const handleQ2 = pickChoice({ setValue: setReadingLevel, validValues: ['simple','standard','detailed'], defaultVal: 'standard', nextStage: 'q3', unsureText: "no worries. we'll go with a nice balance for now. you can always change it later." })
  const handleQ5 = pickChoice({ setValue: setGranularity,  validValues: ['micro','normal','broad'],       defaultVal: 'normal',   nextStage: 'q6', unsureText: "no worries. we'll start with a clear plan. you can always ask for more or less detail." })
  const handleQ6 = pickChoice({ setValue: setCommStyle,    validValues: ['warm','direct','balanced'],     defaultVal: 'balanced', nextStage: 'complete', unsureText: "no worries. we'll start with a little of each and you can adjust anytime." })

  // ── Stage content ─────────────────────────────────────────────────── //

  function renderContent() {
    // welcome is handled separately (special stagger animation)
    switch (stage) {

      case 'name':
        return (
          <>
            <motion.p initial={ENTER} animate={ENTER_T}
              style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 'clamp(22px, 4vw, 26px)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              first, who will i be helping?
            </motion.p>
            <motion.form initial={ENTER} animate={{ ...ENTER_T, transition: { ...ENTER_T.transition, delay: 0.18 } }}
              onSubmit={e => { e.preventDefault(); const n = nameInput.trim(); if (n) { setName(n); setStage('confirm-name') } }}
              style={{ width: '100%', maxWidth: 300 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input ref={nameRef} value={nameInput} onChange={e => setNameInput(e.target.value)}
                  placeholder="Your name" autoComplete="given-name"
                  style={{ width: '100%', height: 48, borderRadius: 12, paddingRight: 48, paddingLeft: 16, fontSize: 15, textAlign: 'center', boxSizing: 'border-box' }} />
                <button type="submit" disabled={!nameInput.trim()} aria-label="Submit"
                  style={{
                    position: 'absolute', right: 8, width: 32, height: 32, borderRadius: '50%',
                    background: nameInput.trim() ? '#5A8A80' : 'rgba(90,138,128,0.22)',
                    border: 'none', cursor: nameInput.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.25s ease', flexShrink: 0,
                  }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </motion.form>
          </>
        )

      case 'confirm-name':
        return (
          <>
            <motion.p initial={ENTER} animate={ENTER_T}
              style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 'clamp(22px, 4vw, 26px)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              {name}, is that right?
            </motion.p>
            <motion.div initial={ENTER} animate={{ ...ENTER_T, transition: { ...ENTER_T.transition, delay: 0.15 } }}
              style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" style={{ borderRadius: 8 }} onClick={() => setStage('meet')}>
                that's me
              </button>
              <button className="btn btn-ghost" style={{ borderRadius: 8 }} onClick={() => { setNameInput(name); setStage('name') }}>
                let me fix that
              </button>
            </motion.div>
          </>
        )

      case 'meet':
        return (
          <motion.p initial={ENTER} animate={ENTER_T}
            style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 'clamp(18px, 4vw, 22px)', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
            nice to meet you, {name}.<br />
            <span style={{ fontSize: '0.82em', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 400, letterSpacing: '0.01em' }}>
              a few quick questions so this feels right for you.
            </span>
          </motion.p>
        )

      case 'q2':
        return (
          <>
            <motion.p initial={ENTER} animate={ENTER_T}
              style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 'clamp(20px, 4vw, 24px)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              How would you like me to walk you through things?
            </motion.p>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
              {[
                { v: 'simple',   l: 'short and clear',            s: 'just the essentials.' },
                { v: 'standard', l: 'a good balance',             s: 'enough detail, nothing extra.' },
                { v: 'detailed', l: 'give me everything',         s: "i like having the full picture." },
                { v: 'describe', l: 'let me describe what i need', s: null },
                { v: 'unsure',   l: "i'm not sure yet",           s: null },
              ].map((c, i) => (
                <motion.div key={c.v} {...cardAnim(i)}>
                  <ChoiceCard label={c.l} sub={c.s}
                    selected={selectedCard === c.v}
                    dimmed={!!selectedCard && selectedCard !== c.v && selectedCard !== 'describe' && c.v !== 'describe'}
                    onClick={() => { if (['simple','standard','detailed'].includes(c.v)) setReadingLevel(c.v); handleQ2(c.v) }}
                  />
                </motion.div>
              ))}
            </div>
            <AnimatePresence>
              {showDescribe && <DescribeInput onSubmit={() => { setReadingLevel('standard'); setShowDescribe(false); setStage('q3') }} />}
            </AnimatePresence>
            <AnimatePresence>
              {unsureMsg && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>{unsureMsg}</motion.p>}
            </AnimatePresence>
            <SettingsNote />
          </>
        )

      case 'q3':
        return (
          <>
            <motion.p initial={ENTER} animate={ENTER_T}
              style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 'clamp(20px, 4vw, 24px)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              Is there a font that feels easier to read?
            </motion.p>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
              {FONTS.map((f, i) => (
                <motion.div key={f.value} {...cardAnim(i)}>
                  <ChoiceCard label={f.label} sub={f.sub} fontCss={f.css}
                    selected={selectedCard === f.value || (!selectedCard && fontChoice === f.value)}
                    dimmed={!!selectedCard && selectedCard !== f.value}
                    onClick={() => { setFontChoice(f.value); setSelectedCard(f.value); setTimeout(() => setStage('q4'), 500) }}
                  />
                </motion.div>
              ))}
            </div>
            <SettingsNote />
          </>
        )

      case 'q4':
        return (
          <>
            <motion.p initial={ENTER} animate={ENTER_T}
              style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 'clamp(20px, 4vw, 24px)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              Choose the space that feels most comfortable.
            </motion.p>
            <motion.div initial={ENTER} animate={{ ...ENTER_T, transition: { ...ENTER_T.transition, delay: 0.18 } }}
              style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { v: 'morning', l: 'warm' },
                { v: 'night',   l: 'dark' },
                { v: 'auto',    l: 'match the time' },
              ].map((t, i) => (
                <motion.div key={t.v} {...cardAnim(i)}>
                  <ThemePreviewCard label={t.l} themeKey={t.v} selected={themeChoice === t.v}
                    onClick={() => {
                      setThemeChoice(t.v)
                      document.documentElement.setAttribute('data-time-theme', resolveTheme(t.v))
                      setSelectedCard(t.v)
                      setTimeout(() => setStage('q5'), 650)
                    }}
                  />
                </motion.div>
              ))}
            </motion.div>
          </>
        )

      case 'q5':
        return (
          <>
            <motion.p initial={ENTER} animate={ENTER_T}
              style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 'clamp(20px, 4vw, 24px)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              When something needs to get done, how should I break it down?
            </motion.p>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
              {[
                { v: 'micro',   l: 'walk me through it step by step', s: 'the smaller, the better.' },
                { v: 'normal',  l: 'give me a clear plan',            s: 'not too detailed, not too vague.' },
                { v: 'broad',   l: 'just show me the big picture',    s: "i'll figure out the rest." },
                { v: 'describe',l: 'let me describe what i need',     s: null },
                { v: 'unsure',  l: "i'm not sure yet",                s: null },
              ].map((c, i) => (
                <motion.div key={c.v} {...cardAnim(i)}>
                  <ChoiceCard label={c.l} sub={c.s}
                    selected={selectedCard === c.v}
                    dimmed={!!selectedCard && selectedCard !== c.v && selectedCard !== 'describe' && c.v !== 'describe'}
                    onClick={() => { if (['micro','normal','broad'].includes(c.v)) setGranularity(c.v); handleQ5(c.v) }}
                  />
                </motion.div>
              ))}
            </div>
            <AnimatePresence>
              {showDescribe && <DescribeInput onSubmit={() => { setGranularity('normal'); setShowDescribe(false); setStage('q6') }} />}
            </AnimatePresence>
            <AnimatePresence>
              {unsureMsg && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>{unsureMsg}</motion.p>}
            </AnimatePresence>
          </>
        )

      case 'q6':
        return (
          <>
            <motion.p initial={ENTER} animate={ENTER_T}
              style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 'clamp(20px, 4vw, 24px)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              What does helpful sound like to you?
            </motion.p>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
              {[
                { v: 'warm',    l: 'like a deep breath',         s: 'warm and reassuring.' },
                { v: 'direct',  l: 'like a clear path',          s: 'calm and to the point.' },
                { v: 'balanced',l: 'a little of each',           s: null },
                { v: 'describe',l: 'let me describe what works', s: null },
                { v: 'unsure',  l: "i'll figure it out as i go", s: null },
              ].map((c, i) => (
                <motion.div key={c.v} {...cardAnim(i)}>
                  <ChoiceCard label={c.l} sub={c.s}
                    selected={selectedCard === c.v}
                    dimmed={!!selectedCard && selectedCard !== c.v && selectedCard !== 'describe' && c.v !== 'describe'}
                    onClick={() => { if (['warm','direct','balanced'].includes(c.v)) setCommStyle(c.v); handleQ6(c.v) }}
                  />
                </motion.div>
              ))}
            </div>
            <AnimatePresence>
              {showDescribe && <DescribeInput onSubmit={() => { setCommStyle('balanced'); setShowDescribe(false); setStage('complete') }} />}
            </AnimatePresence>
            <AnimatePresence>
              {unsureMsg && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>{unsureMsg}</motion.p>}
            </AnimatePresence>
          </>
        )

      case 'complete':
        return (
          <motion.h2 initial={ENTER} animate={ENTER_T}
            style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 'clamp(20px, 4vw, 26px)', color: 'var(--text-primary)', margin: 0 }}>
            you're all set, {name}.
          </motion.h2>
        )

      case 'final':
        return (
          <motion.p initial={ENTER} animate={ENTER_T}
            style={{ fontSize: 16, color: 'var(--text-secondary)', margin: 0, letterSpacing: '0.2px' }}>
            let me show you around.
          </motion.p>
        )

      default:
        return null
    }
  }

  // ── Render ─────────────────────────────────────────────────────────── //

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'var(--bg-primary)',
      zIndex:         1000,
      overflowY:      'auto',
      padding:        '2rem 1rem',
    }}>
      <AnimatePresence mode="wait">

        {/* Welcome — special internal stagger, never shares a key with the other wrapper */}
        {stage === 'welcome' && (
          <motion.div key="welcome" initial={{ opacity: 1 }} exit={EXIT}
            style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } }}
              style={{
                fontFamily:   '"DM Serif Display", Georgia, serif',
                fontSize:     'clamp(22px, 5vw, 28px)',
                color:        'var(--text-primary)',
                margin:       0,
                marginBottom: '0.65rem',
              }}
            >
              Welcome to Pebble.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.45, ease: [0.4, 0, 0.2, 1] } }}
              style={{ fontSize: 14, color: 'var(--text-secondary)', letterSpacing: '0.2px', lineHeight: 1.7, margin: 0 }}
            >
              I'm here to make the overwhelming feel smaller.
            </motion.p>
          </motion.div>
        )}

        {/* All other stages — single wrapper keyed by stage so enter/exit fires on every transition */}
        {stage !== 'welcome' && (
          <motion.div
            key={stage}
            initial={ENTER}
            animate={ENTER_T}
            exit={EXIT}
            style={{ ...SHELL_STYLE, position: 'relative' }}
          >
            {/* Pebble wordmark — subtle, top of every non-welcome stage */}
            {!['complete', 'final'].includes(stage) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.5, delay: 0.1 } }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '0.25rem' }}
              >
                <span style={{
                  fontFamily: '"DM Serif Display", Georgia, serif',
                  fontSize: 15,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.01em',
                }}>Pebble</span>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#5A8A80', display: 'inline-block', marginBottom: 1 }} />
              </motion.div>
            )}

            {renderContent()}

            {/* Stage progress dots — shown only during question stages q2–q6 */}
            {['q2','q3','q4','q5','q6'].includes(stage) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.4, delay: 0.3 } }}
                style={{ display: 'flex', gap: 6, marginTop: '0.5rem' }}
              >
                {['q2','q3','q4','q5','q6'].map(s => (
                  <div key={s} style={{
                    width:        s === stage ? 16 : 6,
                    height:       6,
                    borderRadius: 3,
                    background:   s === stage ? '#5A8A80' : 'var(--border)',
                    transition:   'all 0.3s ease',
                  }} />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
