const API_BASE = '/api';

export interface PollSummary {
  id: string;
  question: string;
  status: 'draft' | 'published' | 'closed';
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

export interface AnswerWithVotes {
  id: string;
  text: string;
  order: number;
  votes: number;
  percentage: number;
}

export interface PollDetail {
  id: string;
  question: string;
  status: 'draft' | 'published' | 'closed';
  created_at: number;
  updated_at: number;
  published_at: number | null;
  closed_at: number | null;
  answers: AnswerWithVotes[];
  totalVotes: number;
}

export interface CreatePollRequest {
  question: string;
  answers: string[];
}

export interface UpdatePollRequest {
  question?: string;
  answers?: string[];
}

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data;
  }

  async listPolls(status?: string): Promise<PollListResponse> {
    const params = status ? `?status=${status}` : '';
    return this.request<PollListResponse>(`/polls${params}`);
  }

  async getPoll(pollId: string): Promise<PollDetail> {
    return this.request<PollDetail>(`/polls/${pollId}`);
  }

  async createPoll(data: CreatePollRequest): Promise<PollDetail> {
    return this.request<PollDetail>('/polls', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePoll(pollId: string, data: UpdatePollRequest): Promise<PollDetail> {
    return this.request<PollDetail>(`/polls/${pollId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async publishPoll(pollId: string): Promise<PollDetail> {
    return this.request<PollDetail>(`/polls/${pollId}/publish`, {
      method: 'POST',
    });
  }

  async closePoll(pollId: string): Promise<PollDetail> {
    return this.request<PollDetail>(`/polls/${pollId}/close`, {
      method: 'POST',
    });
  }

  async deletePoll(pollId: string): Promise<void> {
    await this.request(`/polls/${pollId}`, {
      method: 'DELETE',
    });
  }

  async resetPoll(pollId: string): Promise<PollDetail> {
    return this.request<PollDetail>(`/polls/${pollId}/reset`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
