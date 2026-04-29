#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_IN = path.resolve(process.cwd(), "Garage Sale", "ebay-export.json");
const DEFAULT_OUT = path.resolve(process.cwd(), "Garage Sale", "ebay-listings.json");

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

function toArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function toText(value) {
  return String(value == null ? "" : value).trim();
}

function splitImages(value) {
  if (Array.isArray(value)) {
    return value.map((x) => toText(x)).filter(Boolean);
  }
  const raw = toText(value);
  if (!raw) return [];
  return raw
    .split(/[,\n|]/g)
    .map((x) => toText(x))
    .filter(Boolean);
}

function normalizeRow(row) {
  const title = toText(row.title || row.name || row.listingTitle);
  const url = toText(row.url || row.link || row.itemUrl || row.listingUrl);
  const price = toText(row.price || row.currentPrice || row.listingPrice);
  const condition = toText(row.condition);
  const shipping = toText(row.shipping || row.shippingText);
  const publishedAt = toText(row.publishedAt || row.startTime || row.date);

  const images = [
    ...splitImages(row.images),
    ...splitImages(row.imageUrls),
    ...splitImages(row.additionalImages)
  ];
  const primary = toText(row.image || row.primaryImage || images[0] || "");
  const mergedImages = [primary, ...images].map((x) => toText(x)).filter(Boolean);
  const uniqImages = [...new Set(mergedImages)];

  const item = {
    title,
    url,
    price,
    image: uniqImages[0] || "",
    section: toText(row.section || "garage") || "garage"
  };
  if (uniqImages.length > 1) item.images = uniqImages;
  if (publishedAt) item.publishedAt = publishedAt;
  if (condition) item.condition = condition;
  if (shipping) item.shipping = shipping;
  return item;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] || "").trim();
    });
    return row;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inFile = path.resolve(String(args.in || DEFAULT_IN));
  const outFile = path.resolve(String(args.out || DEFAULT_OUT));
  const seller = toText(args.seller || "owenm00") || "owenm00";

  const raw = await readFile(inFile, "utf8");
  let rows = [];

  if (inFile.toLowerCase().endsWith(".csv")) {
    rows = parseCsv(raw);
  } else {
    const parsed = JSON.parse(raw);
    rows = toArray(parsed.items || parsed.listings || parsed);
  }

  const items = rows.map(normalizeRow).filter((item) => item.title && item.url);
  const payload = {
    source: {
      platform: "eBay",
      seller,
      feedUrl: `https://www.ebay.com/usr/${seller}`,
      syncedAt: new Date().toISOString(),
      imageSyncMethod: "import-ebay-listings-export"
    },
    items
  };

  await writeFile(outFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Imported ${items.length} listing(s) into ${outFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
