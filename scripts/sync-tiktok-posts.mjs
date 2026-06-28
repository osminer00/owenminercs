import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const PROFILE_URL = "https://www.tiktok.com/@owenminercs";
const MAX_ITEMS = 200;
const RAW_JSONL_PATH = "dev/tiktok-recent-raw.jsonl";
const MERGE_SCRIPT_PATH = "dev/merge-tiktok-recent.mjs";

const YT_DLP_BASE_ARGS = [
  "--no-update",
  "--ignore-errors",
  "--skip-download",
  "--dump-json",
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

function buildYtDlpArgProfiles(maxItems) {
  const playlistArgs = ["--playlist-end", String(maxItems), PROFILE_URL];
  return [
    [...YT_DLP_BASE_ARGS, ...playlistArgs],
    [
      ...YT_DLP_BASE_ARGS,
      '--extractor-args',
      'tiktok:api_hostname=api16-normal-useast5.us.tiktokv.com',
      ...playlistArgs,
    ],
  ];
}

async function runYtDlp(maxItems = 200) {
  const commandCandidates = [
    { command: "yt-dlp", module: null },
    { command: "py", module: "yt_dlp" },
    { command: "python", module: "yt_dlp" },
  ];
  let lastErrorText = "";

  for (const argProfile of buildYtDlpArgProfiles(maxItems)) {
    for (const candidate of commandCandidates) {
      const commandArgs = candidate.module ? ["-m", candidate.module, ...argProfile] : argProfile;
      const result = await spawnCommand(candidate.command, commandArgs);
      const entries = parseJsonLines(result.stdout);
      if (entries.length > 0) {
        if (result.code !== 0) {
          console.warn(
            `[tiktok-local-sync] yt-dlp exited ${result.code} but returned ${entries.length} JSON line(s); using partial results.`
          );
        }
        return entries;
      }
      const stderrText = String(result.stderr || "").trim();
      if (stderrText) lastErrorText = stderrText;
    }
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

function sortTikTokPosts(items) {
  return [...items].sort(
    (a, b) =>
      Number(b.likeCount || 0) - Number(a.likeCount || 0) ||
      Number(b.viewCount || 0) - Number(a.viewCount || 0)
  );
}

async function writeJson(path, payload) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readExistingPosts(path) {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch (_err) {
    return false;
  }
}

async function runMergeFallback(root) {
  const mergeScript = resolve(root, MERGE_SCRIPT_PATH);
  const rawJsonl = resolve(root, RAW_JSONL_PATH);
  if (!(await pathExists(rawJsonl))) {
    return false;
  }
  if (!(await pathExists(mergeScript))) {
    return false;
  }

  const result = await spawnCommand(process.execPath, [mergeScript]);
  if (result.code !== 0) {
    throw new Error(
      `merge fallback failed (${MERGE_SCRIPT_PATH}): ${String(result.stderr || result.stdout || "Unknown error").trim()}`
    );
  }
  console.log(`[tiktok-local-sync] used merge fallback -> ${RAW_JSONL_PATH}`);
  return true;
}

async function main() {
  const root = getRepoRoot();
  const outPath = resolve(root, "Socials/data/tiktok-posts.json");
  const existing = await readExistingPosts(outPath);

  try {
    const raw = await runYtDlp(MAX_ITEMS);
    const normalized = sortTikTokPosts(
      dedupeByUrl(raw.map(normalizeTikTokEntry).filter(Boolean))
    );
    if (normalized.length === 0 && existing.length > 0) {
      console.error(
        `[tiktok-local-sync] yt-dlp returned 0 posts; preserving ${existing.length} existing post(s).`
      );
      console.error(
        `[tiktok-local-sync] Fallback: dump recent posts to ${RAW_JSONL_PATH}, then run node ${MERGE_SCRIPT_PATH}`
      );
      process.exitCode = 1;
      return;
    }
    await writeJson(outPath, normalized);
    console.log(`[tiktok-local-sync] wrote ${normalized.length} posts -> Socials/data/tiktok-posts.json`);
  } catch (error) {
    if (await runMergeFallback(root)) {
      return;
    }
    if (existing.length > 0) {
      console.error("[tiktok-local-sync] failed:", String(error?.message || error));
      console.error(
        `[tiktok-local-sync] preserving ${existing.length} existing post(s) in Socials/data/tiktok-posts.json`
      );
      console.error(
        `[tiktok-local-sync] optional fallback: py -m yt_dlp ${YT_DLP_BASE_ARGS.join(" ")} --playlist-end N ${PROFILE_URL} > ${RAW_JSONL_PATH} && node ${MERGE_SCRIPT_PATH}`
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error("[tiktok-local-sync] failed:", String(error?.message || error));
  process.exitCode = 1;
});
