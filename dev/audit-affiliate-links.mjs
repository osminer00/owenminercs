import fs from 'fs';
import path from 'path';

const json = JSON.parse(fs.readFileSync('affiliate-links.json', 'utf8'));
const expected = {};
for (const [cat, prods] of Object.entries(json.products)) {
	for (const [key, p] of Object.entries(prods)) {
		const asin = p.asin?.toUpperCase();
		const am = p.links?.amazon;
		if (asin) expected[asin] = { key: `${cat}.${key}`, name: p.name, amazon: typeof am === 'string' ? am : '' };
		if (typeof am === 'string' && /\/dp\/([A-Z0-9]{10})/i.test(am)) {
			const m = am.match(/\/dp\/([A-Z0-9]{10})/i)[1].toUpperCase();
			if (asin && m !== asin) console.log('JSON MISMATCH', `${cat}.${key}`, 'asin', asin, 'url', m);
		}
	}
}

const skipDirs = new Set(['node_modules', 'backup-pre-the-setup-2026-04-08', 'mockups', 'package', '.git']);

function walk(dir, out = []) {
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		if (ent.name.startsWith('.')) continue;
		if (skipDirs.has(ent.name)) continue;
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) walk(p, out);
		else if (ent.name.endsWith('.html')) out.push(p);
	}
	return out;
}

const htmlFiles = walk('.');
const dpRe = /amazon\.com\/(?:[^"'\s]*\/)?dp\/([A-Z0-9]{10})/gi;
const issues = [];
const foundAsins = new Map();

for (const file of htmlFiles) {
	const rel = file.replace(/\\/g, '/');
	const text = fs.readFileSync(file, 'utf8');
	let m;
	dpRe.lastIndex = 0;
	while ((m = dpRe.exec(text))) {
		const asin = m[1].toUpperCase();
		if (!foundAsins.has(asin)) foundAsins.set(asin, []);
		foundAsins.get(asin).push(rel);
		if (!expected[asin] && asin !== 'B00ZB7W4QU') {
			issues.push({ type: 'unknown_asin', file: rel, asin });
		}
	}
}

for (const [cat, prods] of Object.entries(json.products)) {
	for (const [key, p] of Object.entries(prods)) {
		const pk = `${cat}.${key}`;
		const asin = (p.asin || '').toUpperCase();
		const pages = p.pages || [];
		const am = p.links?.amazon;
		for (const pg of pages) {
			const fp = pg.replace(/\\/g, '/');
			if (!fs.existsSync(fp)) {
				issues.push({ type: 'missing_page', pk, page: fp });
				continue;
			}
			const text = fs.readFileSync(fp, 'utf8');
			if (typeof am === 'string' && am && text.includes(am)) continue;
			if (asin && text.includes(asin)) continue;
			if (typeof am === 'string' && am.includes('/s?k=')) {
				const k = decodeURIComponent((am.match(/k=([^&]+)/) || [])[1] || '').replace(/\+/g, ' ');
				if (k && text.toLowerCase().includes(k.toLowerCase().slice(0, 15))) continue;
			}
			if (am === false) continue;
			issues.push({ type: 'link_missing_on_page', pk, page: fp, asin, amazon: am });
		}
	}
}

console.log('ASINs in HTML:', [...foundAsins.keys()].sort().join(', '));
console.log('Issues:', issues.length);
for (const i of issues) console.log(JSON.stringify(i));
