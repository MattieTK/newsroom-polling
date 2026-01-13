# Architecture Documentation

This document provides detailed architectural information about the Newsroom Polling System.

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Durable Objects Design](#durable-objects-design)
5. [Real-Time Updates](#real-time-updates)
6. [Vote Integrity](#vote-integrity)
7. [Scalability Considerations](#scalability-considerations)
8. [Security Model](#security-model)

## System Overview

The Newsroom Polling System is a distributed application running entirely on Cloudflare's edge infrastructure. It leverages multiple Cloudflare Workers, Durable Objects for stateful real-time operations, and D1 for persistent storage.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Publisher Website                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  <iframe src="embed-worker/embed/:pollId">                 │ │
│  │    ┌──────────────────────────────────────┐                │ │
│  │    │  React Embed UI                      │                │ │
│  │    │  - Poll Question Display             │                │ │
│  │    │  - Answer Options                    │                │ │
│  │    │  - Vote Submission                   │                │ │
│  │    │  - Real-time Results                 │                │ │
│  │    │  - SSE Connection                    │                │ │
│  │    └──────────────────────────────────────┘                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTPS
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Public Embed Worker (Cloudflare Worker)        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Routes:                                                    │ │
│  │  - GET  /embed/:pollId         → Serve iframe HTML         │ │
│  │  - GET  /api/poll/:pollId      → Get poll data             │ │
│  │  - POST /api/poll/:pollId/vote → Submit vote               │ │
│  │  - GET  /api/poll/:pollId/stream → SSE connection          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                    │                         │
         │                    │                         │
         ↓                    ↓                         ↓
┌──────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│ D1 Database  │    │  Durable Object     │    │ Durable Object   │
│              │    │  (Poll-123)         │    │ (Poll-456)       │
│ - polls      │    │                     │    │                  │
│ - answers    │    │ - In-memory counts  │    │ - In-mem counts  │
│ - votes      │    │ - SSE connections   │    │ - SSE conns      │
└──────────────┘    │ - Vote processing   │    │ - Vote process   │
         ↑          │ - Broadcast updates │    │ - Broadcast upd  │
         │          └─────────────────────┘    └──────────────────┘
         │                    ↑
         │                    │ Sync votes
         └────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    CMS Application (Editors)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  React CMS UI                                              │ │
│  │  - Poll Management Dashboard                              │ │
│  │  - Create/Edit Polls (Draft only)                         │ │
│  │  - Publish/Close Actions                                  │ │
│  │  - Real-time Analytics                                    │ │
│  │  - Historical Data & Trends                               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTPS
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CMS Worker (Cloudflare Worker)                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Routes:                                                    │ │
│  │  - GET    /                      → Serve CMS UI            │ │
│  │  - GET    /api/polls             → List polls              │ │
│  │  - POST   /api/polls             → Create poll             │ │
│  │  - GET    /api/polls/:id         → Get poll details        │ │
│  │  - PUT    /api/polls/:id         → Update (draft only)     │ │
│  │  - DELETE /api/polls/:id         → Soft delete             │ │
│  │  - POST   /api/polls/:id/publish → Publish poll            │ │
│  │  - POST   /api/polls/:id/close   → Close poll              │ │
│  │  - GET    /api/polls/:id/analytics → Analytics data        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓
                    ┌──────────────┐
                    │ D1 Database  │
                    │              │
                    │ - polls      │
                    │ - answers    │
                    │ - votes      │
                    └──────────────┘
```

## Component Architecture

### 1. Public Embed Worker

**Purpose**: Serve poll embeds to end users and handle voting operations.

**Responsibilities**:
- Serve iframe HTML with embedded React application
- Provide poll data via REST API
- Process vote submissions
- Proxy SSE connections to Durable Objects
- Validate vote integrity (check for duplicate votes)

**Key Characteristics**:
- Stateless (except for Durable Object bindings)
- High traffic volume (public-facing)
- Must be fast and lightweight
- CORS-enabled for iframe embedding

### 2. CMS Worker

**Purpose**: Provide administrative interface for poll management.

**Responsibilities**:
- Serve React CMS application
- CRUD operations for polls
- Poll lifecycle management (draft → published → closed)
- Analytics data aggregation
- Authentication entry point (for future implementation)

**Key Characteristics**:
- Lower traffic volume (internal tool)
- More complex business logic
- Enforces immutability rules
- Will require authentication

### 3. Durable Objects (PollVoteCounter)

**Purpose**: Maintain real-time state for individual polls.

**Architecture Pattern**: One Durable Object instance per poll.

**Responsibilities**:
- Maintain in-memory vote counts
- Handle Server-Sent Event connections
- Process incoming votes
- Broadcast updates to all connected clients
- Periodically sync data to D1
- Cache poll metadata for performance

**State Management**:
```typescript
interface PollVoteCounterState {
  pollId: string;
  voteCounts: Map<string, number>;  // answerId → vote count
  totalVotes: number;
  lastSyncedAt: number;
  pollMetadata?: {
    question: string;
    status: string;
    answers: Array<{ id: string; text: string }>;
  };
}
```

**Why One DO Per Poll**:
- Isolated state prevents cross-poll interference
- Natural sharding by poll ID
- Simple scaling model (popular polls get dedicated instances)
- Easy cleanup (DO can be deleted when poll archived)

### 4. D1 Database

**Purpose**: Persistent storage for all poll data.

**Characteristics**:
- SQLite-based relational database
- Strongly consistent within a region
- Supports complex queries for analytics
- Serves as source of truth

**Usage Patterns**:
- **Read-heavy for poll metadata**: Cached in Durable Objects
- **Write-heavy for votes**: Batched writes from Durable Objects
- **Analytics queries**: Complex aggregations for CMS dashboard

### 5. React Embed UI

**Purpose**: User interface for poll voting embedded in publisher sites.

**Architecture**:
- Single-page React application
- Bundled and served by Embed Worker
- Minimal dependencies for small bundle size
- Responsive design for various embed sizes

**Key Features**:
- localStorage-based vote tracking
- SSE integration for real-time updates
- Optimistic UI updates
- Error handling and fallbacks

### 6. React CMS UI

**Purpose**: Administrative interface for managing polls.

**Architecture**:
- Full React application with routing
- Rich UI components (charts, forms, tables)
- Could use TanStack Start for SSR capabilities

**Key Features**:
- Poll CRUD interface
- Real-time analytics dashboard
- Embed code generator
- Data export tools

## Data Flow

### Vote Submission Flow

```
1. User clicks answer in embed
   │
   ↓
2. React app checks localStorage
   │
   ├─→ Already voted? → Show "Already voted" message
   │
   └─→ Not voted? → Continue
       │
       ↓
3. POST /api/poll/:pollId/vote
   { answerId: "ans-1", voterFingerprint: "hash" }
   │
   ↓
4. Embed Worker validates request
   ├─→ Poll exists and published?
   ├─→ Poll not closed?
   └─→ Fingerprint not in D1 votes table?
       │
       ↓
5. Forward to Durable Object
   DO.fetch('/vote', { answerId, fingerprint })
   │
   ↓
6. Durable Object processes vote
   ├─→ Increment in-memory counter
   ├─→ Add to pending writes queue
   ├─→ Broadcast update via SSE
   └─→ Return updated counts
       │
       ↓
7. Embed Worker writes to D1
   INSERT INTO votes (poll_id, answer_id, voter_fingerprint, voted_at)
   │
   ↓
8. Return success to client
   { success: true, updatedCounts: {...} }
   │
   ↓
9. React app updates UI
   ├─→ Store vote in localStorage
   ├─→ Display results view
   └─→ Connect to SSE for updates
```

### Real-Time Update Flow

```
1. User votes and sees results
   │
   ↓
2. React app establishes SSE connection
   GET /api/poll/:pollId/stream
   │
   ↓
3. Embed Worker proxies to Durable Object
   │
   ↓
4. Durable Object handles SSE connection
   ├─→ Add client to connections set
   ├─→ Send initial vote counts
   └─→ Keep connection alive (30s keepalive)
       │
       ↓
5. When new votes arrive
   │
   ↓
6. Durable Object broadcasts to all clients
   for each connection:
     send event: vote-update
     data: { answerId, votes, percentage, totalVotes }
   │
   ↓
7. React app receives SSE event
   │
   ↓
8. Update UI with new counts
   (animated transitions)
```

### Poll Creation Flow

```
1. Editor fills out poll form in CMS
   │
   ↓
2. POST /api/polls
   {
     question: "What's your favorite feature?",
     answers: ["Feature A", "Feature B", "Feature C"]
   }
   │
   ↓
3. CMS Worker validates input
   ├─→ Question not empty?
   ├─→ 2-10 answers?
   └─→ Auth check (future)
       │
       ↓
4. Generate UUIDs
   pollId = crypto.randomUUID()
   answerIds = answers.map(() => crypto.randomUUID())
   │
   ↓
5. Write to D1 (transaction)
   BEGIN TRANSACTION;
   INSERT INTO polls (id, question, status, created_at, updated_at)
   INSERT INTO answers (id, poll_id, answer_text, display_order)
   COMMIT;
   │
   ↓
6. Return poll data to CMS
   { id, question, status: "draft", answers: [...] }
   │
   ↓
7. CMS UI shows poll in draft state
```

### Poll Publishing Flow

```
1. Editor clicks "Publish" in CMS
   │
   ↓
2. POST /api/polls/:pollId/publish
   │
   ↓
3. CMS Worker validates
   ├─→ Poll exists?
   ├─→ Status is 'draft'?
   └─→ Has valid question and answers?
       │
       ↓
4. Update D1
   UPDATE polls
   SET status = 'published',
       published_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
   WHERE id = :pollId AND status = 'draft'
   │
   ↓
5. Initialize Durable Object (lazy)
   const stub = env.POLL_COUNTER.get(
     env.POLL_COUNTER.idFromName(pollId)
   );
   await stub.fetch('/initialize', { pollId });
   │
   ↓
6. Durable Object loads poll data
   ├─→ Query D1 for poll metadata
   ├─→ Initialize vote counts to 0
   ├─→ Cache poll data in DO state
   └─→ Ready to accept votes
       │
       ↓
7. Return success to CMS
   │
   ↓
8. CMS UI shows embed code
   <iframe src=".../embed/:pollId">
```

## Durable Objects Design

### PollVoteCounter Class Structure

```typescript
export class PollVoteCounter implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private connections: Set<{ writer: WritableStreamDefaultWriter; id: string }>;
  private pollId: string | null;
  private voteCounts: Map<string, number>;
  private totalVotes: number;
  private pendingWrites: Vote[];
  private syncInterval: number;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.connections = new Set();
    this.pollId = null;
    this.voteCounts = new Map();
    this.totalVotes = 0;
    this.pendingWrites = [];
    this.syncInterval = 0;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/initialize':
        return this.handleInitialize(request);
      case '/vote':
        return this.handleVote(request);
      case '/stream':
        return this.handleSSE(request);
      case '/counts':
        return this.handleGetCounts(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  async handleInitialize(request: Request): Promise<Response> {
    const { pollId } = await request.json();

    // Load from storage or initialize
    let storedState = await this.state.storage.get('pollState');

    if (!storedState) {
      // First initialization - query D1
      const poll = await this.env.DB
        .prepare('SELECT * FROM polls WHERE id = ?')
        .bind(pollId)
        .first();

      const answers = await this.env.DB
        .prepare('SELECT id FROM answers WHERE poll_id = ?')
        .bind(pollId)
        .all();

      // Initialize counts
      this.pollId = pollId;
      this.voteCounts = new Map();
      for (const answer of answers.results) {
        this.voteCounts.set(answer.id, 0);
      }
      this.totalVotes = 0;

      // Persist to storage
      await this.state.storage.put('pollState', {
        pollId,
        voteCounts: Object.fromEntries(this.voteCounts),
        totalVotes: 0
      });
    } else {
      // Restore from storage
      this.pollId = storedState.pollId;
      this.voteCounts = new Map(Object.entries(storedState.voteCounts));
      this.totalVotes = storedState.totalVotes;
    }

    // Start periodic sync
    this.startPeriodicSync();

    return new Response('Initialized');
  }

  async handleVote(request: Request): Promise<Response> {
    const { answerId, voterFingerprint } = await request.json();

    // Increment count
    const currentCount = this.voteCounts.get(answerId) || 0;
    this.voteCounts.set(answerId, currentCount + 1);
    this.totalVotes += 1;

    // Add to pending writes
    this.pendingWrites.push({
      id: crypto.randomUUID(),
      pollId: this.pollId!,
      answerId,
      voterFingerprint,
      votedAt: Date.now()
    });

    // Persist counts to DO storage
    await this.state.storage.put('pollState', {
      pollId: this.pollId,
      voteCounts: Object.fromEntries(this.voteCounts),
      totalVotes: this.totalVotes
    });

    // Broadcast update
    await this.broadcastUpdate();

    // Sync if needed
    if (this.pendingWrites.length >= 10) {
      await this.syncToD1();
    }

    return Response.json({
      success: true,
      counts: this.getCountsObject()
    });
  }

  async handleSSE(request: Request): Promise<Response> {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const connectionId = crypto.randomUUID();

    // Add to connections
    this.connections.add({ writer, id: connectionId });

    // Send initial counts
    const initialData = JSON.stringify(this.getCountsObject());
    await writer.write(encoder.encode(`data: ${initialData}\n\n`));

    // Keep-alive interval
    const keepAliveInterval = setInterval(async () => {
      try {
        await writer.write(encoder.encode(': keepalive\n\n'));
      } catch (error) {
        clearInterval(keepAliveInterval);
        this.connections.delete({ writer, id: connectionId });
      }
    }, 30000);

    // Handle client disconnect
    request.signal.addEventListener('abort', () => {
      clearInterval(keepAliveInterval);
      this.connections.delete({ writer, id: connectionId });
      writer.close();
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  async broadcastUpdate(): Promise<void> {
    const encoder = new TextEncoder();
    const data = JSON.stringify(this.getCountsObject());
    const message = `event: vote-update\ndata: ${data}\n\n`;

    const deadConnections = new Set();

    for (const conn of this.connections) {
      try {
        await conn.writer.write(encoder.encode(message));
      } catch (error) {
        deadConnections.add(conn);
      }
    }

    // Clean up dead connections
    for (const conn of deadConnections) {
      this.connections.delete(conn);
    }
  }

  async syncToD1(): Promise<void> {
    if (this.pendingWrites.length === 0) return;

    // Batch insert votes
    const stmt = this.env.DB.prepare(
      'INSERT INTO votes (id, poll_id, answer_id, voter_fingerprint, voted_at) VALUES (?, ?, ?, ?, ?)'
    );

    const batch = this.pendingWrites.map(vote =>
      stmt.bind(vote.id, vote.pollId, vote.answerId, vote.voterFingerprint, vote.votedAt)
    );

    await this.env.DB.batch(batch);

    // Clear pending writes
    this.pendingWrites = [];
  }

  startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      this.syncToD1();
    }, 30000); // Sync every 30 seconds
  }

  getCountsObject() {
    const answers = Array.from(this.voteCounts.entries()).map(([answerId, votes]) => ({
      answerId,
      votes,
      percentage: this.totalVotes > 0 ? (votes / this.totalVotes) * 100 : 0
    }));

    return {
      totalVotes: this.totalVotes,
      answers
    };
  }
}
```

### Durable Object Lifecycle

1. **Creation**: Lazy initialization when poll is published
2. **Active State**: Handles votes and SSE connections
3. **Hibernation**: If inactive, Cloudflare may hibernate the object
4. **Restoration**: Restored from `state.storage` on next request
5. **Cleanup**: Can be explicitly deleted when poll is archived

### Concurrency Model

- **Single-threaded per instance**: No race conditions within a poll
- **Multiple instances**: Different polls run on different DOs
- **Atomic operations**: All vote increments are serialized per poll

## Real-Time Updates

### Server-Sent Events Architecture

**Why SSE over WebSockets?**
- Unidirectional communication (server → client only)
- Simpler protocol, easier debugging
- Automatic reconnection built into browser API
- Better for broadcast scenarios
- Lower overhead than WebSocket

**Connection Management**:
- Each client establishes one SSE connection per poll
- Connections only established after voting (not while browsing)
- 30-second keep-alive messages prevent timeout
- Automatic cleanup on client disconnect
- Graceful degradation if SSE fails

**Event Format**:
```
event: vote-update
data: {"totalVotes":150,"answers":[{"answerId":"ans-1","votes":68,"percentage":45.3},{"answerId":"ans-2","votes":82,"percentage":54.7}]}

: keepalive

event: vote-update
data: {"totalVotes":151,"answers":[{"answerId":"ans-1","votes":69,"percentage":45.7},{"answerId":"ans-2","votes":82,"percentage":54.3}]}
```

## Vote Integrity

### Multi-Layer Approach

1. **Client-Side (localStorage)**:
   - Fast initial check
   - Prevents accidental double-clicks
   - Not relied upon for security

2. **Server-Side (D1 Query)**:
   - Check `votes` table for existing fingerprint
   - Primary enforcement mechanism
   - Happens before Durable Object call

3. **Fingerprint Generation**:
```typescript
async function generateFingerprint(request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';

  const data = `${ip}:${userAgent}`;
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(data)
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Limitations & Trade-offs

- **Privacy-preserving**: No cookies, no login required
- **Not foolproof**: Incognito/VPN can circumvent
- **Good enough**: For editorial polls, not critical elections
- **Future enhancement**: Optional authentication for higher-stakes polls

## Scalability Considerations

### Horizontal Scaling

- **Workers**: Automatically scale to handle traffic
- **Durable Objects**: One per poll, scales with poll count
- **D1**: Single region, but cached heavily

### Performance Optimizations

1. **Caching Strategy**:
   - Poll metadata cached in Durable Objects
   - Embed HTML cached at edge
   - API responses with appropriate cache headers

2. **Batch Operations**:
   - Votes batched to D1 (10 votes or 30 seconds)
   - Reduces write pressure on database

3. **Lazy Loading**:
   - DOs initialized only when poll published
   - Analytics computed on-demand

4. **Indexed Queries**:
   - All D1 queries use indexed columns
   - Prevent full table scans

### Traffic Patterns

- **Embed Worker**: High read traffic (poll views)
- **Vote Endpoint**: Moderate write traffic (user votes)
- **SSE Connections**: Variable (only post-vote users)
- **CMS Worker**: Low traffic (internal users only)

## Security Model

### Current (Demo) Security

- **No authentication**: CMS is open (for demo purposes)
- **CORS**: Configured to allow embedding
- **Input validation**: All user input sanitized
- **SQL injection**: Prevented by prepared statements
- **XSS**: React escapes output by default

### Future Authentication

**Entry Point Design**:
```typescript
// In CMS Worker
async function authenticate(request: Request): Promise<User | null> {
  // Option 1: Cloudflare Access
  const accessJWT = request.headers.get('Cf-Access-Jwt-Assertion');
  if (accessJWT) {
    return validateCloudflareAccess(accessJWT);
  }

  // Option 2: Custom JWT
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return validateCustomJWT(token);
  }

  // Option 3: Session cookie
  const sessionCookie = request.headers.get('Cookie');
  if (sessionCookie) {
    return validateSession(sessionCookie);
  }

  return null;
}

// Middleware wrapper
function requireAuth(handler: Handler): Handler {
  return async (request, env, ctx) => {
    const user = await authenticate(request);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }
    return handler(request, env, ctx, user);
  };
}

// Usage
app.post('/api/polls', requireAuth(createPollHandler));
```

### Rate Limiting

**Future Implementation**:
- Use Cloudflare rate limiting rules
- Or implement in Worker using Durable Objects for state
- Prevent vote spam and API abuse

## Deployment Architecture

### Multi-Worker Setup

```
┌─────────────────────────────────────────────┐
│         Cloudflare Global Network           │
│                                             │
│  ┌─────────────────┐  ┌──────────────────┐ │
│  │  Embed Worker   │  │   CMS Worker     │ │
│  │  embed.domain   │  │  cms.domain      │ │
│  └─────────────────┘  └──────────────────┘ │
│         │                      │            │
│         └──────────┬───────────┘            │
│                    │                        │
│         ┌──────────▼──────────┐             │
│         │   Durable Objects   │             │
│         │   (PollVoteCounter) │             │
│         └──────────┬──────────┘             │
│                    │                        │
│         ┌──────────▼──────────┐             │
│         │    D1 Database      │             │
│         │   (Single Region)   │             │
│         └─────────────────────┘             │
└─────────────────────────────────────────────┘
```

### Configuration Management

- **Environment Variables**: Per worker in wrangler.toml
- **Secrets**: Managed via Wrangler CLI
- **Bindings**: D1 and DO bindings configured per worker

### Monitoring & Observability

**Cloudflare Analytics**:
- Request volume per worker
- Error rates
- P50/P95/P99 latency
- Durable Object metrics

**Custom Logging**:
- Vote events
- Poll lifecycle changes
- Error tracking

This architecture provides a robust, scalable foundation for the polling system while maintaining simplicity and leveraging Cloudflare's edge infrastructure effectively.
