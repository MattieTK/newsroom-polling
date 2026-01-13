# API Documentation

This document provides detailed specifications for all API endpoints in the Newsroom Polling System.

## Table of Contents

1. [Public Embed Worker API](#public-embed-worker-api)
2. [CMS Worker API](#cms-worker-api)
3. [Common Responses](#common-responses)
4. [Error Handling](#error-handling)

---

## Public Embed Worker API

Base URL: `https://your-embed-worker.workers.dev`

### GET /embed/:pollId

Serves the iframe HTML containing the React poll embed application.

**Parameters**:
- `pollId` (path, required): The unique identifier of the poll

**Response**:
- Content-Type: `text/html`
- Returns HTML page with embedded React application

**Example**:
```http
GET /embed/poll-123 HTTP/1.1
Host: your-embed-worker.workers.dev
```

**Response**:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Poll</title>
  <style>body { margin: 0; font-family: system-ui; }</style>
</head>
<body>
  <div id="root" data-poll-id="poll-123"></div>
  <script src="/embed-bundle.js"></script>
</body>
</html>
```

**Status Codes**:
- `200 OK`: Poll found and HTML served
- `404 Not Found`: Poll does not exist

---

### GET /api/poll/:pollId

Retrieves poll data including question, answers, and current vote counts.

**Parameters**:
- `pollId` (path, required): The unique identifier of the poll

**Response**:
```typescript
{
  id: string;
  question: string;
  status: "draft" | "published" | "closed";
  totalVotes: number;
  answers: Array<{
    id: string;
    text: string;
    votes: number;
    percentage: number;
  }>;
}
```

**Example**:
```http
GET /api/poll/poll-123 HTTP/1.1
Host: your-embed-worker.workers.dev
```

**Response**:
```json
{
  "id": "poll-123",
  "question": "What's your favorite programming language?",
  "status": "published",
  "totalVotes": 427,
  "answers": [
    {
      "id": "ans-1",
      "text": "JavaScript",
      "votes": 192,
      "percentage": 45.0
    },
    {
      "id": "ans-2",
      "text": "Python",
      "votes": 150,
      "percentage": 35.1
    },
    {
      "id": "ans-3",
      "text": "Rust",
      "votes": 85,
      "percentage": 19.9
    }
  ]
}
```

**Status Codes**:
- `200 OK`: Poll data returned successfully
- `404 Not Found`: Poll does not exist
- `403 Forbidden`: Poll is in draft status (not published)

---

### POST /api/poll/:pollId/vote

Submits a vote for a specific answer in a poll.

**Parameters**:
- `pollId` (path, required): The unique identifier of the poll

**Request Body**:
```typescript
{
  answerId: string;
  voterFingerprint: string;
}
```

**Example**:
```http
POST /api/poll/poll-123/vote HTTP/1.1
Host: your-embed-worker.workers.dev
Content-Type: application/json

{
  "answerId": "ans-1",
  "voterFingerprint": "a3f4b2c1d5e6f7g8h9i0j1k2l3m4n5o6"
}
```

**Response**:
```json
{
  "success": true,
  "totalVotes": 428,
  "answers": [
    {
      "answerId": "ans-1",
      "votes": 193,
      "percentage": 45.1
    },
    {
      "answerId": "ans-2",
      "votes": 150,
      "percentage": 35.0
    },
    {
      "answerId": "ans-3",
      "votes": 85,
      "percentage": 19.9
    }
  ]
}
```

**Status Codes**:
- `200 OK`: Vote recorded successfully
- `400 Bad Request`: Invalid request body or answer ID
- `403 Forbidden`: Poll is not published or is closed
- `404 Not Found`: Poll does not exist
- `409 Conflict`: User has already voted in this poll

**Error Response**:
```json
{
  "error": "Already voted",
  "code": "DUPLICATE_VOTE"
}
```

---

### GET /api/poll/:pollId/stream

Establishes a Server-Sent Events (SSE) connection for real-time vote updates.

**Parameters**:
- `pollId` (path, required): The unique identifier of the poll

**Response**:
- Content-Type: `text/event-stream`
- Streaming response with vote updates

**Example**:
```http
GET /api/poll/poll-123/stream HTTP/1.1
Host: your-embed-worker.workers.dev
Accept: text/event-stream
```

**Response Stream**:
```
data: {"totalVotes":428,"answers":[{"answerId":"ans-1","votes":193,"percentage":45.1},{"answerId":"ans-2","votes":150,"percentage":35.0},{"answerId":"ans-3","votes":85,"percentage":19.9}]}

: keepalive

event: vote-update
data: {"totalVotes":429,"answers":[{"answerId":"ans-1","votes":193,"percentage":45.0},{"answerId":"ans-2","votes":151,"percentage":35.2},{"answerId":"ans-3","votes":85,"percentage":19.8}]}

: keepalive

event: vote-update
data: {"totalVotes":430,"answers":[{"answerId":"ans-1","votes":194,"percentage":45.1},{"answerId":"ans-2","votes":151,"percentage":35.1},{"answerId":"ans-3","votes":85,"percentage":19.8}]}
```

**Event Types**:
- `message` (default): Initial vote counts
- `vote-update`: Real-time vote count updates
- Comment lines (`:` prefix): Keep-alive messages (sent every 30s)

**Status Codes**:
- `200 OK`: SSE connection established
- `404 Not Found`: Poll does not exist
- `403 Forbidden`: Poll is not published

**Client Implementation**:
```typescript
const eventSource = new EventSource('/api/poll/poll-123/stream');

eventSource.addEventListener('vote-update', (event) => {
  const data = JSON.parse(event.data);
  updateVoteCounts(data);
});

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  eventSource.close();
};
```

---

## CMS Worker API

Base URL: `https://your-cms-worker.workers.dev`

### GET /

Serves the React CMS application.

**Response**:
- Content-Type: `text/html`
- Returns HTML page with CMS application

**Status Codes**:
- `200 OK`: CMS application served
- `401 Unauthorized`: Authentication required (future)

---

### GET /api/polls

Lists all polls with optional filtering.

**Query Parameters**:
- `status` (optional): Filter by poll status (`draft`, `published`, `closed`)
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example**:
```http
GET /api/polls?status=published&limit=20 HTTP/1.1
Host: your-cms-worker.workers.dev
```

**Response**:
```json
{
  "polls": [
    {
      "id": "poll-123",
      "question": "What's your favorite programming language?",
      "status": "published",
      "totalVotes": 428,
      "createdAt": 1702000000000,
      "publishedAt": 1702003600000,
      "closedAt": null
    },
    {
      "id": "poll-456",
      "question": "Which framework do you prefer?",
      "status": "published",
      "totalVotes": 315,
      "createdAt": 1702010000000,
      "publishedAt": 1702013600000,
      "closedAt": null
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

**Status Codes**:
- `200 OK`: Polls retrieved successfully
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Authentication required (future)

---

### POST /api/polls

Creates a new poll in draft status.

**Request Body**:
```typescript
{
  question: string;
  answers: string[]; // Array of 2-10 answer texts
}
```

**Example**:
```http
POST /api/polls HTTP/1.1
Host: your-cms-worker.workers.dev
Content-Type: application/json

{
  "question": "What's your favorite database?",
  "answers": [
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "SQLite"
  ]
}
```

**Response**:
```json
{
  "id": "poll-789",
  "question": "What's your favorite database?",
  "status": "draft",
  "answers": [
    {
      "id": "ans-10",
      "text": "PostgreSQL",
      "order": 0
    },
    {
      "id": "ans-11",
      "text": "MySQL",
      "order": 1
    },
    {
      "id": "ans-12",
      "text": "MongoDB",
      "order": 2
    },
    {
      "id": "ans-13",
      "text": "SQLite",
      "order": 3
    }
  ],
  "totalVotes": 0,
  "createdAt": 1702020000000,
  "updatedAt": 1702020000000
}
```

**Validation Rules**:
- Question must be 1-500 characters
- Must have 2-10 answers
- Each answer must be 1-200 characters
- Answer texts must be unique within the poll

**Status Codes**:
- `201 Created`: Poll created successfully
- `400 Bad Request`: Validation failed
- `401 Unauthorized`: Authentication required (future)

**Error Response**:
```json
{
  "error": "Validation failed",
  "details": [
    "Question is required",
    "Must have at least 2 answers"
  ]
}
```

---

### GET /api/polls/:pollId

Retrieves detailed information about a specific poll.

**Parameters**:
- `pollId` (path, required): The unique identifier of the poll

**Example**:
```http
GET /api/polls/poll-123 HTTP/1.1
Host: your-cms-worker.workers.dev
```

**Response**:
```json
{
  "id": "poll-123",
  "question": "What's your favorite programming language?",
  "status": "published",
  "answers": [
    {
      "id": "ans-1",
      "text": "JavaScript",
      "order": 0,
      "votes": 193
    },
    {
      "id": "ans-2",
      "text": "Python",
      "order": 1,
      "votes": 150
    },
    {
      "id": "ans-3",
      "text": "Rust",
      "order": 2,
      "votes": 85
    }
  ],
  "totalVotes": 428,
  "createdAt": 1702000000000,
  "updatedAt": 1702000000000,
  "publishedAt": 1702003600000,
  "closedAt": null
}
```

**Status Codes**:
- `200 OK`: Poll retrieved successfully
- `404 Not Found`: Poll does not exist
- `401 Unauthorized`: Authentication required (future)

---

### PUT /api/polls/:pollId

Updates a poll's question and answers. **Only allowed for draft polls.**

**Parameters**:
- `pollId` (path, required): The unique identifier of the poll

**Request Body**:
```typescript
{
  question?: string;
  answers?: string[];
}
```

**Example**:
```http
PUT /api/polls/poll-789 HTTP/1.1
Host: your-cms-worker.workers.dev
Content-Type: application/json

{
  "question": "What's your preferred database system?",
  "answers": [
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "SQLite",
    "Redis"
  ]
}
```

**Response**:
```json
{
  "id": "poll-789",
  "question": "What's your preferred database system?",
  "status": "draft",
  "answers": [
    {
      "id": "ans-14",
      "text": "PostgreSQL",
      "order": 0
    },
    {
      "id": "ans-15",
      "text": "MySQL",
      "order": 1
    },
    {
      "id": "ans-16",
      "text": "MongoDB",
      "order": 2
    },
    {
      "id": "ans-17",
      "text": "SQLite",
      "order": 3
    },
    {
      "id": "ans-18",
      "text": "Redis",
      "order": 4
    }
  ],
  "totalVotes": 0,
  "updatedAt": 1702020100000
}
```

**Status Codes**:
- `200 OK`: Poll updated successfully
- `400 Bad Request`: Validation failed
- `403 Forbidden`: Poll is published or closed (cannot edit)
- `404 Not Found`: Poll does not exist
- `401 Unauthorized`: Authentication required (future)

**Error Response (Published Poll)**:
```json
{
  "error": "Cannot modify published poll",
  "code": "POLL_IMMUTABLE"
}
```

---

### DELETE /api/polls/:pollId

Soft deletes a poll (marks as deleted without removing data).

**Parameters**:
- `pollId` (path, required): The unique identifier of the poll

**Example**:
```http
DELETE /api/polls/poll-789 HTTP/1.1
Host: your-cms-worker.workers.dev
```

**Response**:
```json
{
  "success": true,
  "message": "Poll archived successfully"
}
```

**Status Codes**:
- `200 OK`: Poll archived successfully
- `404 Not Found`: Poll does not exist
- `401 Unauthorized`: Authentication required (future)

**Note**: This operation preserves all vote data for historical records. The poll status is updated to indicate deletion, or a `deleted_at` timestamp is set.

---

### POST /api/polls/:pollId/publish

Publishes a draft poll, making it available for voting.

**Parameters**:
- `pollId` (path, required): The unique identifier of the poll

**Example**:
```http
POST /api/polls/poll-789/publish HTTP/1.1
Host: your-cms-worker.workers.dev
```

**Response**:
```json
{
  "id": "poll-789",
  "question": "What's your preferred database system?",
  "status": "published",
  "publishedAt": 1702020200000,
  "embedCode": "<iframe src=\"https://your-embed-worker.workers.dev/embed/poll-789\" width=\"100%\" height=\"400\" frameborder=\"0\"></iframe>"
}
```

**Status Codes**:
- `200 OK`: Poll published successfully
- `400 Bad Request`: Poll is not in draft status
- `404 Not Found`: Poll does not exist
- `401 Unauthorized`: Authentication required (future)

**Side Effects**:
- Poll status changed from `draft` to `published`
- `published_at` timestamp set
- Question and answers become immutable
- Durable Object initialized for the poll

---

### POST /api/polls/:pollId/close

Closes a published poll, preventing further votes.

**Parameters**:
- `pollId` (path, required): The unique identifier of the poll

**Example**:
```http
POST /api/polls/poll-123/close HTTP/1.1
Host: your-cms-worker.workers.dev
```

**Response**:
```json
{
  "id": "poll-123",
  "question": "What's your favorite programming language?",
  "status": "closed",
  "closedAt": 1702030000000,
  "totalVotes": 428
}
```

**Status Codes**:
- `200 OK`: Poll closed successfully
- `400 Bad Request`: Poll is not published
- `404 Not Found`: Poll does not exist
- `401 Unauthorized`: Authentication required (future)

**Side Effects**:
- Poll status changed from `published` to `closed`
- `closed_at` timestamp set
- Vote endpoint will reject new votes
- Results remain visible to viewers

---

### GET /api/polls/:pollId/analytics

Retrieves detailed analytics and voting trends for a poll.

**Parameters**:
- `pollId` (path, required): The unique identifier of the poll
- `interval` (query, optional): Time interval for trends (`hour`, `day`, `week`) - default: `hour`

**Example**:
```http
GET /api/polls/poll-123/analytics?interval=hour HTTP/1.1
Host: your-cms-worker.workers.dev
```

**Response**:
```json
{
  "pollId": "poll-123",
  "question": "What's your favorite programming language?",
  "status": "published",
  "totalVotes": 428,
  "answers": [
    {
      "id": "ans-1",
      "text": "JavaScript",
      "votes": 193,
      "percentage": 45.1,
      "votesOverTime": [
        { "timestamp": 1702000000000, "count": 45 },
        { "timestamp": 1702003600000, "count": 92 },
        { "timestamp": 1702007200000, "count": 138 },
        { "timestamp": 1702010800000, "count": 176 },
        { "timestamp": 1702014400000, "count": 193 }
      ]
    },
    {
      "id": "ans-2",
      "text": "Python",
      "votes": 150,
      "percentage": 35.0,
      "votesOverTime": [
        { "timestamp": 1702000000000, "count": 32 },
        { "timestamp": 1702003600000, "count": 68 },
        { "timestamp": 1702007200000, "count": 98 },
        { "timestamp": 1702010800000, "count": 125 },
        { "timestamp": 1702014400000, "count": 150 }
      ]
    },
    {
      "id": "ans-3",
      "text": "Rust",
      "votes": 85,
      "percentage": 19.9,
      "votesOverTime": [
        { "timestamp": 1702000000000, "count": 18 },
        { "timestamp": 1702003600000, "count": 38 },
        { "timestamp": 1702007200000, "count": 55 },
        { "timestamp": 1702010800000, "count": 70 },
        { "timestamp": 1702014400000, "count": 85 }
      ]
    }
  ],
  "votingRate": {
    "lastHour": 23,
    "last24Hours": 428,
    "peakHour": {
      "timestamp": 1702007200000,
      "votes": 95
    }
  },
  "publishedAt": 1702003600000,
  "closedAt": null
}
```

**Status Codes**:
- `200 OK`: Analytics retrieved successfully
- `404 Not Found`: Poll does not exist
- `401 Unauthorized`: Authentication required (future)

---

## Common Responses

### Success Response

Standard success response for operations without specific data:

```json
{
  "success": true,
  "message": "Operation completed successfully"
}
```

### Pagination Metadata

Included in list endpoints:

```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Error Handling

All errors follow a consistent format:

```typescript
{
  error: string;        // Human-readable error message
  code?: string;        // Machine-readable error code
  details?: any;        // Additional error details
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `POLL_NOT_FOUND` | Poll does not exist |
| `POLL_NOT_PUBLISHED` | Poll is in draft status |
| `POLL_CLOSED` | Poll is closed and not accepting votes |
| `POLL_IMMUTABLE` | Cannot modify published/closed poll |
| `DUPLICATE_VOTE` | User has already voted |
| `INVALID_ANSWER` | Answer ID does not belong to poll |
| `VALIDATION_ERROR` | Request validation failed |
| `UNAUTHORIZED` | Authentication required |
| `INTERNAL_ERROR` | Server error |

### HTTP Status Codes

| Status | Usage |
|--------|-------|
| `200 OK` | Successful GET/PUT/POST/DELETE |
| `201 Created` | Resource created successfully |
| `400 Bad Request` | Invalid request data |
| `401 Unauthorized` | Authentication required |
| `403 Forbidden` | Operation not allowed |
| `404 Not Found` | Resource not found |
| `409 Conflict` | Resource conflict (e.g., duplicate vote) |
| `500 Internal Server Error` | Server error |

### Example Error Responses

**Validation Error**:
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "question": ["Question must be between 1 and 500 characters"],
    "answers": ["Must provide between 2 and 10 answers"]
  }
}
```

**Not Found Error**:
```json
{
  "error": "Poll not found",
  "code": "POLL_NOT_FOUND"
}
```

**Duplicate Vote Error**:
```json
{
  "error": "You have already voted in this poll",
  "code": "DUPLICATE_VOTE"
}
```

**Immutable Poll Error**:
```json
{
  "error": "Cannot modify published poll - questions and answers are immutable once published",
  "code": "POLL_IMMUTABLE"
}
```

---

## CORS Configuration

### Public Embed Worker

Configured to allow embedding from any origin:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

### CMS Worker

Restricted to specific origins (future):

```
Access-Control-Allow-Origin: https://your-cms-domain.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

---

## Rate Limiting

Future implementation will include:

- **Voting**: 10 votes per IP per hour across all polls
- **API Reads**: 100 requests per minute per IP
- **API Writes**: 20 requests per minute per IP (CMS)

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1702020000
```

---

This API documentation provides a complete reference for integrating with the Newsroom Polling System.
