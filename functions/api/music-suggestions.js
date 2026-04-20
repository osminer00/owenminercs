import { safeJsonParse, upstashCommand } from "./_twitch-utils";

const SUGGESTION_LIST_KEY = "music:suggestions:list";
const MAX_STORED_SUGGESTIONS = 250;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MIN_SUBMIT_SECONDS = 20;

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function pickClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function hashIp(ip) {
  const input = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", input);
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 24);
}

function cleanText(value, maxLen) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  return text.slice(0, maxLen);
}

function validateSuggestion(input) {
  const songTitle = cleanText(input?.songTitle, 120);
  const artistName = cleanText(input?.artistName, 120);
  const viewerName = cleanText(input?.viewerName, 60);
  const note = cleanText(input?.note, 220);
  const honeypot = cleanText(input?.website, 120);

  if (honeypot) {
    return { error: "Invalid submission." };
  }
  if (!songTitle || !artistName) {
    return { error: "Song title and artist are required." };
  }

  return {
    suggestion: {
      id: crypto.randomUUID(),
      songTitle,
      artistName,
      viewerName: viewerName || "Anonymous",
      note,
      createdAt: new Date().toISOString()
    }
  };
}

async function readSuggestions(env, limit) {
  const raw = await upstashCommand(env, ["LRANGE", SUGGESTION_LIST_KEY, "0", String(limit - 1)]);
  const list = Array.isArray(raw) ? raw : [];

  return list
    .map((entry) => safeJsonParse(entry, null))
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
}

export async function onRequestOptions() {
  return new Response("", {
    status: 204,
    headers: {
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type"
    }
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const limit = Math.min(parsePositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);

  try {
    const suggestions = await readSuggestions(env, limit);
    return json({ ok: true, suggestions, generatedAt: new Date().toISOString() });
  } catch (error) {
    return json({ error: "Failed to load song suggestions.", detail: String(error?.message || error) }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const { error, suggestion } = validateSuggestion(payload);
  if (error) {
    return json({ error }, 400);
  }

  const ip = pickClientIp(request);
  const rateKey = `music:suggestions:rate:${await hashIp(ip)}`;

  try {
    const rateResult = await upstashCommand(env, [
      "SET",
      rateKey,
      String(Date.now()),
      "NX",
      "EX",
      String(MIN_SUBMIT_SECONDS)
    ]);

    if (rateResult !== "OK") {
      return json({ error: `Please wait ${MIN_SUBMIT_SECONDS} seconds before sending another suggestion.` }, 429);
    }

    await upstashCommand(env, ["LPUSH", SUGGESTION_LIST_KEY, JSON.stringify(suggestion)]);
    await upstashCommand(env, ["LTRIM", SUGGESTION_LIST_KEY, "0", String(MAX_STORED_SUGGESTIONS - 1)]);

    return json({ ok: true, suggestion });
  } catch (submitError) {
    return json({ error: "Failed to save suggestion.", detail: String(submitError?.message || submitError) }, 500);
  }
}

export async function onRequest() {
  return json({ error: "Method not allowed. Use GET or POST." }, 405);
}
