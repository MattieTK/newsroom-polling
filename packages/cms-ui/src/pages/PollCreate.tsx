import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import PollForm from '../components/PollForm'

function PollCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(question: string, answers: string[]) {
    setLoading(true);
    setError(null);
    try {
      const poll = await api.createPoll({ question, answers });
      navigate(`/polls/${poll.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create poll');
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Create Poll</h2>
      </div>

      {error && <div className="message message-error">{error}</div>}

      <div className="card">
        <PollForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  );
}

export default PollCreate;
