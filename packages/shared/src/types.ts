// Poll Status
export type PollStatus = 'draft' | 'published' | 'closed';

// Database Models
export interface Poll {
  id: string;
  question: string;
  status: PollStatus;
  created_at: number;
  updated_at: number;
  published_at: number | null;
  closed_at: number | null;
}

export interface Answer {
  id: string;
  poll_id: string;
  answer_text: string;
  display_order: number;
}

export interface Vote {
  id: string;
  poll_id: string;
  answer_id: string;
  voter_fingerprint: string;
  voted_at: number;
}

// API Response Types
export interface PollWithAnswers extends Poll {
  answers: AnswerWithVotes[];
  totalVotes: number;
}

export interface AnswerWithVotes {
  id: string;
  text: string;
  order: number;
  votes: number;
  percentage: number;
}

export interface PollSummary {
  id: string;
  question: string;
  status: PollStatus;
  totalVotes: number;
  createdAt: number;
  publishedAt: number | null;
  closedAt: number | null;
}

export interface PollListResponse {
  polls: PollSummary[];
  total: number;
  limit: number;
  offset: number;
}

// Vote Response
export interface VoteResponse {
  success: boolean;
  totalVotes: number;
  answers: {
    answerId: string;
    votes: number;
    percentage: number;
  }[];
}

// Analytics Types
export interface VoteOverTime {
  timestamp: number;
  count: number;
}

export interface AnswerAnalytics {
  id: string;
  text: string;
  votes: number;
  percentage: number;
  votesOverTime: VoteOverTime[];
}

export interface PollAnalytics {
  pollId: string;
  question: string;
  status: PollStatus;
  totalVotes: number;
  answers: AnswerAnalytics[];
  votingRate: {
    lastHour: number;
    last24Hours: number;
    peakHour: {
      timestamp: number;
      votes: number;
    };
  };
  publishedAt: number | null;
  closedAt: number | null;
}

// Error Types
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}

// Create/Update Types
export interface CreatePollRequest {
  question: string;
  answers: string[];
}

export interface UpdatePollRequest {
  question?: string;
  answers?: string[];
}

export interface VoteRequest {
  answerId: string;
  // voterFingerprint is generated server-side, not provided by client
}

// Durable Object State
export interface DurableObjectPollState {
  pollId: string;
  voteCounts: Record<string, number>;
  totalVotes: number;
  lastSyncedAt: number;
  pollMetadata?: {
    question: string;
    status: PollStatus;
    answers: Array<{ id: string; text: string }>;
  };
}

// SSE Event Types
export interface SSEVoteUpdate {
  totalVotes: number;
  answers: {
    answerId: string;
    votes: number;
    percentage: number;
  }[];
}
