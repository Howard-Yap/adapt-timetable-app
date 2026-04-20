# Adapt — AI Adaptive Timetable App

An AI-powered timetable that rebuilds itself around your day.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

## 📦 Build for Production

```bash
npm run build
npm run preview
```

## 🏗️ Project Structure

```
src/
├── engine/
│   ├── scheduler.js      # Core scheduling + rebuild engine
│   └── aiAssistant.js    # Rule-based intent parser + response generator
├── screens/
│   ├── OnboardingScreen.jsx   # 4-step user setup
│   ├── DashboardScreen.jsx    # Today's overview + current task
│   ├── ScheduleScreen.jsx     # Visual timeline with live indicator
│   ├── ChatScreen.jsx         # AI assistant chat interface
│   └── TaskManagerScreen.jsx  # Full task CRUD + filters
├── data/
│   └── defaults.js       # Sample data + constants
├── App.jsx               # Root component + global state
├── main.jsx              # Entry point
└── styles.css            # Full dark theme UI
```

## 🧠 Core Loop

**BUILD → TRACK → BREAK → REBUILD → REPEAT**

1. **BUILD** — Schedule generated from tasks + fixed events + preferences
2. **TRACK** — Mark tasks done/skipped from Dashboard or Schedule view
3. **BREAK** — Tell the AI what's disrupted (chat or quick actions)
4. **REBUILD** — Engine recalculates, respects end-of-day limit
5. **REPEAT** — Happens as many times as needed throughout the day

## 💬 AI Commands (Chat Screen)

The rule-based assistant understands natural language:

| You say | What happens |
|---|---|
| "I'm running late" | Shifts schedule +30 mins |
| "I'm running late by 45 minutes" | Shifts schedule +45 mins |
| "Start at 2pm" | Shifts everything from 2pm onward |
| "Skip this task" | Skips current task, fills gap |
| "Push [task name] to tomorrow" | Moves specific task |
| "Make today lighter" | Removes low-priority tasks |
| "I'm tired" | Lightens load |
| "Only have 2 hours left" | Rebuilds to fit 2h window |
| "End at 9pm" | Sets new hard end time |
| "Rebuild my day" | Full schedule regeneration |
| "What's next?" | Shows next task |
| "I'm done with [task]" | Marks task complete |

## ⚙️ Engine Details

### Scheduling Engine (`scheduler.js`)
- Computes free windows between fixed events
- Sorts tasks by priority → deadline
- Fills windows greedily, splits tasks when partial time available (min 25 min)
- Enforces strict end-of-day constraint

### Rebuild Engine
- Triggered by any chat command or manual action
- Keeps completed blocks in place
- Re-prioritises all remaining tasks
- Respects updated end time

### End-Time Protection
- **Hard limit** — no tasks ever scheduled beyond `endDayTime`
- Excess tasks roll over to `rolledOver[]` (shown as "tomorrow")

## 🎨 Design

- Dark theme with deep space palette
- **Syne** display font + **DM Mono** for times
- Accent: `#7c6bff` (purple) with cyan gradient accents
- Fully responsive, mobile-first (max-width 430px)

## 🔮 Extending

To add **real AI** (Claude API):
1. Replace `parseIntent()` in `aiAssistant.js` with API call
2. Pass schedule state as context in system prompt
3. Parse structured response to extract `mutation` and `response`
