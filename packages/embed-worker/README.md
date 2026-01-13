# Embed Worker

Public-facing Cloudflare Worker that serves embeddable polls, handles voting, and streams real-time updates.

## Features

- **Poll Embedding**: Serves iframe-ready poll widgets
- **Voting API**: Accepts and validates votes with deduplication
- **Real-Time Updates**: SSE streaming for live vote counts
- **Durable Objects**: Each poll has its own SQLite-backed Durable Object for data storage

## Architecture

This worker uses Durable Objects with SQLite storage - no external database required. Each poll is self-contained in its own Durable Object instance, which stores:

- Poll metadata (question, status, timestamps)
- Answer options
- Vote counts and voter fingerprints

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/embed/:pollId` | GET | Serve poll widget HTML |
| `/api/poll/:pollId` | GET | Get poll data with vote counts |
| `/api/poll/:pollId/vote` | POST | Submit a vote |
| `/api/poll/:pollId/stream` | GET | SSE stream for live updates |

## Development

```bash
# From repository root
npm run dev:embed

# Or from this directory
npm run dev
```

The worker runs on http://localhost:8787

## Configuration

See `wrangler.jsonc` for configuration. Key settings:

- **Durable Objects**: `POLL_COUNTER` binding to `PollVoteCounter` class
- **SQLite Storage**: Enabled via `new_sqlite_classes` migration

## Deployment

```bash
# From repository root
npm run deploy:embed

# Or from this directory
wrangler deploy
```

**Important**: This worker must be deployed before the CMS worker, as the CMS worker references this worker's Durable Objects.

## Vote Deduplication

Votes are deduplicated using:

1. **Client-side**: localStorage tracking (prevents casual re-voting)
2. **Server-side**: SHA-256 fingerprint based on IP + User-Agent (no PII stored)

## License

MIT License - see [LICENSE](../../LICENSE) for details.
