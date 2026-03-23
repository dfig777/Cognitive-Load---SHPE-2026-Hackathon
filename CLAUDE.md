# CLAUDE.md — Pebble. AI Cognitive Support Companion

> "a calm place to start"

---

## ⚡ Quick Start (Read This First)

**This is a teammate handoff document.** If you're picking up where Diego left off, start here.

```bash
# Backend
cd backend && uvicorn main:app --reload        # http://localhost:8000
# Frontend
cd frontend && npm install && npm run dev      # http://localhost:5173 (proxies /api → 8000)
```

The frontend proxies all `/api/*` to `localhost:8000` via `vite.config.js`. You need BOTH servers running.

All API calls use `X-User-Id: diego` header. This is hardcoded in `frontend/src/utils/api.js` (`USER_ID = 'diego'`). For multi-user support later, this would need to come from auth.

Secrets go in `backend/.env` — see `backend/.env.example` for required keys. Never commit `.env`.

---

## Project Overview

Microsoft Innovation Challenge hackathon (March 16–27, 2026). Pebble is an AI cognitive support companion that helps people organize their entire lives — not just work or school, but everything. It transforms overwhelming information into calm, structured, personalized clarity. Built for neurodiverse users and anyone experiencing cognitive overload.

**Challenge:** Cognitive Load Reduction
**Stack:** Python 3.11+ (FastAPI) + JavaScript (React + React Router + Framer Motion + Redux Toolkit)
**Judging Criteria (25% each):** Performance, Innovation, Breadth of Azure services, Responsible AI
**Deadline:** March 27, 2026

---

## Team

- **Diego (Fig)** — primary builder, backend + frontend. Main point of contact.
- **Andy** — limited availability, may help with specific tasks.
- **2 other teammates** — may help with prompts and deliverables later.

All code should be calibrated for solo-builder reality. Efficiency matters, never at the cost of quality.

---

## Build Status — Current State (as of Session 12, March 23 2026)

### What's FULLY BUILT AND WORKING

| Component | Status | Notes |
|-----------|--------|-------|
| Backend FastAPI app | ✅ Complete | All routes working |
| `/api/preferences` GET + PUT | ✅ Working | Cosmos DB backed |
| `/api/decompose` POST | ✅ Working | GPT-4o, breaks goals into tasks, now returns `group_name` |
| `/api/summarise` POST (SSE) | ✅ Working | Streaming, Content Safety screened |
| `/api/explain` POST | ✅ Working | Sentence-level explanation |
| `/api/nudge` POST | ✅ Working | Supportive task nudge |
| `/api/upload` POST | ✅ Working | Doc Intelligence + Blob Storage |
| `/api/sessions` GET + POST | ✅ Working | Cosmos DB backed |
| `/api/chat` POST (SSE) | ✅ Working | Full 12-block prompt, streaming, actions |
| `/api/tasks` GET + POST | ✅ Working | Cosmos DB backed, full CRUD |
| TopNav | ✅ Complete | Pebble brand, 4 nav pills, settings gear, user initial avatar |
| Redux store | ✅ Complete | prefs, tasks, summarise slices; `deleteGroup` reducer added |
| `api.js` utilities | ✅ Complete | chatStream, saveTasks, loadTasks, all endpoints |
| App.jsx | ✅ Complete | Loading gate, onboarding gate, theme system, localStorage fallback |
| Onboarding flow | ✅ Complete | 11-stage state machine, saves to Cosmos, no refresh loop |
| Home page (chat) | ✅ Complete | SSE streaming, hero mode, session archive/restore, "new chat", loading phrases |
| Documents page | ✅ Working | Upload, processing, results, click-based tooltips |
| Tasks page | ✅ Working | Accordion groups, task actions, break-down split-pane, delete group |
| FocusMode page | ✅ Working | Full screen, enhanced BreathingCircle, accessible button sizes |
| Settings page | ✅ Working | Font, theme, timer, comm style, reading level, granularity all wired |
| WalkthroughOverlay | ✅ Complete | 5-step teal glow spotlight tour, skip-able, portal-based |
| `global.css` themes | ✅ Complete | 4 time-of-day themes + manual override selectors, all design tokens |

### What's MISSING / NOT YET BUILT

| Feature | Priority | Where to Build | Spec Reference |
|---------|----------|---------------|----------------|
| Post-onboarding walkthrough | ✅ Built | `Home.jsx` + `WalkthroughOverlay.jsx` | SESSION5_PART3_COMPLETE.md §5 |
| Chat history load on reload | ✅ Built | `GET /api/conversations` + `loadConversation()` in `Home.jsx` | SESSION5_PART3_COMPLETE.md |
| Tasks ↔ Cosmos sync | ✅ Built | `Tasks.jsx` anti-clobber pattern | `api.js` `loadTasks`/`saveTasks` |
| Documents saved doc cards | ✅ Built | `Documents.jsx` saved docs section + `GET /api/documents` | SESSION8 |
| `GET /api/conversations` endpoint | ✅ Built | `backend/main.py` line ~394 | — |
| `GET /api/documents` endpoint | ✅ Built | `backend/main.py` (added Session 8) | — |
| Focus Mode → chat routing | 🟢 Lower | `FocusMode.jsx` → Redux state | SESSION4_FINAL.md |
| App Service deployment | 🟢 Lower | Azure portal + GitHub Actions | — |
| P0-5: Clear Chapter 5 seed data | 🟡 Medium | needs running backend — `curl -X POST http://localhost:8000/api/tasks -H "X-User-Id: diego" -d '{"groups":[]}'` | — |

---

## Known Issues / Bugs — Updated March 20 2026 (Session 6)

