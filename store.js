import { configureStore, createSlice } from '@reduxjs/toolkit'
 
// ── Preferences slice ────────────────────────────────────────────────────── //
 
const prefsSlice = createSlice({
  name: 'prefs',
  initialState: {
    readingLevel: 'standard',
    fontChoice: 'default',
    bionicReading: false,
    lineHeight: 1.6,
    letterSpacing: 0,
    timerLengthMinutes: 25,
    focusMode: false,
    granularity: 'normal',
    colorTheme: 'calm',
    loaded: false,
  },
  reducers: {
    setPrefs(state, action) {
      return { ...state, ...action.payload, loaded: true }
    },
    toggleFocusMode(state) {
      state.focusMode = !state.focusMode
    },
    toggleBionic(state) {
      state.bionicReading = !state.bionicReading
    },
  },
})
 
// ── Tasks slice ──────────────────────────────────────────────────────────── //
 
const tasksSlice = createSlice({
  name: 'tasks',
  initialState: {
    goal: '',
    steps: [],         // { task_name, duration_minutes, motivation_nudge, done, timerStarted }
    loading: false,
    error: null,
  },
  reducers: {
    setGoal(state, action) { state.goal = action.payload },
    setSteps(state, action) { state.steps = action.payload.map(s => ({ ...s, done: false, timerStarted: null })) },
    setLoading(state, action) { state.loading = action.payload },
    setError(state, action) { state.error = action.payload },
    toggleStep(state, action) {
      const s = state.steps[action.payload]
      if (s) s.done = !s.done
    },
    startTimer(state, action) {
      const s = state.steps[action.payload]
      if (s) s.timerStarted = Date.now()
    },
    clearTasks(state) {
      state.steps = []
      state.goal = ''
      state.error = null
    },
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
 
export const prefsActions = prefsSlice.actions
export const tasksActions = tasksSlice.actions
export const summariseActions = summariseSlice.actions
 
export const store = configureStore({
  reducer: {
    prefs: prefsSlice.reducer,
    tasks: tasksSlice.reducer,
    summarise: summariseSlice.reducer,
  },
})
 