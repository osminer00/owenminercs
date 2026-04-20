const { json } = require("./_twitch-utils");

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function getAccessToken() {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
  const refreshToken = requireEnv("SPOTIFY_REFRESH_TOKEN");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Spotify token refresh failed (${response.status}): ${text.slice(0, 400)}`);
  }

  const data = JSON.parse(text || "{}");
  if (!data.access_token) {
    throw new Error("Spotify token response did not include an access token.");
  }

  return data.access_token;
}

function normalizeNowPlaying(payload) {
  const item = payload?.item || null;
  const album = item?.album || {};
  const artists = Array.isArray(item?.artists) ? item.artists : [];
  const images = Array.isArray(album.images) ? album.images : [];
  const largestArtwork = images[0]?.url || null;
  const spotifyUrl = item?.external_urls?.spotify || null;

  return {
    ok: true,
    isPlaying: Boolean(payload?.is_playing),
    currentlyPlayingType: payload?.currently_playing_type || null,
    track: item?.name || null,
    artist: artists.map((entry) => entry?.name).filter(Boolean).join(", ") || null,
    album: album?.name || null,
    artworkUrl: largestArtwork,
    spotifyUrl,
    progressMs: Number.isFinite(payload?.progress_ms) ? payload.progress_ms : 0,
    durationMs: Number.isFinite(item?.duration_ms) ? item.duration_ms : 0,
    jamUrl: process.env.SPOTIFY_JAM_URL || null,
    generatedAt: new Date().toISOString()
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed. Use GET." });
  }

  try {
    const accessToken = await getAccessToken();
    const market = process.env.SPOTIFY_MARKET;
    const nowPlayingUrl = market
      ? `${SPOTIFY_NOW_PLAYING_URL}?market=${encodeURIComponent(market)}`
      : SPOTIFY_NOW_PLAYING_URL;

    const response = await fetch(nowPlayingUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (response.status === 204) {
      return json(200, {
        ok: true,
        isPlaying: false,
        currentlyPlayingType: null,
        track: null,
        artist: null,
        album: null,
        artworkUrl: null,
        spotifyUrl: null,
        progressMs: 0,
        durationMs: 0,
        jamUrl: process.env.SPOTIFY_JAM_URL || null,
        generatedAt: new Date().toISOString()
      });
    }

    const text = await response.text();
    if (!response.ok) {
      return json(502, {
        error: "Spotify currently playing request failed.",
        detail: text.slice(0, 500)
      });
    }

    const payload = JSON.parse(text || "{}");
    return json(200, normalizeNowPlaying(payload));
  } catch (error) {
    return json(500, {
      error: "Failed to load Spotify now playing.",
      detail: String(error.message || error)
    });
  }
};
