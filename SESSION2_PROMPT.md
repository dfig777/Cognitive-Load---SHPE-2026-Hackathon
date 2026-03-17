# Session 2: Build the Documents Page

Read CLAUDE.md for full context. Now build the Documents page with the conversational document processing flow.

## What to build:

### The Documents page has THREE states. Build all three.

---

### STATE 1: Input State (what you see when you first navigate to /documents)

Layout: centered content, max-width 540px, vertically centered on the page.

**Elements in order (staggered entrance animation, 100-120ms between each):**

1. Headline: "Share what's overwhelming you." (18-20px, font-weight 500, primary text color)
2. Subtitle: "We'll make it make sense." (11px, secondary text color)
3. Upload zone:
   - Rounded container (border-radius 16px)
   - Border: 1.5px solid with teal tint rgba(42,122,144,0.15)
   - Background: rgba(255,253,250,0.5)
   - Breathing animation: subtle box-shadow pulse — `0 0 0 0px rgba(42,122,144,0.04)` to `0 0 0 12px rgba(42,122,144,0.02)` over 4s ease-in-out infinite
   - Inside the zone:
     - A textarea: "Paste text, drop a file, or describe what you need help with..."
     - The textarea ALSO accepts file drops (drag and drop handler on the whole zone)
     - Height: ~90px, no border, transparent background, font-size 12px
   - Below the textarea, a thin separator line, then a footer row:
     - Left: "+ Upload file" small button (teal-soft background, 9px) + "PDF, Word, image" label in muted gray
     - Right: "Go" button (teal solid, 10px font-weight 500)
   - The "+ Upload file" button opens a native file picker (accept .pdf, .docx, .doc, .png, .jpg)
   - When a file is dropped or selected, show the filename below the textarea: "📄 Company_Onboarding.pdf" with an "x" to remove it

**Behavior:**
- User can EITHER paste text into the textarea OR drop/upload a file — not both simultaneously
- If a file is attached, the textarea becomes read-only and shows "File attached — ready to process"
- "Go" button is disabled (dimmed) until there's text in the textarea or a file attached
- Clicking "Go" transitions to State 2

---

### STATE 2: AI Asks ONE Guided Question

After the user clicks "Go", the input zone fades out (0.3s) and the question state fades in.

**Elements:**

1. File/text indicator at top:
   - If file: icon + filename + page count (from upload response) + "uploaded just now"
   - If text: "Your pasted text" + word count + "ready to process"
   - Small, not prominent — just context

2. AI message bubble (appears with slide-up animation):
   - NeuroFocus avatar (22px circle, teal-soft background, "N" letter)
   - Rounded bubble (border-radius 12px, warm card background)
   - Message: AI describes what it found — "This looks like a [type] with [details]. What would help you most right now?"
   - For the hackathon demo, this message comes from calling POST /api/chat or POST /api/summarise to analyze the document. If the backend endpoint isn't ready yet, use a smart placeholder based on the file name/word count.

3. Four guided choice cards below the AI message (staggered entrance, 80ms delay):
   - Each card is a rounded container (border-radius 10px) with:
     - Left: small colored dot (8px)
     - Title text (11px, font-weight 500)
     - Subtitle text (9px, muted)
   - The four choices:
     a. Teal dot: "Just tell me what I need to do" / "Pull out the action items and deadlines only"
     b. Green dot: "Make it easier to read" / "Simplify the language and shorten it"
     c. Sky blue dot: "Show me what matters most" / "Highlight the key sections I should focus on"
     d. Lilac dot: "I'm not sure, just help me" / "I'll figure out the best way to show it for you"
   - Each card has subtle hover: background darkens slightly, border becomes more visible
   - Clicking a card transitions to State 3 with the chosen mode

**Backend calls for State 2:**
- POST /api/upload (if file) → get back extracted text and page count
- Then use the extracted text or pasted text to generate the AI's description message
- If /api/chat endpoint exists, use it. If not, construct a smart description from the upload response (file type, page count, word count)

---

### STATE 3: Results as Conversation

The guided choices fade out and results appear as a conversation flow.

**Elements:**

1. AI message with results:
   - NeuroFocus avatar + bubble
   - Opening line varies by mode chosen:
     - "Just tell me what I need to do" → "I found [N] things you need to do across [pages] pages. Everything else is background info you don't need right now."
     - "Make it easier to read" → "Here's a simplified version at your reading level."
     - "Show me what matters most" → "Here are the [N] sections that matter most."
     - "I'm not sure" → AI picks the best mode based on user preferences from Cosmos DB

