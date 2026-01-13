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
