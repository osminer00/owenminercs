#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_JSON = path.resolve(process.cwd(), "Garage Sale", "ebay-listings.json");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function normalizeImageUrl(url) {
  return url
    .replace(/&amp;/g, "&")
    .replace(/%7E/g, "~")
    .trim();
}

const BROWSER_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate, br",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "upgrade-insecure-requests": "1"
};

function pickImageFromHtml(html) {
  // Prefer og:image (full resolution listing photo)
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og) return normalizeImageUrl(og[1]);

  const matches = html.match(/https?:\/\/i\.ebayimg\.com[^"'\\\s<>]+/gi) || [];
  return matches.map(normalizeImageUrl)[0] || "";
}

async function fetchHtml(url) {
  try {
    const response = await fetch(url, { headers: BROWSER_HEADERS });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

async function findImageForItem(title, seller, itemUrl) {
  // Try the direct item page first (works better with a real browser session)
  if (itemUrl && !itemUrl.includes("/usr/")) {
    const html = await fetchHtml(itemUrl);
    const img = pickImageFromHtml(html);
    if (img) return img;
  }

  // Fall back to search
  const query = encodeURIComponent(title);
  const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${query}&_ssn=${encodeURIComponent(seller)}`;
  const html = await fetchHtml(searchUrl);
  return pickImageFromHtml(html);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = path.resolve(String(args.file || DEFAULT_JSON));
  const text = await readFile(file, "utf8");
  const data = JSON.parse(text);
  const seller = data?.source?.seller || "owenm00";
  const items = Array.isArray(data?.items) ? data.items : [];

  let updated = 0;
  for (const item of items) {
    if (item.image) continue;
    if (!item.title) continue;
    const image = await findImageForItem(item.title, seller, item.url);
    if (image) {
      item.image = image;
      updated += 1;
    }
  }

  data.source = data.source || {};
  data.source.imageSyncAt = new Date().toISOString();
  data.source.imageSyncMethod = "search-html-enrichment";
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`Updated ${updated} image URL(s) in ${file}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
