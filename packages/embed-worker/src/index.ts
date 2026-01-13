import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleEmbed } from './routes/embed.js';
import { handleGetPoll } from './routes/poll.js';
import { handleVote } from './routes/vote.js';
import { handleStream } from './routes/stream.js';
import { handleOptions } from './lib/utils.js';

// Export Durable Object
export { PollVoteCounter } from './durable-objects/PollVoteCounter.js';

// Environment bindings interface
// Note: D1 is no longer used - all data is stored in Durable Object SQLite
export interface Env {
  POLL_COUNTER: DurableObjectNamespace;
  [key: string]: unknown;
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all routes
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// Handle OPTIONS requests
app.options('*', (c) => handleOptions());

// Routes
app.get('/embed/:pollId', handleEmbed);
app.get('/api/poll/:pollId', handleGetPoll);
app.post('/api/poll/:pollId/vote', handleVote);
app.get('/api/poll/:pollId/stream', handleStream);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
