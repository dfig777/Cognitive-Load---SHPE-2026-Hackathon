# STEP 1: Replace CLAUDE.md entirely

Replace the entire CLAUDE.md file in the repo root with the content below. This is v4 — the final locked version with all design decisions.

---

# CLAUDE.md — NeuroFocus: AI Cognitive Support Companion

> "A calm place to start."

## Project Overview

Microsoft Innovation Challenge hackathon (March 16-27, 2026). An AI cognitive support companion that transforms overwhelming information into calm, structured, personalized clarity for neurodiverse users and anyone experiencing cognitive overload.

**Challenge:** Cognitive Load Reduction Assistant
**Stack:** Python 3.11+ (FastAPI) backend + JavaScript (React + React Router + Framer Motion) frontend
**Judging Criteria (25% each):** Performance, Innovation, Breadth of Azure services, Responsible AI

## Team Reality

Diego (Fig) is the primary builder handling backend AND frontend. Andy has limited availability. Two other teammates may help with prompts and deliverables later. All code should be calibrated for a solo-builder reality. Efficiency matters but never at the cost of quality.

## Standing Code Quality Rules

Before committing or pushing ANY code, Claude must:

1. Triple-check all code — read every file modified and verify correctness end-to-end
2. Security audit — check for injection flaws, exposed secrets, missing input validation
3. Gap analysis — verify all service clients properly closed, all async calls awaited, graceful degradation works
4. Bug check — no attribute errors, no silent failures, no race conditions, no type mismatches
5. Best practices — Microsoft Azure SDK, FastAPI, React (hooks, cleanup, key props), Python (type hints, error chains)
6. Hackathon awareness — every change must serve the 3 core features and 4 judging criteria
7. Show Diego before committing — explain what was built, non-biased analysis, proposed commit message
8. Never cut corners on quality — if the polished version is better, build the polished version

## Current Progress

### Backend (COMPLETE)
All 8 Azure services integrated. Full security audit done. See backend/ for all files.

### Frontend (IN PROGRESS — Session 1)
Existing components: Decomposer.jsx, Refactor.jsx, TimerRing.jsx, PreferenceDashboard.jsx, store.js, api.js, bionic.jsx, global.css
These are FUNCTIONAL and should be KEPT and ADAPTED, not rebuilt from scratch.
Color system designed and locked — 5 accent colors, 4 time-of-day themes (DONE)

## Product Identity

NeuroFocus is ONE cohesive AI companion. It knows the user through stored preferences. It adapts every interaction. It connects document processing → task management → focus execution in one natural flow. After every output, it gently suggests one contextual next step. It feels like a warm, patient friend.

The AI lives everywhere — it IS the experience. Not a sidebar tool.

## Navigation — Minimal Top Bar (Style B)

NO sidebar. NO left panel. The app uses a clean minimal top bar:

- Left: "NeuroFocus" logo text
- Center-right: 4 nav items as small rounded pills: Home, Documents, Tasks, Focus
- Far right: Settings icon (gear) and user avatar circle

Active nav item gets teal-tinted background. Inactive items are secondary text color.
Focus Mode route hides the entire top bar — full screen.

The home page is FULL SCREEN chat — like Claude or ChatGPT. Centered greeting, centered input, suggested action buttons. The chat IS the page.

## Five Pages

### Page 1: Home (Full-Screen AI Chat)
Route: / or /home
Layout: Full screen. Logo top-left. Nav items top-right. Everything centered.
New users: Conversational onboarding — guided preference questions one at a time, UI adapts live as each answer is given. All questions are guided choice with "type your own" option.
Returning users: Time-of-day greeting with name, last session context, quick action buttons ("I have a document", "Break down a task", "Start focus mode"), full chat input below.
AI chat with conversation history. Responses stream in. Chat persists across page navigation.

### Page 2: Documents (Conversational Document Processing)
Route: /documents
Layout: Centered content, max-width 540px. Clean and spacious.

THREE STATES:

**State 1 — Input:**
Centered headline: "Share what's overwhelming you."
Subtitle: "We'll make it make sense."
One unified input zone (breathing animation with subtle teal pulse): accepts pasted text OR file drops. One text area that does both.
Small "+ Upload file" button in bottom-left of zone. "PDF, Word, image" label.
One "Go" button.

