-- Insert sample polls
INSERT INTO polls (id, question, status, created_at, updated_at, published_at, closed_at)
VALUES
  ('poll-sample-1', 'What is your favorite programming language?', 'published', 1702000000000, 1702000000000, 1702000000000, NULL),
  ('poll-sample-2', 'Which JavaScript framework do you prefer?', 'published', 1702010000000, 1702010000000, 1702010000000, NULL),
  ('poll-sample-3', 'Best database system?', 'draft', 1702020000000, 1702020000000, NULL, NULL);

-- Insert answers for poll 1
INSERT INTO answers (id, poll_id, answer_text, display_order)
VALUES
  ('ans-1-1', 'poll-sample-1', 'JavaScript', 0),
  ('ans-1-2', 'poll-sample-1', 'Python', 1),
  ('ans-1-3', 'poll-sample-1', 'Rust', 2),
  ('ans-1-4', 'poll-sample-1', 'Go', 3);

-- Insert answers for poll 2
INSERT INTO answers (id, poll_id, answer_text, display_order)
VALUES
  ('ans-2-1', 'poll-sample-2', 'React', 0),
  ('ans-2-2', 'poll-sample-2', 'Vue', 1),
  ('ans-2-3', 'poll-sample-2', 'Svelte', 2);

-- Insert answers for poll 3 (draft)
INSERT INTO answers (id, poll_id, answer_text, display_order)
VALUES
  ('ans-3-1', 'poll-sample-3', 'PostgreSQL', 0),
  ('ans-3-2', 'poll-sample-3', 'MySQL', 1),
  ('ans-3-3', 'poll-sample-3', 'MongoDB', 2),
  ('ans-3-4', 'poll-sample-3', 'SQLite', 3);

-- Insert sample votes for poll 1
INSERT INTO votes (id, poll_id, answer_id, voter_fingerprint, voted_at)
VALUES
  ('vote-1-1', 'poll-sample-1', 'ans-1-1', 'fp1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7', 1702001000000),
  ('vote-1-2', 'poll-sample-1', 'ans-1-2', 'fp2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8', 1702002000000),
  ('vote-1-3', 'poll-sample-1', 'ans-1-1', 'fp3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9', 1702003000000),
  ('vote-1-4', 'poll-sample-1', 'ans-1-3', 'fp4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0', 1702004000000),
  ('vote-1-5', 'poll-sample-1', 'ans-1-1', 'fp5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1', 1702005000000);

-- Insert sample votes for poll 2
INSERT INTO votes (id, poll_id, answer_id, voter_fingerprint, voted_at)
VALUES
  ('vote-2-1', 'poll-sample-2', 'ans-2-1', 'fp6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2', 1702011000000),
  ('vote-2-2', 'poll-sample-2', 'ans-2-2', 'fp7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3', 1702012000000),
  ('vote-2-3', 'poll-sample-2', 'ans-2-1', 'fp8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4', 1702013000000);
