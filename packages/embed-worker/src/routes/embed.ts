import { Context } from 'hono';
import { errorResponse } from '../lib/utils.js';
import { ERROR_CODES } from '@newsroom-polling/shared';

/**
 * GET /embed/:pollId
 * Serves the iframe HTML containing the Vanilla JS poll embed widget
 */
export async function handleEmbed(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  // Get Durable Object stub for this poll
  const doId = c.env.POLL_COUNTER.idFromName(pollId);
  const stub = c.env.POLL_COUNTER.get(doId);

  // Check if poll exists and is published
  const checkResponse = await stub.fetch(new Request('http://internal/get'));

  if (!checkResponse.ok) {
    if (checkResponse.status === 404) {
      return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
    }
    return errorResponse('Failed to get poll', 500, ERROR_CODES.INTERNAL_ERROR);
  }

  const poll = await checkResponse.json();

  if ((poll as any).status === 'draft') {
    return errorResponse('Poll not published', 403, ERROR_CODES.POLL_NOT_PUBLISHED);
  }

  const html = generateEmbedHTML(pollId);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

function generateEmbedHTML(pollId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Poll</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #ffffff;
      --bg-secondary: #f4f4f5;
      --border: #e4e4e7;
      --text: #18181b;
      --text-secondary: #52525b;
      --text-muted: #a1a1aa;
      --accent: #818cf8;
      --accent-hover: #6366f1;
      --accent-subtle: rgba(129, 140, 248, 0.12);
      --success: #34d399;
      --font: 'Inter', -apple-system, sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font);
      font-size: 15px;
      line-height: 1.5;
      color: var(--text);
      background: transparent;
      padding: 16px;
      -webkit-font-smoothing: antialiased;
    }

    .poll-container {
      max-width: 520px;
      margin: 0 auto;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
    }

    .poll-content {
      padding: 24px;
    }

    .poll-question {
      font-size: 1.125rem;
      font-weight: 600;
      line-height: 1.4;
      color: var(--text);
      margin-bottom: 20px;
    }

    .poll-answers {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .answer-btn {
      display: block;
      width: 100%;
      padding: 14px 18px;
      font-family: var(--font);
      font-size: 0.9375rem;
      font-weight: 500;
      text-align: left;
      color: var(--text);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .answer-btn:hover:not(:disabled) {
      border-color: var(--accent);
      background: var(--accent-subtle);
    }

    .answer-btn:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-subtle);
    }

    .answer-btn:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .answer-btn.submitting {
      background: var(--accent-subtle);
      border-color: var(--accent);
    }

    .poll-results {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .result-item {
      /* No animation */
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
    }

    .result-text {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text);
      flex: 1;
    }

    .result-text.user-vote {
      color: var(--accent-hover);
    }

    .result-text.user-vote::after {
      content: ' ✓';
      font-size: 0.85em;
    }

    .result-percentage {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }

    .result-bar-container {
      height: 10px;
      background: var(--bg-secondary);
      border-radius: 100px;
      overflow: hidden;
    }

    .result-bar {
      height: 100%;
      background: var(--accent);
      border-radius: 100px;
      transition: width 0.4s ease-out;
    }

    .result-bar.user-vote {
      background: var(--accent-hover);
    }

    .poll-footer {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .total-votes {
      font-weight: 500;
      color: var(--text-secondary);
    }

    .live-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      color: var(--success);
    }

    .live-dot {
      width: 6px;
      height: 6px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      gap: 12px;
      color: var(--text-secondary);
    }

    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }

    .error-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      margin: 0 auto 12px;
      background: #fee2e2;
      border-radius: 50%;
      color: #ef4444;
      font-size: 1.25rem;
      font-weight: 700;
    }

    .closed-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: #f3f4f6;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .closed-badge {
      padding: 3px 8px;
      background: #9ca3af;
      color: white;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border-radius: 4px;
    }

    .closed-text {
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .message {
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 0.875rem;
    }

    .message.error {
      background: #fee2e2;
      color: #b91c1c;
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }

    .answer-btn:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  </style>
</head>
<body>
  <div id="poll-root" class="poll-container">
    <div class="poll-content">
      <div class="loading">
        <div class="loading-spinner"></div>
        <div>Loading poll...</div>
      </div>
    </div>
  </div>

  <script>
    (function() {
      'use strict';

      const POLL_ID = '${pollId}';
      const API_BASE = '';

      let state = {
        status: 'loading',
        poll: null,
        userVote: null,
        error: null,
        sseConnected: false
      };

      let eventSource = null;
      const root = document.getElementById('poll-root');

      function getStorageKey() {
        const resetCount = state.poll ? (state.poll.reset_count || 0) : 0;
        return 'poll-voted-' + POLL_ID + '-v' + resetCount;
      }

      function getStoredVote() {
        try {
          return localStorage.getItem(getStorageKey());
        } catch (e) {
          return null;
        }
      }

      function setStoredVote(answerId) {
        try {
          localStorage.setItem(getStorageKey(), answerId);
        } catch (e) {}
      }

      function getClientId() {
        const storageKey = 'poll-client-id';
        try {
          let clientId = localStorage.getItem(storageKey);
          if (!clientId) {
            clientId = crypto.randomUUID();
            localStorage.setItem(storageKey, clientId);
          }
          return clientId;
        } catch (e) {
          return crypto.randomUUID();
        }
      }

      async function fetchPoll() {
        const res = await fetch(API_BASE + '/api/poll/' + POLL_ID);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to load poll');
        }
        return res.json();
      }

      async function submitVote(answerId) {
        const res = await fetch(API_BASE + '/api/poll/' + POLL_ID + '/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answerId, clientId: getClientId() })
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409) {
            return { alreadyVoted: true };
          }
          throw new Error(data.error || 'Failed to submit vote');
        }

        return data;
      }

      function connectSSE() {
        if (eventSource) {
          eventSource.close();
        }

        eventSource = new EventSource(API_BASE + '/api/poll/' + POLL_ID + '/stream');

        eventSource.onopen = function() {
          state.sseConnected = true;
          render();
        };

        eventSource.addEventListener('vote-update', function(e) {
          try {
            var data = JSON.parse(e.data);
            updateVoteCounts(data);
          } catch (err) {}
        });

        eventSource.onerror = function() {
          state.sseConnected = false;
          render();
          setTimeout(connectSSE, 5000);
        };
      }

      function updateVoteCounts(data) {
        if (!state.poll) return;

        state.poll.totalVotes = data.totalVotes;

        data.answers.forEach(function(update) {
          const answer = state.poll.answers.find(function(a) {
            return a.id === update.answerId;
          });
          if (answer) {
            answer.votes = update.votes;
            answer.percentage = update.percentage;
          }
        });

        render();
      }

      function render() {
        switch (state.status) {
          case 'loading':
            root.innerHTML = '<div class="poll-content"><div class="loading"><div class="loading-spinner"></div><div>Loading poll...</div></div></div>';
            break;

          case 'error':
            root.innerHTML = '<div class="poll-content"><div class="error"><div class="error-icon">!</div><div>' + escapeHtml(state.error) + '</div></div></div>';
            break;

          case 'ready':
          case 'submitting':
            renderVotingView();
            break;

          case 'voted':
          case 'closed':
            renderResultsView();
            break;
        }
      }

      function renderVotingView() {
        const poll = state.poll;
        const isSubmitting = state.status === 'submitting';

        let html = '<div class="poll-content">';
        html += '<h2 class="poll-question">' + escapeHtml(poll.question) + '</h2>';

        if (state.error) {
          html += '<div class="message error">' + escapeHtml(state.error) + '</div>';
        }

        html += '<div class="poll-answers">';

        poll.answers.forEach(function(answer) {
          html += '<button class="answer-btn' + (isSubmitting ? ' submitting' : '') + '" ' +
                  'data-answer-id="' + answer.id + '" ' +
                  (isSubmitting ? 'disabled' : '') + '>' +
                  escapeHtml(answer.text) +
                  '</button>';
        });

        html += '</div></div>';

        root.innerHTML = html;

        root.querySelectorAll('.answer-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            handleVote(btn.dataset.answerId);
          });
        });
      }

      function renderResultsView() {
        const poll = state.poll;
        const isClosed = state.status === 'closed' || poll.status === 'closed';

        let html = '<div class="poll-content">';
        html += '<h2 class="poll-question">' + escapeHtml(poll.question) + '</h2>';

        if (isClosed) {
          html += '<div class="closed-banner"><span class="closed-badge">Closed</span><span class="closed-text">This poll is no longer accepting votes</span></div>';
        }

        html += '<div class="poll-results">';

        poll.answers.forEach(function(answer) {
          const isUserVote = answer.id === state.userVote;
          const pct = answer.percentage.toFixed(1);

          html += '<div class="result-item">' +
                    '<div class="result-header">' +
                      '<span class="result-text' + (isUserVote ? ' user-vote' : '') + '">' +
                        escapeHtml(answer.text) +
                      '</span>' +
                      '<span class="result-percentage">' + pct + '%</span>' +
                    '</div>' +
                    '<div class="result-bar-container">' +
                      '<div class="result-bar' + (isUserVote ? ' user-vote' : '') + '" style="width: ' + pct + '%"></div>' +
                    '</div>' +
                  '</div>';
        });

        html += '</div>';

        html += '<div class="poll-footer">' +
                  '<span class="total-votes">' + poll.totalVotes.toLocaleString() + ' vote' + (poll.totalVotes !== 1 ? 's' : '') + '</span>';

        if (state.sseConnected && !isClosed) {
          html += '<span class="live-indicator"><span class="live-dot"></span>Live</span>';
        }

        html += '</div></div>';

        root.innerHTML = html;
      }

      function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      async function handleVote(answerId) {
        state.status = 'submitting';
        state.error = null;
        render();

        try {
          const result = await submitVote(answerId);

          setStoredVote(answerId);
          state.userVote = answerId;

          if (result.alreadyVoted) {
            const poll = await fetchPoll();
            state.poll = poll;
          } else if (result.totalVotes !== undefined) {
            state.poll.totalVotes = result.totalVotes;
            if (result.answers) {
              result.answers.forEach(function(update) {
                const answer = state.poll.answers.find(function(a) {
                  return a.id === update.answerId;
                });
                if (answer) {
                  answer.votes = update.votes;
                  answer.percentage = update.percentage;
                }
              });
            }
          }

          state.status = 'voted';
          render();

          connectSSE();

        } catch (err) {
          state.status = 'ready';
          state.error = err.message;
          render();
        }
      }

      async function init() {
        try {
          const poll = await fetchPoll();
          state.poll = poll;

          const storedVote = getStoredVote();
          if (storedVote) {
            const validAnswer = poll.answers.find(function(a) {
              return a.id === storedVote;
            });
            if (validAnswer) {
              state.userVote = storedVote;
              state.status = poll.status === 'closed' ? 'closed' : 'voted';
              connectSSE();
            } else {
              state.status = poll.status === 'closed' ? 'closed' : 'ready';
            }
          } else {
            state.status = poll.status === 'closed' ? 'closed' : 'ready';
          }

          render();

          if (poll.status === 'published') {
            connectSSE();
          }

        } catch (err) {
          state.status = 'error';
          state.error = err.message;
          render();
        }
      }

      init();
    })();
  </script>
</body>
</html>`;
}
