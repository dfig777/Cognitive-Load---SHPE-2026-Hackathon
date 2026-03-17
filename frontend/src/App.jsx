import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { prefsActions } from './store'
import { fetchPreferences } from './utils/api'
import TopNav from './components/TopNav'
import Home from './pages/Home'
import Documents from './pages/Documents'
import Tasks from './pages/Tasks'
import FocusMode from './pages/FocusMode'
import Settings from './pages/Settings'
import './styles/global.css'

export default function App() {
  const dispatch = useDispatch()
  const prefs = useSelector(s => s.prefs)
  const location = useLocation()
  const isFocusMode = location.pathname === '/focus'

  // Load preferences from Cosmos on mount
  useEffect(() => {
    fetchPreferences()
      .then(p => dispatch(prefsActions.setPrefs({
        readingLevel: p.reading_level,
        fontChoice: p.font_choice,
        bionicReading: p.bionic_reading,
        lineHeight: p.line_height,
        letterSpacing: p.letter_spacing,
        timerLengthMinutes: p.timer_length_minutes,
        focusMode: p.focus_mode,
        granularity: p.granularity,
        colorTheme: p.color_theme,
      })))
      .catch(() => dispatch(prefsActions.setPrefs({})))
  }, [dispatch])

  // Set time-of-day theme once on mount
  useEffect(() => {
    const hour = new Date().getHours()
    let timeTheme = 'afternoon'
    if (hour >= 6 && hour < 12) timeTheme = 'morning'
    else if (hour >= 12 && hour < 17) timeTheme = 'afternoon'
    else if (hour >= 17 && hour < 21) timeTheme = 'evening'
    else timeTheme = 'night'
    document.documentElement.setAttribute('data-time-theme', timeTheme)
  }, [])

  // Apply CSS variables whenever preferences change
  useEffect(() => {
    const root = document.documentElement
    // 'calm' = no manual override, time theme shows through
    if (prefs.colorTheme && prefs.colorTheme !== 'calm') {
      root.setAttribute('data-theme', prefs.colorTheme)
    } else {
      root.removeAttribute('data-theme')
    }
    root.setAttribute('data-font', prefs.fontChoice || 'default')
    root.style.setProperty('--line-height', prefs.lineHeight ?? 1.6)
    root.style.setProperty('--letter-spacing', `${prefs.letterSpacing ?? 0}px`)
  }, [prefs.colorTheme, prefs.fontChoice, prefs.lineHeight, prefs.letterSpacing])

  // Focus Mode: full screen, no nav, no chrome
  if (isFocusMode) {
    return <FocusMode />
  }

  return (
    <div className="app-shell">
      <TopNav />

      <main className="main-content" aria-label="Main content">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  )
}
