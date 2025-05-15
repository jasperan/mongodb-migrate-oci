# LLM Chat with RAG (Ollama) – Architecture & Implementation Plan

## Overview
This document describes the architecture, API, and file changes required to add an LLM-powered chat interface with Retrieval-Augmented Generation (RAG) using Ollama to the MERN Ecommerce app.

---

## Architecture Diagram

```
[User]
  |
[React Chat UI]  <-->  [Express API: /api/llm-chat]  <-->  [Vector Search (MongoDB/Vector DB)]
                                                        |
                                                    [Ollama LLM API]
```

---

## Backend (Express)

**New/Modified Files:**
- `server/routes/llmChat.js` (new)
- `server/controllers/llmChatController.js` (new)
- `server/app.js` (modified to add route)
- `.env` (add OLLAMA_API_URL, etc.)

**Endpoints:**
- `POST /api/llm-chat/message` – Accepts user message, performs RAG (vector search), calls Ollama, returns LLM response.
- `GET /api/llm-chat/history` – (Optional) Returns chat history for the session/user.

**Backend Flow:**
1. Receive user message.
2. Perform vector similarity search on relevant collection (e.g., products, reviews).
3. Compose context and send to Ollama LLM API.
4. Return LLM response to frontend.

---

## Frontend (React)

**New/Modified Files:**
- `client/src/components/LlmChat.js` (new)
- `client/src/pages/LlmChatPage.js` (new, optional)
- `client/src/api/llmChatApi.js` (new)
- `client/src/App.js` (add route/menu link)

**UI Features:**
- Chat interface for user input and LLM responses.
- Display of chat history.
- Loading/error states.

---

## API Contract

### POST /api/llm-chat/message
**Request:**
```json
{
  "message": "How do I find shoes similar to these?"
}
```
**Response:**
```json
{
  "response": "Here are some similar products...",
  "context": [ ... ]
}
```

---

## Summary of Changes in docs/
- `docs/ai-analytics/collections-and-schemas.md` (already present, describes collections)
- `docs/ai-analytics/llm-chat.md` (this file, describes LLM chat architecture and file changes)

---

## Next Steps
- Implement backend API and vector search logic.
- Implement frontend chat UI and connect to backend.
- Test end-to-end chat with RAG and Ollama integration. 