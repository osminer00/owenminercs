import http from "node:http";
import { onRequestGet as onTwitchFeedGet, onRequestOptions as onTwitchFeedOptions } from "../functions/api/twitch-feed.js";
import { onRequestGet as onTwitchHealthGet } from "../functions/api/twitch-health.js";
import {
  onRequestPost as onTwitchRegisterPost,
  onRequest as onTwitchRegisterFallback
} from "../functions/api/twitch-register-eventsub.js";
import {
  onRequestPost as onTwitchEventsubPost,
  onRequestOptions as onTwitchEventsubOptions,
  onRequest as onTwitchEventsubFallback
} from "../functions/api/twitch-eventsub.js";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.TWITCH_LOCAL_PORT || "8789", 10);

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function copyResponseHeaders(res, response, fallbackContentType = "application/json; charset=utf-8") {
  const contentType = response.headers.get("content-type") || fallbackContentType;
  res.setHeader("content-type", contentType);
}

async function sendWorkerResponse(res, response) {
  const body = await response.text();
  copyResponseHeaders(res, response);
  res.writeHead(response.status);
  res.end(body);
}

async function handlerFor(pathname, method, request) {
  if (pathname === "/api/twitch-feed") {
    if (method === "GET") return onTwitchFeedGet({ request, env: process.env });
    if (method === "OPTIONS") return onTwitchFeedOptions({ request, env: process.env });
    return new Response(JSON.stringify({ error: "Method not allowed. Use GET." }), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  if (pathname === "/api/twitch-health") {
    if (method === "GET") return onTwitchHealthGet({ request, env: process.env });
    return new Response(JSON.stringify({ error: "Method not allowed. Use GET." }), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  if (pathname === "/api/twitch-register-eventsub") {
    if (method === "POST") return onTwitchRegisterPost({ request, env: process.env });
    return onTwitchRegisterFallback({ request, env: process.env });
  }

  if (pathname === "/api/twitch-eventsub") {
    if (method === "POST") return onTwitchEventsubPost({ request, env: process.env });
    if (method === "OPTIONS") return onTwitchEventsubOptions({ request, env: process.env });
    return onTwitchEventsubFallback({ request, env: process.env });
  }

  return new Response(JSON.stringify({ ok: false, error: "Not found." }), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (!req.url) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "Missing request URL." }));
    return;
  }

  const requestUrl = `http://${host}:${port}${req.url}`;
  const url = new URL(requestUrl);
  const method = req.method || "GET";

  try {
    const body = method === "POST" || method === "PUT" || method === "PATCH" ? await readBody(req) : undefined;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headers.set(key, value.join(", "));
      } else if (typeof value === "string") {
        headers.set(key, value);
      }
    }

    const request = new Request(requestUrl, {
      method,
      headers,
      body
    });

    const response = await handlerFor(url.pathname, method, request);
    await sendWorkerResponse(res, response);
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: false,
        error: "Local Twitch EventSub server failed.",
        detail: String(error?.message || error)
      })
    );
  }
});

server.listen(port, host, () => {
  console.log(`[twitch-local] listening on http://${host}:${port}`);
  console.log("[twitch-local] endpoints: /api/twitch-health /api/twitch-feed /api/twitch-register-eventsub /api/twitch-eventsub");
  console.log("[twitch-local] set PUBLIC_SITE_URL to your tunnel URL before registering EventSub");
});
