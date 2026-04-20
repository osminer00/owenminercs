const DEFAULT_LIMIT = 60
const MAX_LIMIT = 200
const CACHE_TTL_SECONDS = 15 * 60
const STALE_TTL_SECONDS = 24 * 60 * 60

const inMemoryCache = {
  freshUntilMs: 0,
  lastSuccessMs: 0,
  payload: null
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=60, s-maxage=${CACHE_TTL_SECONDS}`,
      ...extraHeaders
    }
  })
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}

function truncateText(value, maxLen) {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ")
  if (!cleaned) return ""
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned
}

function parseIsoDurationToSeconds(durationIso) {
  if (!durationIso || typeof durationIso !== "string") return null
  const match = durationIso.match(/^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/)
  if (!match) return null
  const hours = Number.parseInt(match[1] || "0", 10)
  const minutes = Number.parseInt(match[2] || "0", 10)
  const seconds = Number.parseInt(match[3] || "0", 10)
  return (hours * 3600) + (minutes * 60) + seconds
}

function makeYouTubeCard(video) {
  const durationSeconds = Number.isFinite(video.durationSeconds) ? video.durationSeconds : null
  const contentType = durationSeconds !== null && durationSeconds <= 70 ? "short" : "video"
  const videoId = String(video.videoId || "").trim()
  if (!videoId) return null

  const title = truncateText(video.title, 120)
  const description = truncateText(video.description, 260)
  const thumbnailUrl = String(video.thumbnailUrl || "").trim()
  const publishedAt = String(video.publishedAt || "").trim()
  const viewCount = Number.parseInt(String(video.viewCount || "0"), 10)
  const likeCount = Number.parseInt(String(video.likeCount || "0"), 10)
  const commentCount = Number.parseInt(String(video.commentCount || "0"), 10)
  const liveBroadcastContent = String(video.liveBroadcastContent || "").toLowerCase()
  const isLive = liveBroadcastContent === "live" || liveBroadcastContent === "upcoming" || Boolean(video.liveStreamingDetails)

  return {
    id: `youtube_${videoId}`,
    platform: "youtube",
    contentType,
    title: title || "Untitled video",
    description,
    publishedAt: publishedAt || new Date().toISOString(),
    permalink: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    media: {
      kind: "embed",
      thumbnailUrl,
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`,
      aspectRatio: "16:9"
    },
    metrics: {
      viewCount: Number.isFinite(viewCount) ? viewCount : 0,
      likeCount: Number.isFinite(likeCount) ? likeCount : 0,
      commentCount: Number.isFinite(commentCount) ? commentCount : 0
    },
    isLive
  }
}

function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i")
  const match = xml.match(regex)
  if (!match || !match[1]) return ""
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim()
}

function extractAttribute(xml, tagName, attrName) {
  const regex = new RegExp(`<${tagName}[^>]*\\s${attrName}="([^"]+)"[^>]*>`, "i")
  const match = xml.match(regex)
  return match?.[1] ? match[1].trim() : ""
}

function parseYouTubeFeedXml(xmlText, limit) {
  const entryMatches = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || []
  const cards = []

  for (const entry of entryMatches) {
    if (cards.length >= limit) break
    const videoId = extractTag(entry, "yt:videoId")
    if (!videoId) continue
    const card = makeYouTubeCard({
      videoId,
      title: extractTag(entry, "title"),
      description: extractTag(entry, "media:description"),
      publishedAt: extractTag(entry, "published"),
      thumbnailUrl: extractAttribute(entry, "media:thumbnail", "url"),
      durationSeconds: null
    })
    if (card) cards.push(card)
  }

  return cards
}

async function fetchYouTubeViaDataApi(apiKey, channelId, limit) {
  const targetCount = Math.min(Math.max(limit, 1), MAX_LIMIT)
  const videoIds = []
  const seenIds = new Set()
  let pageToken = ""

  while (videoIds.length < targetCount) {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search")
    searchUrl.searchParams.set("part", "snippet")
    searchUrl.searchParams.set("channelId", channelId)
    searchUrl.searchParams.set("type", "video")
    searchUrl.searchParams.set("order", "date")
    searchUrl.searchParams.set("maxResults", String(Math.min(50, targetCount)))
    searchUrl.searchParams.set("key", apiKey)
    if (pageToken) {
      searchUrl.searchParams.set("pageToken", pageToken)
    }

    const searchResponse = await fetch(searchUrl.toString())
    if (!searchResponse.ok) {
      const body = await searchResponse.text()
      throw new Error(`YouTube search failed (${searchResponse.status}): ${body.slice(0, 220)}`)
    }

    const searchPayload = await searchResponse.json().catch(() => ({}))
    const searchItems = Array.isArray(searchPayload?.items) ? searchPayload.items : []
    for (const entry of searchItems) {
      const id = String(entry?.id?.videoId || "").trim()
      if (!id || seenIds.has(id)) continue
      seenIds.add(id)
      videoIds.push(id)
      if (videoIds.length >= targetCount) break
    }

    pageToken = String(searchPayload?.nextPageToken || "").trim()
    if (!pageToken || !searchItems.length) break
  }
  if (!videoIds.length) return []

  const videos = []
  for (let index = 0; index < videoIds.length; index += 50) {
    const idChunk = videoIds.slice(index, index + 50)
    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos")
    videosUrl.searchParams.set("part", "snippet,contentDetails,statistics,liveStreamingDetails")
    videosUrl.searchParams.set("id", idChunk.join(","))
    videosUrl.searchParams.set("key", apiKey)

    const videosResponse = await fetch(videosUrl.toString())
    if (!videosResponse.ok) {
      const body = await videosResponse.text()
      throw new Error(`YouTube videos lookup failed (${videosResponse.status}): ${body.slice(0, 220)}`)
    }

    const videosPayload = await videosResponse.json().catch(() => ({}))
    const chunkItems = Array.isArray(videosPayload?.items) ? videosPayload.items : []
    videos.push(...chunkItems)
  }

  const normalized = videos
    .map((item) => makeYouTubeCard({
      videoId: item?.id,
      title: item?.snippet?.title,
      description: item?.snippet?.description,
      publishedAt: item?.snippet?.publishedAt,
      thumbnailUrl:
        item?.snippet?.thumbnails?.maxres?.url ||
        item?.snippet?.thumbnails?.high?.url ||
        item?.snippet?.thumbnails?.medium?.url ||
        item?.snippet?.thumbnails?.default?.url ||
        "",
      durationSeconds: parseIsoDurationToSeconds(item?.contentDetails?.duration),
      viewCount: item?.statistics?.viewCount,
      likeCount: item?.statistics?.likeCount,
      commentCount: item?.statistics?.commentCount,
      liveBroadcastContent: item?.snippet?.liveBroadcastContent,
      liveStreamingDetails: item?.liveStreamingDetails
    }))
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))

  return normalized.slice(0, limit)
}

