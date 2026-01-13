# Implementation Plan

## Project Overview

**Newsroom Polling System** - A real-time polling application for news publishers that enables embeddable polls with live vote counts and a content management system for editors.

### Core User Flow

1. Admin creates a poll via CMS with question + answers
2. Admin publishes the poll (makes it immutable)
3. Admin copies iframe embed code
4. Publisher embeds iframe in news article
5. Reader sees poll, clicks an answer to vote
6. localStorage key is set to prevent re-voting
7. Vote is recorded by Durable Object
8. Reader sees live-updating results from all voters

---

## Current Implementation Status

### What's Built (Backend - 95% Complete)

| Component | Status | Location |
|-----------|--------|----------|
| **Poll CRUD API** | Complete | `packages/cms-worker/src/routes/polls.ts` |
| **Poll lifecycle** (draft→published→closed) | Complete | Enforced in polls.ts |
| **Voting API** | Complete | `packages/embed-worker/src/routes/vote.ts` |
| **Durable Object vote counter** | Complete | `packages/embed-worker/src/durable-objects/PollVoteCounter.ts` |
| **SSE real-time streaming** | Complete | `packages/embed-worker/src/routes/stream.ts` |
| **Server-side duplicate prevention** | Complete | Fingerprint check in D1 |
| **Analytics API** | Complete | `packages/cms-worker/src/routes/analytics.ts` |
| **Database schema** | Complete | `migrations/0001_initial_schema.sql` |
| **Zod validation schemas** | Complete | `packages/shared/src/schemas.ts` |

### What's Missing (Frontend - 0% Complete)

| Component | Status | Notes |
|-----------|--------|-------|
| **Embed UI** (voting widget) | Not built | Placeholder HTML only |
| **CMS UI** (admin dashboard) | Not built | No management interface |
| **localStorage tracking** | Not built | Requires embed UI |
| **Authentication** | Not built | CMS endpoints unprotected |

---

## Implementation Phases

### Phase 1: Embed UI (Vanilla JS Voting Widget)
**Priority: Critical | Effort: 4-6 hours | Status: COMPLETE**

The interactive iframe widget that readers see and vote through.

#### Implementation Approach

Instead of a separate `packages/embed-ui/` package with build tooling, the Vanilla JS widget is inlined directly in `packages/embed-worker/src/routes/embed.ts`. This approach:
- Eliminates build complexity
- Keeps bundle minimal (~5KB)
- Simplifies deployment

#### Tasks

- [x] **1.1 Create embed UI package structure**
  - Inlined in embed.ts instead of separate package

- [x] **1.2 Poll display component**
  - Fetches poll data from `GET /api/poll/:pollId`
  - Renders question text
  - Renders answer buttons with click handlers
  - Loading state with spinner
  - Error states for poll not found, closed, etc.

- [x] **1.3 localStorage vote tracking**
  - Checks `localStorage.getItem('poll-voted-{pollId}')` on load
  - If voted: skips to results view, highlights user's answer
  - On vote: stores `localStorage.setItem('poll-voted-{pollId}', answerId)`
  - Gracefully handles localStorage unavailable (private browsing)

- [x] **1.4 Vote submission**
  - POSTs to `/api/poll/:pollId/vote` with `{ answerId }`
  - Success → transitions to results view
  - Duplicate vote (409) → treats as success
  - Poll closed → shows appropriate message

- [x] **1.5 Results display**
  - Shows vote counts and percentages per answer
  - Highlights user's selected answer with "(your vote)"
  - Visual percentage bars
  - Total vote count in footer

- [x] **1.6 SSE real-time updates**
  - Connects to `GET /api/poll/:pollId/stream`
  - Parses `vote-update` events
  - Updates results display in real-time
  - Auto-reconnects on connection drops (5s delay)
  - Shows green "Live" indicator when connected

- [x] **1.7 Styling**
  - Clean, minimal design
  - Responsive (works at various iframe widths)
  - Focus states for keyboard navigation
  - Self-contained CSS (no global leaks)

