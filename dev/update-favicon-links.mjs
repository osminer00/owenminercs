import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const iconBlock =
	'<link rel="icon" href="/images/logo/favicon.ico" sizes="any" />\n$1<link rel="icon" href="/images/logo/favicon-32.png" type="image/png" sizes="32x32" />\n$1<link rel="icon" href="/images/logo/favicon-16.png" type="image/png" sizes="16x16" />';

let changed = 0;

function walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === '.git') continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full);
		else if (entry.name.endsWith('.html')) updateFile(full);
	}
}

function updateFile(file) {
	let html = fs.readFileSync(file, 'utf8');
	const orig = html;

	html = html.replace(
		/^(\s*)<link rel="apple-touch-icon" href="\/images\/owenminercs-logo\.png"\s*\/?>/gm,
		'$1<link rel="apple-touch-icon" href="/images/logo/apple-touch-icon.png" />'
	);

	html = html.replace(
		/^(\s*)<link rel="icon" href="\/images\/owenminercs-logo\.png" type="image\/png"\s*\/?>/gm,
		(_, indent) => iconBlock.replace(/\$1/g, indent)
	);

	if (html !== orig) {
		fs.writeFileSync(file, html);
		changed += 1;
		console.log(path.relative(root, file));
	}
}

walk(root);
console.log(`Updated ${changed} HTML files.`);
