// proxy-server/server.js
//
// The reverse proxy / CDN layer. Sits in front of the origin server.
// On every GET request: check Redis first (cache-aside pattern).
// HIT  -> serve from Redis, fast.
// MISS -> fetch from origin, cache it, then serve.
//
// IMPORTANT: specific routes (/api/stats, /api/purge) are declared
// BEFORE the catch-all proxy route. Express matches routes top-to-bottom,
// first match wins -- so if the catch-all came first, it would swallow
// every request, including our own API routes.

const express = require("express");
const axios = require("axios");
const { redisClient, connectRedis } = require("./redisClient");

const app = express();
const PORT = 5000;
const ORIGIN_URL = "http://localhost:4000"; // where the real origin server lives
const CACHE_TTL_SECONDS = 60;

// --- 1. Analytics endpoint ---
app.get("/api/stats", async (req, res) => {
  const hits = parseInt((await redisClient.get("stats:hits")) || "0", 10);
  const misses = parseInt((await redisClient.get("stats:misses")) || "0", 10);
  const total = hits + misses;
  const hitRatio = total > 0 ? ((hits / total) * 100).toFixed(2) : "0.00";

  res.json({ hits, misses, total, hitRatio: `${hitRatio}%` });
});

// --- 2. Purge endpoint ---
app.post("/api/purge", async (req, res) => {
  // FLUSHDB clears everything in the current Redis database, including
  // cached assets AND the stats counters. For a portfolio demo this is
  // fine and simple; a production CDN would purge by key pattern instead
  // so stats survive a purge -- worth mentioning if asked in an interview.
  await redisClient.flushDb();
  res.json({ message: "Cache purged successfully" });
});

// --- 3. Core proxy route (catch-all, MUST be last) ---
// Matches any GET request and treats the URL path as the "asset key".
// e.g. GET /sample.txt on the proxy maps to GET /sample.txt on the origin.
app.get(/.*/, async (req, res) => {
  const assetKey = req.originalUrl; // e.g. "/sample.txt" or "/images/cat.jpg"

  try {
    // --- Check Redis for a cached entry ---
    const cached = await redisClient.get(assetKey);

    if (cached) {
      // CACHE HIT
      // We stored the buffer + content-type together as a JSON string,
      // with the buffer encoded as base64 (Redis strings are text-safe this way).
      const { contentType, data } = JSON.parse(cached);
      const buffer = Buffer.from(data, "base64");

      await redisClient.incr("stats:hits");

      res.set("X-Cache", "HIT");
      res.set("Content-Type", contentType);
      return res.send(buffer);
    }

    // --- CACHE MISS: fetch from origin ---
    const originResponse = await axios.get(`${ORIGIN_URL}${assetKey}`, {
      responseType: "arraybuffer", // get raw bytes, not text -- required for images/binaries
    });

    const buffer = Buffer.from(originResponse.data);
    const contentType = originResponse.headers["content-type"] || "application/octet-stream";

    // --- Store in Redis with TTL ---
    // We JSON-wrap {contentType, data} so we can reconstruct the right
    // headers on the next HIT. base64-encode the buffer since Redis
    // string values are stored as text.
    const cachePayload = JSON.stringify({
      contentType,
      data: buffer.toString("base64"),
    });

    await redisClient.set(assetKey, cachePayload, { EX: CACHE_TTL_SECONDS });
    await redisClient.incr("stats:misses");

    res.set("X-Cache", "MISS");
    res.set("Content-Type", contentType);
    return res.send(buffer);

  } catch (err) {
    // Origin might be down, or the asset might not exist (404 from origin)
    console.error("Proxy error:", err.message);
    return res.status(502).send("Bad Gateway: could not reach origin server");
  }
});

// --- Start server ---
const start = async () => {
  await connectRedis();
  app.listen(PORT, () => {
    console.log(`Proxy CDN server running on http://localhost:${PORT}`);
  });
};

start();