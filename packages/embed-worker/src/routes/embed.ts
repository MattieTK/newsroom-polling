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
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #1a1a1a;
      background: #fff;
      padding: 16px;
    }
    
    .poll-container {
      max-width: 600px;
      margin: 0 auto;
    }
    
    .poll-question {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 16px;
      color: #1a1a1a;
    }
    
    .poll-answers {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .answer-btn {
      display: block;
      width: 100%;
      padding: 12px 16px;
      font-size: 1rem;
      font-family: inherit;
      text-align: left;
      background: #f5f5f5;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .answer-btn:hover:not(:disabled) {
      background: #e8e8e8;
      border-color: #ccc;
    }
    
    .answer-btn:focus {
      outline: none;
      border-color: #0066cc;
      box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.2);
    }
    
    .answer-btn:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
    
    .answer-btn.submitting {
      background: #e0e0e0;
    }
    
    /* Results view */
    .result-item {
      margin-bottom: 12px;
    }
    
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    
    .result-text {
      font-size: 0.95rem;
      color: #333;
    }
    
    .result-text.user-vote {
      font-weight: 600;
    }
    
    .result-percentage {
      font-size: 0.9rem;
      font-weight: 600;
      color: #666;
    }
    
    .result-bar-container {
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .result-bar {
      height: 100%;
      background: #0066cc;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    
    .result-bar.user-vote {
      background: #004499;
    }
    
    .poll-footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: #666;
    }
    
    .total-votes {
      font-weight: 500;
    }
    
    .live-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .live-dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    /* States */
    .loading {
      text-align: center;
      padding: 32px;
      color: #666;
    }
    
    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #e0e0e0;
      border-top-color: #0066cc;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 12px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .error {
      text-align: center;
      padding: 32px;
      color: #dc2626;
    }
    
    .error-icon {
      font-size: 2rem;
      margin-bottom: 8px;
    }
    
    .closed-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f3f4f6;
      color: #6b7280;
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 4px;
      text-transform: uppercase;
    }
    
    .message {
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 0.9rem;
    }
    
    .message.info {
      background: #eff6ff;
      color: #1e40af;
    }
    
    .message.error {
      background: #fef2f2;
      color: #dc2626;
      padding: 12px;
      text-align: left;
    }
  </style>
</head>
<body>
  <div id="poll-root" class="poll-container">
    <div class="loading">
      <div class="loading-spinner"></div>
      <div>Loading poll...</div>
    </div>
  </div>

  <script>
    (function() {
      'use strict';
      
      const POLL_ID = '${pollId}';
      const API_BASE = '';
      
      // State
      let state = {
        status: 'loading', // loading, ready, submitting, voted, closed, error
        poll: null,
        userVote: null, // answerId the user voted for
        error: null,
        sseConnected: false
      };
      
      let eventSource = null;
      
      // DOM
      const root = document.getElementById('poll-root');
      
      // Storage key includes reset_count so votes are cleared when poll is reset
      function getStorageKey() {
        const resetCount = state.poll ? (state.poll.reset_count || 0) : 0;
        return 'poll-voted-' + POLL_ID + '-v' + resetCount;
      }
      
      // Storage helpers
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
        } catch (e) {
          // localStorage unavailable
        }
      }

      // Client ID for fingerprinting - persists across sessions in the same browser
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
          // localStorage unavailable, generate ephemeral ID
          return crypto.randomUUID();
        }
      }
      
      // API
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
            // Already voted - treat as success
            return { alreadyVoted: true };
          }
          throw new Error(data.error || 'Failed to submit vote');
        }
        
        return data;
      }
      
      // SSE for real-time vote updates
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
          } catch (err) {
            // Ignore parse errors
          }
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
        
        // Update each answer's votes and percentage
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
      
      // Render
      function render() {
        switch (state.status) {
          case 'loading':
            root.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>Loading poll...</div></div>';
            break;
            
          case 'error':
            root.innerHTML = '<div class="error"><div class="error-icon">!</div><div>' + escapeHtml(state.error) + '</div></div>';
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
        
        let html = '<h2 class="poll-question">' + escapeHtml(poll.question) + '</h2>';
        
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
        
        html += '</div>';
        
        root.innerHTML = html;
        
        // Add click handlers
        root.querySelectorAll('.answer-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            handleVote(btn.dataset.answerId);
          });
        });
      }
      
      function renderResultsView() {
        const poll = state.poll;
        const isClosed = state.status === 'closed' || poll.status === 'closed';
        
        let html = '<h2 class="poll-question">' + escapeHtml(poll.question) + '</h2>';
        
        if (isClosed) {
          html += '<div class="message info"><span class="closed-badge">Closed</span> This poll is no longer accepting votes.</div>';
        }
        
        html += '<div class="poll-results">';
        
        poll.answers.forEach(function(answer) {
          const isUserVote = answer.id === state.userVote;
          const pct = answer.percentage.toFixed(1);
          
          html += '<div class="result-item">' +
                    '<div class="result-header">' +
                      '<span class="result-text' + (isUserVote ? ' user-vote' : '') + '">' + 
                        escapeHtml(answer.text) + 
                        (isUserVote ? ' (your vote)' : '') +
                      '</span>' +
                      '<span class="result-percentage">' + pct + '%</span>' +
                    '</div>' +
                    '<div class="result-bar-container">' +
                      '<div class="result-bar' + (isUserVote ? ' user-vote' : '') + '" style="width: ' + pct + '%"></div>' +
                    '</div>' +
                  '</div>';
        });
        
        html += '</div>';
        
        // Footer
        html += '<div class="poll-footer">' +
                  '<span class="total-votes">' + poll.totalVotes.toLocaleString() + ' vote' + (poll.totalVotes !== 1 ? 's' : '') + '</span>';
        
        if (state.sseConnected && !isClosed) {
          html += '<span class="live-indicator"><span class="live-dot"></span>Live</span>';
        }
        
        html += '</div>';
        
        root.innerHTML = html;
      }
      
      function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }
      
      // Event handlers
      async function handleVote(answerId) {
        state.status = 'submitting';
        state.error = null;
        render();
        
        try {
          const result = await submitVote(answerId);
          
          // Store vote in localStorage
          setStoredVote(answerId);
          state.userVote = answerId;
          
          // If already voted (409), refresh poll data to get current counts
          if (result.alreadyVoted) {
            const poll = await fetchPoll();
            state.poll = poll;
          } else if (result.totalVotes !== undefined) {
            // Update counts from response if available
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
          
          // Connect to SSE for live updates
          connectSSE();
          
        } catch (err) {
          state.status = 'ready';
          state.error = err.message;
          render();
        }
      }
      
      // Initialize
      async function init() {
        try {
          const poll = await fetchPoll();
          state.poll = poll;
          
          // Check if user already voted
          const storedVote = getStoredVote();
          if (storedVote) {
            // Verify the stored vote is still a valid answer
            const validAnswer = poll.answers.find(function(a) {
              return a.id === storedVote;
            });
            if (validAnswer) {
              state.userVote = storedVote;
              state.status = poll.status === 'closed' ? 'closed' : 'voted';
              connectSSE();
            } else {
              // Invalid stored vote, allow voting again
              state.status = poll.status === 'closed' ? 'closed' : 'ready';
            }
          } else {
            state.status = poll.status === 'closed' ? 'closed' : 'ready';
          }

          render();

          // Connect SSE for live updates on all published polls
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
