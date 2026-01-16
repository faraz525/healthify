# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Healthify is a personal health tracker for logging daily metrics (stress, workouts, health issues). It's a SvelteKit SSR app with server-side rendering and Drizzle ORM, using SQLite for storage.

## Commands

```bash
cd frontend
npm install              # Install dependencies
npm run dev              # Dev server on port 5173
npm run build            # Production build
npm run check            # TypeScript/Svelte type checking
```

### Docker (Production)
```bash
DOCKER_BUILDKIT=0 docker compose build --no-cache  # Build (BuildKit breaks on Pi)
docker compose up -d                                # Run on port 3000
```

## Architecture

**Stack**: SvelteKit 2 + Svelte 5 + TypeScript + Tailwind CSS v4 + Drizzle ORM + better-sqlite3

```
frontend/src/
├── routes/              # Pages with +page.svelte and +page.server.ts
│   ├── +page.svelte     # Workouts (home page)
│   └── calendar/        # Calendar view
├── lib/
│   ├── server/          # Server-only code (DB, auth, business logic)
│   │   ├── db/          # Drizzle schema and connection
│   │   ├── auth.ts      # Session management
│   │   ├── entries.ts   # Daily entries CRUD
│   │   ├── workouts.ts  # Workout CRUD
│   │   └── sessions.ts  # Workout session tracking
│   └── components/      # Reusable Svelte components
├── app.css              # Tailwind imports + design tokens (@theme)
└── hooks.server.ts      # Auth middleware (route protection)
```

### Styling with Tailwind CSS v4
- Uses `@import "tailwindcss"` and `@theme` block in `app.css`
- Design tokens defined as CSS variables: `--color-primary`, `--color-bg`, etc.
- Use arbitrary value syntax for custom properties: `bg-(--color-primary)`, `text-(--color-text-muted)`
- Responsive prefixes: `sm:`, `max-sm:` for mobile-first design
- Color opacity: `bg-(--color-primary)/10` for transparent backgrounds

**Data Flow**: `+page.server.ts` → `lib/server/*.ts` → Drizzle ORM → SQLite

## Key Patterns

### SvelteKit Server Routes
- Use `+page.server.ts` for data loading and form actions
- Access user via `locals.user` (set by hooks.server.ts)
- Always pass `userId` to server functions for data isolation

```typescript
// +page.server.ts
export const load: PageServerLoad = async ({ locals }) => {
  const entries = getEntries(locals.user.id);
  return { entries };
};
```

### Database Operations
- **Always use transactions** for multi-step operations:
```typescript
const tx = sqlite.transaction(() => {
  const result = db.insert(table).values(data).returning().all();
  // more operations...
  return result[0].id;
});
tx();
```

- **Always wrap in try/catch** with logging:
```typescript
export function getData(userId: string) {
  try {
    return db.query.table.findMany({ where: eq(table.userId, userId) }).sync();
  } catch (err) {
    console.error('Failed to get data:', err);
    return [];
  }
}
```

- **Always filter by userId** - never trust client data for user identity

### Authentication
- Cookie-based sessions (30-day expiry)
- `hooks.server.ts` validates session and populates `locals.user`
- Protected routes redirect to `/login` if no session
- Passwords hashed with bcrypt (compatible with old backend)

### Rate Limiting
- Login: 5 attempts per IP per minute
- Signup: 3 attempts per IP per hour
- See `lib/server/rate-limit.ts`

## Anti-Patterns to Avoid

1. **Cross-user data leakage**: Always filter queries by userId
   ```typescript
   // BAD - returns all users' data
   db.query.logs.findMany().sync();

   // GOOD - filtered by user
   db.query.logs.findMany({ where: eq(logs.userId, userId) }).sync();
   ```

2. **Missing error handling**: Never let DB errors crash the app
   ```typescript
   // BAD - crashes on error
   return db.insert(table).values(data).returning().all()[0];

   // GOOD - graceful handling
   try {
     const result = db.insert(table).values(data).returning().all();
     return result[0] ?? null;
   } catch (err) {
     console.error('Insert failed:', err);
     return null;
   }
   ```

3. **Race conditions**: Use transactions for related operations
   ```typescript
   // BAD - can interleave with other requests
   db.insert(parent).run();
   db.insert(child).run();

   // GOOD - atomic
   sqlite.transaction(() => {
     db.insert(parent).run();
     db.insert(child).run();
   })();
   ```

4. **Schema/ORM mismatch**: Keep Drizzle schema in sync with actual DB tables

## Database

SQLite at `/app/data/healthify.db` (in container) or `/mnt/ssd/apps/healthify/data/healthify.db` (on host).

**Tables**: `users`, `sessions`, `daily_entries`, `health_issues`, `issue_types`, `workout_routines`, `workout_days`, `exercises`, `workout_sessions`, `exercise_logs`

Access via sqlite3:
```bash
sqlite3 /mnt/ssd/apps/healthify/data/healthify.db
```

## Versioning & Changelog

This project uses [Semantic Versioning](https://semver.org/) and maintains a [CHANGELOG.md](./CHANGELOG.md) following [Keep a Changelog](https://keepachangelog.com/) format.

### Creating a Release
```bash
# 1. Update CHANGELOG.md - move items from [Unreleased] to new version
# 2. Commit the changelog
git add CHANGELOG.md
git commit -m "Release vX.Y.Z"

# 3. Tag the release
git tag vX.Y.Z

# 4. Push everything
git push && git push --tags
```

### Version Guidelines
- **MAJOR** (1.0.0): Breaking changes or major milestones
- **MINOR** (0.X.0): New features, significant improvements
- **PATCH** (0.0.X): Bug fixes, minor tweaks

Current version: See latest tag with `git describe --tags --abbrev=0`

## Production (Raspberry Pi)

- **URL**: https://healthify.farazws.com
- **Local**: http://192.168.50.230:3000
- **Data**: `/mnt/ssd/apps/healthify/data/`

### Deployment
```bash
cd ~/Documents/healthify
git pull
docker compose down
DOCKER_BUILDKIT=0 docker compose build --no-cache
docker compose up -d
docker logs -f healthify-frontend
```

### Known Issues
- **BuildKit on Pi**: Always use `DOCKER_BUILDKIT=0` - BuildKit hangs npm
- **bcrypt**: Use `bcrypt` package (not bcryptjs) for passlib compatibility
