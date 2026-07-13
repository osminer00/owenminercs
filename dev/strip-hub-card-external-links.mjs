import fs from "node:fs";
import path from "node:path";

const SETUP_DIR = path.resolve(import.meta.dirname, "..", "The Setup");

const HUB_FILES = fs
	.readdirSync(SETUP_DIR)
	.filter((f) => f.endsWith(".html"))
	.filter((f) => {
		const content = fs.readFileSync(path.join(SETUP_DIR, f), "utf8");
		return /class="keep-board/.test(content);
	});

function restoreCardA11y(html) {
	return html.replace(
		/<div class="keep-card" data-href="/g,
		'<div class="keep-card" role="link" tabindex="0" data-href="',
	);
}

function stripHubCardShopSuffixes(sectionHtml) {
	return sectionHtml.replace(
		/(<div class="keep-card__affiliate"><h4[^>]*>)([^<]+) <span class="b_w_link">\|[^<]*<\/span>(<\/h4><\/div>)/g,
		"$1$2$3",
	);
}

function processFile(filePath) {
	let html = fs.readFileSync(filePath, "utf8");
	const original = html;
	html = restoreCardA11y(html);
	html = html.replace(/(<div class="keep-board[^"]*"[\s\S]*?<\/div>\s*<\/section>)/g, (section) =>
		stripHubCardShopSuffixes(section),
	);
	if (html !== original) {
		fs.writeFileSync(filePath, html);
		return true;
	}
	return false;
}

let total = 0;
for (const f of HUB_FILES.sort()) {
	if (processFile(path.join(SETUP_DIR, f))) {
		console.log("updated:", f);
		total++;
	}
}
console.log(`Done. ${total} hub file(s) updated.`);
