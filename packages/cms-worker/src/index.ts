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

// Serve CMS UI
app.get('/', (c) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsroom Polls - CMS</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
    }
    .placeholder {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Newsroom Polls - CMS</h1>
    <div class="placeholder">
      <p>CMS UI will be loaded here.</p>
      <p>Use the API endpoints to manage polls:</p>
      <ul style="text-align: left; display: inline-block;">
        <li>GET /api/polls - List all polls</li>
        <li>POST /api/polls - Create a poll</li>
        <li>GET /api/polls/:id - Get poll details</li>
        <li>PUT /api/polls/:id - Update poll (draft only)</li>
        <li>POST /api/polls/:id/publish - Publish poll</li>
        <li>POST /api/polls/:id/close - Close poll</li>
        <li>GET /api/polls/:id/analytics - View analytics</li>
      </ul>
    </div>
  </div>
</body>
</html>
  `.trim();

  return c.html(html);
});

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
