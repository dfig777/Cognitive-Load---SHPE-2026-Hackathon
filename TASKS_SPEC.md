# Tasks Page — Detailed Specification
## Add this to CLAUDE.md under Page 3: My Tasks, and use as Session 3 Claude Code prompt

### Page 3: My Tasks (THE CORE FEATURE — MOST POLISHED PAGE)
Route: /tasks

#### Landing State — All Groups Collapsed
When the user navigates to Tasks, they see:

1. **Input bar at top:** "Add a task or goal..." with "Add" button
   - Smart input: simple tasks ("call mom") add directly, complex goals ("prepare for job interview Thursday") trigger AI decomposition
   - The AI decides whether to break it down — user makes zero decisions

2. **"I have ___ minutes" filter** below the input:
   - Small inline input: "I have [20] minutes" + "Show me what fits" button
   - When used, AI highlights only tasks that fit in the time window
   - Everything else dims but doesn't disappear
   - Eliminates "which one should I start with" paralysis

3. **Task groups as collapsed cards:**
   - Each group is a calm, closed card showing: group name, source label, task count, progress, time estimate
   - Example: "Onboarding Guide · 3 of 4 left · ~30 min"
   - Example: "Job Interview Prep · 5 tasks · ~1 hr 10 min"  
   - Example: "My Tasks · 1 task · ~5 min"
   - First option is always "All Tasks" which combines every group
   - All groups start COLLAPSED — user sees the scope without the detail
   - Tap a group → it smoothly expands (Framer Motion, 0.3s ease)
   - Only one group open at a time (accordion behavior) — opening one closes the other
   - Group cards have subtle left border color: teal for document-sourced, neutral for manual

4. **Progress summary at top (above groups):**
   - "7 tasks total · 2 done · ~45 min remaining"
   - Small progress bar below

#### Expanded Group — Waterfall View
When a group is tapped open:

1. **First uncompleted task auto-expands as active** (teal border, full detail)
2. **Completed tasks show above it** — collapsed, faded, green checkmark, "done" label
3. **Upcoming tasks show below** — collapsed, just checkbox + name + time. Neutral gray.

#### Task States

**Completed task (collapsed):**
- Green filled circle with checkmark
- Task name with line-through at 0.45 opacity
- "done" label in green
- No actions available — it's done

**Active task (expanded) — only ONE at a time:**
- Teal border (1.5px), white card background, subtle shadow
- Open circle with teal border (checkbox)
- Task name (13px, font-weight 500)
- Description text below (10px, secondary color, 1-2 lines)
- Three items below the description:
  - Time estimate chip (sky blue background): "15 min"
  - "Break down" button (teal)
  - "More ···" button (gray)
- AI nudge below (orange background): specific to THIS task, not generic
  - "This is the quickest one. Good place to start."
  - "You can do this while watching TV."
  - "Just needs copy-paste from page 4."
  - Generated per-task, changes when active task changes

**Upcoming task (collapsed):**
- Open circle with gray border (checkbox — can still tap to complete out of order)
- Task name in muted color
- Time estimate in gray on the right
- Tap name → this becomes the active task (previous active collapses)
- Tap checkbox → completes it directly without expanding

#### Task Actions — Three Levels of Depth

**Level 1 — Collapsed task (default):**
- Zero buttons visible
- Tap checkbox → complete
- Tap task name → expand / make active

**Level 2 — Expanded/active task:**
- "Break down" button (teal) — most useful action, always visible
- "More ···" button (gray) — everything else hidden behind this
- AI nudge (orange)

**Level 3 — "More" menu (slides open in place, not a popup):**
- Edit task (sky blue dot) — change text or time estimate
- Move to group (sky blue dot) — reorganize between groups
- Merge with another (orange dot) — combine related tasks
- Pause (lilac dot) — set aside without deleting, moves to a "Paused" section
- [divider line]
- Delete (gray dot) — always last, separated, clearly destructive

All menu items have: colored dot on left, action name, brief description on right in muted text.
Menu closes when any action is taken or user taps elsewhere.

#### Completion Flow

When a task is checked off:
1. Circle fills with green (0.3s)
2. Checkmark draws in smoothly
3. Task card gently fades and slides up (0.4s ease)
4. AI response appears briefly as an orange nudge: contextual acknowledgment
   - "Nice. The next one builds on what you just did."
   - "That's one more down. 2 left."
   - NOT "Great job!!!" or "You're on fire!" — calm, specific, warm
5. Next uncompleted task smoothly expands into the active spot (0.3s ease)
6. Progress bar and time estimate update

#### Group Completion

When ALL tasks in a group are completed:
- Group card transforms into a completion summary:
  - "You finished all 4 onboarding tasks"
  - "Total time: about 42 minutes"  
  - "That 12-page document? Handled."
- Warm green tint on the card
- No confetti, no streaks, no points
- "Start another group" or "Take a break" buttons below

#### Adding Tasks

The input bar at the top always accepts input:

**Simple task** (detected by short, concrete text):
- "call mom" → adds directly as one task with AI-estimated time
- "buy groceries" → adds directly
- Appears in "My Tasks" group

**Complex goal** (detected by complexity, timeframe, or vague scope):
- "prepare for job interview Thursday" → AI breaks into 3-5 steps
- "write my research paper" → AI breaks into steps
- Creates a new task group named by the AI: "Job Interview Prep"
- Brief orange AI message: "That's a big one. I broke it into 5 steps."

**With context** (if a document is referenced):
- Tasks flowing from Documents page arrive as a pre-made group
- Group labeled "From: [document name]"
- Already decomposed with time estimates

#### Task Q&A Input

At the very bottom of the page:
- Small input bar: "Ask about your tasks..."
- Not a chat — a Q&A. User asks, AI answers inline above the input, answer fades after 10 seconds or user dismisses
- "Which one is most important?" → AI highlights one task
- "What if I skip the training?" → AI explains consequences from document context
- "Reorder by easiest first" → AI reorders the list
- "How long will all of this take?" → AI gives total estimate

#### Paused Section

If any tasks are paused (via the More menu):
- A small "Paused" section appears at the bottom, collapsed by default
- Shows count: "2 paused tasks"
- Tap to expand and see paused items
- Each paused item has "Resume" button (teal)
- Paused tasks don't count toward progress bar or time estimate

#### Start Focus Mode

"Start focus mode" button appears:
- At the top of the expanded group, next to the group header
- Only visible when a group is expanded
- Launches Focus Mode starting from the first uncompleted task in that group
- Also available on the active task card: "Focus on this" smaller button

#### Visual Summary

The Tasks page visual hierarchy from top to bottom:
1. Input bar ("Add a task or goal...")
2. Time filter ("I have ___ minutes")
3. Progress summary ("7 tasks · 2 done · ~45 min left")
4. Task group cards (collapsed by default, one opens at a time)
   - Inside expanded group: completed → active (expanded) → upcoming (collapsed)
5. Paused section (if any, collapsed)
6. Q&A input ("Ask about your tasks...")
ENDOFFILE
echo "Done"