- [x] **1.8 Build integration**
  - Inlined directly in embed.ts HTML response
  - No separate build step required

#### Files Changed

- `packages/embed-worker/src/routes/embed.ts` - Complete rewrite with full Vanilla JS widget

#### Embed UI State Machine

```
┌─────────────┐
│   LOADING   │ ──fetch poll──► READY or ERROR
└─────────────┘

┌─────────────┐
│    READY    │ ──user clicks──► SUBMITTING
│  (can vote) │
└─────────────┘

┌─────────────┐
│ SUBMITTING  │ ──success──► VOTED
│             │ ──error──► READY (with error msg)
└─────────────┘

┌─────────────┐
│   VOTED     │ ──SSE updates──► VOTED (updated counts)
│  (results)  │
└─────────────┘

┌─────────────┐
│   CLOSED    │ (poll ended, show final results)
└─────────────┘

┌─────────────┐
│    ERROR    │ (poll not found, network error)
└─────────────┘
```

---

### Phase 2: Server-side Fingerprint Generation
**Priority: High | Effort: 30 minutes | Status: COMPLETE**

~~Currently the client must provide `voterFingerprint` - this should be auto-generated server-side from IP + User-Agent.~~

#### Tasks

- [x] **2.1 Update vote handler**
  - Import `generateFingerprint` from `../lib/fingerprint.js`
  - Call it with the request to generate fingerprint server-side
  - Remove `voterFingerprint` from request body validation

- [x] **2.2 Update Zod schema**
  - Removed `voterFingerprint` from `voteRequestSchema`

- [x] **2.3 Update types**
  - Updated `VoteRequest` interface in shared package

#### Files Changed

- `packages/embed-worker/src/routes/vote.ts` - Added fingerprint import, generate server-side
- `packages/shared/src/schemas.ts` - Removed voterFingerprint from schema
- `packages/shared/src/types.ts` - Removed voterFingerprint from VoteRequest interface

---

### Phase 3: CMS UI (React Admin Dashboard)
**Priority: High | Effort: 6-8 hours | Status: COMPLETE**

Admin interface for creating and managing polls.

#### Tasks

- [x] **3.1 Project setup**
  - Created `packages/cms-ui/` with Vite + React + TypeScript
  - React Router for client-side routing
  - API client for cms-worker endpoints
  - Vite proxy for `/api` → cms-worker (8788) and `/embed` → embed-worker (8787)

- [x] **3.2 Poll list page** (`/polls`)
  - Table/list of all polls
  - Status badges (draft/published/closed)
  - Filter by status
  - "Create Poll" button

- [x] **3.3 Create poll page** (`/polls/new`)
  - Form: Question input (required, 1-500 chars)
  - Form: Answer inputs (2-10 answers, 1-200 chars each)
  - Add/remove answer buttons
  - Validation feedback
  - Submit → creates draft poll → redirect to detail page

- [x] **3.4 Poll detail page** (`/polls/:pollId`)
  - Show question and answers with vote counts
  - Show status with action buttons:
    - Draft: "Edit" | "Publish" | "Delete"
    - Published: "Close" | "Get Embed Code"
    - Closed: "View Embed Code"
  - Vote result bars with percentages
  - Timeline showing created/published/closed dates

- [x] **3.5 Edit poll page** (`/polls/:pollId/edit`)
  - Same form as create
  - Pre-populated with existing data
  - Only accessible for draft polls
  - Update → redirect to detail page

- [x] **3.6 Embed code generator**
  - Generate iframe snippet with poll URL
  - Customizable width/height
  - Copy to clipboard button
  - Live iframe preview

- [ ] **3.7 Analytics view** - Deferred (vote counts shown on detail page)

#### Files Created

