import { useDispatch, useSelector } from 'react-redux'
import { prefsActions } from '../store'
import { savePreferences } from '../utils/api'

function Toggle({ checked, onChange, label, id }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
      <label htmlFor={id} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>{label}</label>
      <label className="toggle">
        <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  )
}

function SliderRow({ label, value, min, max, step = 0.1, onChange, display }) {
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{display ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: '0.6rem' }}>{title}</p>
      {children}
    </div>
  )
}

export default function PreferenceDashboard() {
  const dispatch = useDispatch()
  const prefs = useSelector(s => s.prefs)

  function set(key, value) {
    dispatch(prefsActions.setPrefs({ [key]: value }))
    // Debounce save in a real app; for simplicity save immediately
    savePreferences({ ...prefs, [key]: value }).catch(() => {})
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
        Your Preferences
      </h3>

      <Section title="Reading">
        <div style={{ marginBottom: '0.85rem' }}>
          <label style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            Reading level
          </label>
          <select
            value={prefs.readingLevel}
            onChange={e => set('readingLevel', e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: '0.88rem' }}
          >
            <option value="simple">Simple — plain, short sentences</option>
            <option value="standard">Standard — clear, readable</option>
            <option value="detailed">Detailed — keep more nuance</option>
          </select>
        </div>
        <Toggle id="bionic" label="Bionic Reading" checked={prefs.bionicReading} onChange={v => set('bionicReading', v)} />
      </Section>

      <Section title="Typography">
        <div style={{ marginBottom: '0.85rem' }}>
          <label style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            Font
          </label>
          <select
            value={prefs.fontChoice}
            onChange={e => set('fontChoice', e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: '0.88rem' }}
          >
            <option value="default">Default (DM Sans)</option>
            <option value="opendyslexic">OpenDyslexic</option>
            <option value="atkinson">Atkinson Hyperlegible</option>
          </select>
        </div>
        <SliderRow label="Line height" value={prefs.lineHeight} min={1} max={3} step={0.1}
          display={prefs.lineHeight.toFixed(1)} onChange={v => set('lineHeight', v)} />
        <SliderRow label="Letter spacing" value={prefs.letterSpacing} min={0} max={6} step={0.5}
          display={`${prefs.letterSpacing}px`} onChange={v => set('letterSpacing', v)} />
      </Section>

      <Section title="Tasks">
        <div style={{ marginBottom: '0.85rem' }}>
          <label style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            Step granularity
          </label>
          <select
            value={prefs.granularity}
            onChange={e => set('granularity', e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: '0.88rem' }}
          >
            <option value="micro">Micro — tiny steps (≤5 min)</option>
            <option value="normal">Normal — balanced (≤15 min)</option>
            <option value="broad">Broad — fewer, bigger steps</option>
          </select>
        </div>
        <SliderRow label="Timer length" value={prefs.timerLengthMinutes} min={5} max={60} step={5}
          display={`${prefs.timerLengthMinutes} min`} onChange={v => set('timerLengthMinutes', v)} />
      </Section>

      <Section title="Appearance">
        <div style={{ marginBottom: '0.85rem' }}>
          <label style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            Theme
          </label>
          <select
            value={prefs.colorTheme}
            onChange={e => set('colorTheme', e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: '0.88rem' }}
          >
            <option value="calm">Calm (warm)</option>
            <option value="dark">Dark</option>
            <option value="high-contrast">High contrast</option>
          </select>
        </div>
        <Toggle id="focus" label="Focus mode (hide sidebar)" checked={prefs.focusMode}
          onChange={v => { dispatch(prefsActions.toggleFocusMode()); savePreferences({ ...prefs, focusMode: v }).catch(() => {}) }} />
      </Section>
    </div>
  )
}