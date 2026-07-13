import fs from 'node:fs';
import path from 'node:path';

const roots = ['The Setup', 'PC', 'Keyboard', 'Gaming', 'Counter-Strike'];
const skipFiles = new Set(['gaming-memorabilia.html', 'austin-major.html', 'cs2-merch.html']);
const changed = [];

function walk(dir) {
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) {
			walk(p);
			continue;
		}
		if (!ent.name.endsWith('.html') || skipFiles.has(ent.name)) continue;
		let s = fs.readFileSync(p, 'utf8');
		if (!s.includes('photogallery') || !s.includes('class="photogallery"')) continue;
		const orig = s;
		s = s.replaceAll('class="photogallery"', 'class="photogallery subpage-gallery--dense"');
		if (s !== orig) {
			fs.writeFileSync(p, s);
			changed.push(p);
		}
	}
}

for (const r of roots) {
	if (fs.existsSync(r)) walk(r);
}

console.log(`${changed.length} files updated`);
for (const f of changed) console.log(f);
