# Plan v2: PDF Upload + RAG-Powered Quiz Generation

## Overview

Add support for manually created subtopics backed by uploaded PDFs. These subtopics are visually distinct from AI-generated ones. Their one-pager is the PDF itself (download/view). Quiz generation uses a RAG pipeline: a Python microservice embeds the PDF text with `sentence-transformers` and stores it in FAISS; at quiz time, a semantic query retrieves the most relevant chunks, which are injected into the Gemini prompt.

---

## Architecture

```
┌─────────────┐        ┌──────────────────────┐        ┌─────────────────────┐
│   React     │ <───>  │  Express.js Backend  │ <───>  │  Python RAG Service │
│  Frontend   │  HTTP  │  (Node.js, port 3001)│  HTTP  │  (FastAPI, port 8000)│
└─────────────┘        └──────────────────────┘        └─────────────────────┘
                                  │                               │
                         backend/data/                    sentence-transformers
                           uploads/      (PDFs)           all-MiniLM-L6-v2
                           embeddings/   (FAISS)          faiss-cpu
                           subtopics/    (JSON)           pypdf
```

---

## Data Layout Changes

```
backend/data/
  uploads/                          ← NEW: raw PDF storage
    {subjectId}/
      {topicId}/
        {subtopicId}.pdf
  embeddings/                       ← NEW: FAISS indexes
    {subjectId}/
      {topicId}/
        {subtopicId}/
          index.faiss
          chunks.json               ← chunk texts for retrieval
  subtopics/                        ← EXISTING, extended
    {subjectId}/
      {topicId}.json                ← now includes manual entries
```

### Extended Subtopic Model

Previously:
```json
{ "id": "slug", "name": "Name", "description": "..." }
```

Now:
```json
{
  "id": "slug",
  "name": "Name",
  "description": "User-provided or AI-generated",
  "type": "ai",          // "ai" | "manual"
  "pdfPath": null,       // relative path for manual subtopics, null for ai
  "embeddingsReady": false  // true once RAG service finishes indexing
}
```

All existing AI-generated subtopics are implicitly `type: "ai"` (handled gracefully by defaulting missing `type` to `"ai"`).

---

## Phase 1: Python RAG Microservice

**New directory:** `rag-service/`

### Files

```
rag-service/
  main.py           ← FastAPI app with 3 endpoints
  pdf_processor.py  ← PDF text extraction + chunking
  indexer.py        ← FAISS index creation, querying, deletion
  requirements.txt
```

### requirements.txt

```
fastapi==0.111.0
uvicorn==0.29.0
sentence-transformers==2.7.0
faiss-cpu==1.8.0
pypdf==4.2.0
python-multipart==0.0.9
```

### Chunking Defaults

| Parameter     | Value       | Rationale                                                                 |
|---------------|-------------|---------------------------------------------------------------------------|
| Chunk size    | 500 chars   | ~125 tokens; well within MiniLM-L6-v2's 256-token max                   |
| Overlap       | 100 chars   | 20% overlap preserves sentence context across chunk boundaries           |
| Top-k retrieval | 5 chunks  | Enough context for 5 quiz questions without overloading the prompt       |
| Min chunk len | 50 chars    | Discard tiny chunks (headers, page numbers, whitespace fragments)        |

### API Endpoints

#### `POST /embed`
Triggered after a PDF is uploaded. Extracts text, chunks it, embeds each chunk, stores FAISS index.

**Request body (JSON):**
```json
{
  "pdf_path": "backend/data/uploads/economics/scarcity/my-subtopic.pdf",
  "subtopic_id": "my-subtopic",
  "subject_id": "economics",
  "topic_id": "scarcity"
}
```

**Response:**
```json
{ "status": "ok", "chunk_count": 42 }
```

#### `POST /query`
Called during quiz generation for manual subtopics.

**Request body (JSON):**
```json
{
  "query": "important facts, definitions and concepts from the document",
  "subtopic_id": "my-subtopic",
  "subject_id": "economics",
  "topic_id": "scarcity",
  "top_k": 5
}
```

**Response:**
```json
{
  "chunks": [
    "Scarcity refers to the fundamental economic problem...",
    "Opportunity cost is defined as the next best alternative...",
    ...
  ]
}
```

#### `DELETE /index/{subject_id}/{topic_id}/{subtopic_id}`
Cleans up FAISS index and chunk file when a subtopic is deleted.

**Response:** `{ "status": "deleted" }`

---

## Phase 2: Backend (Express.js) Changes

### New Dependency

```
multer   ← multipart/form-data file upload handling
```

### New / Modified Files

#### `backend/src/routes/subjects.js` — New Routes

**Upload + create manual subtopic:**
```
POST /api/subjects/:subjectId/topics/:topicId/subtopics
  - multipart/form-data: { name, description, pdf (file) }
  - Saves PDF to backend/data/uploads/{subjectId}/{topicId}/{slugifiedName}.pdf
  - Appends subtopic entry (type: "manual", embeddingsReady: false) to subtopics JSON
  - Calls RAG service POST /embed (async, fire-and-forget)
  - Sets embeddingsReady: true in JSON once RAG responds
  - Returns: the new subtopic object
```

**Delete a manual subtopic:**
```
DELETE /api/subjects/:subjectId/topics/:topicId/subtopics/:subtopicId
  - Removes entry from subtopics JSON
  - Deletes PDF file from disk
  - Calls RAG service DELETE /index/... to remove FAISS index
  - Returns: { status: "deleted" }
```

