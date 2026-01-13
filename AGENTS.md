# AI Coding Assistant Guidelines

This document provides context and guidelines for AI coding assistants working with this codebase.

## Project Overview

This is a **Newsroom Polling System** - a real-time polling application for news publishers built on Cloudflare Workers. The system enables embeddable polls with live vote counts and a content management system for editors.

## Current Implementation Status

**Backend: 95% complete | Frontend: 0% complete**

See [PLAN.md](./PLAN.md) for the detailed implementation roadmap.

| Component | Status | Notes |
|-----------|--------|-------|
| Poll CRUD API | Complete | `packages/cms-worker/src/routes/polls.ts` |
| Voting API | Complete | `packages/embed-worker/src/routes/vote.ts` |
| Durable Object | Complete | Real-time vote counting with batched D1 writes |
| SSE streaming | Complete | `packages/embed-worker/src/routes/stream.ts` |
| Embed UI | **Not built** | Placeholder HTML only - needs Vanilla JS widget |
| CMS UI | **Not built** | Needs React admin dashboard |
| Authentication | **Not built** | CMS endpoints unprotected |

### Known TypeScript Errors

The codebase has some TypeScript errors related to Hono types and Durable Object state. These are type definition issues, not runtime bugs.

## Tech Stack

- **Runtime**: Cloudflare Workers (edge computing)
- **Database**: Cloudflare D1 (SQLite-based serverless database)
- **Real-time**: Durable Objects + Server-Sent Events (SSE)
- **Framework**: Hono (lightweight web framework for Workers)
- **Validation**: Zod (schema validation)
- **Language**: TypeScript
- **Monorepo**: npm workspaces

## Project Structure

```
newsroom-polling/
├── packages/
│   ├── embed-worker/          # Public-facing Cloudflare Worker
│   │   ├── src/
│   │   │   ├── index.ts       # Entry point (Hono app)
│   │   │   ├── routes/        # API routes (embed, poll, vote, stream)
│   │   │   ├── durable-objects/
│   │   │   │   └── PollVoteCounter.ts  # Real-time vote aggregation
│   │   │   └── lib/           # Utilities (fingerprint, helpers)
│   │   └── wrangler.toml      # Worker configuration
│   │
│   ├── cms-worker/            # Admin Cloudflare Worker
│   │   ├── src/
│   ���   │   ├── index.ts       # Entry point (Hono app)
│   │   │   ├── routes/        # API routes (polls, analytics)
│   │   │   └── lib/           # Validation and utilities
│   │   └── wrangler.toml
│   │
│   └── shared/                # Shared code package
│       └── src/
│           ├── types.ts       # TypeScript interfaces
│           ├── schemas.ts     # Zod validation schemas
│           └── constants.ts   # Constants and error codes
│
├── migrations/                # D1 database migrations
│   ├── 0001_initial_schema.sql
│   └── seed-dev.sql
│
└── docs/                      # Documentation
    ├── ARCHITECTURE.md
    ├── API.md
    ├── DATABASE.md
    └── DEVELOPMENT.md
```

## Key Architectural Patterns

### 1. Durable Objects for Real-Time

Each poll has its own Durable Object instance (`PollVoteCounter`) that:
- Maintains in-memory vote counts
- Manages SSE connections for real-time updates
- Batches writes to D1 (every 10 votes or 30 seconds)
- Broadcasts vote updates to all connected clients

### 2. Poll Lifecycle

Polls follow a strict lifecycle: **Draft** -> **Published** -> **Closed**
- Draft: Editable, not visible to public
- Published: Immutable (questions/answers cannot change), accepts votes
- Closed: No longer accepts votes, results remain visible

### 3. Vote Integrity

Multi-layer deduplication:
- Client-side: localStorage tracking
- Server-side: SHA-256 fingerprint based on IP + User-Agent
- No PII is stored

## Important Conventions

### Code Style

- Use TypeScript strict mode
- Validate all inputs with Zod schemas from `@newsroom-polling/shared`
- Use Hono's built-in response helpers for consistent API responses
- Follow existing error handling patterns in `lib/utils.ts`

### API Responses

All API responses follow this structure:
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: { code: string, message: string } }
```

### Database Operations

- Use parameterized queries (D1 prepared statements)
- All database schema changes go in `migrations/`
- Use `snake_case` for database columns
- Use `camelCase` for TypeScript properties

### Environment Bindings

Workers expect these bindings in `wrangler.toml`:
- `DB`: D1 database binding
- `POLL_VOTE_COUNTER`: Durable Object namespace (embed-worker only)

## Common Tasks

### Adding a New API Endpoint

1. Define Zod schema in `packages/shared/src/schemas.ts`
2. Add types in `packages/shared/src/types.ts`
3. Create route handler in appropriate `routes/` directory
4. Register route in worker's `index.ts`

### Modifying Database Schema

1. Create new migration file: `migrations/XXXX_description.sql`
2. Run migration: `wrangler d1 execute newsroom-polls --file=./migrations/XXXX_description.sql`
3. Update types in `packages/shared/src/types.ts`

### Testing

- Tests use Vitest
- Run tests: `npm test`
- Test files should be co-located with source files

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start both workers (ports 8787 & 8788)
npm run dev:embed    # Start embed worker only
npm run dev:cms      # Start CMS worker only
npm run deploy       # Deploy to Cloudflare
npm test             # Run tests
```

## Gotchas & Warnings

1. **Durable Objects are stateful** - Be careful with global state; it persists across requests
2. **D1 has write limitations** - Batch writes when possible, avoid hot paths
3. **SSE requires keep-alives** - 30-second intervals prevent connection timeouts
4. **Published polls are immutable** - Never allow modifications to questions/answers after publishing
5. **Worker bundle size limits** - Keep dependencies minimal

## External Documentation

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [Hono Framework](https://hono.dev/)
- [Zod Documentation](https://zod.dev/)
