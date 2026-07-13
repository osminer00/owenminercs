import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rawPath = resolve(root, "dev/tiktok-recent-raw.jsonl");
const outPath = resolve(root, "Socials/data/tiktok-posts.json");

function safeNumber(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePublishedAt(entry) {
  if (entry?.timestamp) {
    const fromUnix = new Date(Number(entry.timestamp) * 1000);
    if (!Number.isNaN(fromUnix.getTime())) return fromUnix.toISOString();
  }
  const upload = String(entry?.upload_date || "").trim();
  if (/^\d{8}$/.test(upload)) {
    const y = upload.slice(0, 4);
    const m = upload.slice(4, 6);
    const d = upload.slice(6, 8);
    return new Date(`${y}-${m}-${d}T12:00:00.000Z`).toISOString();
  }
  return "";
}

function normalizeRatio(width, height, fallback = "9 / 16") {
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return `${Math.round(w)} / ${Math.round(h)}`;
  }
  return fallback;
}

function normalizeTikTokEntry(entry) {
  const title = String(entry?.title || "").trim() || "TikTok post";
  const webpageUrl = String(entry?.webpage_url || "").trim();
  if (!webpageUrl) return null;
  const likeCount = safeNumber(entry?.like_count ?? entry?.digg_count);
  return {
    platform: "tiktok",
    contentType: "video",
    title,
    url: webpageUrl,
    thumbnail: String(entry?.thumbnail || "").trim(),
    embedUrl: "",
    caption: String(entry?.description || "").trim(),
    publishedAt: normalizePublishedAt(entry),
    viewCount: safeNumber(entry?.view_count ?? entry?.play_count),
    likeCount,
    diggCount: likeCount,
    commentCount: safeNumber(entry?.comment_count),
    mediaKind: "video",
    aspectRatio: normalizeRatio(entry?.width, entry?.height),
  };
}

function dedupeByUrl(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item?.url || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

const rawBytes = readFileSync(rawPath);
const text = rawBytes.toString(rawBytes[0] === 0xff && rawBytes[1] === 0xfe ? "utf16le" : "utf8");
const recent = text
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .map(normalizeTikTokEntry)
  .filter(Boolean);

const existing = JSON.parse(readFileSync(outPath, "utf8"));
const merged = dedupeByUrl([...recent, ...existing]).sort((a, b) => {
  const likeDelta = Number(b.likeCount || 0) - Number(a.likeCount || 0);
  if (likeDelta !== 0) return likeDelta;
  const viewDelta = Number(b.viewCount || 0) - Number(a.viewCount || 0);
  if (viewDelta !== 0) return viewDelta;
  return Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0);
});

writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(`[merge-tiktok-recent] merged ${recent.length} recent -> ${merged.length} total in ${outPath}`);
console.log("[merge-tiktok-recent] run: node dev/cache-social-thumbnails.mjs");