```
packages/cms-ui/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── api/
    │   └── client.ts
    ├── components/
    │   ├── PollForm.tsx
    │   └── EmbedCode.tsx
    └── pages/
        ├── PollList.tsx
        ├── PollCreate.tsx
        ├── PollDetail.tsx
        └── PollEdit.tsx
```

#### Page Structure

```
/                       → Redirect to /polls
/polls                  → Poll list
/polls/new              → Create poll form
/polls/:pollId          → Poll detail (view, actions, results)
/polls/:pollId/edit     → Edit poll form (draft only)
```

---

### Phase 4: Authentication (Cloudflare Access)
**Priority: Medium | Effort: 1-2 hours | Status: COMPLETE**

Protect CMS endpoints with Cloudflare Access.

#### Tasks

- [x] **4.1 Create auth middleware**
  - Full JWT validation with RS256 signature verification
  - JWKS key fetching and caching from Cloudflare Access
  - Validates expiration and audience claims
  - Extracts user email from JWT payload

- [x] **4.2 Apply middleware to CMS routes**
  - Added `app.use('/api/*', requireAuth)` to protect all API endpoints
  - Authentication bypassed when `CF_ACCESS_AUD` not configured (local dev)

- [x] **4.3 Configure environment variables**
  - Added `CF_ACCESS_AUD` and `CF_ACCESS_TEAM` vars to wrangler.toml
  - Documented setup steps in config comments

- [ ] **4.4 Add audit logging** (optional, deferred)
  - User email available via `c.get('userEmail')` for future audit logging

#### Files Created/Modified

- `packages/cms-worker/src/middleware/auth.ts` - Full Cloudflare Access JWT validation
- `packages/cms-worker/src/index.ts` - Added auth middleware to API routes
- `packages/cms-worker/wrangler.toml` - Added CF_ACCESS_AUD and CF_ACCESS_TEAM vars

#### Setup Instructions

1. Create an Access Application at https://one.dash.cloudflare.com/
2. Set the Application domain to your CMS worker URL
3. Configure identity providers (Google, GitHub, email OTP, etc.)
4. Copy the Application Audience (AUD) tag
5. Update `wrangler.toml`:
   ```toml
   [vars]
   CF_ACCESS_AUD = "your-application-audience-tag"
   CF_ACCESS_TEAM = "your-team-domain"
   ```
6. Deploy the worker

For local development, leave the vars empty or commented out - auth will be bypassed.

---

## API Reference (Existing)

### Embed Worker (Port 8787)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/embed/:pollId` | GET | Serve iframe HTML |
| `/api/poll/:pollId` | GET | Get poll data with vote counts |
| `/api/poll/:pollId/vote` | POST | Submit vote |
| `/api/poll/:pollId/stream` | GET | SSE for real-time updates |

### CMS Worker (Port 8788)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/polls` | GET | List polls (filter by status) |
| `/api/polls` | POST | Create new poll (draft) |
| `/api/polls/:pollId` | GET | Get poll details |
| `/api/polls/:pollId` | PUT | Update poll (draft only) |
| `/api/polls/:pollId` | DELETE | Soft delete poll |
| `/api/polls/:pollId/publish` | POST | Publish poll |
| `/api/polls/:pollId/close` | POST | Close poll |
| `/api/polls/:pollId/analytics` | GET | Get voting analytics |

---

## Technical Decisions

### Why Vanilla JS for Embed UI?

1. **Bundle size**: React adds ~40KB min+gzip, Vanilla JS can be <5KB
2. **Load time**: Critical for embedded content in news articles
3. **Simplicity**: State machine is simple enough without React
4. **No build dependencies**: Easier to maintain

### Why Cloudflare Access for Auth?

1. **Zero code for identity management**: Cloudflare handles login UI, session management
2. **Flexible providers**: Google, GitHub, SAML, email OTP
3. **Edge-native**: JWT validation at edge with low latency
4. **Already in stack**: No additional services needed

### Why SSE over WebSockets?

