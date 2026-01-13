# Newsroom Polling System

A real-time polling system for news publishers built on Cloudflare Workers, enabling embeddable polls with live vote counts and a content management system for editors.

## Overview

This system allows news publishers to create interactive polls that can be embedded into their articles. Readers can vote on polls and see results update in real-time via Server-Sent Events (SSE). Editors manage polls through a dedicated CMS interface.

## Key Features

- **Embeddable Polls**: Iframe-based polls that can be embedded into any webpage
- **Real-Time Updates**: Live vote counts using Server-Sent Events
- **Vote Integrity**: One vote per user per poll using localStorage + server-side fingerprinting
- **Poll Lifecycle**: Draft → Published → Closed workflow
- **CMS Dashboard**: React admin interface for managing polls
- **Cloudflare Access Auth**: Optional authentication for CMS (SSO, email OTP, etc.)
- **Immutable Published Polls**: Questions and answers cannot be modified once published

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   Embed     │─────→│  Embed Worker    │─────→│   Durable   │
│   (iframe)  │←─────│  (port 8787)     │←─────│   Objects   │
└─────────────┘ SSE  └──────────────────┘      └─────────────┘
                              │                        │
                              ↓                        ↓
                      ┌──────────────────────────────────┐
                      │         D1 Database              │
                      │  (polls, answers, votes)         │
                      └──────────────────────────────────┘
                              ↑
┌─────────────┐      ┌──────────────────┐
│   CMS UI    │─────→│   CMS Worker     │
│   (React)   │←─────│  (port 8788)     │
└─────────────┘      └──────────────────┘
```

## Technology Stack

- **Runtime**: Cloudflare Workers
- **Database**: Durable Object SQLite (no external database needed!)
- **Real-Time**: Durable Objects + Server-Sent Events
- **CMS Frontend**: React + Vite
- **Embed Widget**: Vanilla JS (minimal bundle size)
- **Validation**: Zod
- **Monorepo**: npm workspaces

### Why Durable Object SQLite?

Each poll is stored in its own Durable Object with built-in SQLite storage. This eliminates the need for D1 or any external database:

- **Self-contained**: Each poll's data (question, answers, votes) lives in one place
- **Instant queries**: No network hop to a separate database
- **Natural sharding**: Each poll is isolated, scales automatically
- **Simpler deployment**: No database setup required

## Project Structure

```
newsroom-polling/
├── packages/
│   ├── embed-worker/       # Public-facing worker (voting API, SSE, embed HTML)
│   ├── cms-worker/         # Admin worker (poll management API)
│   ├── cms-ui/             # React CMS dashboard
│   └── shared/             # Shared types and utilities
├── migrations/             # D1 database migrations
├── docs/                   # Additional documentation
├── PLAN.md                 # Implementation roadmap
└── README.md               # This file
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Cloudflare account with Workers and D1 access
- Wrangler CLI (`npm install -g wrangler`)

### 1. Clone and Install

```bash
git clone <repository-url>
cd newsroom-polling
npm install
```

### 2. Start Development Servers

```bash
# Start all services (embed worker, CMS worker, CMS UI)
npm run dev
```

This starts:
- **Embed Worker**: http://localhost:8787
- **CMS Worker**: http://localhost:8788  
- **CMS UI**: http://localhost:5173

No database setup required! Durable Objects automatically create SQLite tables on first use.

### 3. Open the CMS

Navigate to http://localhost:5173 to access the CMS dashboard where you can:
- Create new polls
- Add questions and answers
- Publish polls
- Get embed codes
- View results

---

## Development

### Available Scripts

```bash
npm run dev           # Start all services
npm run dev:embed     # Start embed worker only (port 8787)
npm run dev:cms       # Start CMS worker only (port 8788)
npm run dev:cms-ui    # Start CMS UI only (port 5173)
npm run build         # Build all packages
npm run deploy        # Deploy workers to Cloudflare
```

### Local Development Flow

1. Start the dev servers: `npm run dev`
2. Open CMS UI: http://localhost:5173
3. Create a poll and publish it
4. Click "Get Embed Code" to see the iframe snippet
5. The embed preview shows the live poll widget

---

## Deployment

### 1. Deploy Workers

```bash
# Deploy both workers
npm run deploy

# Or deploy individually
npm run deploy:embed
npm run deploy:cms
```

### 2. Deploy CMS UI (Optional)

The CMS UI can be deployed to Cloudflare Pages:

```bash
cd packages/cms-ui
npm run build
wrangler pages deploy dist --project-name=newsroom-polls-cms
```

Or serve it from the CMS worker by building and embedding the assets.

### 3. Configure Cloudflare Access (Optional)

To protect the CMS with authentication:

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Create an **Access Application**
3. Set the application domain to your CMS worker URL
4. Configure identity providers (Google, GitHub, email OTP, etc.)
5. Copy the **Application Audience (AUD)** tag
6. Update `packages/cms-worker/wrangler.jsonc`:

```jsonc
"vars": {
  "CF_ACCESS_AUD": "your-application-audience-tag",
  "CF_ACCESS_TEAM": "your-team-domain"  // e.g., "mycompany" from mycompany.cloudflareaccess.com
}
```

7. Redeploy: `npm run deploy:cms`

---

## Usage

### Embedding a Poll

Once a poll is published, embed it using the iframe code from the CMS:

```html
<iframe
  src="https://your-embed-worker.workers.dev/embed/{poll-id}"
  width="100%"
  height="400"
  frameborder="0"
  style="border: none; max-width: 100%;"
  title="Poll">
</iframe>
```

### Poll Lifecycle

| Status | Description |
|--------|-------------|
| **Draft** | Poll is being created. Question and answers can be edited. Not visible to public. |
| **Published** | Poll is live. Accepts votes. Question/answers are immutable. Real-time updates active. |
| **Closed** | Voting ended. Results remain visible. No new votes accepted. |

### API Endpoints

**Embed Worker (Public)**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/embed/:pollId` | GET | Serve poll widget HTML |
| `/api/poll/:pollId` | GET | Get poll data with vote counts |
| `/api/poll/:pollId/vote` | POST | Submit a vote |
| `/api/poll/:pollId/stream` | GET | SSE stream for live updates |

**CMS Worker (Protected)**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/polls` | GET | List all polls |
| `/api/polls` | POST | Create new poll |
| `/api/polls/:pollId` | GET | Get poll details |
| `/api/polls/:pollId` | PUT | Update poll (draft only) |
| `/api/polls/:pollId` | DELETE | Delete poll |
| `/api/polls/:pollId/publish` | POST | Publish poll |
| `/api/polls/:pollId/close` | POST | Close poll |

---

## Security

- **Vote Deduplication**: Combines localStorage (client-side) + SHA-256 fingerprint (server-side)
- **Fingerprinting**: Based on IP + User-Agent, no PII stored
- **CORS**: Configured for cross-origin embedding
- **Authentication**: Optional Cloudflare Access integration for CMS

---

## Documentation

- [AGENTS.md](./AGENTS.md) - Guidelines for AI coding assistants
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture details
- [docs/API.md](./docs/API.md) - API endpoint specifications
- [docs/DATABASE.md](./docs/DATABASE.md) - Database schema documentation

---

## License

MIT License - see [LICENSE](./LICENSE) for details.