### Fixed in Session 6
1. ✅ **Settings page wired** — Font, theme, timer buttons all dispatch to Redux + call `savePreferences`. Active state shown on selected button. Font applies instantly via `data-font` attribute.
2. ✅ **Double AI messages on load** — Deduplication filter added in `Home.jsx` `loadConversation()`: consecutive assistant messages from Cosmos are collapsed to the last one only.
3. ✅ **Documents tooltip black boxes** — Switched `SentenceTooltip` from `onMouseEnter` to `onClick` (mobile-safe). Tooltip shows "thinking…" while loading. Closes on outside click. `cursor: 'pointer'` instead of `cursor: 'help'`.
4. ✅ **Onboarding cards flat gray in dark theme** — `ChoiceCard` now uses `var(--bg-card)` and `var(--border)` CSS variables instead of hardcoded `rgba(255,253,250,0.5)`. Selected state increased from 6% to 12% opacity + 3px glow `boxShadow`. `whileHover` no longer overwrites background with hardcoded cream.
5. ✅ **Onboarding name placeholder** — Changed `"your name"` → `"Your name"`.
6. ✅ **Onboarding branding** — Added small "Pebble●" wordmark (DM Serif Display, 15px, `var(--text-muted)`) above each non-welcome stage. Added 5 pill-shaped progress indicators (active pill: 16×6px teal, inactive: 6×6px `var(--border)`) shown only during q2–q6 stages.
7. ✅ **Tasks gamification removed** — Deleted the global progress bar + "X tasks total · X done · Y remaining" stats section (was lines 858–880). The per-group mini progress bar and "X of Y done" count inside each accordion header remain (they're contextual, not pressuring).
8. ✅ **Tasks completion message** — Changed `"You finished all {N} tasks in {group.name...}"` → `"you finished everything here. that's real progress."` (Pebble voice, lowercase, no raw group name).
9. ✅ **Tasks More menu toggle bug** — Added `triggerRef` prop to `MoreMenu`. Outside-click handler now skips if click target is the trigger button, preventing the mousedown→close→click→reopen cycle.
10. ✅ **Focus Mode accessibility** — "I need a pause" button: `fontSize 9` → `13`, added `padding: '8px 16px'`, `minHeight: 40`. Skip/Break buttons: `fontSize 10` → `13`, added `padding: '6px 10px'`, `minHeight: 36`. EXIT button: `fontSize 9` → `11`, added `padding: '4px 8px'`, `minHeight: 32`.
11. ✅ **Focus Mode BreathingCircle enhanced** — Size 120px → 160px. Scale range 0.88↔1.12 → 0.82↔1.18 (more dramatic). Added concentric ghost ring (200px, animates to `ringScale` = 0.88↔1.28). Lowercase phase labels ("breathe in", "hold", "breathe out").
12. ✅ **Focus Mode progress dots replaced** — Gamification-style colored dots replaced with `TaskCount` component: shows "N left" in `var(--text-muted)` at 11px. Hidden when `total <= 1`.
13. ✅ **AI group names** — `/api/decompose` backend now includes `group_name` in response. System prompt instructs GPT-4o to generate a 2–4 word clean descriptive title. `DecomposeResponse` Pydantic model has `group_name: str = ""`. Route handler reads `result.get("group_name", "")`. All three frontend call sites (Tasks smart add, Home chat navigate, Documents turn-into-tasks) now use `res.group_name` as the group name, falling back to the old heuristic only if empty.

### Fixed in Session 7 (March 20 2026)
14. ✅ **Pebble voice enforced in system prompt** — `_BLOCK_1` and `_BLOCK_12_BASE` in `chat_service.py` now include explicit labeled rules: lowercase, ONE QUESTION PER RESPONSE (ABSOLUTE RULE), max 3 list items, `###ACTIONS` for navigation suggestions.
15. ✅ **Nudge system prompt updated** — `_NUDGE_SYSTEM` in `ai_service.py` now uses Pebble voice rules (lowercase, no exclamation marks, no "you've got this").
16. ✅ **Focus Mode "Getting tired" bug** — Check-in button now calls `handleBreak()` (pauses timer, records break start, picks break tip) instead of bare `setAppState('break')`.
17. ✅ **Focus Mode after-escape layout** — Container now has `position: relative` so BreathingCircle (position: absolute) positions inside it, not the viewport.
18. ✅ **Focus Mode summary duplicate button** — Removed duplicate "Talk to Pebble" button; "Done for now" renamed to "Talk to Pebble" + `navigate('/')`.
19. ✅ **Standalone Focus topic picker** — StandaloneFocus now shows topic input screen before the timer (if no task is set). User names the session or skips. Topic label shows above timer when set.
20. ✅ **Tasks time display** — Duration now shows as `~15 min` (with `~` prefix via `formatMinutes()`) in `ActiveTaskCard` and `UpcomingTaskRow`.
21. ✅ **Tasks auto-nudge removed** — Nudge no longer auto-fetches on component mount; now only loaded in FocusMode when user actively starts a task.
22. ✅ **Tasks "Start another group" UX** — Button collapses current group + scrolls/focuses the add-group input below.
23. ✅ **Tasks "Take a break" routing** — Now navigates to `/focus` with `{ state: { startBreak: true } }` so StandaloneFocus shows break screen instead of timer.
24. ✅ **Documents upload breathing animation** — Enhanced `@keyframes breathe` with warm double box-shadow (0px → 14px outer ring + 4px→28px glow), 4s ease-in-out.
25. ✅ **Onboarding visual pass** — All question headings now use DM Serif Display at `clamp(20px,4vw,24px)–26px`. Card stagger delay increased (`0.18 + i*0.08`). `ChoiceCard` label font-size 13→15, sub 10→12, padding 14×18→16×20. SHELL_STYLE gap 1.1→1.35rem.
26. ✅ **WalkthroughOverlay built** — 5-step teal spotlight tour after onboarding. Spotlight via transparent div + enormous box-shadow technique. Steps 1–4 highlight chat input / Documents / Tasks / Focus nav items. Step 5 is closing. "skip tour" always visible. `walkthroughComplete` pref saved to Cosmos on finish/skip. `data-nav` attributes added to TopNav NavLinks, `data-walkthrough="chat-input"` on Home.jsx textarea.
27. ✅ **Settings communication style, reading level, granularity wired** — New "Communication & AI" card in Settings with all three preferences as styled choice buttons, dispatching to Redux + `savePreferences`.

### Fixed in Session 8 (March 20 2026)
28. ✅ **P5-2 Pebble skip trail** — `TaskCount` replaced with `PebbleSkipTrail` SVG component in `FocusMode.jsx`. Gentle water line + completed ripple rings + active dot pulse + ghost pending dots. Positioned centered below Skip/Break row.
29. ✅ **P5-4 Task-to-task transition glitch** — Root cause: `key={currentTaskId + (completing ? '-completing' : '')}` caused AnimatePresence exit+re-enter with same content when `completing` flipped. Fixed to `key={currentTaskId}` only.
30. ✅ **P5-7 Energy check-in background bug** — Check-in overlay used `position: absolute, inset: 0` relative to centered flex child (not viewport). Fixed to `position: fixed, inset: 0, zIndex: 50`.
31. ✅ **P3-1 Documents Q&A Pebble voice** — `handleQaSubmit` now uses `chatStream` (full 12-block Pebble personality) instead of `summariseStream`. First message includes document context. `onToken`/`onReplace`/`onDone`/`onError` callbacks.
32. ✅ **P3-2 Documents conversational flow** — Question phase now shows user's input as a `UserBubble` (truncated to 160 chars for text, filename for files) before the AI bubble. Input "stays visible" in conversational form.
33. ✅ **P3-3 Document type detection** — `detectDocType(text, fileName)` heuristic detects academic/legal/instructions/article/work/unknown. `buildAiDesc()` generates context-appropriate AI message. Smart aiDesc shown instead of generic "X words here."
34. ✅ **P3-4 Documents history** — `GET /api/documents` endpoint added to `backend/main.py`. `DocumentItem` model added to `models.py`. Upload handler now saves metadata to Cosmos (`upsert_document`). `loadDocuments()` added to `api.js`. Saved docs section renders in Documents input phase, refreshes after upload.
35. ✅ **P3-5 Upload breathing animation** — Already present: `@keyframes breathe` on `.upload-zone` (enhanced in Session 7). Confirmed working.
36. ✅ **File emoji replaced** — 📄 in upload zone replaced with inline SVG file icon.

### Fixed in Session 9 (March 20 2026)
37. ✅ **Tasks.jsx saveEdit clears stale motivation_nudge** — `updateTask` reducer now accepts `motivation_nudge` field. `saveEdit()` in `ActiveTaskCard` clears the AI-generated sub-description when the task name changes (`nameChanged` guard).
38. ✅ **Documents contextual follow-up buttons** — `docType` stored as state (set in `handleGo()` for both file + text paths). "Turn into tasks" only shown when `docType !== 'article'`. Articles get "want to explore this further?" prompt instead. `detectDocType` local variable renamed to `detectedType` to avoid shadowing the state.
39. ✅ **Tasks page DM Serif heading** — "your tasks." in DM Serif Display (`font-weight: 400`, `clamp(1.25rem, 3vw, 1.5rem)`) with muted sub-line showing time remaining or "all done for now".
40. ✅ **Tasks empty state redesigned** — Replaced flat gray text with animated teal breathing dot + DM Serif "nothing here yet." + lowercase supporting line.
41. ✅ **Tasks accordion hover state** — Group header `<button>` → `<motion.button>` with `whileHover={{ background: 'var(--accent-soft)' }}` (0.18s transition).
42. ✅ **Documents choice cards hover** — `hoveredChoice` state added. On hover: background → `var(--accent-soft)`, border → dot's color (`choice.dot`), dot scale → 1.4×. Replaced imperceptible `whileHover={{ scale: 1.005 }}`.
43. ✅ **Documents saved docs cards** — Added teal left accent border (`borderLeft: '3px solid var(--color-active)'`), `whileHover={{ background: 'var(--accent-soft)' }}`. Matches visual language of task group cards.
44. ✅ **Focus Mode task name font** — Task `h2` now uses `var(--font-display)` (DM Serif Display) at `fontSize: 22, fontWeight: 400`. Brings the timer state into Pebble brand.
45. ✅ **Focus Mode nudge text size** — AI nudge below the timer: `fontSize: 10` → `fontSize: 12`, `lineHeight: 1.5` → `1.6`. Was unreadably small per audit.

### Fixed in Session 10 (March 20 2026)
46. ✅ **Onboarding ChoiceCard hover** — `whileHover` now sets `background: var(--accent-soft)` + `borderColor: rgba(42,122,144,0.4)`. Previously only border color changed (imperceptible). Cards now visibly respond on hover.
47. ✅ **Onboarding ChoiceCard left accent + dot** — Each card now has `borderLeft: 3px solid transparent` (unselected) → `3px solid rgba(42,122,144,0.7)` (selected). Small indicator dot added to left of each label — scales to 1.4× and turns teal on selection. Consistent with task/doc card visual language.
48. ✅ **Onboarding "you're all set" voice** — "You're all set" → "you're all set" (Pebble lowercase voice).
49. ✅ **Onboarding meet stage** — Moved to DM Serif Display at clamp(18–22px). Text rewritten to lowercase Pebble voice: "nice to meet you, {name}." with muted sub-line "a few quick questions so this feels right for you."
50. ✅ **Home chat raw markdown** (P1-6) — Added `stripMarkdown()` to Home.jsx. Applied at render time in `AiBubble` and at storage time in `sendMessage`/`onReplace`. `**bold**` / `*italic*` / `# headers` / `- bullets` no longer render as raw text.
51. ✅ **Sidebar.jsx deleted** — Dead code removed. Was never imported anywhere. Removed the only remaining `NeuroFocus` string in the frontend.
52. ✅ **FocusMode Pebble voice** — All fallback string pools (NUDGE, COMPLETION, OVERTIME, BREAK_TIPS, SUMMARY, TIRED) converted to lowercase Pebble voice. Break room heading: "Taking a break." → "taking a break.", "No rush." → "no rush.", "I'm back" → "i'm back". Summary: "Back to tasks" → "back to tasks", "Talk to Pebble" → "talk to pebble". Summary heading uses DM Serif Display. Stat labels fontSize 9 → 11. Break tip fontSize 10 → 12.
53. ✅ **Backend NeuroFocus branding** — `main.py` FastAPI title "NeuroFocus API" → "Pebble. API", description updated, `/health` response `service: "neurofocus"` → `service: "pebble"`. Azure resource names in `.env`/`config.py` intentionally unchanged (actual infrastructure).

### Fixed in Session 11 (March 20 2026)
54. ✅ **Tasks voice pass** — Lowercased all user-facing button labels: "Break down" → "break down", "Breaking down…" → "breaking down…", "Focus on this" → "focus on this", "Start another group" → "start another group", "Take a break" → "take a break", "Start focus mode" → "start focus mode", "Save" → "save", "Cancel" → "cancel", "More ···" menu: "Edit task" → "edit task", "Pause" → "pause", "Delete" → "delete". Time filter: "Clear filter" → "clear filter", "Show me what fits" → "show me what fits". Error messages lowercased.
55. ✅ **Tasks inline AI messages** — "Added to your tasks." → "added to your tasks.", "That's a bigger one..." → "that's a bigger one...", "Something went quiet. Try again?" → "something went quiet. try again?"
56. ✅ **Settings heading** — "Settings" → "settings." (DM Serif Display, fontWeight 400). Sub-line lowercased. `var(--text-secondary)` → `var(--text-muted)`.
57. ✅ **FocusMode comprehensive voice pass** — All remaining capitals lowercased: motivational quotes, "Taking a break." / "No rush." (break-only mode), "I'm back" (break-only mode), "Quick check-in" → "quick check-in", "How are you feeling?" → "how are you feeling?", check-in button labels lowercased. "Start/pause/stop/resume" Btn labels lowercased. "Start/Skip" topic picker lowercased. "Custom/Set" duration picker lowercased. "Done/Skip/Break" task action buttons lowercased. "One small thing:" → "one small thing:", "That's it. Nothing else." → "that's it. nothing else.", "I can do this" → "i can do this", "I need a pause" → "i need a pause". Summary msg "You finished everything." → "you finished everything.", summary ctx lowercased. Escape hatch h2 uses DM Serif Display + fontWeight 400. Check-in h3 uses DM Serif Display + fontWeight 400.
58. ✅ **Home.jsx voice pass** — Placeholder texts lowercased ("What's on your mind?" → "what's on your mind?" etc.). Quick action hints lowercased. Error fallback "Something went quiet" → "something went quiet". Quick action labels: "Break down a goal" → "break down a goal", "Start focus mode" → "start focus mode".
59. ✅ **Documents.jsx voice pass** — Upload error message lowercased. "+ Upload file" → "+ upload file".

### Fixed in Session 12 (March 23 2026)
60. ✅ **Loading phrases in chat** — Added `LOADING_PHRASES` pool ("pebbling...", "getting what you need...", "be right there...", etc.). `PulseDot` upgraded: now shows Pebble dot avatar + animated dots + italic personality phrase. Stable via `useRef` so it doesn't flicker on re-renders.
61. ✅ **Break down split-pane** — Clicking "break down" on a task opens a `BreakdownChatPanel` that slides in from the right (spring, `width: 380`). Tasks list shifts left. Panel auto-seeds Pebble with task context on mount (seed message hidden; Pebble's response is first visible thing). Has "Break it down for me →" button to decompose + replace. Full chat thread with streaming.
62. ✅ **"New chat" button on Home** — Pill button appears in the chat header (top-right). Archives current session, clears messages, resets to hero screen, fetches fresh greeting.
63. ✅ **User initial in TopNav** — TopNav now reads `prefs.name` from Redux. Shows first initial in a teal-tinted circle (28px) when name is set. Falls back to ocean sage dot. Wrapped in `<Link to="/settings">`.
64. ✅ **"What was I working on?" dropdown** — Button now shows a dropdown list of archived sessions (title = first real user message, date, message count) when sessions exist. Clicking a session loads its messages and switches to chat view (`setHeroMode(false)`). Outside-click closes dropdown.
65. ✅ **Theme switching fixed** — CSS only had `[data-time-theme="morning"]` etc. but `App.jsx` writes `data-theme="morning"`. Added `[data-theme="morning/afternoon/evening/night"]` selectors to `global.css` mirroring the time-of-day counterparts. Theme changes in Settings now take effect immediately.
66. ✅ **Time-of-day greeting cache** — `heroGreeting` sessionStorage cache now includes an `hour` field. Cache is only reused if `cached.hour === new Date().getHours()`. Fixes "morning" greeting showing at 3 AM after a session started in the morning.
67. ✅ **Tasks hover highlight stuck** — `whileHover={{ background: ... }}` on the accordion header `<motion.button>` gets stuck when the component re-renders during hover. Replaced with `onMouseEnter`/`onMouseLeave` on a plain `<button>` (chevron kept as `motion.span`).
68. ✅ **Delete task group** — Trash icon added to each group header (separate sibling button, not nested inside the toggle — avoids invalid HTML). Clicking shows an amber (`--color-ai`) confirmation strip that slides in with AnimatePresence. Confirming dispatches `tasksActions.deleteGroup`. `deleteGroup` reducer added to `tasksSlice` in `store.js`.
69. ✅ **Onboarding loop on refresh** — `App.jsx` `.catch()` was dispatching `setPrefs({})` on any backend error → `onboardingComplete` defaulted to `false`. Fixed: `.catch()` now reads `localStorage.getItem('pebble_onboarding_complete')` as fallback before defaulting. Successful prefs load now also writes `localStorage.setItem('pebble_onboarding_complete', 'true')`.
70. ✅ **Home nav → hero screen** — `heroMode` state resets to `true` on every `location.key` change (React Router generates a new key per navigation). Clicking the Home nav link always returns to the hero, not an in-progress chat.
71. ✅ **Previous session click loads chat** — Session click handler in the "What was I working on?" dropdown now calls `setHeroMode(false)` so the chat view renders after loading messages.
72. ✅ **Hero typing = new session** — `handleSend` now checks: if `heroMode === true` and messages exist, archive the previous session first and start fresh. The hero screen is the canonical "new session" entry point. Previous sessions appear in the dropdown.
73. ✅ **Session titles fixed** — `archiveSession` now skips "What was I working on?" when picking the title (uses the first real user-typed message). Sessions with only that button click are not archived at all, eliminating the flood of identically-titled entries.

### Still Open
1. **P0-5: Chapter 5 seed data** — Needs running backend: `curl -X POST http://localhost:8000/api/tasks -H "Content-Type: application/json" -H "X-User-Id: diego" -d '{"groups":[]}'`
2. ✅ **Walkthrough built** — `WalkthroughOverlay.jsx` complete, integrated in `Home.jsx`.
3. ✅ **Fonts in onboarding** — All three fonts (Lexend, Atkinson, OpenDyslexic) already loaded in `index.html`.

---

## Architecture Decisions (important context)

### SSE Streaming Pattern (`/api/chat`)
The chat endpoint returns `text/event-stream`. Event types:
- `{type:"token", content:"..."}` — streamed text chunk, accumulate in `streamingContent`
- `{type:"replace", content:"..."}` — replace accumulated text (output safety triggered); push directly as final message
- `{type:"actions", buttons:[...]}` — routing buttons appended below message
- `{type:"done"}` — stream complete

`###ACTIONS[{...}]###` is appended by GPT-4o in its response; `chat_service.py` strips it via regex and emits it as the `actions` event. The frontend never sees the raw marker.

### Chat State (local, not Redux)
Chat messages live in `Home.jsx` local state (`useState`), NOT in Redux. This was a deliberate choice — Redux slices were getting too heavy and chat is page-local. Only task groups and prefs are in Redux (shared across pages).

### heroMode + Session Archive Pattern
`heroMode` state in `Home.jsx` is `true` on every navigation to Home (via `useEffect([location.key])`) and `false` once the user sends a message. The hero screen IS the "new session" entry point — `handleSend` detects `heroMode && messages.length > 0` and archives the previous session before starting fresh. Previous sessions live in `localStorage` (`pebble_chat_sessions`) as an array of `{ id, createdAt, title, msgCount, messages }`. `archiveSession()` skips "What was I working on?" when choosing a title, using the first real typed message instead.

### Theme Override vs Time-of-Day Theme
Two separate HTML attributes on `<html>`: `data-time-theme` (auto-detected by hour, never removed) and `data-theme` (manual user override, removed when set to "calm"). CSS must have BOTH `[data-time-theme="morning"]` AND `[data-theme="morning"]` selectors or manual theme switching silently does nothing.

### `replaced` flag pattern in `sendMessage`
`let replaced = false` is a local variable inside the async function (not React state) to avoid stale closure issues when `onReplace` fires mid-stream.

### CSS Scroll Chain Fix
`app-shell` must have `height: 100vh; overflow: hidden` and `main-content` must have `overflow: hidden; min-height: 0` for Home's internal flex scroll to work. If you change `global.css` here, Documents and Tasks pages need their own `overflowY: auto` scroll wrapper — both already have this.

### Onboarding AnimatePresence Pattern
The 11-stage onboarding uses a `renderContent()` switch inside a single `<motion.div key={stage}>` wrapper. The `key={stage}` is critical — it forces React to unmount/remount on every stage change, which is what makes AnimatePresence exit animations fire correctly. Don't change this to a `<Shell stageKey={stage}>` component approach — that breaks exit animations.

### User ID
All API calls use `X-User-Id: diego` header (hardcoded in `frontend/src/utils/api.js`). The backend extracts this in `get_user_id()` dependency. For the hackathon demo this is fine. Real auth would replace this.

### Field Mapping (frontend ↔ backend)
Tasks have different field names in Redux vs Cosmos:
- `group.name` (frontend) ↔ `group_name` (backend)
- `task.motivation_nudge` (frontend) ↔ `task.description` (backend)
- `task.done/paused` booleans (frontend) ↔ `task.status: 'done'|'in_progress'|'pending'` (backend)

The `_toBackendGroup` and `_toFrontendGroup` helpers in `api.js` handle this mapping.

---

## Brand Identity — Pebble.

- **Name:** "Pebble" with a period — the period is part of the brand
- **Logo font:** DM Serif Display (loaded via Google Fonts in `index.html`)
- **The dot:** Ocean sage #5A8A80 — 8px circle at baseline after "Pebble" text
- **Night mode dot:** White #DCD4DA
- **Subtitle:** "a calm place to start" — Inter Light 300, #7A7670, letter-spacing 1px. **Hero/onboarding only. NEVER in nav.**
- **Avatar:** Ocean sage dot (8px circle, #5A8A80). **NEVER a letter avatar.**
- **Internal codename:** neurofocus (folder names, Azure resource names stay as-is)

---

## Color Meaning System (STRICT — Never Deviate)

See `color_system.md` for full hex values across all 4 themes.

| Color | CSS Variable | Meaning | Use |
|-------|-------------|---------|-----|
| Green | `--color-done` | Completion / safety | "You did it. This is done." |
| Teal | `--color-active` | Active / primary actions | "Click me." |
| Sky blue | `--color-queued` | Upcoming / queued | "Waiting. No rush." |
| Lilac | `--color-paused` | Paused / reflective | "Resting. No judgment." |
| Soft orange | `--color-ai` | AI companion voice | "Pebble is talking to you." NEVER on status |
| Warm gray | — | Inactive / unfilled | Default neutral |

**Never use:** red, bright yellow, pure black backgrounds, pure white backgrounds, neon, salmon/coral on status indicators.

---

## Four Time-of-Day Themes

Auto-detected by hour in `App.jsx`, applied via `data-time-theme` attribute on `<html>`. User can override in Settings (not yet built).

- **Morning (6am–12pm):** Peach sunrise
- **Afternoon (12pm–5pm):** Warm coast — DEFAULT
- **Evening (5pm–9pm):** Warm dusk
- **Night (9pm–6am):** Deep ocean

Color theme override (user-selected) applied via `data-theme` attribute. `calm` = let time-of-day show through (remove `data-theme`).

---

## Five Pages

### Page 1: Home — Full-Screen AI Chat (`/` or `/home`)
**Status: ✅ Built.** Gaps: chat history reload, walkthrough.

- New users → full-screen `Onboarding.jsx` (rendered by `App.jsx` before nav shows)
- Returning users → AI greeting fires on mount, 3 quick action pills, "What was I working on?" lilac button
- Chat: SSE streaming via `chatStream()`, persisted messages in local state, streaming bubble with pulse dots
- Quick actions disappear after first user message (`hasUserMessages` flag)
- Spec: `SESSION5_PROGRESS.md`, `SESSION5_PART3_COMPLETE.md`

### Page 2: Documents — Conversational Doc Processing (`/documents`)
**Status: ✅ Working with gaps.** Missing: saved documents browser.

- Three states: Input (upload zone + breathing animation) → AI question (4 guided choices) → Results (conversation)
- "Turn into tasks" → dispatches to Redux `taskGroups` → navigates to `/tasks`
- Doc memory saves to Cosmos DB
- Spec: `SESSION2_PROMPT.md`

### Page 3: Tasks — Living Checklist (`/tasks`)
**Status: ✅ Working with gaps.** Missing: Cosmos sync on mount/change.

- Accordion groups (one open at a time), waterfall inside groups
- Three-level interaction depth, smart input (simple vs AI decomposition)
- "I have ___ minutes" filter, per-task AI nudges
- Shared Redux `tasks.groups` state — also written by Home chat and Documents page
- Spec: `TASKS_SPEC.md`

### Page 4: Focus Mode — Full Screen (`/focus`)
**Status: ✅ Working.** App.jsx hides TopNav entirely for this route.

- Circular timer, energy check-in, overwhelm escape hatch
- Timer colors: green → teal → warm amber (NEVER red)
- Session summary on exit
- Spec: `SESSION4_FINAL.md` (561 lines, 6 states)

### Page 5: Settings (`/settings`)
**Status: ⚠️ Stub only.** Full UI is Session 6 work.

- Will show: all preferences adjustable with live preview, "What Pebble has learned", reduce motion toggle
- Spec: to be designed in Session 6

---

## Onboarding Flow (`Onboarding.jsx`)

11-stage state machine: `welcome → name → confirm-name → meet → q2 → q3 → q4 → q5 → q6 → complete → final`

| Stage | Content |
|-------|---------|
| `welcome` | Full-screen hero — "Pebble." logo + "a calm place to start" + "Let's begin" button |
| `name` | "What should I call you?" — text input |
| `confirm-name` | "Nice to meet you, [name]" — confirm or re-enter |
| `meet` | "Here's what I can help with" — 3 life areas intro |
| `q2` | Communication style — 4 choice cards (Calm/Direct/Warm/Adaptive) |
| `q3` | Font preference — 4 font cards with live preview |
| `q4` | Theme preference — 5 theme cards with live preview |
| `q5` | Reading level — 4 choice cards |
| `q6` | Granularity — 4 choice cards (how much detail in tasks) |
| `complete` | Saving animation + "Pebble is ready" message |
| `final` | Transition — sets `onboardingComplete: true` in Cosmos + Redux, App.jsx automatically shows main app |

On save: calls `savePreferences()` → dispatches `prefsActions.setPrefs({ ..., onboardingComplete: true })` → App.jsx gate unlocks automatically.

---

## API Endpoints — Actual Backend Status

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/health` | Health check | ✅ Working |
| GET | `/api/preferences` | Load user preferences | ✅ Working |
| PUT | `/api/preferences` | Save user preferences | ✅ Working |
| POST | `/api/decompose` | Break goal into tasks (GPT-4o) | ✅ Working |
| POST | `/api/summarise` | Simplify text (SSE stream) | ✅ Working |
| POST | `/api/explain` | Explain a sentence | ✅ Working |
| POST | `/api/nudge` | Supportive task nudge | ✅ Working |
| POST | `/api/upload` | Upload document (Doc Intelligence + Blob) | ✅ Working |
| POST | `/api/sessions` | Save focus session | ✅ Working |
| GET | `/api/sessions` | List focus sessions | ✅ Working |
| POST | `/api/chat` | AI companion chat (SSE stream, 12-block prompt) | ✅ Working |
| GET | `/api/tasks` | Load task groups from Cosmos | ✅ Working |
| POST | `/api/tasks` | Save task groups to Cosmos | ✅ Working |
| GET | `/api/conversations` | Load chat history | ✅ Working |
| GET | `/api/documents` | List user's documents | ✅ Working |

---

## Azure Services (8 integrated)

1. **Azure OpenAI** (GPT-4o) — all AI generation, assembled via `ai_service.py` + `chat_service.py`
2. **Azure Cosmos DB** (serverless, NoSQL) — preferences, sessions, documents, conversations, user_memory, learned_patterns, tasks
3. **Azure Blob Storage** — document archival after upload
4. **Azure AI Document Intelligence** — PDF/Word text extraction
5. **Azure AI Content Safety** — input screening (before GPT call) + output screening (after stream, via `replace` event)
6. **Azure Monitor / Application Insights** — observability, telemetry in `monitoring.py`
7. **Azure Key Vault** — secrets management, accessed via `keyvault.py`
8. **Azure App Service** — deployment target (not yet deployed to Azure)

---

## Backend File Structure

```
backend/
├── main.py              ← FastAPI app + all route handlers
├── config.py            ← Settings (env vars + Key Vault fallback)
├── models.py            ← Pydantic request/response schemas
├── db.py                ← Cosmos DB async repository
├── ai_service.py        ← Azure OpenAI wrapper (decompose, summarise, explain, nudge)
├── chat_service.py      ← Chat logic: 12-block system prompt, SSE streaming, ###ACTIONS### parsing
├── content_safety.py    ← Azure Content Safety + cognitive pressure regex
├── blob_service.py      ← Azure Blob Storage upload
├── doc_intelligence.py  ← Azure Document Intelligence extraction
├── keyvault.py          ← Azure Key Vault client
├── monitoring.py        ← Application Insights telemetry
├── requirements.txt     ← Python dependencies
└── .env.example         ← Required environment variables template
```

---

## Frontend File Structure

```
frontend/
├── index.html           ← Title "Pebble.", DM Serif Display font, meta tags
├── package.json
├── vite.config.js       ← Proxies /api → localhost:8000
└── src/
    ├── main.jsx         ← React entry, BrowserRouter, Redux Provider
    ├── App.jsx          ← Routes, time-of-day theme, loading gate, onboarding gate
    ├── store.js         ← Redux: prefsSlice, tasksSlice, summariseSlice
    ├── components/
    │   ├── TopNav.jsx             ← "Pebble●" logo + 4 nav pills + settings gear
    │   ├── WalkthroughOverlay.jsx ← 5-step teal spotlight tour, portal-based, shown once after onboarding
    │   ├── Decomposer.jsx         ← Task decomposition widget (used in Tasks page)
    │   ├── Refactor.jsx           ← Text simplification widget (used in Documents page)
    │   ├── PreferenceDashboard.jsx← Preferences widget (adapt for Settings page)
    │   ├── TimerRing.jsx          ← Circular timer (used in FocusMode page)
    │   └── Sidebar.jsx            ← OLD — not used, left in codebase, can be deleted
    ├── pages/
    │   ├── Home.jsx         ← Full chat (SSE), quick actions, greeting on mount
    │   ├── Onboarding.jsx   ← 11-stage onboarding state machine
    │   ├── Documents.jsx    ← Upload + 3-state processing flow
    │   ├── Tasks.jsx        ← Living checklist with task groups
    │   ├── FocusMode.jsx    ← Full-screen focus timer
    │   └── Settings.jsx     ← STUB — needs full build in Session 6
    ├── utils/
    │   ├── api.js           ← All API helpers + chatStream SSE parser
    │   └── bionic.jsx       ← Bionic Reading word-bolding utility
    └── styles/
        └── global.css       ← All CSS: 4 themes, design tokens, .btn, .app-shell, etc.
```

---

## Redux Store — Actual Shape (as built)

```javascript
// store.js

// prefs slice
{
  name:               'there',       // user's name from onboarding
  communicationStyle: 'balanced',    // calm | direct | warm | adaptive | balanced
  onboardingComplete: false,         // gates App.jsx — shows Onboarding if false
  walkthroughComplete: false,        // gates walkthrough overlay
  readingLevel:       'standard',    // simplified | standard | detailed | expert
  fontChoice:         'default',     // default | lexend | atkinson | opendyslexic
  bionicReading:      false,
  lineHeight:         1.6,
  letterSpacing:      0,
  timerLengthMinutes: 25,
  focusMode:          false,
  granularity:        'normal',      // minimal | normal | detailed | ultra
  colorTheme:         'calm',        // calm | morning | afternoon | evening | night
  loaded:             false,         // true after fetchPreferences() resolves
}

// tasks slice
{
  groups: [
    {
      id:         string,            // generated: Math.random().toString(36).slice(2,10)
      name:       string,            // display name (maps to group_name in Cosmos)
      source:     'manual'|'ai'|'document',
      created_at: string,
      tasks: [
        {
          id:               string,
          task_name:        string,
          duration_minutes: number,
          motivation_nudge: string,  // maps to 'description' in Cosmos
          due_date:         string|null,
          due_label:        string|null,
          done:             boolean,  // maps to status='done' in Cosmos
          paused:           boolean,  // maps to status='in_progress' in Cosmos
          timerStarted:     number|null,
          nudgeText:        string|null,
        }
      ]
    }
  ],
  focusGroupId: string|null,
  focusTaskId:  string|null,
  loading:      boolean,
  error:        string|null,
}

// summarise slice (used by Documents page streaming)
{
  output:    string,
  streaming: boolean,
  error:     string|null,
}
```

---

## Transitions and Animations

### Page transitions (Framer Motion AnimatePresence mode="wait")
- Out: `{ opacity: 0, y: -12, transition: { duration: 0.4, ease: [0.4,0,0.2,1] } }`
- In: `initial: { opacity: 0, y: 16 }` → `animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4,0,0.2,1] } }`

### Staggered element reveal
- Elements: `initial: {opacity:0, y:8}` → `animate: {opacity:1, y:0, transition:{duration:0.4, ease:'ease'}}`
- Delay: `0.05 + index * 0.1` seconds per item

### Loading indicator
- Ocean sage dot (8px), `animate: {scale: [0.85, 1.15, 0.85], opacity: [0.4, 1, 0.4]}`, `transition: {duration: 2.2, repeat: Infinity, ease: 'easeInOut'}`

### Breathing animation (upload zone)
- `box-shadow` pulse: `0 0 0 0px rgba(42,122,144,0.04)` → `0 0 0 12px rgba(42,122,144,0.02)`, 4s ease-in-out infinite

### General rules
- All hover/focus transitions: `0.25s ease`
- Border radius: 14px cards, 12px inputs, 8px buttons
- Never red. Never spinning loaders. Everything breathes.
- Respect `prefers-reduced-motion`: instant transitions

---

## AI Personality (Pebble)

Full spec in `PEBBLE_PERSONALITY.md` (1,652 lines). Key points:

- **Layer 1:** Identity, 7 nevers, 6 always behaviors, emotional spectrum
- **Layer 2:** 12-block dynamic system prompt assembled per `/api/chat` call in `chat_service.py`:
  - Block 1: Pebble identity
  - Block 2: User prefs (name, style, granularity, reading level)
  - Block 3: Long-term memories from Cosmos
  - Block 4: Learned patterns
  - Block 5: Time context (time of day, day of week)
  - Block 6: Emotional/cognitive signals (detected from message)
  - Block 7: Recent conversation history (last 20 turns)
  - Block 8: Document summaries (if relevant)
  - Block 9: Current task context
  - Block 10: Current page context
  - Block 11: Safety instructions (adjusted by content safety tier)
  - Block 12: Response format + `###ACTIONS[...]###` instruction