2. Results content (inside or below the AI bubble):
   
   **For "Just tell me what I need to do":**
   - A clean card with numbered action items
   - Each item: numbered teal circle + bold action title + brief description + deadline chip (sky blue) if applicable
   - Items separated by subtle dividers
   
   **For "Make it easier to read":**
   - Simplified text rendered with the user's font preferences
   - Bionic Reading toggle available (use existing bionic.jsx utility)
   - Sentences with explainability: dashed teal underline on simplified sentences
   - Hovering an underlined sentence calls POST /api/explain and shows a tooltip with why it was changed
   - Connect to POST /api/summarise for streaming simplified text (use existing Refactor.jsx streaming logic)
   
   **For "Show me what matters most":**
   - The key sections listed as expandable rows
   - Each row: colored dot + section title + brief summary
   - Tap to expand and see the full section text
   
   **For "I'm not sure":**
   - AI picks the most appropriate mode and shows those results
   - Mentions which mode it chose: "Based on your preferences, I'm showing you the action items."

3. AI follow-up (orange accent — appears after results with slight delay):
   - NeuroFocus avatar with orange tint
   - Orange-tinted bubble
   - "Want me to do anything else with this document?"
   - Guided buttons: "Turn into tasks" (teal solid), "Simplify full text" (teal soft), "Highlight key parts" (teal soft)
   - These buttons trigger the OTHER modes — so the user can explore without going back

4. Q&A input at the bottom:
   - Rounded input: "Ask anything about this document..."
   - "Ask" button on the right
   - When the user types a question and submits:
     - Their message appears as a user bubble (green-soft tint, right-aligned with user avatar)
     - AI responds with an answer bubble below
     - The conversation grows downward — user can keep asking
   - Connect to POST /api/chat if available, or POST /api/summarise with a question-answering prompt

5. "Turn into tasks" button behavior:
   - When clicked, extracts the action items
   - Navigates to /tasks with the items passed via Redux state or URL params
   - On the Tasks page, they appear as a new group: "From: [document name]"

---

### Backend connections:

| Frontend action | Backend endpoint | Notes |
|----------------|-----------------|-------|
| File upload | POST /api/upload | Returns extracted text, page count |
| Text simplification | POST /api/summarise | STREAMING (SSE) — use EventSource or fetch with reader |
| Explain sentence | POST /api/explain | Returns explanation for hover tooltip |
| AI question about doc | POST /api/chat (or /api/summarise with question prompt) | If /api/chat doesn't exist yet, fall back to a summarise call with the question prepended |
| Turn into tasks | POST /api/decompose | Pass the action items text, get back structured tasks |

### Streaming implementation for "Make it easier to read":
- POST /api/summarise returns Server-Sent Events
- The existing Refactor.jsx has streaming logic — ADAPT this, don't rebuild
- Text should appear word by word or chunk by chunk in the results bubble
- Use the existing api.js streamSummarise function if it exists

### Error handling:
- If upload fails: calm message in the AI bubble — "Something went quiet. Try again or paste the text directly."
- If streaming fails mid-way: show what we have so far + "I wasn't able to finish. Here's what I got so far."
- If content safety flags the input: show the flagged response's calm message in an orange-tinted card. Check EVERY API response for {flagged: true}.
- NEVER show error codes, stack traces, or technical error messages to the user

### File drop UX:
- When a file is being dragged over the upload zone: border becomes solid teal (not dashed), background brightens slightly
- When dropped: brief green flash on the border (0.2s), then filename appears
- Accepted types: .pdf, .docx, .doc, .png, .jpg, .jpeg
- If wrong file type: gentle message "I can work with PDFs, Word docs, and images. Try one of those?"
- Max file size: 20MB. If exceeded: "That file is a bit large. Try one under 20MB?"

### Design rules:
- Everything centered, max-width 540px
- Use the color system from CLAUDE.md exactly — every color has a strict meaning
- All transitions smooth (0.3-0.5s ease)
- Staggered entrance on every state change
- No tabs anywhere — this is a conversation, not an interface
- The page should feel like handing something overwhelming to a calm friend

### After building:
- Verify all three states work in the browser
- Test with both file upload and pasted text
- Test the guided question cards
- Test at least the "Just tell me what I need to do" results view
- If backend isn't running, gracefully show the UI with mock data so the design is verifiable
- Show me everything before committing
- Commit: "Frontend Session 2: Documents page — upload zone, guided question, conversational results"
