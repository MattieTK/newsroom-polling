# Database Documentation

This document provides detailed information about the database schema, migrations, and data management for the Newsroom Polling System.

## Table of Contents

1. [Overview](#overview)
2. [Schema Design](#schema-design)
3. [Tables](#tables)
4. [Indexes](#indexes)
5. [Migrations](#migrations)
6. [Queries](#queries)
7. [Data Lifecycle](#data-lifecycle)

## Overview

The Newsroom Polling System uses **Cloudflare D1**, a SQLite-based serverless database that runs on Cloudflare's edge network.

### Key Characteristics

- **Database Type**: SQLite (via Cloudflare D1)
- **Consistency Model**: Strongly consistent within a region
- **Primary Region**: Configured per database
- **Backup**: Automatic via Cloudflare
- **Migrations**: SQL-based, version controlled

### Design Principles

1. **Normalization**: Tables are normalized to 3NF to reduce redundancy
2. **Referential Integrity**: Foreign key constraints enforce relationships
3. **Indexing**: Strategic indexes for common query patterns
4. **Immutability**: Published polls cannot be modified (enforced at application layer)
5. **Soft Deletion**: Data is preserved for historical records

## Schema Design

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                           POLLS                              │
├─────────────────────────────────────────────────────────────┤
│ • id (PK)                 TEXT                               │
│ • question                TEXT NOT NULL                      │
│ • status                  TEXT NOT NULL                      │
│ • created_at              INTEGER NOT NULL                   │
│ • updated_at              INTEGER NOT NULL                   │
│ • published_at            INTEGER                            │
│ • closed_at               INTEGER                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                          ANSWERS                             │
├─────────────────────────────────────────────────────────────┤
│ • id (PK)                 TEXT                               │
│ • poll_id (FK)            TEXT NOT NULL                      │
│ • answer_text             TEXT NOT NULL                      │
│ • display_order           INTEGER NOT NULL                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                           VOTES                              │
├─────────────────────────────────────────────────────────────┤
│ • id (PK)                 TEXT                               │
│ • poll_id (FK)            TEXT NOT NULL                      │
│ • answer_id (FK)          TEXT NOT NULL                      │
│ • voter_fingerprint       TEXT NOT NULL                      │
│ • voted_at                INTEGER NOT NULL                   │
└─────────────────────────────────────────────────────────────┘
```

## Tables

### polls

Stores poll metadata and lifecycle information.

**Schema**:
```sql
CREATE TABLE polls (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER,
  closed_at INTEGER
);
```

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 identifier |
| `question` | TEXT | NOT NULL | Poll question (1-500 chars) |
| `status` | TEXT | NOT NULL, CHECK | Poll lifecycle state |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (milliseconds) |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (milliseconds) |
| `published_at` | INTEGER | NULL | Unix timestamp when published |
| `closed_at` | INTEGER | NULL | Unix timestamp when closed |

**Status Values**:
- `draft`: Poll being created/edited
- `published`: Live poll accepting votes
- `closed`: Poll ended, no longer accepting votes

**Example Rows**:
```sql
INSERT INTO polls (id, question, status, created_at, updated_at, published_at, closed_at)
VALUES
  ('poll-123', 'What''s your favorite programming language?', 'published', 1702000000000, 1702000000000, 1702003600000, NULL),
  ('poll-456', 'Which framework do you prefer?', 'closed', 1702010000000, 1702020000000, 1702013600000, 1702020000000),
  ('poll-789', 'Best database system?', 'draft', 1702020000000, 1702020000000, NULL, NULL);
```

---

### answers

Stores answer options for each poll.

**Schema**:
```sql
CREATE TABLE answers (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  FOREIGN KEY (poll_id) REFERENCES polls(id)
);
```

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 identifier |
| `poll_id` | TEXT | NOT NULL, FK | Reference to polls.id |
| `answer_text` | TEXT | NOT NULL | Answer option text (1-200 chars) |
| `display_order` | INTEGER | NOT NULL | Display order (0-indexed) |

**Constraints**:
- Foreign key to `polls(id)` ensures referential integrity
- No unique constraint on `answer_text` (same text can appear in different polls)
- `display_order` determines rendering sequence in UI

**Example Rows**:
```sql
INSERT INTO answers (id, poll_id, answer_text, display_order)
VALUES
  ('ans-1', 'poll-123', 'JavaScript', 0),
  ('ans-2', 'poll-123', 'Python', 1),
  ('ans-3', 'poll-123', 'Rust', 2),
  ('ans-4', 'poll-456', 'React', 0),
  ('ans-5', 'poll-456', 'Vue', 1),
  ('ans-6', 'poll-456', 'Svelte', 2);
```

---

### votes

Records individual votes with voter fingerprints for deduplication.

**Schema**:
```sql
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  voter_fingerprint TEXT NOT NULL,
  voted_at INTEGER NOT NULL,
  FOREIGN KEY (poll_id) REFERENCES polls(id),
  FOREIGN KEY (answer_id) REFERENCES answers(id)
);
```

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 identifier |
| `poll_id` | TEXT | NOT NULL, FK | Reference to polls.id |
| `answer_id` | TEXT | NOT NULL, FK | Reference to answers.id |
| `voter_fingerprint` | TEXT | NOT NULL | SHA-256 hash of IP + User-Agent |
| `voted_at` | INTEGER | NOT NULL | Unix timestamp (milliseconds) |

**Privacy Considerations**:
- `voter_fingerprint` is a one-way hash, no PII stored
- No way to reverse-engineer IP or identity from fingerprint
- Fingerprint collision rate is negligible (SHA-256)

**Example Rows**:
```sql
INSERT INTO votes (id, poll_id, answer_id, voter_fingerprint, voted_at)
VALUES
  ('vote-1', 'poll-123', 'ans-1', 'a3f4b2c1d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7', 1702004000000),
  ('vote-2', 'poll-123', 'ans-2', 'b4g5c3d2e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8', 1702004010000),
  ('vote-3', 'poll-123', 'ans-1', 'c5h6d4e3f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9', 1702004020000);
```

## Indexes

Indexes are critical for query performance, especially as vote counts grow.

### Index Definitions

```sql
-- Index for finding answers by poll
CREATE INDEX idx_answers_poll_id ON answers(poll_id);

-- Index for counting votes by poll
CREATE INDEX idx_votes_poll_id ON votes(poll_id);

-- Index for counting votes by answer
CREATE INDEX idx_votes_answer_id ON votes(answer_id);

-- Composite index for duplicate vote detection
CREATE INDEX idx_votes_fingerprint ON votes(poll_id, voter_fingerprint);

-- Index for filtering polls by status
CREATE INDEX idx_polls_status ON polls(status);
```

### Index Usage

| Index | Query Pattern | Example |
|-------|---------------|---------|
| `idx_answers_poll_id` | Get all answers for a poll | `SELECT * FROM answers WHERE poll_id = ?` |
| `idx_votes_poll_id` | Count total votes for a poll | `SELECT COUNT(*) FROM votes WHERE poll_id = ?` |
| `idx_votes_answer_id` | Count votes per answer | `SELECT COUNT(*) FROM votes WHERE answer_id = ?` |
| `idx_votes_fingerprint` | Check if user has voted | `SELECT id FROM votes WHERE poll_id = ? AND voter_fingerprint = ?` |
| `idx_polls_status` | List polls by status | `SELECT * FROM polls WHERE status = 'published'` |

### Performance Considerations

**Without Indexes**:
- Duplicate vote check: O(n) table scan
- Vote counting: O(n) full table scan
- Answer lookup: O(m) where m = total answers across all polls

**With Indexes**:
- Duplicate vote check: O(log n) index lookup
- Vote counting: O(log n) + result set size
- Answer lookup: O(log m) index lookup

**Index Size Impact**:
- Minimal storage overhead (SQLite B-tree indexes)
- Faster reads at cost of slightly slower writes
- Well worth the trade-off for read-heavy workload

## Migrations

Migrations are SQL files versioned and applied sequentially.

### Migration Files

Located in `/migrations/` directory:

```
migrations/
├── 0001_initial_schema.sql
├── 0002_add_poll_metadata.sql (example future migration)
└── 0003_add_analytics_tables.sql (example future migration)
```

### Initial Migration: 0001_initial_schema.sql

```sql
-- Create polls table
CREATE TABLE polls (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER,
  closed_at INTEGER
);

-- Create answers table
CREATE TABLE answers (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  FOREIGN KEY (poll_id) REFERENCES polls(id)
);

-- Create votes table
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  voter_fingerprint TEXT NOT NULL,
  voted_at INTEGER NOT NULL,
  FOREIGN KEY (poll_id) REFERENCES polls(id),
  FOREIGN KEY (answer_id) REFERENCES answers(id)
);

-- Create indexes
CREATE INDEX idx_answers_poll_id ON answers(poll_id);
CREATE INDEX idx_votes_poll_id ON votes(poll_id);
CREATE INDEX idx_votes_answer_id ON votes(answer_id);
CREATE INDEX idx_votes_fingerprint ON votes(poll_id, voter_fingerprint);
CREATE INDEX idx_polls_status ON polls(status);
```

### Applying Migrations

**Using Wrangler CLI**:

```bash
# Create database
wrangler d1 create newsroom-polls

# Apply migration
wrangler d1 execute newsroom-polls --file=./migrations/0001_initial_schema.sql

# Verify schema
wrangler d1 execute newsroom-polls --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**Local Development**:

```bash
# Using local D1 (Miniflare)
wrangler d1 execute newsroom-polls --local --file=./migrations/0001_initial_schema.sql
```

### Future Migration Example

**0002_add_poll_metadata.sql**:
```sql
-- Add optional metadata fields to polls
ALTER TABLE polls ADD COLUMN author_id TEXT;
ALTER TABLE polls ADD COLUMN category TEXT;
ALTER TABLE polls ADD COLUMN tags TEXT; -- JSON array as text

-- Index for filtering by category
CREATE INDEX idx_polls_category ON polls(category);
```

## Queries

### Common Query Patterns

#### 1. Get Poll with Answers and Vote Counts

```sql
SELECT
  p.id,
  p.question,
  p.status,
  a.id AS answer_id,
  a.answer_text,
  a.display_order,
  COUNT(v.id) AS vote_count
FROM polls p
JOIN answers a ON a.poll_id = p.id
LEFT JOIN votes v ON v.answer_id = a.id
WHERE p.id = ?
GROUP BY p.id, a.id
ORDER BY a.display_order;
```

**Result**:
```
| id       | question                    | status    | answer_id | answer_text | display_order | vote_count |
|----------|-----------------------------|-----------|-----------|-------------|---------------|------------|
| poll-123 | What's your favorite...     | published | ans-1     | JavaScript  | 0             | 193        |
| poll-123 | What's your favorite...     | published | ans-2     | Python      | 1             | 150        |
| poll-123 | What's your favorite...     | published | ans-3     | Rust        | 2             | 85         |
```

#### 2. Check for Duplicate Vote

```sql
SELECT id
FROM votes
WHERE poll_id = ?
  AND voter_fingerprint = ?
LIMIT 1;
```

**Usage**:
```typescript
const existingVote = await db
  .prepare('SELECT id FROM votes WHERE poll_id = ? AND voter_fingerprint = ?')
  .bind(pollId, fingerprint)
  .first();

if (existingVote) {
  return new Response('Already voted', { status: 409 });
}
```

#### 3. Insert Vote (with Transaction)

```sql
BEGIN TRANSACTION;

-- Verify poll is published and not closed
SELECT id FROM polls
WHERE id = ?
  AND status = 'published';

-- Verify answer belongs to poll
SELECT id FROM answers
WHERE id = ?
  AND poll_id = ?;

-- Insert vote
INSERT INTO votes (id, poll_id, answer_id, voter_fingerprint, voted_at)
VALUES (?, ?, ?, ?, ?);

COMMIT;
```

#### 4. Get Votes Over Time (Analytics)

```sql
SELECT
  a.id AS answer_id,
  a.answer_text,
  strftime('%Y-%m-%d %H:00:00', datetime(v.voted_at / 1000, 'unixepoch')) AS hour,
  COUNT(*) AS votes_in_hour
FROM answers a
JOIN votes v ON v.answer_id = a.id
WHERE a.poll_id = ?
GROUP BY a.id, hour
ORDER BY hour ASC, a.display_order ASC;
```

**Result**:
```
| answer_id | answer_text | hour                | votes_in_hour |
|-----------|-------------|---------------------|---------------|
| ans-1     | JavaScript  | 2024-12-08 10:00:00 | 45            |
| ans-2     | Python      | 2024-12-08 10:00:00 | 32            |
| ans-3     | Rust        | 2024-12-08 10:00:00 | 18            |
| ans-1     | JavaScript  | 2024-12-08 11:00:00 | 47            |
| ans-2     | Python      | 2024-12-08 11:00:00 | 36            |
| ans-3     | Rust        | 2024-12-08 11:00:00 | 20            |
```

#### 5. List Polls with Total Votes

```sql
SELECT
  p.id,
  p.question,
  p.status,
  p.created_at,
  p.published_at,
  p.closed_at,
  COUNT(v.id) AS total_votes
FROM polls p
LEFT JOIN votes v ON v.poll_id = p.id
WHERE p.status = ?
GROUP BY p.id
ORDER BY p.created_at DESC
LIMIT ? OFFSET ?;
```

#### 6. Batch Insert Votes (from Durable Object)

```sql
-- Using D1 batch API
const batch = pendingVotes.map(vote =>
  db.prepare('INSERT INTO votes (id, poll_id, answer_id, voter_fingerprint, voted_at) VALUES (?, ?, ?, ?, ?)')
    .bind(vote.id, vote.pollId, vote.answerId, vote.voterFingerprint, vote.votedAt)
);

await db.batch(batch);
```

## Data Lifecycle

### Poll Creation

```
1. User creates poll in CMS
   ↓
2. Generate UUID for poll
   ↓
3. INSERT INTO polls (status = 'draft')
   ↓
4. Generate UUIDs for answers
   ↓
5. INSERT INTO answers (multiple rows)
   ↓
6. Poll is editable (status = 'draft')
```

### Poll Publishing

```
1. User clicks "Publish" in CMS
   ↓
2. UPDATE polls SET status = 'published', published_at = NOW()
   ↓
3. Initialize Durable Object
   ↓
4. DO loads poll data from D1 into memory
   ↓
5. Poll is now immutable (cannot UPDATE question/answers)
```

### Vote Submission

```
1. User votes in embed
   ↓
2. Check D1 for duplicate vote
   ↓
3. If not duplicate, forward to Durable Object
   ↓
4. DO increments in-memory counter
   ↓
5. DO adds vote to pending writes queue
   ↓
6. INSERT INTO votes (via batch, periodic sync)
   ↓
7. Vote persisted in D1
```

### Poll Closing

```
1. User clicks "Close" in CMS
   ↓
2. UPDATE polls SET status = 'closed', closed_at = NOW()
   ↓
3. Vote endpoint rejects new votes
   ↓
4. Results remain queryable
   ↓
5. DO can be archived (optional)
```

### Data Retention

**Active Polls** (status = 'published'):
- Poll metadata: Indefinite
- Votes: Indefinite (for analytics)
- Durable Object state: Active in memory

**Closed Polls** (status = 'closed'):
- Poll metadata: Indefinite
- Votes: Indefinite (historical data)
- Durable Object state: Can be cleaned up

**Soft Deleted Polls**:
- Poll metadata: Marked deleted, retained
- Votes: Retained for compliance/audit
- Not shown in CMS lists (unless "show deleted" filter)

## Backup and Recovery

### Cloudflare D1 Backups

Cloudflare automatically backs up D1 databases:
- Point-in-time recovery available
- Managed through Cloudflare dashboard
- No manual backup scripts needed

### Manual Backup (Optional)

```bash
# Export all data
wrangler d1 execute newsroom-polls --command="SELECT * FROM polls" > backup-polls.json
wrangler d1 execute newsroom-polls --command="SELECT * FROM answers" > backup-answers.json
wrangler d1 execute newsroom-polls --command="SELECT * FROM votes" > backup-votes.json
```

## Performance Tips

1. **Use Prepared Statements**: Prevents SQL injection, allows query plan caching
2. **Batch Writes**: Group multiple INSERTs into single D1.batch() call
3. **Limit Result Sets**: Always use LIMIT for list queries
4. **Cache in Durable Objects**: Load poll metadata once, cache in DO state
5. **Avoid SELECT ***: Only query columns you need
6. **Use Covering Indexes**: Include all queried columns in index when possible

## Schema Evolution

Future enhancements may include:

- **Poll templates**: Save question/answer patterns
- **User accounts**: Track poll authors
- **Comments**: Allow discussion on polls
- **Advanced analytics**: Demographic breakdowns
- **Multi-language**: Localized questions/answers

All changes will be applied via versioned migrations to ensure consistent schema across deployments.
