// proxy-server/redisClient.js
//
// Single shared Redis connection for the whole proxy server.
// We create the client here once and export it, so every other file
// (proxy logic, stats route, purge route) reuses the same connection
// instead of opening a new one each time.

const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

// The redis client emits an 'error' event on connection problems —
// if we don't listen for it, Node will crash the whole process on
// any transient Redis hiccup. Always attach an error handler.
redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

// connect() is async — we call it immediately and export a promise
// so server.js can wait for the connection before accepting requests.
const connectRedis = async () => {
  await redisClient.connect();
  console.log("Connected to Redis");
};

module.exports = { redisClient, connectRedis };