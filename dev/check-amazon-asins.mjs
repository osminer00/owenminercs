import fs from 'fs';
import path from 'path';

const skipDirs = new Set(['node_modules', 'backup-pre-the-setup-2026-04-08', 'mockups', 'package', '.git']);
const dpRe = /amazon\.com\/(?:[^"'\s]*\/)?dp\/([A-Z0-9]{10})/gi;

function walk(dir, out = []) {
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		if (ent.name.startsWith('.') || skipDirs.has(ent.name)) continue;
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) walk(p, out);
		else if (ent.name.endsWith('.html')) out.push(p);
	}
	return out;
}

const asins = new Set();
for (const file of walk('.')) {
	const text = fs.readFileSync(file, 'utf8');
	let m;
	dpRe.lastIndex = 0;
	while ((m = dpRe.exec(text))) asins.add(m[1].toUpperCase());
}

const results = [];
for (const asin of [...asins].sort()) {
	const url = `https://www.amazon.com/dp/${asin}`;
	try {
		const res = await fetch(url, {
			method: 'HEAD',
			redirect: 'follow',
			headers: { 'User-Agent': 'OwenMinerCS-affiliate-audit/1.0' },
		});
		const finalUrl = res.url || url;
		const finalAsin = (finalUrl.match(/\/dp\/([A-Z0-9]{10})/i) || [])[1]?.toUpperCase();
		results.push({
			asin,
			status: res.status,
			finalAsin: finalAsin || '',
			redirected: finalAsin && finalAsin !== asin,
			ok: res.status >= 200 && res.status < 400,
		});
	} catch (e) {
		results.push({ asin, status: 'error', error: e.message });
	}
	await new Promise((r) => setTimeout(r, 400));
}

console.log(JSON.stringify(results, null, 2));
const bad = results.filter((r) => !r.ok || r.redirected);
console.log('Problems:', bad.length);
for (const b of bad) console.log(b);
