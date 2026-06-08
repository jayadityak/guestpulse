# GuestPulse — AI Hotel Recommender

Natural language hotel recommendations powered by Claude AI and real Google Places data.

Type *"downtown hotel for a Badgers game, clean, under $150"* → get ranked hotels with a personalised "why this fits you" explanation per result.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, SQLite |
| AI | Claude Sonnet (scoring) + Claude Haiku (streaming explanations) |
| Data | Google Places API (New) — 60 hotels, 5 reviews each |

## How it works

1. **Google Places API** discovers ~60 hotels across 7 city zones in ~5 seconds (no browser scraping)
2. **Claude Haiku** runs per-review sentiment analysis (categories, complaints, compliments)
3. **Claude Sonnet** scores each hotel across 6 dimensions (cleanliness, service, food, value, maintenance, overall)
4. **Streaming SSE** — hotel list appears in ~150ms, AI explanations stream in one by one

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # add your API keys
uvicorn main:app --port 8001
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # set BACKEND_URL
npm run dev
```

### Environment variables

**backend/.env**
```
ANTHROPIC_API_KEY=...
GOOGLE_PLACES_API_KEY=...
TARGET_CITY=Madison, Wisconsin
```

**frontend/.env.local**
```
BACKEND_URL=http://localhost:8001
```
