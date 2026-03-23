import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { tasksActions } from '../store'
import { decompose, fetchNudge, summariseStream, loadTasks, saveTasks, chatStream } from '../utils/api'

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
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8,  transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const stagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.12 } },
}

const item = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
}

// ── TaskCircle ────────────────────────────────────────────────────────────── //

function TaskCircle({ done, active, onClick, size = 20 }) {
  return (
    <motion.button
      onClick={e => { e.stopPropagation(); if (!done) onClick() }}
      aria-label={done ? 'Task complete' : 'Mark complete'}
      whileHover={done ? {} : { scale: 1.12 }}
      whileTap={done ? {} : { scale: 0.9 }}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${done ? 'var(--color-done)' : active ? 'var(--color-active)' : 'var(--color-inactive)'}`,
        background: done ? 'var(--color-done)' : 'transparent',
        cursor: done ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
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

function MoreMenu({ onClose, onEdit, onPause, onDelete, onChatRequest, taskName, groupName, triggerRef }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (triggerRef?.current && triggerRef.current.contains(e.target)) return
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose, triggerRef])

  const menuItems = [
    { id: 'edit',   dot: 'var(--color-upcoming)', label: 'Edit task',  desc: 'Change text or time estimate' },
    { id: 'pause',  dot: 'var(--color-paused)',   label: 'Pause',      desc: 'Set aside without deleting' },
    { id: 'delete', dot: 'var(--color-inactive)', label: 'Delete',     desc: 'Remove permanently', divider: true },
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
              if (mi.id === 'edit')   { onEdit(); onClose() }
              else if (mi.id === 'pause')  { onPause(); onClose() }
              else if (mi.id === 'delete') { onDelete(); onClose() }
              else if (mi.id === 'move')  {
                onChatRequest?.(`move "${taskName}" to a different group`)
                onClose()
              }
              else if (mi.id === 'merge') {
                onChatRequest?.(`merge the "${groupName}" group with another group`)
                onClose()
              }
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem',
              padding: '0.55rem 0.25rem', background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left', borderRadius: 6,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: mi.dot, flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{mi.label}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {mi.desc}
            </span>
          </button>
        </div>
      ))}
    </motion.div>
  )
}

// ── ActiveTaskCard ────────────────────────────────────────────────────────── //

function ActiveTaskCard({ task, groupId, groupName, onComplete, onPause, onDelete, onChatRequest, onOpenBreakdown }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen]   = useState(false)
  const moreBtnRef = useRef(null)
  const [editing, setEditing]     = useState(false)
  const [editName, setEditName]   = useState(task.task_name)
  const [editMins, setEditMins]   = useState(String(task.duration_minutes || ''))

  function saveEdit() {
    const name = editName.trim()
    const mins = parseInt(editMins, 10)
    const nameChanged = name && name !== task.task_name
    dispatch(tasksActions.updateTask({
      groupId, taskId: task.id,
      task_name: name || task.task_name,
      duration_minutes: isNaN(mins) ? task.duration_minutes : mins,
      // Clear AI-generated nudge if task name changed — it's now stale
      ...(nameChanged ? { motivation_nudge: '' } : {}),
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
        background: 'rgba(42,122,144,0.04)',
        border: '1.5px solid var(--color-active)',
        borderLeft: '3px solid var(--color-active)',
        borderRadius: 14,
        padding: '0.95rem 1rem',
        boxShadow: '0 4px 20px rgba(42,122,144,0.12)',
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
              {formatMinutes(task.duration_minutes)}
            </span>
          )}
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }}
            onClick={() => onOpenBreakdown?.({ task, groupId })}
          >
            Break down
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            onClick={() => {
              dispatch(tasksActions.setFocusGroup(groupId))
              dispatch(tasksActions.setFocusTask(task.id))
              navigate('/focus')
            }}
          >
            Focus on this
          </button>
          <button
            ref={moreBtnRef}
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            onClick={() => setMoreOpen(o => !o)}
            aria-expanded={moreOpen}
          >
            More ···
          </button>
        </div>
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
            onChatRequest={onChatRequest}
            taskName={task.task_name}
            groupName={groupName}
            triggerRef={moreBtnRef}
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
          {formatMinutes(task.duration_minutes)}
        </span>
      )}
    </motion.div>
  )
}

// ── TaskGroupCard ─────────────────────────────────────────────────────────── //

function TaskGroupCard({ group, isOpen, onToggle, timeFilter, timeFilterActive, onStartNewGroup, onChatRequest, onOpenBreakdown }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  // Local active task override — user can tap any upcoming to make it active
  const [activeOverrideId, setActiveOverrideId] = useState(null)
  const [confirmDelete,    setConfirmDelete]    = useState(false)

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

  // Nudge text is fetched in FocusMode when the user actively starts a task.
  // We intentionally do NOT auto-fetch here — showing a nudge before the user
  // has started the task is premature and adds noise.

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
      {/* Header — toggle area + delete button */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button
          onClick={onToggle}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.85rem 1.1rem', background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left', transition: 'background 0.18s ease', minWidth: 0,
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
              style={{ height: '100%', borderRadius: 99, background: allDone ? 'var(--color-done)' : 'var(--color-active)' }}
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

        {/* Trash button */}
        <button
          onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
          aria-label="Delete group"
          style={{
            background: 'none', border: 'none', borderLeft: '1px solid var(--border)',
            cursor: 'pointer', padding: '0 0.85rem', color: 'var(--text-muted)',
            flexShrink: 0, transition: 'background 0.18s ease, color 0.18s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,148,80,0.08)'; e.currentTarget.style.color = 'var(--color-ai)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>

      {/* Delete confirmation strip */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden', borderTop: '1px solid rgba(200,148,80,0.2)' }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.65rem 1.1rem',
              background: 'rgba(200,148,80,0.06)',
              gap: '0.75rem',
            }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                delete <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>"{group.name}"</strong> and all its tasks?
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button
                  onClick={() => {
                    dispatch(tasksActions.deleteGroup(group.id))
                  }}
                  style={{
                    fontSize: '0.78rem', padding: '4px 14px', borderRadius: 7,
                    border: '1px solid var(--color-ai)', background: 'transparent',
                    color: 'var(--color-ai)', cursor: 'pointer', fontWeight: 500,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,148,80,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    fontSize: '0.78rem', padding: '4px 12px', borderRadius: 7,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    You finished everything here. That's real progress.
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Total time: {formatMinutes(group.tasks.reduce((s, t) => s + (t.duration_minutes || 0), 0))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                    <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }} onClick={() => { onToggle(); onStartNewGroup?.() }}>
                      Start another group
                    </button>
                    <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }} onClick={() => navigate('/focus', { state: { startBreak: true } })}>
                      Take a break
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
                      onClick={() => {
                        dispatch(tasksActions.setFocusGroup(group.id))
                        dispatch(tasksActions.setFocusTask(null))
                        navigate('/focus')
                      }}
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
                          groupName={group.name}
                          onComplete={() => handleComplete(activeTask.id)}
                          onPause={() => dispatch(tasksActions.pauseTask({ groupId: group.id, taskId: activeTask.id }))}
                          onDelete={() => dispatch(tasksActions.deleteTask({ groupId: group.id, taskId: activeTask.id }))}
                          onChatRequest={onChatRequest}
                          onOpenBreakdown={onOpenBreakdown}
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
                      no tasks yet.
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

// ── BreakdownChatPanel ────────────────────────────────────────────────────── //

function BreakdownChatPanel({ task, groupId, onClose, onReplaceTask }) {
  const prefs        = useSelector(s => s.prefs)
  const [messages,   setMessages]   = useState([])
  const [input,      setInput]      = useState('')
  const [streaming,  setStreaming]  = useState(false)
  const [streamText, setStreamText] = useState('')
  const [applying,   setApplying]   = useState(false)
  const [applyErr,   setApplyErr]   = useState(null)
  const bottomRef   = useRef(null)
  const initialSent = useRef(false)
  const genId       = () => Math.random().toString(36).slice(2, 10)

  const stripMd = t => t
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
    .replace(/^#+\s+/gm, '').replace(/^[-*]\s+/gm, '')

  async function sendChat(text, history = []) {
    setStreaming(true)
    setStreamText('')
    let accumulated = ''
    await chatStream(
      {
        message: text,
        is_greeting: false,
        current_page: 'tasks',
        conversation_history: history.slice(-12).map(m => ({ role: m.role, content: m.content })),
      },
      {
        onToken: t => { accumulated += t; setStreamText(accumulated) },
        onReplace: content => {
          accumulated = content
          setStreamText('')
          setMessages(prev => [...prev, { id: genId(), role: 'assistant', content }])
        },
        onDone: () => {
          if (accumulated) setMessages(prev => [...prev, { id: genId(), role: 'assistant', content: accumulated }])
          setStreamText('')
          setStreaming(false)
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        },
        onError: msg => {
          setMessages(prev => [...prev, { id: genId(), role: 'assistant', content: msg || 'something went quiet. try again?' }])
          setStreamText('')
          setStreaming(false)
        },
      },
    )
  }

  // On mount: seed Pebble with the task context — Pebble's response is the first
  // visible message (the trigger is hidden so the chat opens with Pebble already helping)
  useEffect(() => {
    if (initialSent.current) return
    initialSent.current = true
    const seed = `I want to break down this task: "${task.task_name}"${task.duration_minutes > 0 ? ` (about ${task.duration_minutes} minutes)` : ''}. Walk me through the smaller steps to get this done.`
    sendChat(seed, [])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    const userMsg = { id: genId(), role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    await sendChat(text, next)
  }

  async function handleApply() {
    if (applying) return
    setApplying(true)
    setApplyErr(null)
    try {
      const res = await decompose({
        goal: task.task_name,
        granularity: prefs.granularity || 'normal',
        reading_level: prefs.readingLevel || 'standard',
      })
      if (res.flagged) { setApplyErr("Couldn't break that down."); setApplying(false); return }
      const steps = res.steps || []
      if (steps.length > 1) {
        onReplaceTask(groupId, task.id, steps)
      } else {
        setApplyErr("That task is already as simple as it can be.")
        setApplying(false)
      }
    } catch {
      setApplyErr("Something went quiet. Try again?")
      setApplying(false)
    }
  }

  const userInitial = (prefs.name && prefs.name !== 'there') ? prefs.name.charAt(0).toUpperCase() : 'Y'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem 0.85rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              breaking down
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.35 }}>
              {task.task_name}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '1.35rem', lineHeight: 1,
              padding: '0 0.2rem', flexShrink: 0, transition: 'color 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        {/* Quick apply button */}
        <div style={{ marginTop: '0.7rem' }}>
          <button
            className="btn btn-primary"
            style={{ width: '100%', fontSize: '0.82rem', padding: '0.42rem 1rem', opacity: applying ? 0.55 : 1 }}
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? 'Breaking down…' : 'Break it down for me →'}
          </button>
          {applyErr && (
            <p style={{ fontSize: '0.76rem', color: 'var(--color-ai)', marginTop: '0.3rem', textAlign: 'center' }}>
              {applyErr}
            </p>
          )}
        </div>
      </div>

      {/* Chat thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}
          >
            {msg.role === 'assistant' ? (
              <motion.div
                animate={{ scale: [0.88, 1.08, 0.88], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 7, height: 7, borderRadius: '50%', background: '#5A8A80', flexShrink: 0, marginTop: '0.85rem' }}
              />
            ) : (
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: '0.2rem',
                background: 'rgba(42,122,144,0.12)', border: '1px solid rgba(42,122,144,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.62rem', fontWeight: 600, color: 'var(--color-active)',
              }}>
                {userInitial}
              </div>
            )}
            <div style={{
              maxWidth: '84%',
              background: msg.role === 'assistant' ? 'rgba(200,148,80,0.07)' : 'rgba(42,122,144,0.08)',
              border: `1px solid ${msg.role === 'assistant' ? 'rgba(200,148,80,0.16)' : 'rgba(42,122,144,0.16)'}`,
              borderRadius: msg.role === 'assistant' ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
              padding: '0.65rem 0.9rem',
              fontSize: '0.85rem', color: 'var(--text-primary)',
              lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.role === 'assistant' ? stripMd(msg.content) : msg.content}
            </div>
          </motion.div>
        ))}

        {/* In-flight streaming bubble */}
        {streaming && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <motion.div
              animate={{ scale: [0.88, 1.08, 0.88], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: '#5A8A80', flexShrink: 0, marginTop: '0.85rem' }}
            />
            <div style={{
              maxWidth: '84%', background: 'rgba(200,148,80,0.07)',
              border: '1px solid rgba(200,148,80,0.16)', borderRadius: '16px 16px 16px 4px',
              padding: '0.65rem 0.9rem', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.65,
            }}>
              {streamText ? stripMd(streamText) : (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <motion.span key={i}
                      animate={{ scale: [0.85,1.15,0.85], opacity: [0.35,0.9,0.35] }}
                      transition={{ duration: 2.2, delay: i*0.35, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ display: 'block', width: 5, height: 5, borderRadius: '50%', background: '#5A8A80' }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '0.6rem 1.25rem 1rem', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="ask pebble anything..."
            rows={2}
            disabled={streaming}
            style={{ flex: 1, resize: 'none', borderRadius: 10, fontSize: '0.85rem', opacity: streaming ? 0.55 : 1, transition: 'opacity 0.25s ease' }}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            style={{ flexShrink: 0, fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
          >
            send
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Tasks component ──────────────────────────────────────────────────── //

export default function Tasks() {
  const dispatch = useDispatch()
  const { groups } = useSelector(s => s.tasks)
  const prefs = useSelector(s => s.prefs)

  // Track whether initial load from Cosmos is done (prevent saving empty state on mount)
  const [cosmosSynced, setCosmosSynced] = useState(false)

  // Capture initial groups length at mount time (before any async loads).
  // If groups are already populated (e.g., navigated here from Documents or chat),
  // we don't overwrite Redux with Cosmos data — we just let the save effect persist them.
  const initialGroupsLengthRef = useRef(groups.length)

  // Load tasks from Cosmos on mount
  useEffect(() => {
    loadTasks()
      .then(data => {
        // Only populate from Cosmos if Redux was empty at mount time.
        // This prevents clobbering tasks that Documents/chat created before navigating here.
        if (data.groups && data.groups.length > 0 && initialGroupsLengthRef.current === 0) {
          dispatch(tasksActions.setGroups(data.groups))
        }
      })
      .catch(() => { /* keep whatever is in Redux */ })
      .finally(() => setCosmosSynced(true))
  }, [dispatch])

  // Save tasks to Cosmos whenever groups change (after initial load)
  useEffect(() => {
    if (!cosmosSynced) return
    saveTasks(groups).catch(() => { /* silent — don't interrupt the user */ })
  }, [groups, cosmosSynced])

  // Accordion
  const [expandedGroupId, setExpandedGroupId] = useState(null)
  const [pendingExpand, setPendingExpand] = useState(null) // 'my-tasks' | 'last'

  // Add input
  const [addInput, setAddInput]     = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addMsg, setAddMsg]         = useState(null) // { type: 'ai' | 'error', text }
  const addMsgTimer   = useRef(null)
  const addInputRef   = useRef(null)

  // Time filter
  const [timeFilter, setTimeFilter]             = useState('20')
  const [timeFilterActive, setTimeFilterActive] = useState(false)

  // Paused section
  const [pausedOpen, setPausedOpen] = useState(false)

  // Breakdown chat panel — set to { task, groupId } to open, null to close
  const [breakdownTask, setBreakdownTask] = useState(null)

  // Pebble chat thread (persistent during session)
  const [qaMessages,  setQaMessages]  = useState([])   // [{id,role,content}]
  const [qaInput,     setQaInput]     = useState('')
  const [qaStreaming, setQaStreaming]  = useState(false)
  const [qaStream,    setQaStream]    = useState('')    // in-flight streaming text
  const qaInputRef  = useRef(null)
  const qaChatRef   = useRef(null)
  const genQaId     = () => Math.random().toString(36).slice(2, 10)

  // Cleanup timers on unmount
  useEffect(() => () => {
    clearTimeout(addMsgTimer.current)
  }, [])

  // Called by MoreMenu move/merge — pre-fills chat and scrolls to it
  function handleChatRequest(text) {
    setQaInput(text)
    setTimeout(() => {
      qaInputRef.current?.focus()
      qaChatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

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
        setAddMsg({ type: 'error', text: "Can't process that right now. Try rephrasing?" })
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
        const groupName = res.group_name || (text.length > 36 ? text.slice(0, 34) + '…' : text)
        dispatch(tasksActions.addGroup({ name: groupName, source: 'ai', tasks: steps }))
        setPendingExpand('last')
        setAddMsg({ type: 'ai', text: `That's a bigger one. I broke it into ${steps.length} steps.` })
      }
      setAddInput('')
    } catch {
      setAddMsg({ type: 'error', text: "Something went quiet. Try again?" })
    }
    setAddLoading(false)
    // Auto-clear the AI message after 4 seconds — clear previous timer first
    clearTimeout(addMsgTimer.current)
    addMsgTimer.current = setTimeout(() => setAddMsg(null), 4000)
  }

  // Pebble chat: full personality via /api/chat, persistent thread
  async function handleQaSubmit() {
    const q = qaInput.trim()
    if (!q || qaStreaming) return

    const userMsg = { id: genQaId(), role: 'user', content: q }
    const next = [...qaMessages, userMsg]
    setQaMessages(next)
    setQaInput('')
    setQaStreaming(true)
    setQaStream('')

    // Scroll to bottom of chat area
    setTimeout(() => qaChatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)

    let accumulated = ''
    await chatStream(
      {
        message:              q,
        is_greeting:          false,
        current_page:         'tasks',
        conversation_history: next.slice(-20).map(m => ({ role: m.role, content: m.content })),
      },
      {
        onToken: token => {
          accumulated += token
          setQaStream(accumulated)
        },
        onReplace: content => {
          accumulated = content
          setQaStream('')
          setQaMessages(prev => [...prev, { id: genQaId(), role: 'assistant', content }])
        },
        onDone: () => {
          if (accumulated) {
            setQaMessages(prev => [...prev, { id: genQaId(), role: 'assistant', content: accumulated }])
          }
          setQaStream('')
          setQaStreaming(false)
          setTimeout(() => qaChatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
        },
        onError: msg => {
          setQaMessages(prev => [...prev, { id: genQaId(), role: 'assistant', content: msg || 'Something went quiet. Want to try again?' }])
          setQaStream('')
          setQaStreaming(false)
        },
      },
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

    {/* ── Left panel: task list ─────────────────────────────────────── */}
    <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ maxWidth: 640, margin: '0 auto', width: '100%', padding: '2rem 1.5rem 6rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      {/* ── Page heading ──────────────────────────────────────────────── */}
      <motion.div variants={item} style={{ paddingBottom: '0.25rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.25rem, 3vw, 1.5rem)',
          fontWeight: 400,
          color: 'var(--text-primary)',
          marginBottom: '0.2rem',
        }}>
          your tasks.
        </h2>
        {allTasks.length > 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {timeLeft > 0 ? `${formatMinutes(timeLeft)} of work left` : 'all done for now'}
          </p>
        )}
      </motion.div>

      {/* ── Add input ─────────────────────────────────────────────────── */}
      <motion.div variants={item} style={{
        display: 'flex', gap: '0.5rem', alignItems: 'center',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '0.5rem 0.5rem 0.5rem 1rem',
      }}>
        <input
          ref={addInputRef}
          type="text"
          placeholder="add a task or goal..."
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
          {addLoading ? '…' : 'add'}
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


      {/* ── Task groups ───────────────────────────────────────────────── */}
      <motion.div
        variants={stagger} initial="initial" animate="animate"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}
      >
        {groups.length === 0 ? (
          <motion.div
            variants={item}
            style={{ textAlign: 'center', padding: '3.5rem 1rem' }}
          >
            <motion.div
              animate={{ scale: [0.85, 1.1, 0.85], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-active)', margin: '0 auto 1.1rem' }}
            />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.4rem', fontWeight: 400 }}>
              nothing here yet.
            </p>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              add a goal above and i'll break it into steps.
            </p>
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
                onChatRequest={handleChatRequest}
                onOpenBreakdown={({ task, groupId }) => setBreakdownTask({ task, groupId })}
                onStartNewGroup={() => {
                  setTimeout(() => {
                    addInputRef.current?.focus()
                    addInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }, 80)
                }}
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
              paused · {pausedAll.length} task{pausedAll.length !== 1 ? 's' : ''}
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

      {/* ── Pebble chat ──────────────────────────────────────────────── */}
      {groups.length > 0 && (
        <motion.div
          ref={qaChatRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.3, duration: 0.4 } }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}
        >
          {/* Divider label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>ask pebble</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Chat thread */}
          <AnimatePresence initial={false}>
            {qaMessages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } }}
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                {/* Avatar */}
                {msg.role === 'assistant' ? (
                  <motion.div
                    animate={{ scale: [0.88, 1.08, 0.88], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: '#5A8A80', flexShrink: 0, marginTop: '0.9rem' }}
                  />
                ) : (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: '0.2rem',
                    background: 'rgba(42,122,144,0.12)', border: '1px solid rgba(42,122,144,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-active)',
                  }}>
                    {(prefs.name && prefs.name !== 'there') ? prefs.name.charAt(0).toUpperCase() : 'Y'}
                  </div>
                )}
                {/* Bubble */}
                <div style={{
                  maxWidth: '80%',
                  background: msg.role === 'assistant' ? 'rgba(200,148,80,0.07)' : 'rgba(42,122,144,0.08)',
                  border: `1px solid ${msg.role === 'assistant' ? 'rgba(200,148,80,0.16)' : 'rgba(42,122,144,0.16)'}`,
                  borderRadius: msg.role === 'assistant' ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.88rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  boxShadow: msg.role === 'assistant' ? '0 3px 14px rgba(200,148,80,0.07)' : '0 2px 10px rgba(42,122,144,0.05)',
                }}>
                  {msg.role === 'assistant'
                    ? msg.content.replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1').replace(/^#+\s+/gm,'').replace(/^[-*]\s+/gm,'')
                    : msg.content}
                </div>
              </motion.div>
            ))}

            {/* In-flight streaming bubble */}
            {qaStreaming && (
              <motion.div
                key="streaming"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }}
                style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}
              >
                <motion.div
                  animate={{ scale: [0.88, 1.08, 0.88], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#5A8A80', flexShrink: 0, marginTop: '0.9rem' }}
                />
                <div style={{
                  background: 'rgba(200,148,80,0.07)', border: '1px solid rgba(200,148,80,0.16)',
                  borderRadius: '18px 18px 18px 4px', padding: '0.75rem 1rem',
                  fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.65,
                  maxWidth: '80%', boxShadow: '0 3px 14px rgba(200,148,80,0.07)',
                }}>
                  {qaStream
                    ? qaStream
                    : (
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
                        {[0, 1, 2].map(i => (
                          <motion.span
                            key={i}
                            animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 2.2, delay: i * 0.35, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: '#5A8A80' }}
                          />
                        ))}
                      </div>
                    )
                  }
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat input */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              ref={qaInputRef}
              type="text"
              placeholder="ask pebble to move, merge, prioritize, or explain..."
              value={qaInput}
              onChange={e => setQaInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQaSubmit()}
              style={{
                flex: 1, borderRadius: 99, padding: '0.6rem 1.1rem',
                fontSize: '0.85rem', width: 'auto',
              }}
              aria-label="Ask Pebble about your tasks"
            />
            <button
              className="btn btn-ghost"
              style={{ borderRadius: 99, padding: '0.6rem 1.1rem', fontSize: '0.85rem', flexShrink: 0, opacity: !qaInput.trim() || qaStreaming ? 0.45 : 1 }}
              disabled={!qaInput.trim() || qaStreaming}
              onClick={handleQaSubmit}
            >
              send
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
    </div>

    {/* ── Right panel: breakdown chat ────────────────────────────────── */}
    <AnimatePresence>
      {breakdownTask && (
        <motion.div
          key="breakdown-panel"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          style={{
            width: 380,
            flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <BreakdownChatPanel
            task={breakdownTask.task}
            groupId={breakdownTask.groupId}
            onClose={() => setBreakdownTask(null)}
            onReplaceTask={(gId, taskId, newTasks) => {
              dispatch(tasksActions.replaceTask({ groupId: gId, taskId, newTasks }))
              setBreakdownTask(null)
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>

    </div>
  )
}
