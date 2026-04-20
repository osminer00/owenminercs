const FOLLOW_UPDATES_URL = "https://x.com/OwenMinerCS";

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function requireEnv(env, name) {
  const value = env?.[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function getTwitchAppAccessToken(env) {
  const clientId = requireEnv(env, "TWITCH_CLIENT_ID");
  const clientSecret = requireEnv(env, "TWITCH_CLIENT_SECRET");

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials"
    })
  });

  if (!response.ok) {
    throw new Error(`Unable to get Twitch access token (HTTP ${response.status}).`);
  }

  const data = await response.json().catch(() => ({}));
  if (!data.access_token) {
    throw new Error("Twitch token response missing access_token.");
  }
  return data.access_token;
}

async function detectTwitchLiveStatus(env) {
  const clientId = env?.TWITCH_CLIENT_ID;
  const clientSecret = env?.TWITCH_CLIENT_SECRET;
  const broadcasterId = env?.TWITCH_BROADCASTER_ID;
  if (!clientId || !clientSecret || !broadcasterId) return null;

  const token = await getTwitchAppAccessToken(env);
  const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(broadcasterId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": clientId
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to check Twitch stream status (HTTP ${response.status}).`);
  }

  const data = await response.json().catch(() => ({}));
  const stream = Array.isArray(data?.data) ? data.data[0] : null;
  if (!stream) return null;

  const login = stream.user_login || env?.TWITCH_CHANNEL_LOGIN || "owenminercs";
  return {
    live: true,
    platform: "Twitch",
    url: `https://www.twitch.tv/${login}`,
    title: stream.title || ""
  };
}

async function detectYouTubeLiveStatus(env) {
  const apiKey = env?.YOUTUBE_API_KEY;
  const channelId = env?.YOUTUBE_CHANNEL_ID;
  if (!apiKey || !channelId) return null;

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("channelId", channelId);
  endpoint.searchParams.set("eventType", "live");
  endpoint.searchParams.set("type", "video");
  endpoint.searchParams.set("maxResults", "1");
  endpoint.searchParams.set("key", apiKey);

  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    throw new Error(`Unable to check YouTube stream status (HTTP ${response.status}).`);
  }

  const data = await response.json().catch(() => ({}));
  const item = Array.isArray(data?.items) ? data.items[0] : null;
  const id = item?.id?.videoId;
  if (!id) return null;

  return {
    live: true,
    platform: "YouTube",
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
    title: item?.snippet?.title || ""
  };
}

function manualOverrideStatus(env) {
  const isLiveValue = String(env?.LIVE_OVERRIDE_IS_LIVE || "").toLowerCase();
  const isLive = isLiveValue === "1" || isLiveValue === "true" || isLiveValue === "yes";
  if (!isLive) return null;

  return {
    live: true,
    platform: env?.LIVE_OVERRIDE_PLATFORM || "Live",
    url: env?.LIVE_OVERRIDE_URL || FOLLOW_UPDATES_URL
  };
}

export async function onRequestGet(context) {
  const { env } = context;
  const sources = [
    { name: "manual", run: () => manualOverrideStatus(env) },
    { name: "twitch", run: () => detectTwitchLiveStatus(env) },
    { name: "youtube", run: () => detectYouTubeLiveStatus(env) }
  ];
  const errors = [];

  for (const source of sources) {
    try {
      const status = await source.run();
      if (status?.live && status?.url) {
        return json({
          live: true,
          platform: status.platform || "Live",
          url: status.url,
          title: status.title || "",
          source: source.name
        });
      }
    } catch (error) {
      errors.push({
        source: source.name,
        message: String(error?.message || error)
      });
    }
  }

  return json({
    live: false,
    platform: "",
    url: FOLLOW_UPDATES_URL,
    source: "fallback",
    errors
  });
}

export async function onRequest() {
  return json({ error: "Method not allowed. Use GET." }, 405);
}