**State 2 — AI asks ONE guided question:**
After scanning, AI shows what it found as a chat message: "This looks like a [type] with [details]."
Then asks: "What would help you most right now?" with 4 guided choices:
- Teal: "Just tell me what I need to do" — action items and deadlines
- Green: "Make it easier to read" — simplify language
- Sky blue: "Show me what matters most" — highlight key sections
- Lilac: "I'm not sure, just help me" — AI decides based on preferences

**State 3 — Results as conversation:**
AI delivers results in chat format — not tabs, not cards. A conversational response with structured content inline.
After results, AI offers guided next steps as buttons: "Turn into tasks", "Simplify full text", "Highlight key parts"
PLUS a text input: "Ask anything about this document..." for open-ended follow-up questions.
The user can keep asking questions about the document and the AI responds with full context.

### Page 3: My Tasks (Living Checklist — MOST POLISHED PAGE)
Route: /tasks
Two entry points: type a goal in input at top, or tasks flow from Documents page.
Living checklist — tasks feel alive, AI responds contextually to completions.
Break any task down further. AI understands dependencies.
Granularity control (Micro/Normal/Broad). Progress indicator.
"Start Focus Mode" button.

### Page 4: Focus Mode
Route: /focus
FULL SCREEN — no top bar, no nav, nothing.
Single task displayed. Circular timer. Done/Skip/Break buttons.
Timer colors: green → blue → warm amber (NEVER red).
Energy check-in periodically with 3 guided buttons.
Overwhelm escape hatch: "Everything is too much" strips to one action.
Session summary on exit.

### Page 5: Settings
Route: /settings
All preferences adjustable with real-time preview.
Reading level, font, theme (including time-of-day auto), spacing, granularity, timer, nudge style.

## Color Meaning System (STRICT)

Every color has ONE meaning. Never deviate.

### Green — completion and safety
"You did it. You're safe. This is done."
- Done status chips, completed task dots, "Good" energy button, success confirmations
- Morning: #58A078 / Afternoon: #50946A / Evening: #528C64 / Night: #50A86E, glow #60C888

### Teal — active and primary actions
"You're here. Click me to do something."
- Primary buttons, "Working on it" chips, active task highlight, active nav item
- Morning: #5A9AA4 / Afternoon: #2A7A90 / Evening: #3A7E8E / Night: #44A0AE, glow #60BCC8

### Sky blue — upcoming and queued
"This is waiting. No rush."
- "Up next" chips, upcoming task dots, queued items
- Morning: #6892B0 / Afternoon: #6A96B8 / Evening: #6488A8 / Night: #6A8AB4, glow #80B0D8

### Lilac/purple — paused and reflective
"This is resting. No judgment."
- "Paused" chips, "Overwhelmed" energy button, deferred items
- Morning: #9686AE / Afternoon: #9A88B4 / Evening: #8A78A4 / Night: #8A78AE, glow #B0A0CC

### Soft orange — AI companion voice
"The AI is gently talking to you."
- AI nudges, follow-up suggestions, energy check-in containers, "Getting tired" button
- NEVER on status indicators, NEVER on primary buttons, NEVER on errors
- Morning: #DCA05A / Afternoon: #E0A060 / Evening: #C89450 / Night: #C8A046, glow #D8C060

### Neutral warm gray — inactive and unfilled
"This exists but doesn't need attention."
- Unfilled checkboxes, inactive nav, placeholder text, disabled buttons, ghost borders
- Consistent: #B4AA9A range

## NEVER use:
- Red, bright yellow, pure black backgrounds, pure white backgrounds, neon colors
- Salmon/coral/warm-hot colors on status indicators

## Four Time-of-Day Themes

