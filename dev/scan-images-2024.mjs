import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import exifr from "exifr";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SKIP = new Set(["node_modules", ".git", "package", "mockups", "backup-pre-the-setup-2026-04-08"]);
const exts = new Set([".jpg", ".jpeg", ".JPG", ".JPEG"]);

function walk(dir, out = []) {
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		if (ent.name.startsWith(".")) continue;
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) {
			if (SKIP.has(ent.name)) continue;
			if (ent.name === "old photos") continue;
			walk(p, out);
		} else if (exts.has(path.extname(ent.name))) {
			out.push(p);
		}
	}
	return out;
}

function in2024(d) {
	if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return false;
	const y = d.getFullYear();
	return y === 2024;
}

const files = walk(root);
const hits = [];

for (const abs of files) {
	try {
		const buf = fs.readFileSync(abs);
		const exif = await exifr.parse(buf, { pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"] });
		const candidates = [exif?.DateTimeOriginal, exif?.CreateDate, exif?.ModifyDate].filter(Boolean);
		for (const c of candidates) {
			const dt = c instanceof Date ? c : new Date(c);
			if (in2024(dt)) {
				hits.push({ abs, field: "exif", date: dt.toISOString().slice(0, 10) });
				break;
			}
		}
	} catch {
		// skip corrupt
	}
}

hits.sort((a, b) => a.abs.localeCompare(b.abs));
for (const h of hits) {
	console.log(h.date, path.relative(root, h.abs).replace(/\\/g, "/"));
}

console.error("total_jpeg_scanned", files.length, "hits_2024", hits.length);
