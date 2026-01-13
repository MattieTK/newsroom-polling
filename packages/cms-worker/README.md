# CMS Worker

Admin Cloudflare Worker that provides the poll management API for editors.

## Features

- **Poll CRUD**: Create, read, update, and delete polls
- **Lifecycle Management**: Publish and close polls
- **Analytics**: View vote counts and poll performance
- **Authentication**: Optional Cloudflare Access integration

## Architecture

This worker connects to the Embed Worker's Durable Objects to manage poll data. It does not have its own data storage - all poll data lives in the Embed Worker's Durable Objects.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/polls` | GET | List all polls |
| `/api/polls` | POST | Create new poll |
| `/api/polls/:pollId` | GET | Get poll details |
| `/api/polls/:pollId` | PUT | Update poll (draft only) |
| `/api/polls/:pollId` | DELETE | Delete poll |
| `/api/polls/:pollId/publish` | POST | Publish poll |
| `/api/polls/:pollId/close` | POST | Close poll |

## Development

```bash
# From repository root
npm run dev:cms

# Or from this directory
npm run dev
```

The worker runs on http://localhost:8788

## Configuration

### Environment Variables

Copy `.dev.vars.example` to `.dev.vars` for local development:

```bash
cp .dev.vars.example .dev.vars
```

### Cloudflare Access (Optional)

To protect the CMS with authentication:

1. Create an Access Application in [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. Configure identity providers (Google, GitHub, email OTP, etc.)
3. Copy the Application Audience (AUD) tag
4. Update `wrangler.jsonc`:

```jsonc
"vars": {
  "CF_ACCESS_AUD": "your-application-audience-tag",
  "CF_ACCESS_TEAM": "your-team-domain"
}
```

When not configured, authentication is bypassed (useful for local development).

## Deployment

```bash
# From repository root
npm run deploy:cms

# Or from this directory
wrangler deploy
```

**Important**: The Embed Worker must be deployed first, as this worker references its Durable Objects via the `script_name` binding.

## Cross-Worker Durable Object Binding

This worker accesses the Embed Worker's Durable Objects using:

```jsonc
"durable_objects": {
  "bindings": [{
    "name": "POLL_COUNTER",
    "class_name": "PollVoteCounter",
    "script_name": "newsroom-polls-embed"  // References the embed worker
  }]
}
```

## License

MIT License - see [LICENSE](../../LICENSE) for details.