1. **Simpler for broadcast**: One-way server→client is all we need
2. **Auto-reconnect**: Built into EventSource API
3. **HTTP/2 multiplexing**: Multiple SSE connections share one TCP connection
4. **Cloudflare support**: Full support in Workers

---

## File Structure (After Implementation)

```
newsroom-polling/
├── packages/
│   ├── embed-worker/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── embed.ts          # Contains full Vanilla JS widget (inlined)
│   │   │   │   ├── poll.ts
│   │   │   │   ├── vote.ts           # Updated: server-side fingerprint generation
│   │   │   │   └── stream.ts
│   │   │   ├── durable-objects/
│   │   │   │   └── PollVoteCounter.ts
│   │   │   └── lib/
│   │   │       ├── fingerprint.ts
│   │   │       └── utils.ts
│   │   └── wrangler.toml
│   │
│   ├── cms-worker/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── polls.ts
│   │   │   │   └── analytics.ts
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts           # NEW: Cloudflare Access auth
│   │   │   └── lib/
│   │   │       ├── validation.ts
│   │   │       └── utils.ts
│   │   └── wrangler.toml
│   │
│   ├── cms-ui/                        # NEW: React admin dashboard
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── pages/
│   │   │   │   ├── PollList.tsx
│   │   │   │   ├── PollCreate.tsx
│   │   │   │   ├── PollDetail.tsx
│   │   │   │   ├── PollEdit.tsx
│   │   │   │   └── PollAnalytics.tsx
│   │   │   ├── components/
│   │   │   │   ├── PollForm.tsx
│   │   │   │   ├── StatusBadge.tsx
│   │   │   │   ├── EmbedCode.tsx
│   │   │   │   └── VoteChart.tsx
│   │   │   └── api/
│   │   │       └── client.ts
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── shared/
│       └── src/
│           ├── types.ts
│           ├── schemas.ts
│           └── constants.ts
│
├── migrations/
│   ├── 0001_initial_schema.sql
│   └── seed-dev.sql
│
├── docs/
├── PLAN.md                            # This file
├── AGENTS.md
└── README.md
```

---

## Estimated Timeline

| Phase | Effort | Status |
|-------|--------|--------|
| Phase 1: Embed UI | 4-6 hours | **COMPLETE** |
| Phase 2: Fingerprint fix | 30 mins | **COMPLETE** |
| Phase 3: CMS UI | 6-8 hours | **COMPLETE** |
| Phase 4: Auth | 1-2 hours | **COMPLETE** |
| Phase 5: Remove D1, use DO SQLite | 2 hours | **COMPLETE** |

**All phases complete!**

---

## Architecture Change: D1 → Durable Object SQLite

The application was refactored to eliminate D1 database entirely. Each poll now stores all its data in its own Durable Object using the built-in SQLite storage.

### Benefits

1. **Simpler deployment**: No database setup required
2. **Natural isolation**: Each poll is self-contained
3. **Instant queries**: No network hop to external database
4. **Automatic scaling**: Durable Objects scale horizontally

### How It Works

- **Poll Storage**: Each poll gets a DO named by its ID (e.g., `poll-abc123`)
- **Poll Index**: A special DO named `poll-index` tracks all poll IDs for listing
- **Vote Deduplication**: Fingerprints stored in each poll's SQLite database

### Files Changed

- `packages/embed-worker/src/durable-objects/PollVoteCounter.ts` - Full SQLite schema and CRUD
- `packages/embed-worker/src/routes/*` - Updated to use DO instead of D1
- `packages/cms-worker/src/routes/polls.ts` - Updated to use DO instead of D1
- `packages/*/wrangler.jsonc` - Removed D1 configuration

---

## Open Questions

1. **Embed styling**: Should the embed have a configurable theme/colors?
2. **Poll expiry**: Should polls auto-close after a date?
3. **Vote visibility**: Should users see results before voting, or only after?
4. **Rate limiting**: Should we add rate limiting to prevent vote manipulation attempts?
