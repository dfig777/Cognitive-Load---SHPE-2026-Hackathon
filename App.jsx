import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { motion, AnimatePresence } from 'framer-motion'
import { prefsActions } from './store'
import { fetchPreferences } from './utils/api'
import { loginRequest } from './authConfig'
import Decomposer from './components/Decomposer'
import Refactor from './components/Refactor'
import PreferenceDashboard from './components/PreferenceDashboard'
import './styles/global.css'

function LoginScreen({ onLogin }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', gap: '1.5rem', padding: '2rem',
    }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--text-primary)', textAlign: 'center' }}>
        NeuroFocus
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', textAlign: 'center', maxWidth: 360 }}>
        A calm space to break down tasks, simplify text, and work at your own pace.
      </p>
      <button className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }} onClick={onLogin}>
        Sign in with your organisation
      </button>
    </div>
  )
}

export default function App() {
  const dispatch = useDispatch()
  const prefs = useSelector(s => s.prefs)
  const { instance } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  // Load preferences from Cosmos once authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    fetchPreferences()
      .then(p => {
        const mapped = {
          readingLevel: p.reading_level,
          fontChoice: p.font_choice,
          bionicReading: p.bionic_reading,
          lineHeight: p.line_height,
          letterSpacing: p.letter_spacing,
          timerLengthMinutes: p.timer_length_minutes,
          focusMode: p.focus_mode,
          granularity: p.granularity,
          colorTheme: p.color_theme,
        }
        dispatch(prefsActions.setPrefs(mapped))
      })
      .catch(() => dispatch(prefsActions.setPrefs({})))
  }, [isAuthenticated, dispatch])

  // Apply CSS variables from prefs
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', prefs.colorTheme || 'calm')
    root.setAttribute('data-font', prefs.fontChoice || 'default')
    root.style.setProperty('--line-height', prefs.lineHeight ?? 1.6)
    root.style.setProperty('--letter-spacing', `${prefs.letterSpacing ?? 0}px`)
  }, [prefs.colorTheme, prefs.fontChoice, prefs.lineHeight, prefs.letterSpacing])

  if (!isAuthenticated) {
    return (
      <LoginScreen onLogin={() => instance.loginRedirect(loginRequest).catch(console.error)} />
    )
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <AnimatePresence>
        {!prefs.focusMode && (
          <motion.aside
            className="sidebar"
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            aria-label="Settings sidebar"
          >
            {/* Logo */}
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                NeuroFocus
              </h1>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Your calm work companion
              </p>
            </div>

            <PreferenceDashboard />

            {/* Sign out */}
            <button
              className="btn btn-ghost"
              style={{ marginTop: 'auto', width: '100%', fontSize: '0.82rem' }}
              onClick={() => instance.logoutRedirect()}
            >
              Sign out
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="main-content" aria-label="Main content">
        {/* Focus mode toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.82rem' }}
            onClick={() => dispatch(prefsActions.toggleFocusMode())}
            aria-pressed={prefs.focusMode}
          >
            {prefs.focusMode ? '← Show sidebar' : 'Focus mode'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', flex: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Decomposer />
          </div>
          <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Refactor />
          </div>
        </div>
      </main>
    </div>
  )
}
