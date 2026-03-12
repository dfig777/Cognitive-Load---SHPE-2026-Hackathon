import { msalInstance, loginRequest, DEBUG_MODE, DEBUG_TOKEN } from '../authConfig'

async function getToken() {
  if (DEBUG_MODE) return DEBUG_TOKEN
  const accounts = msalInstance.getAllAccounts()
  if (!accounts.length) throw new Error('Not authenticated')
  const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account: accounts[0] })
  return result.accessToken
}

async function authFetch(url, options = {}) {
  const token = await getToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
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
  const res = await authFetch('/api/preferences')
  return res.json()
}

export async function savePreferences(prefs) {
  const res = await authFetch('/api/preferences', { method: 'PUT', body: JSON.stringify(prefs) })
  return res.json()
}

// ── Decompose ──────────────────────────────────────────────────────────── //
export async function decompose(payload) {
  const res = await authFetch('/api/decompose', { method: 'POST', body: JSON.stringify(payload) })
  return res.json()
}

// ── Summarise (streaming) ──────────────────────────────────────────────── //
export async function summariseStream(payload, onChunk, onDone, onError) {
  const token = await getToken()
  const res = await fetch('/api/summarise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) { onError('Something went quiet — please try again.'); return }

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
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') { onDone(); return }
      try {
        const parsed = JSON.parse(payload)
        if (parsed.chunk) onChunk(parsed.chunk)
        if (parsed.error) { onError(parsed.error); return }
      } catch {}
    }
  }
  onDone()
}

// ── Explain ────────────────────────────────────────────────────────────── //
export async function explainSentence(sentence) {
  const res = await authFetch('/api/explain', { method: 'POST', body: JSON.stringify({ sentence }) })
  return res.json()
}

// ── Nudge ──────────────────────────────────────────────────────────────── //
export async function fetchNudge(task_name, elapsed_minutes) {
  const res = await authFetch('/api/nudge', { method: 'POST', body: JSON.stringify({ task_name, elapsed_minutes }) })
  return res.json()
}

// ── Sessions ───────────────────────────────────────────────────────────── //
export async function createSession(payload) {
  const res = await authFetch('/api/sessions', { method: 'POST', body: JSON.stringify(payload) })
  return res.json()
}

export async function listSessions() {
  const res = await authFetch('/api/sessions')
  return res.json()
}