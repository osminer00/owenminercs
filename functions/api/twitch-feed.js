import {
  EVENT_LIST_KEY,
  LAST_UPDATED_KEY,
  TOTALS_HASH_KEY,
  json,
  safeJsonParse,
  upstashCommand,
  upstashPipeline
} from "./_twitch-utils";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 80;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const limit = Math.min(parsePositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);

  try {
    const [eventsRes, totalsRes] = await upstashPipeline(env, [
      ["LRANGE", EVENT_LIST_KEY, "0", String(limit - 1)],
      ["HGETALL", TOTALS_HASH_KEY]
    ]);

    const rawEvents = Array.isArray(eventsRes?.result) ? eventsRes.result : [];
    const events = rawEvents
      .map((item) => safeJsonParse(item, null))
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

    const flatTotals = Array.isArray(totalsRes?.result) ? totalsRes.result : [];
    const totals = {
      events_total: 0,
      follows_total: 0,
      subs_total: 0,
      gift_events_total: 0,
      gift_subs_total: 0,
      bits_total: 0
    };
    for (let i = 0; i < flatTotals.length; i += 2) {
      const key = flatTotals[i];
      const value = Number.parseInt(flatTotals[i + 1] || "0", 10);
      if (Object.prototype.hasOwnProperty.call(totals, key)) {
        totals[key] = Number.isFinite(value) ? value : 0;
      }
    }

    const lastUpdated = await upstashCommand(env, ["GET", LAST_UPDATED_KEY]).catch(() => null);

    return json({
      ok: true,
      events,
      totals,
      generatedAt: new Date().toISOString(),
      lastUpdated: lastUpdated || null
    });
  } catch (error) {
    return json({ error: "Failed to load Twitch feed.", detail: String(error.message || error) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response("", {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
