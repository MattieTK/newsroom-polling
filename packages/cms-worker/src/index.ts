import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  handleListPolls,
  handleCreatePoll,
  handleGetPoll,
  handleUpdatePoll,
  handleDeletePoll,
  handlePublishPoll,
  handleClosePoll,
  handleResetPoll,
} from './routes/polls.js';
import { handleGetAnalytics } from './routes/analytics.js';
import { requireAuth } from './middleware/auth.js';

// Environment bindings interface
// Note: D1 is no longer used - all data is stored in Durable Object SQLite
export interface Env {
  POLL_COUNTER: DurableObjectNamespace;
  ASSETS: Fetcher;         // Static assets binding (CMS UI)
  CF_ACCESS_AUD?: string;  // Cloudflare Access Application Audience Tag
  CF_ACCESS_TEAM?: string; // Cloudflare Access Team Domain (e.g., "mycompany")
  [key: string]: unknown;
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors({
  origin: '*', // In production, restrict to specific origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Apply auth middleware to all /api routes
app.use('/api/*', requireAuth);

// API Routes (protected by auth middleware above)
app.get('/api/polls', handleListPolls);
app.post('/api/polls', handleCreatePoll);
app.get('/api/polls/:pollId', handleGetPoll);
app.put('/api/polls/:pollId', handleUpdatePoll);
app.delete('/api/polls/:pollId', handleDeletePoll);
app.post('/api/polls/:pollId/publish', handlePublishPoll);
app.post('/api/polls/:pollId/close', handleClosePoll);
app.post('/api/polls/:pollId/reset', handleResetPoll);
app.get('/api/polls/:pollId/analytics', handleGetAnalytics);

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
