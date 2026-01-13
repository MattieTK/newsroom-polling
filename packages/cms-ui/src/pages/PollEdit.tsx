import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, PollDetail } from '../api/client'
import PollForm from '../components/PollForm'

function PollEdit() {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (data.status !== 'draft') {
        setError('Only draft polls can be edited');
        setPoll(null);
      } else {
        setPoll(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load poll');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(question: string, answers: string[]) {
    setSaving(true);
    setError(null);
    try {
      await api.updatePoll(pollId!, { question, answers });
      navigate(`/polls/${pollId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update poll');
      setSaving(false);
    }
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
        <h2 className="page-title">Edit Poll</h2>
      </div>

      {error && <div className="message message-error">{error}</div>}

      <div className="card">
        <PollForm
          initialQuestion={poll.question}
          initialAnswers={poll.answers.map((a) => a.text)}
          onSubmit={handleSubmit}
          loading={saving}
          submitLabel="Save Changes"
        />
      </div>

      <Link to={`/polls/${poll.id}`} className="btn btn-secondary" style={{ marginTop: '16px' }}>
        Cancel
      </Link>
    </div>
  );
}

export default PollEdit;