### Morning (6am-12pm): peach sunrise
Background: radial-gradient(ellipse at 50% 38%, #FFF8F2 0%, #F8F0E8 18%, #F4EBE4 34%, #F0E6E0 50%, #EDE2DC 68%, #F0E6E0 85%, #F2E8E2 100%)
Card bg: rgba(255,253,250,0.58) border rgba(226,214,202,0.35)
Text primary: #3A3024 / Secondary: #8A7860

### Afternoon (12pm-5pm): warm coast — DEFAULT
Background: radial-gradient(ellipse at 50% 40%, #FFFAF5 0%, #F5EDE4 35%, #EAE4DC 65%, #F0EBE5 100%)
Card bg: rgba(255,255,255,0.68) border rgba(218,208,196,0.4)
Text primary: #2A2622 / Secondary: #8A7E6E

### Evening (5pm-9pm): warm dusk
Background: radial-gradient(ellipse at 50% 42%, #F6F0EE 0%, #F0E8E6 18%, #EAE2E0 34%, #E6DCDA 50%, #E2D8D8 68%, #E6E0DE 85%, #E8E2E0 100%)
Card bg: rgba(255,252,250,0.55) border rgba(214,206,204,0.35)
Text primary: #2E2828 / Secondary: #7A6E70

### Night (9pm-6am): deep ocean
Background: radial-gradient(ellipse at 50% 46%, #2C2434 0%, #241E2C 25%, #201A26 45%, #1C1822 65%, #1E1A22 85%, #201C24 100%)
Card bg: rgba(40,34,48,0.7) border rgba(80,70,90,0.45)
Text primary: #DCD4DA / Secondary: #A098A4

### Time detection:
```javascript
function getTimeTheme() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}
```
Set data-time-theme on document root. Transition: 2s ease on background, 0.5s on colors. User can override in Settings.

## Transitions and Animations

### Page transitions: soft slide up
- Outgoing page: opacity 0, translateY(-12px) over 0.4s
- Incoming page: starts at translateY(16px) opacity 0, animates to translateY(0) opacity 1 over 0.45s
- Use Framer Motion AnimatePresence with mode="wait"
- Easing: cubic-bezier(0.4, 0, 0.2, 1)

### Smaller elements (modals, tooltips, chips, nudges): gentle fade
- opacity 0 → 1 over 0.3s ease

### Staggered reveal on every page load
- Elements appear one by one with ~100-120ms delay between each
- Each element: translateY(8px) opacity 0 → translateY(0) opacity 1 over 0.4s ease
- Order: heading first, then subtitle, then action buttons/cards, then input

### Task completion micro-interaction
- Dot scales to 1.3x then back to 1x (0.3s cubic-bezier)
- Background shifts from teal to green (0.5s ease)
- Text gets line-through and opacity 0.45 (0.4s ease)
- Time label changes to "done" with green color

### Breathing animation (document upload zone)
- Subtle box-shadow pulse: 0 0 0 0px rgba(42,122,144,0.04) → 0 0 0 12px rgba(42,122,144,0.02) over 4s ease-in-out infinite

### General rules
- All interactive elements: 0.25s ease transitions on hover/focus
- Rounded corners everywhere: 14px cards, 8px buttons, 12px inputs
- No jarring, no popping, no flashing. Everything breathes.

## Key Constraints

- NO sidebar — top nav only
- NO red anywhere — warm accent colors only
- NO pure white or pure black backgrounds
- NO tabs on document results — conversational flow only
- NO gamification — no streaks, points, leaderboards
- NO open-ended AI questions — always guided choices with "type your own" option
- NO spinning loaders — gentle pulsing only
- Salmon/coral ONLY in background decoration, NEVER on status indicators
- Green = done, Teal = active, Sky blue = upcoming, Lilac = paused, Orange = AI voice
- Existing components ADAPTED not rebuilt
- Frontend checks EVERY API response for {flagged: true}

## API Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /health | Health check | Working |
| GET | /api/preferences | Load preferences | Working |
| PUT | /api/preferences | Save preferences | Working |
| POST | /api/decompose | Break goal into tasks | Working |
| POST | /api/summarise | Simplify text (SSE) | Working |
| POST | /api/explain | Explain simplification | Working |
| POST | /api/nudge | Supportive nudge | Working |
| POST | /api/upload | Upload document | Working |
| POST | /api/sessions | Save session | Working |
| GET | /api/sessions | List sessions | Working |
| POST | /api/analyze | Full pipeline | To build |
| POST | /api/checkin | Energy check-in | To build |
| POST | /api/chat | AI companion chat | To build |

## Development

Backend: cd backend && uvicorn main:app --reload (port 8000)
Frontend: cd frontend && npm install && npm run dev (port 5173)

---

# STEP 2: Build Frontend Session 1 — App Shell + Routing + Navigation

Read the updated CLAUDE.md. Now build Session 1.

## What to build:

### 1. Install dependencies
```bash
cd frontend
npm install react-router-dom --save
```

### 2. Update src/main.jsx
- Wrap app in BrowserRouter + Redux Provider
- Structure: BrowserRouter > Provider > App

### 3. Build src/components/TopNav.jsx
- A clean horizontal top bar
- Left: "NeuroFocus" text logo (font-weight 500, primary text color)
- Center-right: 4 nav items as NavLinks: Home, Documents, Tasks, Focus
- Far right: small gear icon link to /settings, user avatar circle with initial "D"
- Active NavLink gets teal-tinted background pill: rgba(42,122,144,0.1) with color teal
- Inactive items: secondary text color
- The ENTIRE top bar hides on /focus route
- Height: ~52px. Subtle bottom border matching theme.
- Smooth appearance with Framer Motion

### 4. Rewrite src/App.jsx
- Layout: TopNav at top (unless Focus Mode) + main content area centered
- React Router Routes:
  - / and /home → Home.jsx
  - /documents → Documents.jsx
  - /tasks → Tasks.jsx
  - /focus → FocusMode.jsx (TopNav hidden)
  - /settings → Settings.jsx
- Keep existing preference loading (useEffect → fetchPreferences)
- Keep CSS variable application (data-theme, data-font, line-height, letter-spacing)
- Add time-of-day detection: set data-time-theme on document.documentElement
- Wrap page content in Framer Motion AnimatePresence for slide-up transitions

### 5. Create page shells in src/pages/
Each page shell should:
- Use the warm card styling from the design system
- Have a staggered entrance animation (elements appear one by one)
- Show placeholder content indicating what will be built

**Home.jsx:**
- Centered layout, full height
- Large greeting: "Good [morning/afternoon/evening], Diego" (use time detection)
- Subtitle: "What would you like to work on?"
- Three action buttons: "I have a document" (teal), "Break down a task" (orange-soft), "Start focus mode" (green-soft)
- Chat input below: rounded, with placeholder "What's on your mind?"
- All elements stagger in on load

**Documents.jsx:**
- Centered, max-width 540px
- Headline: "Share what's overwhelming you."
- Subtitle: "We'll make it make sense."
- Upload zone with breathing animation (teal pulse box-shadow)
- Textarea inside zone: "Paste text, drop a file, or describe what you need help with..."
- Small "+ Upload file" button bottom-left, "Go" button bottom-right
- Staggered entrance

**Tasks.jsx:**
- Centered, max-width 540px
- Input at top: "What do you need to break down?"
- Empty state below: "Your tasks will appear here. Type a goal above or bring in tasks from a document."
- Staggered entrance

**FocusMode.jsx:**
- Full screen, no TopNav
- Centered: "Focus Mode coming soon"
- A small "Exit" link to go back to /tasks

**Settings.jsx:**
- Centered, max-width 480px
- "Settings" heading
- Placeholder text: "Preferences will go here"

### 6. Update src/styles/global.css
- Add 4 time-of-day theme blocks: [data-time-theme="morning"], [data-time-theme="afternoon"], [data-time-theme="evening"], [data-time-theme="night"]
- Each sets CSS custom properties: --bg-gradient, --bg-card, --bg-card-border, --text-primary, --text-secondary, --text-muted, --color-done, --color-active, --color-upcoming, --color-paused, --color-ai, --color-inactive
- Include the full gradient values from CLAUDE.md
- Keep existing font-face declarations, font switching, base styles
- Add TopNav styles
- Add page transition styles
- Default: afternoon theme
- Keep [data-theme="dark"] and [data-theme="high-contrast"] as manual overrides

### 7. DO NOT modify these existing files:
Decomposer.jsx, Refactor.jsx, TimerRing.jsx, PreferenceDashboard.jsx, store.js, api.js, bionic.jsx

### 8. After building:
- Run `npm run dev` and verify:
  - App loads with TopNav showing NeuroFocus logo + 4 nav items
  - Clicking each nav item navigates to correct page with slide-up transition
  - Active nav item highlighted in teal
  - Focus Mode hides TopNav completely
  - Time-of-day theme applied based on current hour
  - Staggered entrance animations on each page
  - Breathing animation on Documents upload zone
  - Overall vibe: warm, calm, spacious — like opening a quiet room
- Show me everything before committing
- Commit: "Frontend Session 1: App shell, top nav, routing, time-of-day themes, page transitions"
