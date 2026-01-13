import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, PollDetail as PollDetailType } from '../api/client'
import EmbedCode from '../components/EmbedCode'

function PollDetail() {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<PollDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  useEffect(() => {
    if (pollId) {
      loadPoll();
    }
  }, [pollId]);

  async function loadPoll() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPoll(pollId!);
      setPoll(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load poll');
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!confirm('Are you sure you want to publish this poll? Once published, the question and answers cannot be changed.')) {
      return;
    }
    setActionLoading(true);
    try {
      const updated = await api.publishPoll(pollId!);
      setPoll(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish poll');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClose() {
    if (!confirm('Are you sure you want to close this poll? No more votes will be accepted.')) {
      return;
    }
    setActionLoading(true);
    try {
      const updated = await api.closePoll(pollId!);
      setPoll(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close poll');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this poll? This action cannot be undone.')) {
      return;
    }
    setActionLoading(true);
    try {
      await api.deletePoll(pollId!);
      navigate('/polls');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete poll');
      setActionLoading(false);
    }
  }

  async function handleReset() {
    if (!confirm('Are you sure you want to reset this poll? All votes will be removed. This cannot be undone.')) {
      return;
    }
    setActionLoading(true);
    try {
      const updated = await api.resetPoll(pollId!);
      setPoll(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset poll');
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(timestamp: number | null) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading poll...
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="card">
        <div className="message message-error">{error}</div>
        <Link to="/polls" className="btn btn-secondary">
          Back to Polls
        </Link>
      </div>
    );
  }

  if (!poll) return null;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{poll.question}</h2>
        <div className="actions">
          {poll.status === 'draft' && (
            <>
              <Link to={`/polls/${poll.id}/edit`} className="btn btn-secondary">
                Edit
              </Link>
              <button
                className="btn btn-success"
                onClick={handlePublish}
                disabled={actionLoading}
              >
                Publish
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={actionLoading}
              >
                Delete
              </button>
            </>
          )}
          {poll.status === 'published' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setShowEmbed(!showEmbed)}
              >
                {showEmbed ? 'Hide Embed Code' : 'Get Embed Code'}
              </button>
              <button
                className="btn btn-warning"
                onClick={handleReset}
                disabled={actionLoading}
              >
                Reset Votes
              </button>
              <button
                className="btn btn-danger"
                onClick={handleClose}
                disabled={actionLoading}
              >
                Close Poll
              </button>
            </>
          )}
          {poll.status === 'closed' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setShowEmbed(!showEmbed)}
              >
                {showEmbed ? 'Hide Embed Code' : 'View Embed Code'}
              </button>
              <button
                className="btn btn-warning"
                onClick={handleReset}
                disabled={actionLoading}
              >
                Reset Votes
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="message message-error">{error}</div>}

      {showEmbed && (
        <div className="card">
          <EmbedCode pollId={poll.id} />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Poll Details</span>
          {getStatusBadge(poll.status)}
        </div>

        <div className="poll-stats">
          <div className="stat-card">
            <div className="stat-value">{poll.totalVotes.toLocaleString()}</div>
            <div className="stat-label">Total Votes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{poll.answers.length}</div>
            <div className="stat-label">Answers</div>
          </div>
        </div>

        <h3 style={{ marginBottom: '16px' }}>Results</h3>
        {poll.answers.map((answer) => (
          <div key={answer.id} className="result-item">
            <div className="result-header">
              <span className="result-text">{answer.text}</span>
              <span className="result-votes">
                {answer.votes.toLocaleString()} votes ({answer.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="result-bar-bg">
              <div
                className="result-bar"
                style={{ width: `${Math.max(answer.percentage, 0)}%` }}
              >
                {answer.percentage >= 10 && `${answer.percentage.toFixed(1)}%`}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '16px' }}>Timeline</h3>
        <table className="table">
          <tbody>
            <tr>
              <td><strong>Created</strong></td>
              <td>{formatDate(poll.created_at)}</td>
            </tr>
            <tr>
              <td><strong>Last Updated</strong></td>
              <td>{formatDate(poll.updated_at)}</td>
            </tr>
            <tr>
              <td><strong>Published</strong></td>
              <td>{formatDate(poll.published_at)}</td>
            </tr>
            <tr>
              <td><strong>Closed</strong></td>
              <td>{formatDate(poll.closed_at)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Link to="/polls" className="btn btn-secondary">
        &larr; Back to Polls
      </Link>
    </div>
  );
}

export default PollDetail;