**Serve the PDF:**
```
GET /api/subjects/:subjectId/topics/:topicId/subtopics/:subtopicId/pdf
  - Pipes the stored PDF file as application/pdf response
```

#### `backend/src/services/ai.js` — Modified Quiz Generation

Current `generateQuestions(topicName, subtopicName, count, subjectName)` takes only text names.

New signature:
```
generateQuestions(topicName, subtopicName, count, subjectName, ragChunks = null)
```

When `ragChunks` is provided (manual subtopics), the prompt becomes:

```
Based on the following excerpts from the study material:

[chunk 1 text]
---
[chunk 2 text]
...

Generate {count} multiple-choice quiz questions that test understanding of 
the important facts, definitions, and concepts present in the material above.
```

When `ragChunks` is null (AI subtopics), existing prompt is used unchanged.

#### `backend/src/routes/subjects.js` — Modified Quiz Route

The existing quiz generation route needs to check subtopic type:
1. Load subtopic metadata to check `type`
2. If `type === "manual"` and `embeddingsReady === true`:
   - Call RAG service `POST /query` with the standard query string
   - Pass returned chunks to `generateQuestions`
3. If `type === "ai"` or embeddings not ready: existing flow unchanged

---

## Phase 3: Frontend Changes

### `SubtopicList.jsx` — Add Manual Subtopic Form

- Add an **"Add Subtopic"** button below the AI-generated list
- Clicking toggles a form with:
  - **Name** (text input, required)
  - **Description** (textarea, required)
  - **PDF File** (file input, `accept=".pdf"`, required)
  - Submit / Cancel buttons
- On submit: `POST` to new API with `FormData`
- On success: append new subtopic to local state (no full reload needed)
- Show upload progress indicator during submission

**Visual differentiation for manual subtopics:**
- AI subtopics: current styling (unchanged)
- Manual subtopics: distinct left-border color (e.g. blue/indigo) + small **"PDF"** badge tag
- If `embeddingsReady === false`: show a subtle "Indexing..." indicator (embeddings being processed)
- Show a **delete button** (trash icon) on manual subtopic cards only

### `SubtopicDetail.jsx` — PDF Content Button

Current: "View One-Pager" button → navigates to `ContentView`

For manual subtopics, replace with:
- **"View PDF"** button → opens `/api/.../pdf` in a new browser tab
- Keep "Take Quiz" button as-is (quiz works the same from frontend perspective)
- Show "Indexing in progress..." if `embeddingsReady === false`, and disable quiz button

### `api.js` — New API Methods

```javascript
createManualSubtopic(subjectId, topicId, formData)   // FormData with name, description, pdf
deleteSubtopic(subjectId, topicId, subtopicId)
getPdfUrl(subjectId, topicId, subtopicId)             // Returns the URL string, not a fetch
```

---

## Phase 4: Deletion Flow

When a manual subtopic is deleted:
1. Frontend: confirmation prompt ("Delete this subtopic and its PDF?")
2. `DELETE /api/subjects/:subjectId/topics/:topicId/subtopics/:subtopicId`
3. Backend:
   - Removes subtopic from `subtopics/{subjectId}/{topicId}.json`
   - Deletes `uploads/{subjectId}/{topicId}/{subtopicId}.pdf`
   - Calls RAG service `DELETE /index/...`
   - Removes any cached content at `content/{subjectId}/{topicId}_{subtopicId}.json` if it exists
   - Removes progress entry from `progress/user_progress.json` for this subtopic
4. Frontend: removes card from list

---

## Running the System

After implementation, two services must be running:

```bash
# Terminal 1 — existing Express backend
cd backend && npm run dev

# Terminal 2 — new Python RAG service
cd rag-service && uvicorn main:app --port 8000 --reload

# Terminal 3 — existing React frontend
cd frontend && npm run dev
```

A `start.sh` / `start.bat` convenience script can be added to launch all three.

---

## File Change Summary

| File | Change |
|------|--------|
| `rag-service/` | NEW directory — entire Python microservice |
| `backend/package.json` | Add `multer` dependency |
| `backend/src/routes/subjects.js` | Add upload, delete, pdf-serve routes; modify quiz route |
| `backend/src/services/ai.js` | Add `ragChunks` param to `generateQuestions` |
| `frontend/src/components/SubtopicList.jsx` | Add manual subtopic form + visual differentiation + delete button |
| `frontend/src/components/SubtopicDetail.jsx` | Conditional PDF button vs one-pager button |
| `frontend/src/services/api.js` | Add 3 new API methods |

No changes needed to: `SubjectList`, `TopicList`, `Quiz`, `QuizQuestion`, `QuizResults`, `ContentView`, `storage.js`, `proficiency.js`

---

## Open Decisions / Assumptions

- **Embeddings are generated asynchronously** after upload (fire-and-forget from the upload route). The quiz button is disabled until `embeddingsReady: true`. The frontend could poll for this status or use a page refresh.
- **Single PDF per subtopic** — enforced by naming the file `{subtopicId}.pdf` (overwrite if re-uploaded, though no re-upload UI is planned).
- **AI subtopics cannot be deleted** — deletion is only for manually created subtopics.
- **No re-indexing UI** — if a PDF needs to change, the subtopic must be deleted and re-created.