async function resolveChannelIdFromHandle(handleOrUsername) {
  const cleaned = String(handleOrUsername || "").replace(/^@/, "").trim()
  if (!cleaned) return ""
  const handleUrl = `https://www.youtube.com/@${encodeURIComponent(cleaned)}`
  const response = await fetch(handleUrl, {
    headers: {
      "user-agent": "Mozilla/5.0"
    }
  })
  if (!response.ok) {
    throw new Error(`Unable to resolve channel handle (HTTP ${response.status}).`)
  }
  const html = await response.text()
  const match = html.match(/UC[a-zA-Z0-9_-]{20,}/)
  return match?.[0] || ""
}

async function fetchYouTubeViaRss(channelId, username, limit) {
  let resolvedChannelId = String(channelId || "").trim()
  if (!resolvedChannelId) {
    resolvedChannelId = await resolveChannelIdFromHandle(username)
  }
  if (!resolvedChannelId) {
    throw new Error("Could not resolve YouTube channel ID.")
  }
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(resolvedChannelId)}`
  const response = await fetch(rssUrl)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`YouTube RSS failed (${response.status}): ${body.slice(0, 220)}`)
  }
  const xmlText = await response.text()
  return parseYouTubeFeedXml(xmlText, limit)
}

async function getFeedPayload(env, limit) {
  const channelId = String(env?.YOUTUBE_CHANNEL_ID || "").trim()
  const youtubeUsername = String(env?.YOUTUBE_USERNAME || env?.YOUTUBE_HANDLE || "OwenMinerCS").replace(/^@/, "").trim()

  const apiKey = String(env?.YOUTUBE_API_KEY || "").trim()
  const usingDataApi = Boolean(apiKey)

  let items = []
  let source = ""
  let warnings = []

  if (usingDataApi) {
    if (!channelId) {
      warnings.push("YOUTUBE_CHANNEL_ID is not set, skipping Data API and using RSS.")
    } else {
    try {
      items = await fetchYouTubeViaDataApi(apiKey, channelId, limit)
      source = "youtube-data-api"
    } catch (error) {
      warnings.push(`Data API failed, falling back to RSS: ${String(error?.message || error)}`)
    }
    }
  }

  if (!items.length) {
    items = await fetchYouTubeViaRss(channelId, youtubeUsername, limit)
    source = usingDataApi ? "youtube-rss-fallback" : "youtube-rss"
  }

  if (!items.length) {
    throw new Error("No YouTube items were returned.")
  }

  return {
    ok: true,
    source,
    generatedAt: new Date().toISOString(),
    items,
    warnings
  }
}

function getCachedPayload() {
  if (!inMemoryCache.payload) return null
  return inMemoryCache.payload
}

function updateCache(payload) {
  const nowMs = Date.now()
  inMemoryCache.payload = payload
  inMemoryCache.lastSuccessMs = nowMs
  inMemoryCache.freshUntilMs = nowMs + (CACHE_TTL_SECONDS * 1000)
}

export async function onRequestGet(context) {
  const { request, env } = context
  const nowMs = Date.now()
  const url = new URL(request.url)
  const limit = Math.min(parsePositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT)
  const forceRefresh = url.searchParams.get("refresh") === "1"

  const cached = getCachedPayload()
  if (!forceRefresh && cached && nowMs < inMemoryCache.freshUntilMs) {
    return json({
      ...cached,
      cache: {
        hit: true,
        stale: false,
        ageSeconds: Math.floor((nowMs - inMemoryCache.lastSuccessMs) / 1000)
      }
    })
  }

  try {
    const payload = await getFeedPayload(env, limit)
    updateCache(payload)
    return json({
      ...payload,
      cache: {
        hit: false,
        stale: false,
        ageSeconds: 0
      }
    })
  } catch (error) {
    const staleAgeSeconds = Math.floor((nowMs - inMemoryCache.lastSuccessMs) / 1000)
    if (cached && staleAgeSeconds <= STALE_TTL_SECONDS) {
      return json({
        ...cached,
        cache: {
          hit: true,
          stale: true,
          ageSeconds: staleAgeSeconds
        },
        warnings: [
          ...(Array.isArray(cached.warnings) ? cached.warnings : []),
          `Returned stale feed after refresh failure: ${String(error?.message || error)}`
        ]
      })
    }

    return json(
      {
        ok: false,
        error: "Failed to load social feed.",
        detail: String(error?.message || error),
        generatedAt: new Date().toISOString(),
        items: []
      },
      500
    )
  }
}

export async function onRequest() {
  return json({ error: "Method not allowed. Use GET." }, 405)
}
