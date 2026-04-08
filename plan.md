# Self-Learn Quiz App — Implementation Plan

## Overview
An economics study tool built with React (frontend) and Node.js (backend). Content is AI-generated via OpenAI and cached in JSON files. Single-user, with quiz sessions limited to 5 questions followed by a configurable global cooldown.

---

## Project Structure

```
self-learn-quiz/
├── backend/
│   ├── config/
│   │   ├── config.json          # API key, cooldown duration, proficiency thresholds
│   │   └── topics.json          # User-defined topics list
│   ├── data/
│   │   ├── subtopics/           # Cached subtopics per topic: {topicId}.json
│   │   ├── content/             # Cached one-pagers: {topicId}_{subtopicId}.json
│   │   └── progress/
│   │       ├── user_progress.json   # Correct/wrong counts per subtopic
│   │       └── session.json         # Global cooldown state
│   ├── src/
│   │   ├── routes/
│   │   │   ├── topics.js
│   │   │   ├── subtopics.js
│   │   │   ├── content.js
│   │   │   ├── questions.js
│   │   │   └── progress.js
│   │   ├── services/
│   │   │   ├── openai.js        # OpenAI API wrapper
│   │   │   ├── storage.js       # JSON file read/write abstraction (swap for DB later)
│   │   │   └── proficiency.js   # Proficiency level calculation
│   │   └── app.js
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── TopicList.jsx
    │   │   ├── SubtopicList.jsx
    │   │   ├── SubtopicDetail.jsx
    │   │   ├── ContentView.jsx
    │   │   ├── Quiz.jsx
    │   │   ├── QuizQuestion.jsx
    │   │   ├── QuizResults.jsx
    │   │   ├── ProficiencyBadge.jsx
    │   │   ├── CooldownScreen.jsx
    │   │   └── BackButton.jsx
    │   ├── services/
    │   │   └── api.js            # All fetch calls to backend
    │   ├── App.jsx
    │   └── main.jsx
    └── package.json
```

---

## Configuration Files

### `backend/config/config.json`
```json
{
  "openai": {
    "apiKey": "YOUR_OPENAI_KEY_HERE",
    "model": "gpt-4o"
  },
  "session": {
    "questionsPerSession": 5,
    "cooldownMinutes": 5
  },
  "proficiency": {
    "beginner":     { "min": 0,   "max": 9   },
    "novice":       { "min": 10,  "max": 29  },
    "rookie":       { "min": 30,  "max": 49  },
    "intermediate": { "min": 50,  "max": 74  },
    "master":       { "min": 75,  "max": 119 },
    "expert":       { "min": 120, "max": null }
  }
}
```

### `backend/config/topics.json`
```json
[
  {
    "id": "microeconomics",
    "name": "Microeconomics",
    "description": "Study of individual economic units"
  },
  {
    "id": "macroeconomics",
    "name": "Macroeconomics",
    "description": "Study of the economy as a whole"
  }
]
```
> Add or remove topics by editing this file. Sub-topics are auto-generated from the topic name and description.

---

## Backend

### API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/topics` | Returns all topics from `topics.json` |
| GET | `/api/topics/:topicId/subtopics` | Returns subtopics (generates + caches if not found) |
| GET | `/api/subtopics/:topicId/:subtopicId/content` | Returns one-pager (generates + caches if not found) |
| GET | `/api/subtopics/:topicId/:subtopicId/questions` | Generates and returns 5 MCQ questions |
| POST | `/api/progress/:subtopicId` | Submits correct/wrong count after a session |
| GET | `/api/progress/:subtopicId` | Returns correct/wrong count + proficiency level |
| GET | `/api/session` | Returns current cooldown state (active, remainingSeconds) |
| POST | `/api/session/start` | Records the start of a new quiz session (starts cooldown) |

### Storage Abstraction (`storage.js`)
All file reads/writes go through a `storage` service with methods:
- `read(filePath)` — parses and returns JSON, returns `null` if not found
- `write(filePath, data)` — serializes and writes JSON

This layer is the only place that touches the filesystem. Replacing it with a DB adapter later requires changes only here.

### OpenAI Integration (`openai.js`)
Three prompt functions:
1. **generateSubtopics(topicName)** — returns an array of `{ id, name, description }` objects
2. **generateContent(topicName, subtopicName)** — returns a markdown string (the one-pager)
3. **generateQuestions(topicName, subtopicName)** — returns an array of 5 MCQ objects:
   ```json
   {
     "question": "...",
     "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
     "correctIndex": 1,
     "explanation": "..."
   }
   ```

