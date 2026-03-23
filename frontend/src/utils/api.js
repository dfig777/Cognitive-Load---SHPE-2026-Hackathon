const USER_ID = 'diego'

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-User-Id': USER_ID,
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res
}

// ── Preferences ────────────────────────────────────────────────────────── //
export async function fetchPreferences() {
  const res = await apiFetch('/api/preferences')
  return res.json()
}

export async function savePreferences(prefs) {
  const res = await apiFetch('/api/preferences', { method: 'PUT', body: JSON.stringify(prefs) })
  return res.json()
}

// ── Decompose ──────────────────────────────────────────────────────────── //
export async function decompose(payload) {
  const res = await apiFetch('/api/decompose', { method: 'POST', body: JSON.stringify(payload) })
  return res.json()
}

// ── Summarise (streaming) ──────────────────────────────────────────────── //
export async function summariseStream(payload, onChunk, onDone, onError) {
  const res = await fetch('/api/summarise', {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload),
  })
  if (!res.ok) { onError('something went quiet — please try again.'); return }

  // Content Safety can return plain JSON {flagged: true, message: "..."} at 200
  // instead of SSE — detect and handle before entering the stream loop
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    const json = await res.json().catch(() => null)
    if (json?.flagged) {
      onError(json.message || "this content couldn't be processed right now.")
    } else {
      onError('something went quiet — please try again.')
    }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') { onDone(); return }
      try {
        const parsed = JSON.parse(data)
        if (parsed.chunk) onChunk(parsed.chunk)
        if (parsed.error) { onError(parsed.error); return }
      } catch {}
    }
  }
  onDone()
}

// ── Explain ────────────────────────────────────────────────────────────── //
export async function explainSentence(sentence) {
  const res = await apiFetch('/api/explain', { method: 'POST', body: JSON.stringify({ sentence }) })
  return res.json()
}

// ── Nudge ──────────────────────────────────────────────────────────────── //
export async function fetchNudge(task_name, elapsed_minutes) {
  const res = await apiFetch('/api/nudge', { method: 'POST', body: JSON.stringify({ task_name, elapsed_minutes }) })
  return res.json()
}

// ── Sessions ───────────────────────────────────────────────────────────── //
export async function createSession(payload) {
  const res = await apiFetch('/api/sessions', { method: 'POST', body: JSON.stringify(payload) })
  return res.json()
}

export async function listSessions() {
  const res = await apiFetch('/api/sessions')
  return res.json()
}

// ── Chat (streaming SSE) ────────────────────────────────────────────────── //
/**
 * Stream a chat message. SSE event types from backend:
 *   {type:"token", content:"..."}   — streamed text token
 *   {type:"replace", content:"..."}  — replace accumulated text (output safety)
 *   {type:"actions", buttons:[...]} — routing/action buttons
 *   {type:"done"}                   — stream complete
 */
export async function chatStream(payload, { onToken, onActions, onReplace, onDone, onError } = {}) {
  let res
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(payload),
    })
  } catch {
    onError?.('something went quiet — please try again.')
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    onError?.(err.detail || 'something went quiet — please try again.')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw) continue
        try {
          const evt = JSON.parse(raw)
          if (evt.type === 'token')   { onToken?.(evt.content);    continue }
          if (evt.type === 'replace') { onReplace?.(evt.content);  continue }
          if (evt.type === 'actions') { onActions?.(evt.buttons);  continue }
          if (evt.type === 'done')    { onDone?.();                return  }
        } catch { /* malformed chunk — skip */ }
      }
    }
  } catch {
    onError?.('something went quiet — please try again.')
    return
  }
  onDone?.()
}

// ── Conversation History ────────────────────────────────────────────────── //
export async function loadConversation() {
  const res = await apiFetch('/api/conversations')
  return res.json()
}

export async function loadDocuments() {
  const res = await apiFetch('/api/documents')
  return res.json()
}

// ── Tasks ──────────────────────────────────────────────────────────────── //

function _toBackendGroup(g) {
  return {
    id:         g.id,
    group_name: g.name || g.group_name || 'Tasks',
    source:     g.source || 'manual',
    created_at: g.created_at || '',
    tasks: (g.tasks || []).map(t => ({
      id:               t.id,
      task_name:        t.task_name,
      description:      t.motivation_nudge || '',
      duration_minutes: t.duration_minutes || 15,
      status:           t.done ? 'done' : (t.paused ? 'in_progress' : 'pending'),
      due_date:         t.due_date || null,
      due_label:        t.due_label || null,
    })),
  }
}

function _toFrontendGroup(g) {
  return {
    id:         g.id,
    name:       g.group_name || g.name || 'Tasks',
    source:     g.source || 'manual',
    created_at: g.created_at || '',
    tasks: (g.tasks || []).map(t => ({
      id:               t.id,
      task_name:        t.task_name,
      duration_minutes: t.duration_minutes || 15,
      motivation_nudge: t.description || '',
      due_date:         t.due_date || null,
      due_label:        t.due_label || null,
      done:             t.status === 'done',
      paused:           t.status === 'in_progress',
      timerStarted:     null,
      nudgeText:        null,
    })),
  }
}

export async function saveTasks(groups) {
  const res = await apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ groups: groups.map(_toBackendGroup) }),
  })
  const data = await res.json()
  return { groups: (data.groups || []).map(_toFrontendGroup) }
}

export async function loadTasks() {
  const res = await apiFetch('/api/tasks')
  const data = await res.json()
  return { groups: (data.groups || []).map(_toFrontendGroup) }
}

// ── Upload document (multipart) ────────────────────────────────────────── //
export async function uploadDocument(file) {
  const formData = new FormData()
  formData.append('file', file)
  // No Content-Type header — browser sets multipart boundary automatically
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'X-User-Id': USER_ID },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}
