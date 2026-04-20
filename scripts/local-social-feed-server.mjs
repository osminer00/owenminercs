import http from "node:http";
import { onRequestGet } from "../functions/api/social-feed.js";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.SOCIAL_FEED_PORT || "8788", 10);

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "GET" || !req.url || !req.url.startsWith("/api/social-feed")) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "Not found." }));
    return;
  }

  try {
    const requestUrl = `http://${host}:${port}${req.url}`;
    const response = await onRequestGet({
      request: new Request(requestUrl, { method: "GET" }),
      env: process.env
    });
    const body = await response.text();
    res.writeHead(response.status, { "content-type": "application/json; charset=utf-8" });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      ok: false,
      error: "Local social feed server failed.",
      detail: String(error?.message || error)
    }));
  }
});

server.listen(port, host, () => {
  console.log(`[social-feed-local] listening on http://${host}:${port}/api/social-feed`);
  console.log("[social-feed-local] optional env: YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID, YOUTUBE_USERNAME");
});
