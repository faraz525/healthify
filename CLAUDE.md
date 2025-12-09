# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Healthify is a personal health tracker for logging daily metrics (stress, workouts, health issues). It's a full-stack app with a SvelteKit frontend and FastAPI backend, using SQLite for storage.

## Commands

### Frontend (in `/frontend`)
```bash
npm install              # Install dependencies
npm run dev              # Dev server on port 5173
npm run build            # Production build
npm run check            # TypeScript/Svelte type checking
```

### Backend (in `/backend`)
```bash
uv sync                  # Install dependencies
uvicorn app.main:app --reload  # Dev server on port 8000
pytest                   # Run tests
```

### Docker
```bash
docker-compose up        # Run both services (backend:8000, frontend:3000)
```

## Architecture

**Frontend**: SvelteKit 2 + Svelte 5 (runes syntax) + TypeScript + Vite
- `src/lib/api.ts` - Centralized typed API client
- `src/lib/stores/` - Svelte stores for entries, issueTypes, ui state
- `src/lib/components/` - Reusable components (Calendar, Modal, etc.)
- `src/routes/` - Pages (main calendar view, stats page)

**Backend**: FastAPI + SQLAlchemy + SQLite (async via aiosqlite)
- `app/routes.py` - API endpoints under `/api` prefix
- `app/crud.py` - Database operations and business logic
- `app/models.py` - SQLAlchemy ORM models
- `app/schemas.py` - Pydantic request/response schemas

**Data Flow**: Route → CRUD function → ORM Model → SQLite

## Key Patterns

- **Svelte 5 runes**: Components use `$state`, `$props`, `$derived`, `$effect`
- **Store pattern**: `entriesByDate` is a derived store for O(1) date lookups
- **API prefix**: All backend endpoints are under `/api`
- **Async throughout**: Backend uses async SQLAlchemy with aiosqlite

## Database

SQLite database at `./data/healthify.db` (configurable via `DATABASE_URL` env var).

Tables: `daily_entries`, `health_issues`, `issue_types`

Default issue types are seeded on first startup.

## Environment Variables

- `DATABASE_URL` - SQLite path (default: `./data/healthify.db`)
- `VITE_API_URL` - Frontend API base URL (default: `http://localhost:8000/api`)