- **Layer 3:** 3-tier content safety — severity 5–6 = hard block (no GPT call), 3–4 = soft flag (extra care Block 11), cognitive pressure regex = behavior signal
- **Layer 4:** Scope — entire life organizer (moving, studying, layoffs, insurance, events, bureaucracy)
- **Layer 5:** Adaptive learning — 3 types, pattern detection, user transparency

---

## Detailed Specification Documents

| File | Contents |
|------|----------|
| `PEBBLE_PERSONALITY.md` | Full AI personality — 5 layers, system prompt construction, voice guide, content safety |
| `SESSION5_PROGRESS.md` | Home page layout + all 6 onboarding questions + returning user view |
| `SESSION5_PART3_COMPLETE.md` | Chat routing, document memory, walkthrough 5-step spec, error handling |
| `SESSION5_GAPS.md` | Animation specs, chat styling, backend endpoint spec, Redux shape, known gaps |
| `TASKS_SPEC.md` | Complete Tasks page specification — all interaction depths, filter, nudges |
| `SESSION2_PROMPT.md` | Complete Documents page specification — 3 states, guided choices, results |
| `SESSION4_FINAL.md` | Complete Focus Mode specification — 6 states (561 lines) |
| `color_system.md` | Full color system — all hex values across 4 time-of-day themes |

