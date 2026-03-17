import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { tasksActions } from '../store'
import { decompose, fetchNudge, summariseStream } from '../utils/api'

// ── Helpers ───────────────────────────────────────────────────────────────── //

function formatMinutes(m) {
  if (!m || m <= 0) return null
  if (m < 60) return `~${m} min`
  const h = Math.floor(m / 60), rem = m % 60
  return rem ? `~${h} hr ${rem} min` : `~${h} hr`
}

function sumMinutes(tasks) {
  return tasks.filter(t => !t.done && !t.paused).reduce((s, t) => s + (t.duration_minutes || 0), 0)
}

// ── Animation variants ────────────────────────────────────────────────────── //

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
}

const stagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.08 } },
}

const item = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

// ── TaskCircle ────────────────────────────────────────────────────────────── //

function TaskCircle({ done, active, onClick, size = 20 }) {
  return (
    <motion.button
      onClick={e => { e.stopPropagation(); onClick() }}
      aria-label={done ? 'Mark incomplete' : 'Mark complete'}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.9 }}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${done ? 'var(--color-done)' : active ? 'var(--color-active)' : 'var(--color-inactive)'}`,
        background: done ? 'var(--color-done)' : 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.3s ease', padding: 0,
      }}
    >
      <AnimatePresence>
        {done && (
          <motion.svg
            key="check"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            width={size * 0.5} height={size * 0.5} viewBox="0 0 10 10" fill="none"
          >
            <motion.path
              d="M1.5 5L4 7.5L8.5 2.5"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ── MoreMenu ──────────────────────────────────────────────────────────────── //

function MoreMenu({ onClose, onEdit, onPause, onDelete }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const menuItems = [
    { id: 'edit',   dot: 'var(--color-upcoming)', label: 'Edit task',   desc: 'Change text or time estimate' },
    { id: 'pause',  dot: 'var(--color-paused)',   label: 'Pause',       desc: 'Set aside without deleting' },
    { id: 'delete', dot: 'var(--color-inactive)', label: 'Delete',      desc: 'Remove permanently', divider: true },
  ]

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      style={{ overflow: 'hidden', borderTop: '1px solid var(--border)', marginTop: '0.65rem', paddingTop: '0.2rem' }}
    >
      {menuItems.map(mi => (
        <div key={mi.id}>
          {mi.divider && <div style={{ height: 1, background: 'var(--border)', margin: '0.25rem 0' }} />}
          <button
            onClick={() => {
              if (mi.id === 'edit')   onEdit()
              if (mi.id === 'pause')  onPause()
              if (mi.id === 'delete') onDelete()
              onClose()
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem',
              padding: '0.55rem 0.25rem', background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left', borderRadius: 6,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-soft)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: mi.dot, flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{mi.label}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{mi.desc}</span>
          </button>
        </div>
      ))}
    </motion.div>
  )
}

// ── ActiveTaskCard ────────────────────────────────────────────────────────── //

function ActiveTaskCard({ task, groupId, onComplete, onPause, onDelete }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen]   = useState(false)
  const [breaking, setBreaking]   = useState(false)
  const [breakErr, setBreakErr]   = useState(null)
  const [editing, setEditing]     = useState(false)
  const [editName, setEditName]   = useState(task.task_name)
  const [editMins, setEditMins]   = useState(String(task.duration_minutes || ''))

  async function handleBreakDown() {
    if (breaking) return
    setBreaking(true)
    setBreakErr(null)
    try {
      const res = await decompose({ goal: task.task_name, granularity: 'normal', reading_level: 'standard' })
      if (res.flagged) { setBreakErr("Couldn't break that down. Try rephrasing?"); setBreaking(false); return }
      const steps = res.steps || []
      if (steps.length > 1) {
        dispatch(tasksActions.replaceTask({ groupId, taskId: task.id, newTasks: steps }))
      } else {
        setBreakErr("That task is already as simple as it can be.")
      }
    } catch {
      setBreakErr("Something went quiet. Try again?")
    }
    setBreaking(false)
  }

  function saveEdit() {
    const name = editName.trim()
    const mins = parseInt(editMins, 10)
    dispatch(tasksActions.updateTask({
      groupId, taskId: task.id,
      task_name: name || task.task_name,
      duration_minutes: isNaN(mins) ? task.duration_minutes : mins,
    }))
    setEditing(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{
        background: 'var(--bg-card)',
        border: '1.5px solid var(--color-active)',
        borderRadius: 12,
        padding: '0.95rem 1rem',
        boxShadow: '0 2px 12px rgba(42,122,144,0.09)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <TaskCircle done={false} active onClick={onComplete} size={20} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveEdit()}
                style={{ fontSize: '0.88rem', padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number"
                  value={editMins}
                  onChange={e => setEditMins(e.target.value)}
                  style={{ width: 56, fontSize: '0.82rem', padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  min={1}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>min</span>
                <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem', marginLeft: 'auto' }} onClick={saveEdit}>Save</button>
                <button className="btn btn-ghost"   style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {task.task_name}
              </div>
              {task.motivation_nudge && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.5 }}>
                  {task.motivation_nudge}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action row */}
      {!editing && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.7rem', marginLeft: '1.85rem', flexWrap: 'wrap' }}>
          {task.duration_minutes > 0 && (
            <span style={{
              fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-upcoming)',
              background: 'rgba(106,150,184,0.12)', padding: '0.18rem 0.6rem',
              borderRadius: 99, border: '1px solid rgba(106,150,184,0.2)',
            }}>
              {task.duration_minutes} min
            </span>
          )}
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem', opacity: breaking ? 0.55 : 1 }}
            onClick={handleBreakDown}
            disabled={breaking}
          >
            {breaking ? 'Breaking down…' : 'Break down'}
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            onClick={() => navigate('/focus')}
          >
            Focus on this
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            onClick={() => setMoreOpen(o => !o)}
            aria-expanded={moreOpen}
          >
            More ···
          </button>
        </div>
      )}

      {/* Break-down error */}
      {breakErr && !editing && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-ai)', marginTop: '0.4rem', marginLeft: '1.85rem' }}>
          {breakErr}
        </p>
      )}

      {/* AI nudge */}
      {task.nudgeText && !editing && (
        <div style={{
          marginTop: '0.75rem', marginLeft: '1.85rem',
          background: 'rgba(200,148,80,0.09)', border: '1px solid rgba(200,148,80,0.18)',
          borderRadius: 8, padding: '0.5rem 0.75rem',
          fontSize: '0.8rem', color: 'var(--color-ai)', lineHeight: 1.5,
        }}>
          {task.nudgeText}
        </div>
      )}

      {/* More menu */}
      <AnimatePresence>
        {moreOpen && (
          <MoreMenu
            onClose={() => setMoreOpen(false)}
            onEdit={() => { setEditing(true); setEditName(task.task_name); setEditMins(String(task.duration_minutes || '')) }}
            onPause={onPause}
            onDelete={onDelete}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── CompletedTaskRow ──────────────────────────────────────────────────────── //

function CompletedTaskRow({ task }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0' }}
    >
      <TaskCircle done active={false} onClick={() => {}} size={18} />
      <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'line-through', opacity: 0.55 }}>
        {task.task_name}
      </span>
      <span style={{ fontSize: '0.72rem', color: 'var(--color-done)', fontWeight: 500 }}>done</span>
    </motion.div>
  )
}

// ── UpcomingTaskRow ───────────────────────────────────────────────────────── //

function UpcomingTaskRow({ task, dimmed, onComplete, onMakeActive }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: dimmed ? 0.3 : 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0', cursor: 'pointer' }}
      onClick={onMakeActive}
    >
      <TaskCircle done={false} active={false} onClick={onComplete} size={18} />
      <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400, lineHeight: 1.4 }}>
        {task.task_name}
      </span>
      {task.duration_minutes > 0 && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          {task.duration_minutes} min
        </span>
      )}
    </motion.div>
  )
}

// ── TaskGroupCard ─────────────────────────────────────────────────────────── //

function TaskGroupCard({ group, isOpen, onToggle, timeFilter, timeFilterActive }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  // Local active task override — user can tap any upcoming to make it active
  const [activeOverrideId, setActiveOverrideId] = useState(null)

  const activeTasks    = group.tasks.filter(t => !t.done && !t.paused)
  const completedTasks = group.tasks.filter(t => t.done)
  const totalUnpaused  = group.tasks.filter(t => !t.paused).length
  const doneCount      = completedTasks.length
  const timeLeft       = sumMinutes(group.tasks)
  const allDone        = totalUnpaused > 0 && doneCount >= totalUnpaused

  // Compute which task is "active" right now
  const effectiveActiveId = (activeOverrideId && activeTasks.some(t => t.id === activeOverrideId))
    ? activeOverrideId
    : activeTasks[0]?.id ?? null
  const activeTask     = activeTasks.find(t => t.id === effectiveActiveId) ?? null
  const upcomingTasks  = activeTasks.filter(t => t.id !== effectiveActiveId)

  // Load nudge when active task becomes visible (and doesn't have one yet)
  useEffect(() => {
    if (!activeTask || !isOpen || activeTask.nudgeText) return
    fetchNudge(activeTask.task_name, 0)
      .then(r => dispatch(tasksActions.setTaskNudge({
        groupId: group.id, taskId: activeTask.id,
        nudgeText: r.nudge || r.message || r.text || 'Take this one step at a time.',
      })))
      .catch(() => dispatch(tasksActions.setTaskNudge({
        groupId: group.id, taskId: activeTask.id, nudgeText: 'Take this one step at a time.',
      })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask?.id, isOpen])

  function handleComplete(taskId) {
    dispatch(tasksActions.completeTask({ groupId: group.id, taskId }))
    // If the active override was the completed task, clear it → auto-advance
    if (activeOverrideId === taskId) setActiveOverrideId(null)
  }

  const leftBorderColor = group.source === 'document' ? 'var(--color-active)'
                        : group.source === 'ai'       ? 'var(--color-upcoming)'
                        : 'var(--border)'

  return (
    <motion.div
      layout
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${leftBorderColor}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.85rem 1.1rem', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
        aria-expanded={isOpen}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.1rem' }}>
            {group.name}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            {doneCount} of {totalUnpaused} done
            {timeLeft > 0 && ` · ${formatMinutes(timeLeft)}`}
          </div>
        </div>

        {/* Mini progress bar */}
        <div style={{ width: 56, height: 3, background: 'var(--border)', borderRadius: 99, flexShrink: 0 }}>
          <motion.div
            animate={{ width: totalUnpaused > 0 ? `${(doneCount / totalUnpaused) * 100}%` : '0%' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
              height: '100%', borderRadius: 99,
              background: allDone ? 'var(--color-done)' : 'var(--color-active)',
            }}
          />
        </div>

        {/* Chevron */}
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.22 }}
          style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flexShrink: 0, lineHeight: 1 }}
        >
          ›
        </motion.span>
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 1.1rem 1rem' }}>

              {/* All-done completion summary */}
              {allDone ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: 'rgba(80,148,106,0.08)', border: '1px solid rgba(80,148,106,0.2)',
                    borderRadius: 10, padding: '1rem', textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-done)', marginBottom: '0.3rem' }}>
                    You finished all {totalUnpaused} tasks in {group.name.toLowerCase().replace('from: ', '')}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Total time: {formatMinutes(group.tasks.reduce((s, t) => s + (t.duration_minutes || 0), 0))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                    <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }} onClick={onToggle}>
                      Close
                    </button>
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* "Start focus mode" */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.65rem' }}>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '0.78rem', padding: '0.28rem 0.85rem' }}
                      onClick={() => navigate('/focus')}
                    >
                      Start focus mode
                    </button>
                  </div>

                  {/* Completed tasks */}
                  <AnimatePresence>
                    {completedTasks.map(t => <CompletedTaskRow key={t.id} task={t} />)}
                  </AnimatePresence>

                  {/* Divider between completed and active */}
                  {completedTasks.length > 0 && activeTask && (
                    <div style={{ height: 1, background: 'var(--border)', margin: '0.35rem 0' }} />
                  )}

                  {/* Active task */}
                  <AnimatePresence mode="wait">
                    {activeTask && (
                      <div key={activeTask.id} style={{ marginBottom: upcomingTasks.length > 0 ? '0.35rem' : 0 }}>
                        <ActiveTaskCard
                          task={activeTask}
                          groupId={group.id}
                          onComplete={() => handleComplete(activeTask.id)}
                          onPause={() => dispatch(tasksActions.pauseTask({ groupId: group.id, taskId: activeTask.id }))}
                          onDelete={() => dispatch(tasksActions.deleteTask({ groupId: group.id, taskId: activeTask.id }))}
                        />
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Upcoming tasks */}
                  {upcomingTasks.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.35rem' }}>
                      {upcomingTasks.map(t => {
                        const dimmed = timeFilterActive && Number(timeFilter) > 0 && (t.duration_minutes || 0) > Number(timeFilter)
                        return (
                          <UpcomingTaskRow
                            key={t.id}
                            task={t}
                            dimmed={dimmed}
                            onComplete={() => handleComplete(t.id)}
                            onMakeActive={() => setActiveOverrideId(t.id)}
                          />
                        )
                      })}
                    </div>
                  )}

                  {activeTasks.length === 0 && completedTasks.length === 0 && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem 0' }}>
                      No tasks yet.
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main Tasks component ──────────────────────────────────────────────────── //

export default function Tasks() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { groups, loading } = useSelector(s => s.tasks)
  const prefs = useSelector(s => s.prefs)

  // Accordion
  const [expandedGroupId, setExpandedGroupId] = useState(null)
  const prevGroupsLen = useRef(groups.length)
  const [pendingExpand, setPendingExpand] = useState(null) // 'my-tasks' | 'last'

  // Add input
  const [addInput, setAddInput]   = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addMsg, setAddMsg]       = useState(null) // { type: 'ai' | 'error', text }

  // Time filter
  const [timeFilter, setTimeFilter]       = useState('20')
  const [timeFilterActive, setTimeFilterActive] = useState(false)

  // Paused section
  const [pausedOpen, setPausedOpen] = useState(false)

  // Q&A
  const [qaInput, setQaInput]     = useState('')
  const [qaAnswer, setQaAnswer]   = useState('')
  const [qaStreaming, setQaStreaming] = useState(false)

  // Auto-expand document-sourced group on first mount
  useEffect(() => {
    if (expandedGroupId) return
    const docGroup = groups.find(g => g.source === 'document')
    if (docGroup) setExpandedGroupId(docGroup.id)
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-expand after a new group is added
  useEffect(() => {
    if (pendingExpand === 'my-tasks') {
      const g = groups.find(g => g.name === 'My Tasks' && g.source === 'manual')
      if (g) { setExpandedGroupId(g.id); setPendingExpand(null) }
    } else if (pendingExpand === 'last' && groups.length > 0) {
      setExpandedGroupId(groups[groups.length - 1].id)
      setPendingExpand(null)
    }
    prevGroupsLen.current = groups.length
  }, [groups, pendingExpand])

  // Global progress stats
  const allTasks  = groups.flatMap(g => g.tasks.filter(t => !t.paused))
  const doneCount = allTasks.filter(t => t.done).length
  const timeLeft  = sumMinutes(allTasks)
  const pausedAll = groups.flatMap(g => g.tasks.filter(t => t.paused))

  function toggleGroup(id) {
    setExpandedGroupId(cur => cur === id ? null : id)
  }

  // Smart add: calls /api/decompose and decides single task vs new group
  async function handleAdd() {
    const text = addInput.trim()
    if (!text || addLoading) return
    setAddLoading(true)
    setAddMsg(null)
    try {
      const res = await decompose({
        goal: text,
        granularity: prefs.granularity || 'normal',
        reading_level: prefs.readingLevel || 'standard',
      })
      if (res.flagged) {
        setAddMsg({ type: 'error', text: "I can't process that right now. Try rephrasing?" })
        setAddLoading(false)
        return
      }
      const steps = res.steps || []
      if (steps.length <= 1) {
        dispatch(tasksActions.addSimpleTask({
          task_name:        steps[0]?.task_name || text,
          duration_minutes: steps[0]?.duration_minutes || 15,
          motivation_nudge: steps[0]?.motivation_nudge || '',
        }))
        setPendingExpand('my-tasks')
        setAddMsg({ type: 'ai', text: "Added to your tasks." })
      } else {
        const groupName = text.length > 36 ? text.slice(0, 34) + '…' : text
        dispatch(tasksActions.addGroup({ name: groupName, source: 'ai', tasks: steps }))
        setPendingExpand('last')
        setAddMsg({ type: 'ai', text: `That's a bigger one. I broke it into ${steps.length} steps.` })
      }
      setAddInput('')
    } catch {
      setAddMsg({ type: 'error', text: "Something went quiet. Try again?" })
    }
    setAddLoading(false)
    // Auto-clear the AI message after 4 seconds
    setTimeout(() => setAddMsg(null), 4000)
  }

  // Q&A: stream answer using task list as context
  async function handleQaSubmit() {
    const q = qaInput.trim()
    if (!q || qaStreaming) return
    setQaInput('')
    setQaStreaming(true)
    setQaAnswer('')
    const taskList = groups
      .flatMap(g => g.tasks.map(t => `[${g.name}] ${t.task_name} (${t.duration_minutes || '?'} min)${t.done ? ' — done' : t.paused ? ' — paused' : ''}`))
      .join('\n')
    const context = `Answer this question about the user's task list. Be brief and specific.\nQuestion: "${q}"\n\nTask list:\n${taskList}`
    await summariseStream(
      { text: context, reading_level: prefs.readingLevel || 'standard' },
      chunk => setQaAnswer(a => a + chunk),
      () => setQaStreaming(false),
      () => { setQaAnswer("I wasn't able to answer that. Try rephrasing?"); setQaStreaming(false) },
    )
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ maxWidth: 640, margin: '0 auto', width: '100%', padding: '2rem 1.5rem 6rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      {/* ── Add input ─────────────────────────────────────────────────── */}
      <motion.div variants={item} style={{
        display: 'flex', gap: '0.5rem', alignItems: 'center',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '0.5rem 0.5rem 0.5rem 1rem',
      }}>
        <input
          type="text"
          placeholder="Add a task or goal..."
          value={addInput}
          onChange={e => setAddInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: '0.9rem', color: 'var(--text-primary)', padding: 0, width: 'auto',
          }}
          aria-label="Add a task or goal"
        />
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.85rem', padding: '0.45rem 1.1rem', flexShrink: 0, opacity: !addInput.trim() || addLoading ? 0.45 : 1 }}
          onClick={handleAdd}
          disabled={!addInput.trim() || addLoading}
        >
          {addLoading ? '…' : 'Add'}
        </button>
      </motion.div>

      {/* Add message (AI confirmation or error) */}
      <AnimatePresence>
        {addMsg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              fontSize: '0.82rem', textAlign: 'center',
              color: addMsg.type === 'error' ? 'var(--color-ai)' : 'var(--text-muted)',
            }}
          >
            {addMsg.text}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Time filter ───────────────────────────────────────────────── */}
      <motion.div variants={item} style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', flexShrink: 0 }}>I have</span>
        <input
          type="number"
          value={timeFilter}
          onChange={e => setTimeFilter(e.target.value)}
          min={1}
          style={{
            width: 52, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600,
            padding: '0.22rem 0.3rem', borderRadius: 8,
            border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-card)',
          }}
          aria-label="Available minutes"
        />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', flexShrink: 0 }}>minutes</span>
        <button
          className="btn btn-ghost"
          style={{ fontSize: '0.8rem', padding: '0.28rem 0.75rem', opacity: timeFilter ? 1 : 0.45 }}
          onClick={() => setTimeFilterActive(a => !a)}
          aria-pressed={timeFilterActive}
        >
          {timeFilterActive ? 'Clear filter' : 'Show me what fits'}
        </button>
      </motion.div>

      {/* ── Progress summary ──────────────────────────────────────────── */}
      {allTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {allTasks.length} task{allTasks.length !== 1 ? 's' : ''} total
            {' · '}{doneCount} done
            {timeLeft > 0 && ` · ${formatMinutes(timeLeft)} remaining`}
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: allTasks.length > 0 ? `${(doneCount / allTasks.length) * 100}%` : '0%' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                height: '100%', borderRadius: 99,
                background: doneCount === allTasks.length ? 'var(--color-done)' : 'var(--color-active)',
              }}
            />
          </div>
        </motion.div>
      )}

      {/* ── Task groups ───────────────────────────────────────────────── */}
      <motion.div
        variants={stagger} initial="initial" animate="animate"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}
      >
        {groups.length === 0 ? (
          <motion.div
            variants={item}
            style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}
          >
            No tasks yet. Add a goal above and I'll break it down for you.
          </motion.div>
        ) : (
          groups.map(g => (
            <motion.div key={g.id} variants={item}>
              <TaskGroupCard
                group={g}
                isOpen={expandedGroupId === g.id}
                onToggle={() => toggleGroup(g.id)}
                timeFilter={timeFilter}
                timeFilterActive={timeFilterActive}
              />
            </motion.div>
          ))
        )}
      </motion.div>

      {/* ── Paused section ────────────────────────────────────────────── */}
      {pausedAll.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderLeft: '3px solid var(--color-paused)', borderRadius: 12, overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setPausedOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.75rem 1.1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-paused)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Paused · {pausedAll.length} task{pausedAll.length !== 1 ? 's' : ''}
            </span>
            <motion.span
              animate={{ rotate: pausedOpen ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginLeft: 'auto', lineHeight: 1 }}
            >
              ›
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {pausedOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '0 1.1rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {pausedAll.map(t => {
                    const parentGroup = groups.find(g => g.tasks.some(gt => gt.id === t.id))
                    return (
                      <div key={t.id} style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', padding: '0.4rem 0' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-paused)', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.task_name}</span>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.78rem', padding: '0.2rem 0.65rem', color: 'var(--color-active)', borderColor: 'var(--color-active)' }}
                          onClick={() => dispatch(tasksActions.resumeTask({ groupId: parentGroup?.id, taskId: t.id }))}
                        >
                          Resume
                        </button>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Q&A input ─────────────────────────────────────────────────── */}
      {groups.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.3, duration: 0.4 } }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}
        >
          {/* Inline answer */}
          <AnimatePresence>
            {qaAnswer && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  background: 'rgba(200,148,80,0.07)', border: '1px solid rgba(200,148,80,0.18)',
                  borderRadius: 10, padding: '0.75rem 1rem',
                  fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.65,
                }}
              >
                {qaAnswer}
                {qaStreaming && <span className="streaming-cursor" aria-hidden="true" />}
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Ask about your tasks..."
              value={qaInput}
              onChange={e => setQaInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQaSubmit()}
              style={{
                flex: 1, borderRadius: 99, padding: '0.55rem 1rem',
                fontSize: '0.85rem', width: 'auto',
              }}
              aria-label="Ask about your tasks"
            />
            <button
              className="btn btn-ghost"
              style={{ borderRadius: 99, padding: '0.55rem 1.1rem', fontSize: '0.85rem', flexShrink: 0, opacity: !qaInput.trim() || qaStreaming ? 0.45 : 1 }}
              disabled={!qaInput.trim() || qaStreaming}
              onClick={handleQaSubmit}
            >
              Ask
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
