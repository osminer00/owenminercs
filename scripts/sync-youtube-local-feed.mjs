import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const CHANNEL_HANDLE = "@OwenMinerCS";
const MAX_SHORTS = 150;
const MAX_VIDEOS = 100;

const LIVESTREAM_MARKERS = [
  " live",
  "livestream",
  "live stream",
  "premiere",
  "premiering",
  "24/7",
  "stream"
];

function getRepoRoot() {
  const currentFilePath = fileURLToPath(import.meta.url);
  return resolve(dirname(currentFilePath), "..");
}

function safeNumber(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePublishedAt(entry) {
  if (entry?.timestamp) {
    const fromUnix = new Date(Number(entry.timestamp) * 1000);
    if (!Number.isNaN(fromUnix.getTime())) {
      return fromUnix.toISOString();
    }
  }
  const uploadDate = String(entry?.upload_date || "").trim();
  if (/^\d{8}$/.test(uploadDate)) {
    const iso = `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}T00:00:00.000Z`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return "";
}

function buildYouTubeUrl(entry) {
  const id = String(entry?.id || "").trim();
  if (!id) return "";
  const webpageUrl = String(entry?.webpage_url || "").trim();
  if (webpageUrl) return webpageUrl;
  const url = String(entry?.url || "").trim();
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

function isShort(entry) {
  const duration = Number(entry?.duration || 0);
  if (Number.isFinite(duration) && duration > 0 && duration <= 70) return true;
  const combined = [
    entry?.webpage_url,
    entry?.url,
    entry?.title,
    entry?.description
  ].map((value) => String(value || "").toLowerCase()).join(" ");
  return combined.includes("/shorts/") || combined.includes("#shorts");
}

function isLivestreamLike(entry) {
  const liveStatus = String(entry?.live_status || "").toLowerCase();
  if (liveStatus === "is_live" || liveStatus === "is_upcoming" || liveStatus === "was_live") {
    return true;
  }
  if (Boolean(entry?.is_live) || Boolean(entry?.was_live)) {
    return true;
  }
  const combined = [
    entry?.webpage_url,
    entry?.url,
    entry?.title,
    entry?.description
  ].map((value) => String(value || "").toLowerCase()).join(" ");
  if (combined.includes("/live/") || combined.includes("youtube.com/live/")) {
    return true;
  }
  return LIVESTREAM_MARKERS.some((marker) => combined.includes(marker));
}

function scoreContent(item) {
  const views = Math.max(0, Number(item?.viewCount || 0));
  const likes = Math.max(0, Number(item?.likeCount || 0));
  const publishedMs = Date.parse(item?.publishedAt || "");
  const ageDays = Number.isFinite(publishedMs)
    ? Math.max(0, (Date.now() - publishedMs) / (1000 * 60 * 60 * 24))
    : 365;
  const recencyBoost = Math.max(0, 60 - ageDays) / 60;
  return (Math.log10(views + 1) * 8) + (Math.log10(likes + 1) * 6) + (recencyBoost * 4);
}

function normalizeEntry(entry, sourceKind = "") {
  const id = String(entry?.id || "").trim();
  if (!id) return null;
  const source = String(sourceKind || "").toLowerCase();
  const inferredShort = isShort(entry);
  const contentType = source === "shorts"
    ? "short"
    : (source === "videos" ? "video" : (inferredShort ? "short" : "video"));
  const url = contentType === "short"
    ? `https://www.youtube.com/shorts/${encodeURIComponent(id)}`
    : (buildYouTubeUrl(entry) || `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`);
  return {
    platform: "youtube",
    contentType,
    title: String(entry?.title || "").trim() || "Untitled video",
    url,
    thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`,
    caption: String(entry?.description || "").trim(),
    publishedAt: normalizePublishedAt(entry),
    viewCount: safeNumber(entry?.view_count),
    likeCount: safeNumber(entry?.like_count),
    commentCount: safeNumber(entry?.comment_count),
    _videoId: id
  };
}

function parseJsonLines(stdout) {
  const parsedEntries = [];
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      parsedEntries.push(data);
    } catch (_error) {
      // Ignore non-JSON lines.
    }
  }
  return parsedEntries;
}

function spawnCommand(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      rejectPromise(error);
    });
    child.on("close", (code) => {
      resolvePromise({ code: Number(code || 0), stdout, stderr });
    });
  });
}

async function runYtDlp(url, maxItems = 220) {
  const args = [
    "--skip-download",
    "--dump-json",
    "--playlist-end",
    String(maxItems),
    url
  ];
  const commandCandidates = [
    { command: "yt-dlp", commandArgs: args },
    { command: "py", commandArgs: ["-m", "yt_dlp", ...args] },
    { command: "python", commandArgs: ["-m", "yt_dlp", ...args] }
  ];
  let lastErrorText = "";
  for (const candidate of commandCandidates) {
    const result = await spawnCommand(candidate.command, candidate.commandArgs);
    if (result.code === 0) {
      return parseJsonLines(result.stdout);
    }
    const stderrText = String(result.stderr || "").trim();
    if (stderrText) {
      lastErrorText = stderrText;
    }
  }
  throw new Error(
    `Could not run yt-dlp. Install it, then rerun this script. Last error: ${lastErrorText || "Unknown execution failure."}`
  );
}

function dedupeByVideoId(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = String(item?._videoId || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function sanitizeForOutput(item) {
  return {
    platform: item.platform,
    contentType: item.contentType,
    title: item.title,
    url: item.url,
    thumbnail: item.thumbnail,
    caption: item.caption,
    publishedAt: item.publishedAt,
    viewCount: item.viewCount,
    likeCount: item.likeCount,
    commentCount: item.commentCount
  };
}

async function writeJson(path, payload) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const root = getRepoRoot();
  const shortsUrl = `https://www.youtube.com/${CHANNEL_HANDLE}/shorts`;
  const videosUrl = `https://www.youtube.com/${CHANNEL_HANDLE}/videos`;
  const outShortsPath = resolve(root, "Socials/data/youtube-shorts.json");
  const outVideosPath = resolve(root, "Socials/data/youtube-videos.json");

  const [shortsRaw, videosRaw] = await Promise.all([
    runYtDlp(shortsUrl),
    runYtDlp(videosUrl)
  ]);

  const combined = [
    ...shortsRaw.map((entry) => ({ ...entry, _sourceKind: "shorts" })),
    ...videosRaw.map((entry) => ({ ...entry, _sourceKind: "videos" }))
  ]
    .map((entry) => normalizeEntry(entry, entry?._sourceKind))
    .filter(Boolean)
    .filter((entry) => !isLivestreamLike(entry));

  const deduped = dedupeByVideoId(combined);
  const shorts = deduped
    .filter((item) => item.contentType === "short")
    .sort((a, b) => scoreContent(b) - scoreContent(a))
    .slice(0, MAX_SHORTS)
    .map(sanitizeForOutput);

  const videos = deduped
    .filter((item) => item.contentType === "video")
    .sort((a, b) => scoreContent(b) - scoreContent(a))
    .slice(0, MAX_VIDEOS)
    .map(sanitizeForOutput);

  await Promise.all([
    writeJson(outShortsPath, shorts),
    writeJson(outVideosPath, videos)
  ]);

  console.log(`[youtube-local-sync] wrote ${shorts.length} shorts -> Socials/data/youtube-shorts.json`);
  console.log(`[youtube-local-sync] wrote ${videos.length} videos -> Socials/data/youtube-videos.json`);
}

main().catch((error) => {
  console.error("[youtube-local-sync] failed:", String(error?.message || error));
  process.exitCode = 1;
});
