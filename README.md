# Identity Ingestion API

A REST API service that ingests identity-related events from applications and exposes them for querying.

Built with **Express 5**, **TypeScript**, **Zod** (validation), and **Pino** (structured logging). Structured with a clean repository abstraction layer so the in-memory store can be swapped for Postgres or Redis without touching any business logic.

---

## Architecture

```
src/
├── schemas/          # Zod schemas — single source of truth for types + validation
├── models/           # Domain models (IdentityEvent, AppSummary)
├── repositories/
│   ├── interfaces/   # IEventRepository contract
│   └── in-memory/    # InMemoryEventRepository implementation (swappable)
├── services/         # Business logic (EventService)
├── controllers/      # HTTP request/response handling (EventController)
├── routes/           # Express router
├── logger.ts         # Shared Pino logger instance
├── app.ts            # Express app + dependency wiring
└── index.ts          # Server entry point
```

**Request flow:**
```
HTTP Request → Controller (validate) → Service (business logic) → Repository (data access)
```

---

## Endpoints

### `POST /events`
Ingest a batch of identity events.

**Request body:**
```json
{
  "events": [
    {
      "userId": "user-123",
      "appId": "app-abc",
      "action": "login",
      "timestamp": "2026-06-08T10:00:00.000Z",
      "metadata": { "ip": "1.2.3.4" }
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | ✅ | Non-empty |
| `appId` | string | ✅ | Non-empty |
| `action` | enum | ✅ | `login` \| `logout` \| `privilege_escalation` \| `token_refresh` |
| `timestamp` | ISO 8601 | ✅ | e.g. `2026-06-08T10:00:00.000Z` |
| `metadata` | object | ❌ | Arbitrary key/value pairs, defaults to `{}` |

Batch size: 1–1000 events per request.

**Response `201`:**
```json
{
  "ingested": 1,
  "events": [
    {
      "id": "2e889b54-...",
      "userId": "user-123",
      "appId": "app-abc",
      "action": "login",
      "timestamp": "2026-06-08T10:00:00.000Z",
      "metadata": { "ip": "1.2.3.4" },
      "receivedAt": "2026-06-08T16:08:18.638Z"
    }
  ]
}
```

---

### `GET /events`
Query events with optional filters and pagination.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `appId` | string | — | Filter by app |
| `userId` | string | — | Filter by user |
| `action` | enum | — | Filter by action type |
| `from` | ISO 8601 | — | Inclusive start of time range |
| `to` | ISO 8601 | — | Inclusive end of time range |
| `page` | integer ≥ 1 | `1` | Page number |
| `limit` | integer 1–100 | `20` | Results per page |

**Response `200`:**
```json
{
  "data": [ ...events ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

Results are sorted by `timestamp` descending (most recent first).

---

### `GET /apps/:appId/summary`
Returns aggregate stats for a single app.

**Response `200`:**
```json
{
  "appId": "app-abc",
  "totalEvents": 150,
  "uniqueUsers": 12,
  "lastSeenAt": "2026-06-08T15:30:00.000Z",
  "eventCountsByType": {
    "login": 80,
    "logout": 45,
    "privilege_escalation": 10,
    "token_refresh": 15
  }
}
```

Returns `404` if no events exist for the given `appId`.

---

## Getting Started

### Prerequisites
- Node.js 22+
- npm

### Install dependencies
```bash
npm install
```

### Run in development (single run)
```bash
npm run dev
```

### Run with hot reload
```bash
npm run dev:watch
```

### Build for production
```bash
npm run build
npm start
```

---

## Docker

### Build and run with Docker Compose
```bash
docker compose up --build
```

### Build and run manually
```bash
docker build -t identity-ingestion-api .
docker run -p 3000:3000 identity-ingestion-api
```

The Dockerfile uses a **two-stage build** — the builder stage compiles TypeScript, and the production stage contains only the compiled JS and runtime dependencies (no TypeScript toolchain).

---

## Testing

```bash
npm test                # run all tests
npm run test:watch      # re-run on file changes
npm run test:coverage   # generate coverage report
```

**46 tests** across 3 suites covering:
- `POST /events` — happy path, all validations
- `GET /events` — filtering, pagination, edge cases
- `GET /apps/:appId/summary` — aggregation, 404 handling

---

## Logging

Powered by [Pino](https://getpino.io). Logs are emitted at the following layers:

| Layer | Level | What's logged |
|---|---|---|
| HTTP (pino-http) | `info` | Every request + response: method, URL, status, responseTime |
| Controller | `info` | Validated params per endpoint; validation failures |
| Service | `info` | Batch size ingested, query result counts, summary stats |
| Repository | `debug` | Query details (filters, pagination) and result counts |
| Repository | `error` | Storage-level failures |
| Global error handler | `error` | Any unhandled error with full stack |

**Environment behaviour:**
- `NODE_ENV=development` → pretty coloured output, `debug` level
- `NODE_ENV=production` → raw JSON, `info` level
- Override with `LOG_LEVEL=debug` env var

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `NODE_ENV` | `development` | Controls log format and level |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Override log verbosity |
