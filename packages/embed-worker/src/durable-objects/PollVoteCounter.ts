import { DurableObject } from 'cloudflare:workers';

/**
 * PollVoteCounter Durable Object
 * 
 * Each poll gets its own Durable Object instance with SQLite storage.
 * This eliminates the need for D1 - all poll data lives in the DO.
 * 
 * Storage:
 * - poll: Single row with poll metadata (question, status, timestamps)
 * - answers: Poll answer options
 * - votes: Individual votes with fingerprints for deduplication
 */

interface Env {
  POLL_COUNTER: DurableObjectNamespace;
}

interface SSEConnection {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  id: string;
}

interface PollData {
  id: string;
  question: string;
  status: 'draft' | 'published' | 'closed';
  created_at: number;
  updated_at: number;
  published_at: number | null;
  closed_at: number | null;
  reset_count: number;
}

interface AnswerData {
  id: string;
  answer_text: string;
  display_order: number;
}

interface VoteCount {
  answer_id: string;
  answer_text: string;
  display_order: number;
  votes: number;
  percentage: number;
}

interface PollWithAnswers extends PollData {
  answers: VoteCount[];
  totalVotes: number;
}

export class PollVoteCounter extends DurableObject {
  private sql: SqlStorage;
  private connections: Set<SSEConnection>;
  private initialized: boolean = false;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = state.storage.sql;
    this.connections = new Set();
  }

  /**
   * Initialize SQLite schema on first access
   */
  private ensureSchema(): void {
    if (this.initialized) return;

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS poll (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER,
        closed_at INTEGER,
        reset_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS answers (
        id TEXT PRIMARY KEY,
        answer_text TEXT NOT NULL,
        display_order INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS votes (
        id TEXT PRIMARY KEY,
        answer_id TEXT NOT NULL,
        voter_fingerprint TEXT NOT NULL,
        voted_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_votes_fingerprint ON votes(voter_fingerprint);
      CREATE INDEX IF NOT EXISTS idx_votes_answer ON votes(answer_id);
    `);
    
    // Migration: add reset_count column if it doesn't exist
    try {
      this.sql.exec('ALTER TABLE poll ADD COLUMN reset_count INTEGER NOT NULL DEFAULT 0');
    } catch {
      // Column already exists
    }

    this.initialized = true;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.ensureSchema();

    switch (url.pathname) {
      // Poll operations
      case '/create':
        return this.handleCreate(request);
      case '/get':
        return this.handleGet();
      case '/update':
        return this.handleUpdate(request);
      case '/publish':
        return this.handlePublish();
      case '/close':
        return this.handleClose();
      case '/delete':
        return this.handleDelete();
      case '/reset':
        return this.handleReset();
      case '/vote':
        return this.handleVote(request);
      case '/check-voted':
        return this.handleCheckVoted(request);
      case '/stream':
        return this.handleSSE(request);
      // Poll index operations (for the index DO)
      case '/get-index':
        return this.handleGetIndex();
      case '/add-to-index':
        return this.handleAddToIndex(request);
      case '/remove-from-index':
        return this.handleRemoveFromIndex(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Create a new poll with question and answers
   */
  async handleCreate(request: Request): Promise<Response> {
    const { id, question, answers } = await request.json<{
      id: string;
      question: string;
      answers: string[];
    }>();

    // Check if poll already exists
    const existing = this.sql.exec('SELECT id FROM poll LIMIT 1').toArray();
    if (existing.length > 0) {
      return Response.json({ error: 'Poll already exists in this DO' }, { status: 400 });
    }

    const now = Date.now();

    // Insert poll
    this.sql.exec(
      'INSERT INTO poll (id, question, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      id, question, 'draft', now, now
    );

    // Insert answers
    for (let i = 0; i < answers.length; i++) {
      const answerId = crypto.randomUUID();
      this.sql.exec(
        'INSERT INTO answers (id, answer_text, display_order) VALUES (?, ?, ?)',
        answerId, answers[i], i
      );
    }

    return Response.json({ success: true, id });
  }

  /**
   * Get poll with answers and vote counts
   */
  handleGet(): Response {
    const pollRow = this.sql.exec('SELECT * FROM poll LIMIT 1').toArray()[0];
    
    if (!pollRow) {
      return Response.json({ error: 'Poll not found' }, { status: 404 });
    }

    const poll = pollRow as unknown as PollData;

    // Get answers with vote counts
    const answersWithCounts = this.sql.exec(`
      SELECT 
        a.id as answer_id,
        a.answer_text,
        a.display_order,
        COUNT(v.id) as votes
      FROM answers a
      LEFT JOIN votes v ON v.answer_id = a.id
      GROUP BY a.id
      ORDER BY a.display_order
    `).toArray();

    const totalVotes = answersWithCounts.reduce((sum, a: any) => sum + Number(a.votes), 0);

    const answers: VoteCount[] = answersWithCounts.map((a: any) => ({
      answer_id: a.answer_id,
      answer_text: a.answer_text,
      display_order: a.display_order,
      votes: Number(a.votes),
      percentage: totalVotes > 0 ? (Number(a.votes) / totalVotes) * 100 : 0,
    }));

    const result: PollWithAnswers = {
      ...poll,
      answers,
      totalVotes,
    };

    return Response.json(result);
  }

  /**
   * Update poll question and/or answers (draft only)
   */
  async handleUpdate(request: Request): Promise<Response> {
    const { question, answers } = await request.json<{
      question?: string;
      answers?: string[];
    }>();

    const pollRow = this.sql.exec('SELECT status FROM poll LIMIT 1').toArray()[0];
    
    if (!pollRow) {
      return Response.json({ error: 'Poll not found' }, { status: 404 });
    }

    if ((pollRow as any).status !== 'draft') {
      return Response.json({ error: 'Can only update draft polls' }, { status: 400 });
    }

    const now = Date.now();

    if (question !== undefined) {
      this.sql.exec('UPDATE poll SET question = ?, updated_at = ?', question, now);
    }

    if (answers !== undefined) {
      // Delete existing answers and add new ones
      this.sql.exec('DELETE FROM answers');
      for (let i = 0; i < answers.length; i++) {
        const answerId = crypto.randomUUID();
        this.sql.exec(
          'INSERT INTO answers (id, answer_text, display_order) VALUES (?, ?, ?)',
          answerId, answers[i], i
        );
      }
      this.sql.exec('UPDATE poll SET updated_at = ?', now);
    }

    return this.handleGet();
  }

  /**
   * Publish poll (makes it immutable and opens for voting)
   */
  handlePublish(): Response {
    const pollRow = this.sql.exec('SELECT status FROM poll LIMIT 1').toArray()[0];
    
    if (!pollRow) {
      return Response.json({ error: 'Poll not found' }, { status: 404 });
    }

    if ((pollRow as any).status !== 'draft') {
      return Response.json({ error: 'Poll is not in draft status' }, { status: 400 });
    }

    const now = Date.now();
    this.sql.exec(
      'UPDATE poll SET status = ?, published_at = ?, updated_at = ?',
      'published', now, now
    );

    return this.handleGet();
  }

  /**
   * Close poll (stops accepting votes)
   */
  handleClose(): Response {
    const pollRow = this.sql.exec('SELECT status FROM poll LIMIT 1').toArray()[0];
    
    if (!pollRow) {
      return Response.json({ error: 'Poll not found' }, { status: 404 });
    }

    if ((pollRow as any).status !== 'published') {
      return Response.json({ error: 'Poll is not published' }, { status: 400 });
    }

    const now = Date.now();
    this.sql.exec(
      'UPDATE poll SET status = ?, closed_at = ?, updated_at = ?',
      'closed', now, now
    );

    return this.handleGet();
  }

  /**
   * Delete poll (soft delete by setting status)
   */
  handleDelete(): Response {
    const pollRow = this.sql.exec('SELECT id FROM poll LIMIT 1').toArray()[0];
    
    if (!pollRow) {
      return Response.json({ error: 'Poll not found' }, { status: 404 });
    }

    // For now, just delete everything in this DO
    this.sql.exec('DELETE FROM votes');
    this.sql.exec('DELETE FROM answers');
    this.sql.exec('DELETE FROM poll');

    return Response.json({ success: true, deleted: true });
  }

  /**
   * Reset poll - removes all votes but keeps poll and answers
   * Increments reset_count so clients know to clear their localStorage
   */
  handleReset(): Response {
    const pollRow = this.sql.exec('SELECT id FROM poll LIMIT 1').toArray()[0];
    
    if (!pollRow) {
      return Response.json({ error: 'Poll not found' }, { status: 404 });
    }

    // Delete all votes and increment reset_count
    this.sql.exec('DELETE FROM votes');
    this.sql.exec('UPDATE poll SET reset_count = reset_count + 1, updated_at = ?', Date.now());

    return this.handleGet();
  }

  /**
   * Submit a vote
   */
  async handleVote(request: Request): Promise<Response> {
    const { answerId, voterFingerprint } = await request.json<{
      answerId: string;
      voterFingerprint: string;
    }>();

    // Check poll status
    const pollRow = this.sql.exec('SELECT status FROM poll LIMIT 1').toArray()[0];
    
    if (!pollRow) {
      return Response.json({ error: 'Poll not found' }, { status: 404 });
    }

    const status = (pollRow as any).status;
    if (status === 'draft') {
      return Response.json({ error: 'Poll not published' }, { status: 400 });
    }
    if (status === 'closed') {
      return Response.json({ error: 'Poll is closed' }, { status: 400 });
    }

    // Check if answer exists
    const answerRow = this.sql.exec(
      'SELECT id FROM answers WHERE id = ?', answerId
    ).toArray()[0];

    if (!answerRow) {
      return Response.json({ error: 'Invalid answer' }, { status: 400 });
    }

    // Check for duplicate vote
    const existingVote = this.sql.exec(
      'SELECT id FROM votes WHERE voter_fingerprint = ?', voterFingerprint
    ).toArray()[0];

    if (existingVote) {
      return Response.json({ error: 'Already voted' }, { status: 409 });
    }

    // Record vote
    const voteId = crypto.randomUUID();
    this.sql.exec(
      'INSERT INTO votes (id, answer_id, voter_fingerprint, voted_at) VALUES (?, ?, ?, ?)',
      voteId, answerId, voterFingerprint, Date.now()
    );

    // Broadcast to SSE clients
    await this.broadcastUpdate();

    // Return updated counts
    return this.getVoteCounts();
  }

  /**
   * Check if a fingerprint has already voted
   */
  async handleCheckVoted(request: Request): Promise<Response> {
    const { voterFingerprint } = await request.json<{ voterFingerprint: string }>();

    const existingVote = this.sql.exec(
      'SELECT answer_id FROM votes WHERE voter_fingerprint = ?', voterFingerprint
    ).toArray()[0];

    return Response.json({
      hasVoted: !!existingVote,
      answerId: existingVote ? (existingVote as any).answer_id : null,
    });
  }

  /**
   * Get current vote counts
   */
  getVoteCounts(): Response {
    const answersWithCounts = this.sql.exec(`
      SELECT 
        a.id as answerId,
        COUNT(v.id) as votes
      FROM answers a
      LEFT JOIN votes v ON v.answer_id = a.id
      GROUP BY a.id
      ORDER BY a.display_order
    `).toArray();

    const totalVotes = answersWithCounts.reduce((sum, a: any) => sum + Number(a.votes), 0);

    const answers = answersWithCounts.map((a: any) => ({
      answerId: a.answerId,
      votes: Number(a.votes),
      percentage: totalVotes > 0 ? (Number(a.votes) / totalVotes) * 100 : 0,
    }));

    return Response.json({ totalVotes, answers });
  }

  /**
   * SSE stream for real-time vote updates
   */
  async handleSSE(request: Request): Promise<Response> {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const connectionId = crypto.randomUUID();

    const connection: SSEConnection = { writer, id: connectionId };
    this.connections.add(connection);

    // Send initial counts
    const counts = this.getVoteCountsData();
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(counts)}\n\n`));
    } catch (error) {
      this.connections.delete(connection);
    }

    // Keep-alive interval
    const keepAliveInterval = setInterval(async () => {
      try {
        await writer.write(encoder.encode(': keepalive\n\n'));
      } catch (error) {
        clearInterval(keepAliveInterval);
        this.connections.delete(connection);
      }
    }, 30000);

    // Handle client disconnect
    request.signal.addEventListener('abort', () => {
      clearInterval(keepAliveInterval);
      this.connections.delete(connection);
      writer.close().catch(() => {});
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  /**
   * Broadcast vote update to all SSE clients
   */
  async broadcastUpdate(): Promise<void> {
    const encoder = new TextEncoder();
    const counts = this.getVoteCountsData();
    const message = `event: vote-update\ndata: ${JSON.stringify(counts)}\n\n`;

    const deadConnections = new Set<SSEConnection>();

    for (const conn of this.connections) {
      try {
        await conn.writer.write(encoder.encode(message));
      } catch (error) {
        deadConnections.add(conn);
      }
    }

    for (const conn of deadConnections) {
      this.connections.delete(conn);
    }
  }

  /**
   * Get vote counts as plain object (for SSE)
   */
  private getVoteCountsData(): { totalVotes: number; answers: any[] } {
    const answersWithCounts = this.sql.exec(`
      SELECT 
        a.id as answerId,
        COUNT(v.id) as votes
      FROM answers a
      LEFT JOIN votes v ON v.answer_id = a.id
      GROUP BY a.id
      ORDER BY a.display_order
    `).toArray();

    const totalVotes = answersWithCounts.reduce((sum, a: any) => sum + Number(a.votes), 0);

    const answers = answersWithCounts.map((a: any) => ({
      answerId: a.answerId,
      votes: Number(a.votes),
      percentage: totalVotes > 0 ? (Number(a.votes) / totalVotes) * 100 : 0,
    }));

    return { totalVotes, answers };
  }

  // ==========================================
  // Poll Index Operations
  // These are used by a dedicated "poll-index" DO instance
  // to track all poll IDs for listing
  // ==========================================

  private ensureIndexSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS poll_index (
        poll_id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      );
    `);
  }

  /**
   * Get all poll IDs from the index
   */
  handleGetIndex(): Response {
    this.ensureIndexSchema();
    const rows = this.sql.exec('SELECT poll_id FROM poll_index ORDER BY created_at DESC').toArray();
    const pollIds = rows.map((r: any) => r.poll_id);
    return Response.json({ pollIds });
  }

  /**
   * Add a poll ID to the index
   */
  async handleAddToIndex(request: Request): Promise<Response> {
    this.ensureIndexSchema();
    const { pollId } = await request.json<{ pollId: string }>();
    
    // Use INSERT OR IGNORE to handle duplicates
    this.sql.exec(
      'INSERT OR IGNORE INTO poll_index (poll_id, created_at) VALUES (?, ?)',
      pollId, Date.now()
    );
    
    return Response.json({ success: true });
  }

  /**
   * Remove a poll ID from the index
   */
  async handleRemoveFromIndex(request: Request): Promise<Response> {
    this.ensureIndexSchema();
    const { pollId } = await request.json<{ pollId: string }>();
    
    this.sql.exec('DELETE FROM poll_index WHERE poll_id = ?', pollId);
    
    return Response.json({ success: true });
  }
}
