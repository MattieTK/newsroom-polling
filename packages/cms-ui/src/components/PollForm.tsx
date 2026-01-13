import { useState } from 'react'

interface PollFormProps {
  initialQuestion?: string;
  initialAnswers?: string[];
  onSubmit: (question: string, answers: string[]) => void;
  loading?: boolean;
  submitLabel?: string;
}

function PollForm({
  initialQuestion = '',
  initialAnswers = ['', ''],
  onSubmit,
  loading = false,
  submitLabel = 'Create Poll',
}: PollFormProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [answers, setAnswers] = useState<string[]>(initialAnswers);
  const [errors, setErrors] = useState<{ question?: string; answers?: string }>({});

  function validateForm(): boolean {
    const newErrors: { question?: string; answers?: string } = {};

    if (!question.trim()) {
      newErrors.question = 'Question is required';
    } else if (question.length > 500) {
      newErrors.question = 'Question must be 500 characters or less';
    }

    const validAnswers = answers.filter((a) => a.trim());
    if (validAnswers.length < 2) {
      newErrors.answers = 'At least 2 answers are required';
    } else if (validAnswers.length > 10) {
      newErrors.answers = 'Maximum 10 answers allowed';
    } else if (new Set(validAnswers).size !== validAnswers.length) {
      newErrors.answers = 'Answers must be unique';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    const validAnswers = answers.filter((a) => a.trim());
    onSubmit(question.trim(), validAnswers);
  }

  function updateAnswer(index: number, value: string) {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  }

  function addAnswer() {
    if (answers.length < 10) {
      setAnswers([...answers, '']);
    }
  }

  function removeAnswer(index: number) {
    if (answers.length > 2) {
      setAnswers(answers.filter((_, i) => i !== index));
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label" htmlFor="question">
          Question
        </label>
        <input
          type="text"
          id="question"
          className="form-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What would you like to ask?"
          disabled={loading}
        />
        {errors.question && <div className="form-error">{errors.question}</div>}
        <div className="form-hint">{question.length}/500 characters</div>
      </div>

      <div className="form-group">
        <label className="form-label">Answers</label>
        <div className="answer-list">
          {answers.map((answer, index) => (
            <div key={index} className="answer-item">
              <input
                type="text"
                className="form-input"
                value={answer}
                onChange={(e) => updateAnswer(index, e.target.value)}
                placeholder={`Answer ${index + 1}`}
                disabled={loading}
              />
              {answers.length > 2 && (
                <button
                  type="button"
                  className="answer-remove"
                  onClick={() => removeAnswer(index)}
                  disabled={loading}
                  title="Remove answer"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
        {errors.answers && <div className="form-error">{errors.answers}</div>}
        {answers.length < 10 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm add-answer"
            onClick={addAnswer}
            disabled={loading}
            style={{ marginTop: '12px' }}
          >
            + Add Answer
          </button>
        )}
        <div className="form-hint">{answers.filter((a) => a.trim()).length}/10 answers</div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}

export default PollForm;
