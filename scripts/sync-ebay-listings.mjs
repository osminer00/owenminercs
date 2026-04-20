#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_USER = "owenm00";
const DEFAULT_OUT = path.resolve(process.cwd(), "Garage Sale", "ebay-listings.json");
const DEFAULT_LIMIT = 24;
const DEFAULT_PAID = path.resolve(process.cwd(), "Garage Sale", "ebay-price-paid.json");

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

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function readTag(xml, tagName) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(pattern);
  if (!match) return "";
  return decodeXml(match[1].trim());
}

function extractPrice(title, description) {
  const combined = `${title} ${description}`;
  const match = combined.match(/\$[0-9]+(?:\.[0-9]{2})?/);
  return match ? match[0] : "";
}

function extractImage(description) {
  const match = description.match(/<img[^>]+src="([^"]+)"/i);
  return match ? decodeXml(match[1]) : "";
}

function sanitizeText(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeTitle(value) {
  return String(value || "").trim().toLowerCase();
}

function parseRssItems(xml, limit) {
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return itemMatches.slice(0, limit).map((itemXml) => {
    const title = readTag(itemXml, "title");
    const link = readTag(itemXml, "link");
    const descriptionRaw = readTag(itemXml, "description");
    const pubDate = readTag(itemXml, "pubDate");

    return {
      title: sanitizeText(title),
      url: sanitizeText(link),
      price: extractPrice(title, descriptionRaw),
      image: extractImage(descriptionRaw),
      publishedAt: pubDate || ""
    };
  });
}

async function readJsonIfExists(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildPaidLookup(data) {
  const lookup = new Map();
  const entries = Array.isArray(data?.items) ? data.items : [];
  entries.forEach((item) => {
    const key = normalizeTitle(item?.title);
    const paidPrice = String(item?.paidPrice || "").trim();
    if (!key || !paidPrice) return;
    lookup.set(key, paidPrice);
  });
  return lookup;
}

function buildExistingPaidLookup(data) {
  const lookup = new Map();
  const entries = Array.isArray(data?.items) ? data.items : [];
  entries.forEach((item) => {
    const key = normalizeTitle(item?.title);
    const paidPrice = String(item?.paidPrice || "").trim();
    if (!key || !paidPrice) return;
    lookup.set(key, paidPrice);
  });
  return lookup;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const user = String(args.user || DEFAULT_USER);
  const out = path.resolve(String(args.out || DEFAULT_OUT));
  const limit = Number(args.limit || DEFAULT_LIMIT);
  const paidFile = path.resolve(String(args.paid || DEFAULT_PAID));
  const rssUrl = `https://www.ebay.com/sch/i.html?_ssn=${encodeURIComponent(user)}&rt=nc&_rss=1`;

  const response = await fetch(rssUrl, {
    headers: {
      "user-agent": "owenminercs-garage-sale-sync/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`eBay RSS request failed (${response.status})`);
  }

  const xml = await response.text();
  const items = parseRssItems(xml, Number.isFinite(limit) ? limit : DEFAULT_LIMIT);
  const [paidData, existingData] = await Promise.all([
    readJsonIfExists(paidFile),
    readJsonIfExists(out)
  ]);
  const paidByTitle = buildPaidLookup(paidData);
  const existingPaidByTitle = buildExistingPaidLookup(existingData);
  const hydratedItems = items.map((item) => {
    const key = normalizeTitle(item.title);
    const paidPrice = paidByTitle.get(key) || existingPaidByTitle.get(key) || "";
    return paidPrice ? { ...item, paidPrice } : item;
  });

  const payload = {
    source: {
      platform: "eBay",
      seller: user,
      feedUrl: rssUrl,
      syncedAt: new Date().toISOString(),
      paidPriceSource: path.basename(paidFile)
    },
    items: hydratedItems
  };

  await writeFile(out, JSON.stringify(payload, null, 2) + "\n", "utf8");
  const paidAttached = hydratedItems.filter((item) => item.paidPrice).length;
  console.log(`Synced ${hydratedItems.length} eBay listing(s) to ${out} (${paidAttached} with paidPrice)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
