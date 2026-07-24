# Reverse Proxy CDN

A lightweight reverse proxy and CDN simulator built to demonstrate caching strategies,
latency reduction, and reverse-proxy architecture using Node.js, Express, and Redis.

![Dashboard Screenshot](./docs/dashboard-screenshot.png)

## What This Project Demonstrates

- **Cache-aside pattern**: the industry-standard caching strategy used by CDNs like
  Cloudflare and Fastly, and by application-level caches in front of slow databases
- **Reverse proxying**: intercepting client requests, forwarding to an origin server,
  and returning a modified response
- **TTL-based cache expiry**: automatic cache invalidation using Redis's `EX` option,
  no manual cleanup logic required
- **Real-time analytics**: a polling React dashboard visualizing cache hit ratio and
  latency differences live
- **CORS handling**: cross-origin requests between a frontend (port 5173) and backend
  API (port 5000), a common real-world integration point

## Architecture

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Dashboard   │──────▶│  Proxy / CDN  │──────▶│    Origin     │
│  (React, 5173)│  poll │  Server (5000)│  MISS │ Server (4000) │
└──────────────┘       └───────┬──────┘       └──────────────┘
                                 │
                                 ▼
                         ┌──────────────┐
                         │     Redis     │
                         │  (cache +     │
                         │   stats)      │
                         └──────────────┘
```

**Request flow:**
1. Client requests an asset from the Proxy Server.
2. Proxy checks Redis for a cached copy of that asset.
3. **Cache HIT** → served directly from Redis (~5ms), `X-Cache: HIT` header, `stats:hits` incremented.
4. **Cache MISS** → fetched from the Origin Server (~200ms simulated delay), stored in
   Redis with a 60-second TTL, `X-Cache: MISS` header, `stats:misses` incremented.
5. After 60 seconds, the cached entry expires automatically and the next request for
   that asset is a fresh MISS.

## Tech Stack

- **Origin Server**: Node.js, Express (serves static files with artificial 200ms delay)
- **Proxy/CDN Server**: Node.js, Express, Redis (`redis` client), Axios, CORS
- **Cache**: Redis (via [Memurai](https://www.memurai.com/) on Windows / Docker on other platforms)
- **Dashboard**: React (Vite), Tailwind CSS, Recharts

## Project Structure

```
reverse-proxy-cdn/
├── origin-server/      # Simulated slow backend
│   ├── server.js
│   └── public/          # Static assets served with 200ms delay
├── proxy-server/        # Reverse proxy + caching logic
│   ├── server.js
│   └── redisClient.js
└── dashboard/            # React + Tailwind analytics dashboard
    └── src/
        └── App.jsx
```

## API Endpoints (Proxy Server)

| Method | Endpoint      | Description                                    |
|--------|---------------|-------------------------------------------------|
| GET    | `/<any-path>` | Proxies to origin, caches response, sets X-Cache header |
| GET    | `/api/stats`  | Returns hits, misses, total requests, hit ratio |
| POST   | `/api/purge`  | Clears all cached assets and resets stats       |

## Running Locally

**Prerequisites:** Node.js, and a Redis-compatible server running on `localhost:6379`
(Redis via Docker, or [Memurai](https://www.memurai.com/get-memurai) on Windows).

1. **Start the origin server**
   ```bash
   cd origin-server
   npm install
   node server.js
   # → http://localhost:4000
   ```

2. **Start the proxy server** (in a new terminal)
   ```bash
   cd proxy-server
   npm install
   node server.js
   # → http://localhost:5000
   ```

3. **Start the dashboard** (in a new terminal)
   ```bash
   cd dashboard
   npm install
   npm run dev
   # → http://localhost:5173
   ```

4. Open `http://localhost:5173` and generate traffic by requesting an asset through the
   proxy, e.g. `curl http://localhost:5000/sample.txt` — watch the dashboard update live.

## Key Design Decisions

- **60-second TTL**: short enough to demo cache expiry within a reasonable testing
  window; a real CDN would tune this per asset type (e.g. hours/days for images,
  seconds for API responses).
- **Route ordering in Express**: specific routes (`/api/stats`, `/api/purge`) are
  registered before the catch-all proxy route, since Express matches top-to-bottom —
  a catch-all registered first would swallow every request, including the API's own
  routes.
- **`FLUSHDB` on purge**: clears the entire Redis database for simplicity. A
  production system would purge by key pattern instead, so operational stats aren't
  lost alongside the asset cache.
- **Base64-encoded buffers in Redis**: Redis stores strings; raw binary file data
  (images, etc.) is base64-encoded before storage and decoded on retrieval, alongside
  its original `Content-Type`, so cached responses render correctly.

## Possible Extensions

- Cache invalidation by wildcard/pattern (e.g. purge only `/images/*`)
- Per-asset configurable TTLs
- Rate limiting on the proxy layer
- Multi-origin support / load balancing across origin servers