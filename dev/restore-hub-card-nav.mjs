import fs from 'node:fs';
import path from 'node:path';

const SETUP_DIR = path.resolve(import.meta.dirname, '..', 'The Setup');

for (const f of fs.readdirSync(SETUP_DIR).filter((x) => x.endsWith('.html'))) {
	const fp = path.join(SETUP_DIR, f);
	let html = fs.readFileSync(fp, 'utf8');
	const before = html;
	html = html.replace(
		/(class="keep-card")((?:(?!role="link")[\s\S])*?)(\s+data-href="(?!https?:\/\/)[^"]+")/g,
		'class="keep-card" role="link" tabindex="0"$2$3',
	);
	if (html !== before) {
		fs.writeFileSync(fp, html);
		console.log('restored nav attrs:', f);
	}
}
