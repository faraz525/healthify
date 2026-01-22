# Changelog

All notable changes to Healthify will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Exercise linking across routines - linked exercises sync weights automatically
- Import Existing modal with "Linked" and "Copy Only" options
- Link icon indicator on linked exercises with unlink functionality
- Duplicate name validation for workouts and exercises (alerts user)
- Server-side duplicate workout name validation (prevents creating duplicates)
- Database indexes for sessions, workout sessions, exercise logs, and health issues
- Issue type caching for faster validation (1-minute TTL)
- Periodic session cleanup in hooks.server.ts

### Changed
- Improved email validation with stricter RFC-compliant regex
- Stricter weight parsing with format validation and range checking (0-2000)
- Expanded workout view now shows "Click to collapse" instead of duplicate name

### Security
- Exercise ownership verification in logExerciseSet() prevents cross-user data access
- LinkGroupId now scoped per-user to prevent cross-user sync collisions
- Constant-time password comparison using crypto.timingSafeEqual() prevents timing attacks
- All database operations wrapped in try/catch with proper error logging

### Fixed
- Trash button when creating a routine now works (shows confirmation dialog)
- X button on exercise now clears the name field instead of deleting (delete moved to trash icon)
- Toast memory leak - added timeout tracking and cleanup
- Modal close race condition - delayed state clearing prevents data loss
- N+1 query pattern in getUserWorkoutDayIds() - consolidated to 2 queries
- O(n²) streak calculations optimized to O(n) using Map lookups
- JSON parsing errors now caught with proper error handling
- Null checks added in linked exercise weight sync
- syncSessionToCalendar() now has proper error handling
- generateWorkoutSummary() defensive coding for malformed data
- Unused loop variable removed from Calendar.svelte
- Implicit type coercion fixed in day of week comparison
- Null display name handling in stats with proper fallbacks
- TypeScript errors in +page.svelte with explicit type annotations
- Accessibility improvements for calendar day cells (aria-labels)

## [0.4.0] - 2026-01-16

### Added
- Weight progression chart in exercise history view (SVG line chart)
- Touch-friendly reps stepper buttons (+/-) for target reps in exercise constructor
- Touch-friendly reps stepper buttons (+/-) for actual reps in workout tracker
- Exercise reorder functionality with up/down arrow buttons

### Fixed
- Calendar view not showing workouts (now combines routines and standalone workouts)
- Health Details section collapsing to 2px due to overflow-hidden CSS bug
- EntryModal now properly loads both workoutRoutines and standalone workouts

## [0.3.0] - 2026-01-15

### Added
- Per-set weight inputs for workout routines with +/- adjustment buttons
- Collapsible routines with accordion behavior
- Completed workout display on Today's screen

### Changed
- Auth pages now use minimal layout without navbar and FAB
- Improved history view with clear weight × reps display
- Better mobile layout for stats page with responsive grid
- Fixed login page spacing

### Fixed
- History not showing logged workouts (now uses SvelteKit deserialize)
- getExerciseHistory now filters by completed sessions only
- Calendar day click freeze caused by Svelte 5 $effect loop

## [0.2.0] - 2026-01-12

### Added
- Rate limiting for authentication (5 login attempts/min, 3 signups/hour)
- Comprehensive error handling for all database operations
- Database transactions for atomic multi-step operations

### Changed
- Migrated from scoped CSS to Tailwind CSS v4 with @theme design tokens
- Restructured routes: workouts at `/`, calendar at `/calendar`
- Mobile-first design with better spacing and touch targets
- Updated CLAUDE.md with SvelteKit patterns and anti-patterns

### Security
- Fixed critical cross-user data leakage in workout sessions
- All database queries now properly filter by userId
- Added transaction support to prevent race conditions

### Fixed
- Database schema mismatches in Drizzle ORM
- Safe JSON parsing with validation

## [0.1.0] - 2026-01-11

### Added
- Open registration signup page
- Multi-user authentication with cookie-based sessions
- Simplified workout structure with better mobile UX

### Changed
- Merged calendar entries, PR tracking, and stats features
- Improved overall UX based on PR reviews

## [0.0.1] - 2026-01-04

### Added
- Initial SvelteKit-only architecture with Drizzle ORM
- Server-side stats page with visual charts
- Workout session and PR tracking feature
- Calendar entries page with server-side rendering
- Workout session tracking with quick check-off UI

### Changed
- Migrated from FastAPI + SvelteKit to SvelteKit-only SSR architecture
- Replaced API calls with server-side data loading
