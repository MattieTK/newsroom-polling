import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, PollSummary } from '../api/client'

type StatusFilter = 'all' | 'draft' | 'published' | 'closed';

function PollList() {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    loadPolls();
  }, [filter]);

  async function loadPolls() {
    setLoading(true);
    setError(null);
    try {
      const status = filter === 'all' ? undefined : filter;
      const response = await api.listPolls(status);
      setPolls(response.polls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load polls');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getStatusBadge(status: string) {
    const classMap: Record<string, string> = {
      draft: 'badge badge-draft',
      published: 'badge badge-published',
      closed: 'badge badge-closed',
    };
    return <span className={classMap[status] || 'badge'}>{status}</span>;
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Polls</h2>
        <Link to="/polls/new" className="btn btn-primary">
          Create Poll
        </Link>
      </div>

      <div className="filters">
        {(['all', 'draft', 'published', 'closed'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            className={`filter-btn ${filter === status ? 'active' : ''}`}
            onClick={() => setFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="message message-error">{error}</div>}

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            Loading polls...
          </div>
        ) : polls.length === 0 ? (
          <div className="empty-state">
            <h3>No polls found</h3>
            <p>Create your first poll to get started.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Status</th>
                <th>Votes</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {polls.map((poll) => (
                <tr key={poll.id}>
                  <td>
                    <Link to={`/polls/${poll.id}`}>{poll.question}</Link>
                  </td>
                  <td>{getStatusBadge(poll.status)}</td>
                  <td>{poll.totalVotes.toLocaleString()}</td>
                  <td>{formatDate(poll.createdAt)}</td>
                  <td>
                    <Link to={`/polls/${poll.id}`} className="btn btn-secondary btn-sm">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PollList;
