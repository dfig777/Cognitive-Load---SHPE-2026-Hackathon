import { NavLink, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSelector } from 'react-redux'

const NAV_ITEMS = [
  { to: '/',          label: 'home',      end: true,  dataNav: null         },
  { to: '/documents', label: 'documents', end: false, dataNav: 'documents'  },
  { to: '/tasks',     label: 'tasks',     end: false, dataNav: 'tasks'      },
  { to: '/focus',     label: 'focus',     end: false, dataNav: 'focus'      },
]

export default function TopNav() {
  const name = useSelector(s => s.prefs.name)
  const initial = (name && name !== 'there') ? name.charAt(0).toUpperCase() : null

  return (
    <motion.header
      className="top-nav"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      aria-label="Main navigation"
    >
      {/* Logo — left: "Pebble" + ocean sage dot */}
      <Link
        to="/"
        className="top-nav__logo"
        style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 0 }}
        aria-label="Pebble home"
      >
        <span style={{ fontFamily: '"DM Serif Display", Georgia, serif', color: 'var(--text-primary)' }}>
          Pebble
        </span>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#5A8A80',
            marginLeft: 2,
            marginBottom: 1,
            verticalAlign: 'baseline',
            flexShrink: 0,
          }}
        />
      </Link>

      {/* Nav links — center-right */}
      <nav role="navigation" aria-label="Pages" className="top-nav__links">
        {NAV_ITEMS.map(({ to, label, end, dataNav }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `top-nav__item${isActive ? ' active' : ''}`}
            style={{ textDecoration: 'none' }}
            {...(dataNav ? { 'data-nav': dataNav } : {})}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Right side — settings icon + avatar */}
      <div className="top-nav__right">
        <Link
          to="/settings"
          className="top-nav__icon-btn"
          aria-label="Settings"
          style={{ textDecoration: 'none' }}
        >
          <GearIcon />
        </Link>
        {/* User avatar — shows initial when name is known, otherwise the Pebble dot */}
        <Link
          to="/settings"
          className="top-nav__avatar"
          aria-label="Profile & settings"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: initial ? 'rgba(42,122,144,0.12)' : 'rgba(90,138,128,0.15)',
            border: initial ? '1.5px solid rgba(42,122,144,0.28)' : '1.5px solid rgba(90,138,128,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            transition: 'background 0.2s ease, border-color 0.2s ease',
            cursor: 'pointer',
          }}
        >
          {initial
            ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-active)', letterSpacing: '0.02em' }}>{initial}</span>
            : <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5A8A80', display: 'block' }} />
          }
        </Link>
      </div>
    </motion.header>
  )
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
