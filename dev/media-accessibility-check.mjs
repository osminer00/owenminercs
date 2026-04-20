#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const TARGET_HTML_FILES = [
  'The Setup/the-setup.html',
  'Desk Setup/setup.html',
  'Photography/photography.html'
];

function parseArgs(argv) {
  const opts = {
    failOnReview: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fail-on-review') {
      opts.failOnReview = true;
    }
  }
  return opts;
}

function cleanText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function clipText(value, maxLen) {
  const text = cleanText(value);
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).replace(/[,\s-]+$/, '') + '.';
}

function isWeakAlt(alt) {
  const t = cleanText(alt).toLowerCase();
  if (!t) return true;
  if (t.length < 8) return true;
  return /^(image|photo|picture|untitled|img|setup)$/i.test(t);
}

function decodeHtmlEntity(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(html) {
  return cleanText(decodeHtmlEntity(String(html).replace(/<[^>]*>/g, ' ')));
}

function pathToWords(src) {
  const normalized = cleanText(src).split('?')[0];
  if (!normalized) return '';
  let part = normalized.split('/').pop() || '';
  part = part.replace(/\.[a-z0-9]+$/i, '');
  part = part.replace(/[_-]+/g, ' ');
  part = part.replace(/\b(img|image|photo|dsc|pxl)\b/gi, '');
  return cleanText(part);
}

function buildAltText({ existingAlt, title, context, src }) {
  const current = cleanText(existingAlt);
  if (!isWeakAlt(current)) return clipText(current, 160);

  const t = cleanText(title);
  const c = cleanText(context);
  const p = pathToWords(src);
  let subject = t || c || p || 'setup photo';

  if (t && c && !c.toLowerCase().includes(t.toLowerCase())) {
    subject = `${t} in ${c}`;
  } else if (!t && c) {
    subject = c;
  }

  return clipText(subject, 160);
}

function buildCaption({ caption, title, alt }) {
  const explicit = cleanText(caption);
  if (explicit) return clipText(explicit, 92);
  return clipText(title || alt || 'Setup photo', 92);
}

function extractAttr(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const m = tag.match(pattern);
  if (!m) return '';
  return m[2] ?? m[3] ?? '';
}

function hasClass(tag, className) {
  const classAttr = extractAttr(tag, 'class');
  if (!classAttr) return false;
  return classAttr.split(/\s+/).includes(className);
}

function nearestHeading(html, index) {
  const slice = html.slice(Math.max(0, index - 1800), index);
  const headingRegex = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  let match = null;
  let latest = null;
  while ((match = headingRegex.exec(slice)) !== null) {
    latest = match[1];
  }
  return latest ? stripTags(latest) : '';
}

function lineFromIndex(text, idx) {
  return text.slice(0, idx).split('\n').length;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function collectPhotoEntries() {
  const rel = 'Photography/photos.json';
  const abs = path.resolve(ROOT, rel);
  const data = await readJson(abs);
  const years = Array.isArray(data.years) ? data.years : [];
  const rows = [];

  for (const y of years) {
    const photos = Array.isArray(y.photos) ? y.photos : [];
    for (const photo of photos) {
      const suggestedAlt = buildAltText({
        existingAlt: photo.alt,
        title: photo.title,
        context: y.year ? `Owen Miner photo from ${y.year}` : 'Owen Miner photo',
        src: photo.full || photo.thumb
      });
      const suggestedCaption = buildCaption({
        caption: photo.caption,
        title: photo.title,
        alt: suggestedAlt
      });
      rows.push({
        scope: rel,
        item: cleanText(photo.title) || cleanText(photo.full) || cleanText(photo.thumb) || 'Untitled photo',
        status: isWeakAlt(photo.alt) ? 'REVIEW' : 'OK',
        currentAlt: cleanText(photo.alt),
        suggestedAlt,
        suggestedCaption
      });
    }
  }
  return rows;
}

async function collectHtmlImages() {
  const rows = [];

  for (const rel of TARGET_HTML_FILES) {
    const abs = path.resolve(ROOT, rel);
    let html;
    try {
      html = await fs.readFile(abs, 'utf8');
    } catch {
      continue;
    }

    const imgRegex = /<img\b[^>]*>/gi;
    let match = null;
    while ((match = imgRegex.exec(html)) !== null) {
      const tag = match[0];
      const src = extractAttr(tag, 'src');
      const alt = extractAttr(tag, 'alt');
      const id = extractAttr(tag, 'id');
      if (id === 'photo-dialog-img') continue;
      if (!src) continue;
      if (hasClass(tag, 'site-logo')) continue;
      const heading = nearestHeading(html, match.index);
      const line = lineFromIndex(html, match.index);
      const suggestedAlt = buildAltText({
        existingAlt: alt,
        title: '',
        context: heading || 'Owen Miner setup',
        src
      });
      const suggestedCaption = buildCaption({
        title: heading,
        alt: suggestedAlt
      });

      rows.push({
        scope: rel,
        item: `${src || 'inline image'} (line ${line})`,
        status: isWeakAlt(alt) ? 'REVIEW' : 'OK',
        currentAlt: cleanText(alt),
        suggestedAlt,
        suggestedCaption
      });
    }
  }

  return rows;
}

function printRows(rows) {
  if (!rows.length) {
    console.log('No matching media entries found.');
    return;
  }

  for (const row of rows) {
    console.log(`\n[${row.status}] ${row.scope}`);
    console.log(`- Item: ${row.item}`);
    console.log(`- Current alt: ${row.currentAlt || '(empty)'}`);
    console.log(`- Suggested alt: ${row.suggestedAlt || '(empty)'}`);
    console.log(`- Suggested caption: ${row.suggestedCaption || '(empty)'}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const photoRows = await collectPhotoEntries();
  const htmlRows = await collectHtmlImages();
  const rows = [...photoRows, ...htmlRows];

  const reviewCount = rows.filter((r) => r.status === 'REVIEW').length;
  const okCount = rows.length - reviewCount;

  console.log('=== Media Accessibility Preview ===');
  console.log(`Total checked: ${rows.length}`);
  console.log(`Needs review: ${reviewCount}`);
  console.log(`Already OK: ${okCount}`);

  printRows(rows);

  if (opts.failOnReview && reviewCount > 0) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
