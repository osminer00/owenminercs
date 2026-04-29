import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const PROFILE_URL = "https://www.tiktok.com/@owenminercs";
const MAX_ITEMS = 200;

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
    if (!Number.isNaN(fromUnix.getTime())) return fromUnix.toISOString();
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

function parseJsonLines(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_err) {
        return null;
      }
    })
    .filter(Boolean);
}

function spawnCommand(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => rejectPromise(error));
    child.on("close", (code) => {
      resolvePromise({ code: Number(code || 0), stdout, stderr });
    });
  });
}

async function runYtDlp(url, maxItems = 200) {
  const args = ["--skip-download", "--dump-json", "--playlist-end", String(maxItems), url];
  const commandCandidates = [
    { command: "yt-dlp", commandArgs: args },
    { command: "py", commandArgs: ["-m", "yt_dlp", ...args] },
    { command: "python", commandArgs: ["-m", "yt_dlp", ...args] },
  ];
  let lastErrorText = "";
  for (const candidate of commandCandidates) {
    const result = await spawnCommand(candidate.command, candidate.commandArgs);
    if (result.code === 0) return parseJsonLines(result.stdout);
    const stderrText = String(result.stderr || "").trim();
    if (stderrText) lastErrorText = stderrText;
  }
  throw new Error(
    `Could not run yt-dlp. Install it, then rerun this script. Last error: ${lastErrorText || "Unknown execution failure."}`
  );
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

function normalizeTikTokEntry(entry) {
  const title = String(entry?.title || "").trim() || "TikTok post";
  const webpageUrl = String(entry?.webpage_url || "").trim();
  if (!webpageUrl) return null;
  const thumbnail = String(entry?.thumbnail || "").trim();
  const likeCount = safeNumber(entry?.like_count ?? entry?.digg_count);
  const commentCount = safeNumber(entry?.comment_count);
  const viewCount = safeNumber(entry?.view_count ?? entry?.play_count);
  const width = safeNumber(entry?.width);
  const height = safeNumber(entry?.height);
  return {
    platform: "tiktok",
    contentType: "video",
    title,
    url: webpageUrl,
    thumbnail,
    embedUrl: "",
    caption: String(entry?.description || "").trim(),
    publishedAt: normalizePublishedAt(entry),
    viewCount,
    likeCount,
    diggCount: likeCount,
    commentCount,
    mediaKind: "video",
    aspectRatio: normalizeRatio(width, height),
  };
}

async function writeJson(path, payload) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const root = getRepoRoot();
  const outPath = resolve(root, "Socials/data/tiktok-posts.json");
  const raw = await runYtDlp(PROFILE_URL, MAX_ITEMS);
  const normalized = dedupeByUrl(raw.map(normalizeTikTokEntry).filter(Boolean)).sort(
    (a, b) =>
      (Number(b.likeCount || 0) - Number(a.likeCount || 0)) ||
      (Number(b.viewCount || 0) - Number(a.viewCount || 0))
  );
  await writeJson(outPath, normalized);
  console.log(`[tiktok-local-sync] wrote ${normalized.length} posts -> Socials/data/tiktok-posts.json`);
}

main().catch((error) => {
  console.error("[tiktok-local-sync] failed:", String(error?.message || error));
  process.exitCode = 1;
});
