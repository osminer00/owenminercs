#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TARGET_JSON = path.resolve(process.cwd(), "Garage Sale", "ebay-listings.json");

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

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceFile = args.source ? path.resolve(String(args.source)) : "";
  if (!sourceFile) {
    throw new Error("Missing required --source <file> argument.");
  }

  const [targetText, sourceText] = await Promise.all([
    readFile(TARGET_JSON, "utf8"),
    readFile(sourceFile, "utf8")
  ]);

  const target = JSON.parse(targetText);
  const source = JSON.parse(sourceText);
  const sourceItems = Array.isArray(source) ? source : source.items;
  if (!Array.isArray(sourceItems)) {
    throw new Error("Source JSON must be an array or { items: [] }.");
  }

  const byTitle = new Map();
  sourceItems.forEach((item) => {
    const title = normalize(item.title);
    const image = String(item.image || item.imageUrl || "").trim();
    if (title && image) byTitle.set(title, image);
  });

  let updated = 0;
  (target.items || []).forEach((item) => {
    const key = normalize(item.title);
    const image = byTitle.get(key);
    if (image && !item.image) {
      item.image = image;
      updated += 1;
    }
  });

  target.source = target.source || {};
  target.source.imageMergeAt = new Date().toISOString();
  await writeFile(TARGET_JSON, JSON.stringify(target, null, 2) + "\n", "utf8");
  console.log(`Merged ${updated} image(s) into ${TARGET_JSON}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