### Caching Logic
- On request for subtopics: check `data/subtopics/{topicId}.json`. If missing, call OpenAI and save.
- On request for content: check `data/content/{topicId}_{subtopicId}.json`. If missing, call OpenAI and save.
- Questions are **not cached** — generated fresh each session.

### Session / Cooldown Logic (`session.json`)
```json
{
  "lastSessionEnd": "2024-01-01T12:00:00.000Z"
}
```
- On `GET /api/session`: compare `lastSessionEnd + cooldownMinutes` to now. Return `{ active: bool, remainingSeconds: int }`.
- On `POST /api/session/start`: write current timestamp to `lastSessionEnd`.

### Proficiency Calculation (`proficiency.js`)
Reads thresholds from `config.json`. Compares `correctCount` to ranges and returns the level label.

---

## Frontend

### Screens & Navigation

```
TopicList
  └── SubtopicList (for a selected topic)
        └── SubtopicDetail (for a selected subtopic)
              ├── ContentView  (read the one-pager)
              └── Quiz         (answer questions)
                    └── CooldownScreen (if cooldown is active)
```

All screens except TopicList have a **Back** button.

### Screen Details

#### 1. TopicList
- Fetches and displays all topics as cards
- Clicking a topic navigates to SubtopicList

#### 2. SubtopicList
- Shows topic name + list of subtopics
- Each subtopic card shows: name, `ProficiencyBadge`
- Shows a loading state while subtopics are being generated

#### 3. SubtopicDetail
- Shows subtopic name and `ProficiencyBadge`
- Two action buttons: **Read** and **Quiz**
- If cooldown is active, Quiz button is disabled and shows remaining time

#### 4. ContentView
- Renders the one-pager as formatted text/markdown
- Shows loading state while content is being generated

#### 5. Quiz
- Checks cooldown on mount; redirects to `CooldownScreen` if active
- Fetches 5 questions, shows them one at a time
- After selecting an answer:
  - Highlights correct answer in green, wrong in red
  - Shows explanation text
  - "Next" button to proceed
- After question 5: shows `QuizResults`
- On completion: POSTs score to `/api/progress/:subtopicId` and POSTs to `/api/session/start`

#### 6. QuizResults
- Shows score (e.g., "4 / 5 correct")
- Shows updated proficiency level
- Options: "Back to Subtopic" or "Back to Topics"

#### 7. CooldownScreen
- Displays a countdown timer
- Auto-redirects to SubtopicDetail when cooldown expires

### ProficiencyBadge Component
- Accepts a level string (`beginner`, `novice`, etc.)
- Renders a colored badge

### `api.js` Service
Thin wrapper around `fetch` for all backend calls. Base URL is configurable (defaults to `http://localhost:3001`).

---

## Data Flow Summary

```
User selects topic
  → GET /api/topics/:topicId/subtopics
    → if cached: return from file
    → if not: call OpenAI → save → return

User selects subtopic → reads content
  → GET /api/subtopics/:topicId/:subtopicId/content
    → if cached: return from file
    → if not: call OpenAI → save → return

User selects subtopic → starts quiz
  → GET /api/session (check cooldown)
  → if active: show CooldownScreen
  → if not: GET /api/subtopics/:topicId/:subtopicId/questions
    → generate 5 MCQs via OpenAI → return (not cached)
  → User answers all 5 questions
  → POST /api/progress/:subtopicId (submit score)
  → POST /api/session/start (start cooldown)
```

---

## Implementation Order

1. **Backend scaffolding** — Express app, folder structure, config loading
2. **Storage service** — JSON read/write abstraction
3. **Topics & subtopics routes** — static topics, OpenAI subtopic generation + caching
4. **Content route** — OpenAI one-pager generation + caching
5. **Questions route** — OpenAI MCQ generation
6. **Progress & session routes** — score tracking, cooldown logic
7. **Frontend scaffolding** — React app (Vite), routing setup
8. **TopicList + SubtopicList screens**
9. **ContentView screen**
10. **Quiz + QuizResults screens**
11. **Cooldown logic + CooldownScreen**
12. **ProficiencyBadge integration across screens**
13. **Polish** — loading states, error handling, responsive layout