---

## PEBBLE DESIGN PRINCIPLES & KNOWN PATTERNS

This section guides design and development decisions. These are principles with context, not rigid bans. Use good judgment — if something serves the user and fits Pebble's personality, it's probably right.

---

### Pebble's Core Identity
Pebble is a calm, creative, neurodiverse-friendly life companion. Everything should feel warm, breathing, alive, soothing, and useful. Think: sitting by a calm lake, skipping pebbles, breathing slowly. NOT: clinical productivity app, corporate dashboard, generic chatbot, or anxiety-inducing checklist.

The voice is quiet poet 70% + playful sage 30%. Short sentences. Gentle metaphors. Lowercase feels natural for Pebble. Every interaction should reduce cognitive load, never add to it.

---

### Branding
- The app name is "Pebble." (with period). Internal codename "neurofocus" can stay in code paths, Azure resource names, and folder structures — but ALL user-facing text must say "Pebble." Grep the entire frontend before shipping: `grep -ri "neurofocus" frontend/src/`
- Logo is "Pebble●" — DM Serif Display text with an ocean sage (#5A8A80) dot at baseline
- The subtitle "a calm place to start" currently lives on the Home hero. This placement may change — don't hardcode assumptions about where it can/can't appear
- Pebble's avatar is the ocean sage dot (small filled #5A8A80 circle). Never a letter avatar for the AI
- The USER can have their initial(s) as their avatar — that's personalization. First initial, or first + last if they gave two names. This appears on user chat bubbles and could link to a profile/settings view later. Pebble = dot, User = their initial(s)

### Color Philosophy
- Colors have meanings in Pebble (see color_system.md for exact hex values across all 4 time-of-day themes):
  - **Green:** completion, safety — "you did it"
  - **Teal/ocean sage:** primary actions, Pebble's identity — "click me" / "I'm Pebble"
  - **Sky blue:** upcoming, queued — "no rush"
  - **Lilac:** paused, reflective — "resting, no judgment"
  - **Soft orange:** AI companion voice, warmth — "Pebble is here"
  - **Warm gray:** neutral, inactive
- **Red and its shades:** OK as an aesthetic color or for explicit destructive actions (stop, delete) where the user is deliberately choosing to end something. NOT OK for: status indicators, error alerts, overdue warnings, urgency pressure, "you haven't done this" messaging, or anything that creates anxiety. The vibe test: does this red make someone feel alarmed or pressured? If yes, don't use it.
- Avoid: neon colors, pure black backgrounds, pure white backgrounds, salmon/coral on status indicators
- The palette isn't limited to just our 6 named colors — small accent elements (dots, decorative touches) can use complementary warm tones that fit the temperature and hue of our themes. Be creative within the warm spectrum.

### Typography
- **Headings:** DM Serif Display (loaded from Google Fonts in index.html). This MUST be loaded — if missing, headings fall back to generic serif and the whole app looks wrong
- **Body text:** Clean sans-serif. DM Sans is the default, with Lexend, Atkinson Hyperlegible, and OpenDyslexic as user-selectable alternatives
- All user-selectable fonts must be loaded in index.html from Google Fonts. If a font isn't loaded, the picker preview won't work and the user can't see what they're choosing
- Button labels: Pebble's voice tends toward lowercase ("add task", "let's begin") because it feels calmer. But use uppercase when clarity requires it (e.g., "EXIT" in Focus Mode for visibility). Default to lowercase, deviate when it helps the user.

### Layout & Spacing
- Generous border-radius: roughly 12-16px for cards, 20-24px for chat bubbles. These aren't rigid pixel values — the principle is "rounded and soft, never sharp or boxy"
- Generous padding and whitespace. Things should breathe. Nothing cramped
- Shadows should be subtle and warm-toned, barely visible. Not harsh drop shadows
- The overall feel: organic, not grid-locked. Content has room to exist

### Animation & Motion
- Everything breathes. Animation durations typically 0.3s-0.5s for interactions, up to 2.2s for ambient breathing/pulsing effects
- Use ease-out or gentle cubic-bezier curves, not linear easing
- Loading states: gentle breathing/pulsing dots or the Pebble dot expanding/contracting. Never spinning loaders or progress bars
- Page transitions: gentle fade + slight vertical movement (Framer Motion AnimatePresence)
- **Reduced motion:** respect `prefers-reduced-motion` media query, BUT only enforce simplified animations when the user has this set in their system OR toggles it in Pebble's Settings. Don't reduce motion by default — the breathing animations ARE the experience
- When something appears or disappears, animate it. Things sliding in, fading in, breathing in. Never just popping into existence

### AI Personality & Behavior
- Pebble's voice: quiet poet 70% + playful sage 30%. Short sentences. Gentle metaphors. "that's a lot to hold. let's set one piece down." NOT "That sounds important. We can make a plan."
- Prefer fewer questions per message. One question is ideal. Two is OK when they're closely related. Never three or more in a single message. The principle: don't overwhelm with choices or demands
- When the user asks for something to be broken down or turned into tasks, Pebble should actually DO it — dispatch to the task system, create the tasks, then tell the user it's done. Don't just list things in chat text
- Before asking the user what to do with something (a document, a goal, etc.), Pebble should analyze it first and offer smart, contextual suggestions. A Wikipedia article doesn't need "turn into tasks" — it needs "want me to help you study this?" or "want the key points?"
- Every "no" includes a "but here's what I can do." Pebble never just refuses
- Error messages sound like Pebble talking: "something went quiet. let's try that again." Never technical jargon, HTTP codes, or alarming language
- The AI should feel like it knows you and is building a relationship over time. Reference past conversations, remember preferences, adapt its approach

### Progress & Gamification
- No anxiety-inducing progress pressure. No "you have 4 tasks remaining" countdowns, no streak tracking, no points/badges/leaderboards
- Progress visualization IS allowed when it's calming and motivating, not pressuring. Example: the pebble-skipping-on-water concept — each completed task = a pebble skip across a calm lake. It shows progress without creating a checklist anxiety. Creative metaphors > number counters
- Time estimates should be gentle: "about 15 minutes" not "15:00 remaining." Time is a suggestion, not a countdown
- Completion moments should be warm acknowledgment, not scoreboard. "you finished everything in this group. that's real progress." — with a gentle animation, not fireworks

### Page-Level Guidance

**Home:** Primarily the chat. Returning users see a centered hero greeting (name + time of day in DM Serif Display) with quick action pills, then the chat area below. Pebble should be able to guide users to other tabs and help them understand what to do — it's a companion, not a router. The quick actions ("I have a document", "break down a goal", "start focus mode") should feel like friendly suggestions, not a menu.

**Documents:** A conversational document processing flow. User pastes/uploads → Pebble analyzes and offers contextual help based on what the document actually is. The user's input should stay visible (slides up) as Pebble's response appears below. Previously processed documents should be browsable.

**Tasks:** A living checklist where Pebble helps break goals into doable steps. Group titles should be AI-generated (clean and descriptive), not raw user input. Tasks are created by Pebble's intelligence, not just listed. The chat at the bottom should be functional — if it can't execute actions, hide it until it can.

**Focus Mode:** An immersive, calm focus experience. When coming from Tasks, it shows the current task. When accessed directly, it should offer to pick a task or name what you're focusing on. The escape hatch ("I need a pause") must be clearly visible, not hidden. The break room breathing animation should be alive (circle expands/contracts). Post-focus check-ins trigger by time elapsed, not task count.

**Settings:** Every preference from onboarding should be adjustable here with live preview. Theme options match our 4 time-of-day system. All font options from onboarding are available. No development placeholder text visible.

### Cross-Page Integration
- Home chat → Tasks: when Pebble creates tasks from a conversation, they actually appear in the Tasks page via Redux + Cosmos
- Documents → Tasks: "turn into tasks" should dispatch structured tasks, not just navigate
- Tasks → Focus: "Focus on this" should carry the task context into Focus Mode
- Focus → Home: after a focus session, returning to Home should feel like a warm "welcome back" moment
- Everything persists: chat history, tasks, documents, preferences. Refreshing the page should NOT reset anything. Use localStorage as interim persistence where backend endpoints aren't ready yet.

### Before Shipping / Demo
1. Run `grep -ri "neurofocus" frontend/src/` — zero results
2. Every AI message has the Pebble dot avatar (ocean sage circle), user messages have their initial
3. No raw ###ACTIONS markers visible in any chat
4. No "coming soon", "Session 6", or development language visible anywhere
5. Refreshing the page preserves state (onboarding complete, chat history, tasks)
6. DM Serif Display is loading for headings
7. Every page has the time-of-day theme applied
8. Features that don't work are hidden, not shown with errors
9. Test the full flow: onboarding → home greeting → chat → create tasks → go to tasks → focus mode → break → session summary → back to home


---

## Standing Code Quality Rules

Before committing or pushing ANY code:

1. Triple-check all code — read every modified file end-to-end
2. Security audit — injection flaws, exposed secrets, input validation
3. Gap analysis — service clients closed, async calls awaited, graceful degradation
4. Bug check — no attribute errors, silent failures, race conditions, type mismatches
5. Best practices — Azure SDK, FastAPI, React hooks/cleanup/key props, Python type hints
6. Hackathon awareness — every change must serve a judging criterion
7. Show Diego before committing — explain what was built, propose commit message
8. Never cut corners — polished > fast

---

## Key Constraints (Never Violate)

- NO sidebar — top nav only
- NO red anywhere — warm accent colors only
- NO pure white or pure black backgrounds
- NO tabs on document results — conversational flow only
- NO gamification — no streaks, points, leaderboards
- NO spinning loaders — gentle pulsing dots only
- Home page is ONLY chat — no embedded task lists or document viewers
- Every error message sounds like Pebble talking, never technical jargon
- Frontend must check EVERY API response for `{flagged: true}`
- Respect `prefers-reduced-motion` throughout
- Existing components (`Decomposer`, `Refactor`, `TimerRing`) should be ADAPTED, not rebuilt from scratch
- `Sidebar.jsx` is dead code — not used anywhere, safe to delete

---

## How to Clear Chapter 5 Seed Data (P0-5)

Stale Cosmos data causes Pebble to hallucinate tasks the user never created. Clear it:

```bash
# Clear tasks
curl -s -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-User-Id: diego" \
  -d '{"groups": []}'

# Clear conversation history (once GET /api/conversations is built, also clear via PUT)
# For now, clear localStorage manually in DevTools: localStorage.removeItem('pebble_chat_messages')
```

---

## How to Reset Onboarding (Testing)

To test onboarding as a new user:

```bash
curl -X PUT http://localhost:8000/api/preferences \
  -H "Content-Type: application/json" \
  -H "X-User-Id: diego" \
  -d '{"onboarding_complete": false}'
```

Then refresh the frontend — you'll see the full onboarding flow.

---

## Development

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in Azure credentials
uvicorn main:app --reload  # http://localhost:8000

# Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173
```

API docs available at `http://localhost:8000/docs` (Swagger UI) when backend is running.
