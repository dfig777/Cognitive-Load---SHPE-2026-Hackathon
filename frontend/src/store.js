import { configureStore, createSlice } from '@reduxjs/toolkit'

const genId = () => Math.random().toString(36).slice(2, 10)

function mapTasks(tasks = []) {
  return tasks.map(t => ({
    id:               genId(),
    task_name:        t.task_name || t.name || 'Task',
    duration_minutes: t.duration_minutes || 15,
    motivation_nudge: t.motivation_nudge || '',
    done:             false,
    paused:           false,
    timerStarted:     null,
    nudgeText:        null,
  }))
}

// ── Preferences slice ────────────────────────────────────────────────────── //

const prefsSlice = createSlice({
  name: 'prefs',
  initialState: {
    readingLevel: 'standard',
    fontChoice:   'default',
    bionicReading: false,
    lineHeight:    1.6,
    letterSpacing: 0,
    timerLengthMinutes: 25,
    focusMode:    false,
    granularity:  'normal',
    colorTheme:   'calm',
    loaded:       false,
  },
  reducers: {
    setPrefs(state, action) {
      return { ...state, ...action.payload, loaded: true }
    },
    toggleFocusMode(state) { state.focusMode = !state.focusMode },
    toggleBionic(state)    { state.bionicReading = !state.bionicReading },
  },
})

// ── Tasks slice ───────────────────────────────────────────────────────────── //
// Shape: groups: [{ id, name, source, tasks: [{id, task_name, duration_minutes,
//                   motivation_nudge, done, paused, timerStarted, nudgeText}] }]

const tasksSlice = createSlice({
  name: 'tasks',
  initialState: {
    groups:  [],
    loading: false,
    error:   null,
  },
  reducers: {
    // Add a new group (from Documents page or smart AI decomposition)
    addGroup(state, action) {
      const { name, source = 'manual', tasks = [] } = action.payload
      state.groups.push({ id: genId(), name, source, tasks: mapTasks(tasks) })
    },

    // Add a single task to the "My Tasks" group (creates it if missing)
    addSimpleTask(state, action) {
      const { task_name, duration_minutes = 15, motivation_nudge = '' } = action.payload
      let group = state.groups.find(g => g.name === 'My Tasks' && g.source === 'manual')
      if (!group) {
        group = { id: genId(), name: 'My Tasks', source: 'manual', tasks: [] }
        state.groups.push(group)
      }
      group.tasks.push({
        id: genId(), task_name, duration_minutes, motivation_nudge,
        done: false, paused: false, timerStarted: null, nudgeText: null,
      })
    },

    completeTask(state, action) {
      const { groupId, taskId } = action.payload
      const task = state.groups.find(g => g.id === groupId)?.tasks.find(t => t.id === taskId)
      if (task) task.done = true
    },

    uncompleteTask(state, action) {
      const { groupId, taskId } = action.payload
      const task = state.groups.find(g => g.id === groupId)?.tasks.find(t => t.id === taskId)
      if (task) task.done = false
    },

    pauseTask(state, action) {
      const { groupId, taskId } = action.payload
      const task = state.groups.find(g => g.id === groupId)?.tasks.find(t => t.id === taskId)
      if (task) task.paused = true
    },

    resumeTask(state, action) {
      const { groupId, taskId } = action.payload
      const task = state.groups.find(g => g.id === groupId)?.tasks.find(t => t.id === taskId)
      if (task) task.paused = false
    },

    deleteTask(state, action) {
      const { groupId, taskId } = action.payload
      const group = state.groups.find(g => g.id === groupId)
      if (!group) return
      group.tasks = group.tasks.filter(t => t.id !== taskId)
      // Remove empty non-manual groups
      if (group.tasks.length === 0 && group.source !== 'manual') {
        state.groups = state.groups.filter(g => g.id !== groupId)
      }
    },

    // Replace a single task with sub-tasks (Break down)
    replaceTask(state, action) {
      const { groupId, taskId, newTasks } = action.payload
      const group = state.groups.find(g => g.id === groupId)
      if (!group) return
      const idx = group.tasks.findIndex(t => t.id === taskId)
      if (idx === -1) return
      group.tasks.splice(idx, 1, ...mapTasks(newTasks))
    },

    setTaskNudge(state, action) {
      const { groupId, taskId, nudgeText } = action.payload
      const task = state.groups.find(g => g.id === groupId)?.tasks.find(t => t.id === taskId)
      if (task) task.nudgeText = nudgeText
    },

    updateTask(state, action) {
      const { groupId, taskId, task_name, duration_minutes } = action.payload
      const task = state.groups.find(g => g.id === groupId)?.tasks.find(t => t.id === taskId)
      if (!task) return
      if (task_name    !== undefined) task.task_name        = task_name
      if (duration_minutes !== undefined) task.duration_minutes = duration_minutes
    },

    setTaskTimer(state, action) {
      const { groupId, taskId } = action.payload
      const task = state.groups.find(g => g.id === groupId)?.tasks.find(t => t.id === taskId)
      if (task) task.timerStarted = Date.now()
    },

    setLoading(state, action) { state.loading = action.payload },
    setError(state, action)   { state.error = action.payload },
    clearAll(state)            { state.groups = []; state.error = null },
  },
})

// ── Summarise slice ──────────────────────────────────────────────────────── //

const summariseSlice = createSlice({
  name: 'summarise',
  initialState: { output: '', streaming: false, error: null },
  reducers: {
    startStream(state) { state.streaming = true; state.output = ''; state.error = null },
    appendChunk(state, action) { state.output += action.payload },
    endStream(state) { state.streaming = false },
    setError(state, action) { state.error = action.payload; state.streaming = false },
    clear(state) { state.output = ''; state.streaming = false; state.error = null },
  },
})

export const prefsActions    = prefsSlice.actions
export const tasksActions    = tasksSlice.actions
export const summariseActions = summariseSlice.actions

export const store = configureStore({
  reducer: {
    prefs:     prefsSlice.reducer,
    tasks:     tasksSlice.reducer,
    summarise: summariseSlice.reducer,
  },
})
