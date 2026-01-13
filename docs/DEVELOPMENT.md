# Development Guide

This guide covers local development setup, workflows, testing, and deployment for the Newsroom Polling System.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Project Structure](#project-structure)
4. [Local Development](#local-development)
5. [Building](#building)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js**: Version 18 or higher
- **npm** or **pnpm**: Latest version
- **Wrangler CLI**: Cloudflare Workers CLI tool
- **Git**: For version control

### Cloudflare Account Requirements

- Cloudflare account with Workers access
- D1 database access enabled
- Durable Objects access enabled

### Installation

```bash
# Install Node.js (using nvm)
nvm install 18
nvm use 18

# Install Wrangler globally
npm install -g wrangler

# Verify installation
wrangler --version

# Login to Cloudflare
wrangler login
```

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd newsroom-polling
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# Or using pnpm
pnpm install
```

### 3. Create D1 Database

```bash
# Create production database
wrangler d1 create newsroom-polls

# Create development database (optional)
wrangler d1 create newsroom-polls-dev
```

**Output**:
```
✅ Successfully created DB 'newsroom-polls'

[[d1_databases]]
binding = "DB"
database_name = "newsroom-polls"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Important**: Copy the `database_id` from the output.

### 4. Configure Wrangler Files

#### embed-worker/wrangler.toml

```toml
name = "newsroom-polls-embed"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "newsroom-polls"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID

[durable_objects]
bindings = [
  { name = "POLL_COUNTER", class_name = "PollVoteCounter" }
]

[[migrations]]
tag = "v1"
new_classes = ["PollVoteCounter"]

# Development overrides
[env.dev]
[[env.dev.d1_databases]]
binding = "DB"
database_name = "newsroom-polls-dev"
database_id = "YOUR_DEV_DATABASE_ID_HERE"  # Replace with dev DB ID
```

#### cms-worker/wrangler.toml

```toml
name = "newsroom-polls-cms"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "newsroom-polls"
database_id = "YOUR_DATABASE_ID_HERE"  # Same as embed worker

# Reference to Durable Objects in embed worker
[durable_objects]
bindings = [
  { name = "POLL_COUNTER", class_name = "PollVoteCounter", script_name = "newsroom-polls-embed" }
]

# Development overrides
[env.dev]
[[env.dev.d1_databases]]
binding = "DB"
database_name = "newsroom-polls-dev"
database_id = "YOUR_DEV_DATABASE_ID_HERE"

[env.dev.durable_objects]
bindings = [
  { name = "POLL_COUNTER", class_name = "PollVoteCounter", script_name = "newsroom-polls-embed" }
]
```

### 5. Apply Database Migrations

```bash
# Apply to production database
wrangler d1 execute newsroom-polls --file=./migrations/0001_initial_schema.sql

# Apply to development database
wrangler d1 execute newsroom-polls-dev --file=./migrations/0001_initial_schema.sql

# Verify schema
wrangler d1 execute newsroom-polls --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**Expected Output**:
```
┌─────────┐
│  name   │
├─────────┤
│ polls   │
│ answers │
│ votes   │
└─────────┘
```

### 6. Seed Development Data (Optional)

Create a seed file for local testing:

**migrations/seed-dev.sql**:
```sql
-- Insert sample poll
INSERT INTO polls (id, question, status, created_at, updated_at, published_at, closed_at)
VALUES ('poll-sample', 'What is your favorite color?', 'published', 1702000000000, 1702000000000, 1702000000000, NULL);

-- Insert answers
INSERT INTO answers (id, poll_id, answer_text, display_order)
VALUES
  ('ans-sample-1', 'poll-sample', 'Red', 0),
  ('ans-sample-2', 'poll-sample', 'Blue', 1),
  ('ans-sample-3', 'poll-sample', 'Green', 2);

-- Insert sample votes
INSERT INTO votes (id, poll_id, answer_id, voter_fingerprint, voted_at)
VALUES
  ('vote-1', 'poll-sample', 'ans-sample-1', 'fingerprint1', 1702001000000),
  ('vote-2', 'poll-sample', 'ans-sample-2', 'fingerprint2', 1702002000000),
  ('vote-3', 'poll-sample', 'ans-sample-1', 'fingerprint3', 1702003000000);
```

Apply seed:
```bash
wrangler d1 execute newsroom-polls-dev --file=./migrations/seed-dev.sql
```

## Project Structure

```
newsroom-polling/
├── packages/
│   ├── embed-worker/              # Public embed worker
│   │   ├── src/
│   │   │   ├── index.ts           # Worker entry point
│   │   │   ├── routes/
│   │   │   │   ├── embed.ts       # GET /embed/:pollId
│   │   │   │   ├── poll.ts        # GET /api/poll/:pollId
│   │   │   │   ├── vote.ts        # POST /api/poll/:pollId/vote
│   │   │   │   └── stream.ts      # GET /api/poll/:pollId/stream
│   │   │   ├── durable-objects/
│   │   │   │   └── PollVoteCounter.ts
│   │   │   └── lib/
│   │   │       ├── fingerprint.ts # Voter fingerprint generation
│   │   │       └── utils.ts       # Utility functions
│   │   ├── wrangler.toml
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── cms-worker/                # CMS worker
│   │   ├── src/
│   │   │   ├── index.ts           # Worker entry point
│   │   │   ├── routes/
│   │   │   │   ├── polls.ts       # CRUD endpoints
│   │   │   │   └── analytics.ts   # Analytics endpoints
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts        # Authentication (future)
│   │   │   └── lib/
│   │   │       ├── validation.ts  # Input validation
│   │   │       └── utils.ts       # Utility functions
│   │   ├── wrangler.toml
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── embed-ui/                  # React embed interface
│   │   ├── src/
│   │   │   ├── main.tsx           # Entry point
│   │   │   ├── App.tsx            # Main component
│   │   │   ├── components/
│   │   │   │   ├── PollQuestion.tsx
│   │   │   │   ├── PollAnswer.tsx
│   │   │   │   ├── VoteButton.tsx
│   │   │   │   └── ResultsView.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── usePoll.ts
│   │   │   │   ├── useVote.ts
│   │   │   │   └── useRealtimeVotes.ts
│   │   │   └── lib/
│   │   │       └── localStorage.ts
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── cms-ui/                    # React CMS interface
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── PollCreate.tsx
│   │   │   │   ├── PollEdit.tsx
│   │   │   │   └── PollAnalytics.tsx
│   │   │   ├── components/
│   │   │   │   ├── PollList.tsx
│   │   │   │   ├── PollForm.tsx
│   │   │   │   ├── VoteTrendChart.tsx
│   │   │   │   └── VoteDistribution.tsx
│   │   │   └── hooks/
│   │   │       ├── usePolls.ts
│   │   │       └── useAnalytics.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── shared/                    # Shared types and utilities
│       ├── src/
│       │   ├── types.ts           # TypeScript types
│       │   ├── schemas.ts         # Validation schemas
│       │   └── constants.ts       # Shared constants
│       ├── tsconfig.json
│       └── package.json
│
├── migrations/                    # D1 migrations
│   ├── 0001_initial_schema.sql
│   └── seed-dev.sql
│
├── docs/                          # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   └── DEVELOPMENT.md
│
├── package.json                   # Root package.json (workspace config)
├── pnpm-workspace.yaml            # Workspace configuration
├── tsconfig.json                  # Root TypeScript config
└── README.md                      # Main README
```

## Local Development

### Development Commands

```bash
# Start all workers in development mode (from root)
npm run dev

# Or start individually
npm run dev:embed    # Embed worker on http://localhost:8787
npm run dev:cms      # CMS worker on http://localhost:8788
npm run dev:embed-ui # Embed UI with hot reload
npm run dev:cms-ui   # CMS UI with hot reload
```

### Root package.json Scripts

```json
{
  "name": "newsroom-polling",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently \"npm:dev:*\"",
    "dev:embed": "npm run dev -w packages/embed-worker",
    "dev:cms": "npm run dev -w packages/cms-worker",
    "dev:embed-ui": "npm run dev -w packages/embed-ui",
    "dev:cms-ui": "npm run dev -w packages/cms-ui",
    "build": "npm run build -w packages/embed-worker && npm run build -w packages/cms-worker && npm run build -w packages/embed-ui && npm run build -w packages/cms-ui",
    "deploy": "npm run deploy:embed && npm run deploy:cms",
    "deploy:embed": "npm run deploy -w packages/embed-worker",
    "deploy:cms": "npm run deploy -w packages/cms-worker",
    "test": "npm test --workspaces",
    "lint": "npm run lint --workspaces",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "concurrently": "^8.0.0",
    "typescript": "^5.3.0"
  }
}
```

### Worker Development

**embed-worker/package.json**:
```json
{
  "name": "embed-worker",
  "scripts": {
    "dev": "wrangler dev --port 8787",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail",
    "test": "vitest"
  },
  "dependencies": {
    "hono": "^3.11.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20231218.0",
    "wrangler": "^3.20.0",
    "vitest": "^1.0.0"
  }
}
```

### UI Development

**embed-ui/package.json**:
```json
{
  "name": "embed-ui",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

### Using Wrangler Dev

Start the embed worker with local D1:

```bash
cd packages/embed-worker
wrangler dev --local --port 8787
```

**Features**:
- Hot reloading on code changes
- Local D1 database (Miniflare)
- Local Durable Objects
- Request logging
- Error stack traces

**Access**:
- Worker: http://localhost:8787
- DevTools: http://localhost:8787/__devtools

### Testing API Endpoints

**Using curl**:

```bash
# Get poll data
curl http://localhost:8787/api/poll/poll-sample

# Submit a vote
curl -X POST http://localhost:8787/api/poll/poll-sample/vote \
  -H "Content-Type: application/json" \
  -d '{"answerId":"ans-sample-1","voterFingerprint":"test-fp-123"}'

# SSE stream (in another terminal)
curl -N http://localhost:8787/api/poll/poll-sample/stream
```

**Using a REST client** (Postman, Insomnia, etc.):
- Import API specifications from `docs/API.md`
- Set base URL to `http://localhost:8787`

### Environment Variables

Create `.dev.vars` files for local development secrets:

**embed-worker/.dev.vars**:
```
# Local development environment variables
# DO NOT commit this file
ENVIRONMENT=development
```

**cms-worker/.dev.vars**:
```
# Local development environment variables
# Future: add auth secrets here
ENVIRONMENT=development
```

## Building

### Build All Packages

```bash
# From root directory
npm run build
```

This will:
1. Build TypeScript workers
2. Bundle React UIs with Vite
3. Output to `dist/` directories

### Build Individual Packages

```bash
# Build embed worker
npm run build -w packages/embed-worker

# Build CMS UI
npm run build -w packages/cms-ui
```

### Build Output

**Workers**:
- Bundled JavaScript in `dist/index.js`
- Sourcemaps in `dist/index.js.map`
- Type declarations in `dist/types/`

**React Apps**:
- Optimized bundles in `dist/assets/`
- HTML entry point in `dist/index.html`
- Minified and tree-shaken

### Serving Built React Apps from Workers

**embed-worker/src/index.ts** (serving embed UI):

```typescript
import embedHTML from '../../../embed-ui/dist/index.html';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/embed/')) {
      // Serve the built HTML with poll ID injected
      const pollId = url.pathname.split('/')[2];
      const html = embedHTML.replace('{{POLL_ID}}', pollId);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // ... other routes
  }
};
```

Alternatively, upload static assets to R2 or Workers KV and serve from there.

## Testing

### Unit Tests

**Using Vitest**:

```bash
# Run all tests
npm test

# Run tests for specific package
npm test -w packages/embed-worker

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

**Example test** (embed-worker/src/lib/fingerprint.test.ts):

```typescript
import { describe, it, expect } from 'vitest';
import { generateFingerprint } from './fingerprint';

describe('generateFingerprint', () => {
  it('generates consistent fingerprint for same input', async () => {
    const request1 = new Request('https://example.com', {
      headers: {
        'CF-Connecting-IP': '192.168.1.1',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const request2 = new Request('https://example.com', {
      headers: {
        'CF-Connecting-IP': '192.168.1.1',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const fp1 = await generateFingerprint(request1);
    const fp2 = await generateFingerprint(request2);

    expect(fp1).toBe(fp2);
  });

  it('generates different fingerprints for different IPs', async () => {
    const request1 = new Request('https://example.com', {
      headers: {
        'CF-Connecting-IP': '192.168.1.1',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const request2 = new Request('https://example.com', {
      headers: {
        'CF-Connecting-IP': '192.168.1.2',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const fp1 = await generateFingerprint(request1);
    const fp2 = await generateFingerprint(request2);

    expect(fp1).not.toBe(fp2);
  });
});
```

### Integration Tests

Test full request/response cycle with Miniflare:

```typescript
import { unstable_dev } from 'wrangler';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Embed Worker Integration', () => {
  let worker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('returns poll data', async () => {
    const resp = await worker.fetch('/api/poll/poll-sample');
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('question');
    expect(data).toHaveProperty('answers');
  });
});
```

### E2E Tests

Use Playwright for end-to-end testing:

```bash
npm install -D @playwright/test
npx playwright install
```

**tests/e2e/voting.spec.ts**:

```typescript
import { test, expect } from '@playwright/test';

test('user can vote in a poll', async ({ page }) => {
  await page.goto('http://localhost:8787/embed/poll-sample');

  // Select an answer
  await page.click('input[value="ans-sample-1"]');

  // Submit vote
  await page.click('button:has-text("Vote")');

  // Verify results are shown
  await expect(page.locator('text=Results')).toBeVisible();
  await expect(page.locator('text=Red')).toBeVisible();
});
```

## Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] TypeScript compilation successful
- [ ] Updated database migrations applied
- [ ] Environment variables configured
- [ ] Wrangler.toml files updated with correct database IDs
- [ ] Version bumped in package.json

### Deploy to Production

```bash
# Deploy all workers
npm run deploy

# Or deploy individually
npm run deploy:embed
npm run deploy:cms
```

**Behind the scenes**:
- Workers bundled and uploaded to Cloudflare
- Durable Objects migrated if needed
- D1 bindings connected
- Routes configured

### Deploy with Custom Environment

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

**wrangler.toml environment config**:

```toml
[env.staging]
name = "newsroom-polls-embed-staging"
[[env.staging.d1_databases]]
binding = "DB"
database_id = "staging-database-id"

[env.production]
name = "newsroom-polls-embed"
[[env.production.d1_databases]]
binding = "DB"
database_id = "production-database-id"
```

### Apply Migrations to Production

```bash
# Apply new migration
wrangler d1 execute newsroom-polls --file=./migrations/0002_new_feature.sql

# Verify migration
wrangler d1 execute newsroom-polls --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### Rollback Strategy

If deployment fails:

1. **Rollback Worker**: Deploy previous version
   ```bash
   wrangler rollback
   ```

2. **Rollback Database**: Use Cloudflare Dashboard
   - Navigate to D1 database
   - Select "Restore from backup"
   - Choose restore point

### Monitoring Deployment

```bash
# Tail logs from deployed worker
wrangler tail newsroom-polls-embed

# Filter for errors only
wrangler tail newsroom-polls-embed --status error

# View metrics in dashboard
open https://dash.cloudflare.com
```

## Troubleshooting

### Common Issues

#### 1. D1 Database Not Found

**Error**:
```
Error: D1 database binding 'DB' not found
```

**Solution**:
- Verify `database_id` in `wrangler.toml` matches created database
- Run `wrangler d1 list` to see available databases
- Ensure database is created: `wrangler d1 create newsroom-polls`

#### 2. Durable Object Not Found

**Error**:
```
Error: Durable Object namespace 'POLL_COUNTER' not found
```

**Solution**:
- Ensure `[durable_objects]` binding is in `wrangler.toml`
- Verify `PollVoteCounter` class is exported from worker
- Check migration tag is present: `[[migrations]]`
- For CMS worker, ensure `script_name` points to embed worker

#### 3. CORS Errors in Embed

**Error** (in browser console):
```
Access to fetch at 'http://localhost:8787/api/poll/...' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution**:
Add CORS headers to worker responses:

```typescript
const response = new Response(data, {
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
});
```

#### 4. SSE Connection Dropping

**Issue**: SSE connection closes after 30 seconds

**Solution**:
Ensure keep-alive messages are sent:

```typescript
const keepAlive = setInterval(() => {
  writer.write(encoder.encode(': keepalive\n\n'));
}, 30000);
```

#### 5. Fingerprint Collisions

**Issue**: Different users showing as same voter

**Solution**:
- Check that `CF-Connecting-IP` header is available (not in local dev)
- Consider adding more entropy (e.g., timestamp window)
- For local dev, manually set different fingerprints in test data

### Debugging Tips

**Enable verbose logging**:

```typescript
console.log('Vote received:', { pollId, answerId, fingerprint });
```

**Inspect Durable Object state**:

```typescript
// In Durable Object
async fetch(request: Request): Promise<Response> {
  if (url.pathname === '/debug') {
    const state = {
      pollId: this.pollId,
      voteCounts: Object.fromEntries(this.voteCounts),
      connections: this.connections.size
    };
    return Response.json(state);
  }
}
```

**Query D1 directly**:

```bash
wrangler d1 execute newsroom-polls --command="SELECT * FROM votes WHERE poll_id = 'poll-sample';"
```

### Getting Help

- Cloudflare Workers Docs: https://developers.cloudflare.com/workers
- D1 Documentation: https://developers.cloudflare.com/d1
- Durable Objects: https://developers.cloudflare.com/durable-objects
- Community Discord: https://discord.gg/cloudflaredev

---

This development guide should provide everything needed to get started with local development and deployment of the Newsroom Polling System.
