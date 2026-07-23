// origin-server/server.js
//
// This simulates a "real" backend that's a bit slow — like a database-backed
// asset server or an under-provisioned origin in a real CDN setup.
// The 200ms delay exists purely so we can later PROVE the cache is working
// by comparing response times.

const express = require("express");
const path = require("path");

const app = express();
const PORT = 4000;

// Artificial network/processing delay middleware.
// In a real system this might be slow disk I/O, a cold database query,
// or geographic latency to a far-away origin.
const simulateSlowOrigin = (req, res, next) => {
  setTimeout(next, 200); // 200ms delay before handling the request
};

app.use(simulateSlowOrigin);

// Serve everything inside /public as static files.
// e.g. GET /images/cat.jpg -> origin-server/public/images/cat.jpg
app.use(express.static(path.join(__dirname, "public")));

// Simple root route so you can sanity-check the server is alive
app.get("/", (req, res) => {
  res.send("Origin server is running. Try /sample.txt or /images/<file>");
});

app.listen(PORT, () => {
  console.log(`Origin server (slow, 200ms delay) running on http://localhost:${PORT}`);
});