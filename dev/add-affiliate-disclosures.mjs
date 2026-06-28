import fs from 'fs';
import path from 'path';

const STANDARD =
	'Some links on this page are affiliate links. If you buy through them, Owen Miner may earn a commission at no extra cost to you. That support helps fund content on this website and social media.';
const AMAZON =
	`${STANDARD} As an Amazon Associate I earn from qualifying purchases.`;
const ALIEXPRESS =
	'Some links on this page are compensated AliExpress store links. If you buy through them, Owen Miner may earn a commission at no extra cost to you. That support helps fund content on this website and social media.';
const SHOP =
	'Direct shop checkout and eBay listings on this page complete through Stripe or eBay respectively; payment processor and marketplace terms apply.';

const OLD_PATTERNS = [
	/Affiliate links on this page cost you nothing extra but directly support content on this website and social media platforms\./gi,
	/Referral and affiliate links on this page cost you nothing extra but directly support content on this website and social media platforms\./gi,
];

const skipDirs = new Set(['node_modules', 'backup-pre-the-setup-2026-04-08', 'mockups', 'package', '.git', 'dev']);

const affiliateRe =
	/tag=owenminercs-20|pwrdesports\.aliexpress\.com|s\.click\.aliexpress\.com/i;
const amazonRe = /tag=owenminercs-20/i;
const aliexpressRe = /pwrdesports\.aliexpress\.com|s\.click\.aliexpress\.com/i;

function disclosureBlock(text) {
	return `\n\t\t\t\t<p class="affiliate-disclosure" role="note"><span class="affiliate-disclosure__label">Disclosure</span> ${text}</p>`;
}

function walk(dir, out = []) {
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		if (ent.name.startsWith('.') || skipDirs.has(ent.name)) continue;
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) walk(p, out);
		else if (ent.name.endsWith('.html')) out.push(p);
	}
	return out;
}

function pickCopy(rel, html = '') {
	if (/Garage Sale\/garage-sale\.html$/i.test(rel)) return SHOP;
	if (/Gaming\/(cs2-merch|gaming)\.html$/i.test(rel)) return ALIEXPRESS;
	if (amazonRe.test(html)) return AMAZON;
	if (aliexpressRe.test(html)) return ALIEXPRESS;
	return STANDARD;
}

function removeOldTopDisclosures(html) {
	html = html.replace(
		/\s*<p[^>]*>\s*<strong>Disclosure:<\/strong>\s*<i>This page includes Amazon shopping links tagged with my Amazon Associates ID\. As an Amazon Associate I earn from qualifying purchases\.<\/i>\s*<\/p>/gi,
		''
	);
	html = html.replace(/\s*<h5 id="Disclosure" class="Disclosure"[\s\S]*?<\/h5>/gi, '');
	return html;
}

function removeTheSetupDisclosurePanel(html) {
	return html.replace(
		/\s*<div\s+class="jungle-hub__readable-panel"[\s\S]*?<h5 id="Disclosure"[\s\S]*?<\/h5>\s*<\/div>/i,
		''
	);
}

function syncExistingDisclosure(html, rel) {
	const copy = pickCopy(rel, html);
	const block = disclosureBlock(copy).trim();
	const re = /<p class="affiliate-disclosure" role="note">[\s\S]*?<\/p>/i;
	if (!re.test(html)) return { html, changed: false };
	const next = html.replace(re, block);
	return { html: next, changed: next !== html };
}

function insertDisclosure(html, rel) {
	const copy = pickCopy(rel, html);
	const block = disclosureBlock(copy);

	if (html.includes('class="pc-build-lede"')) {
		const next = html.replace(/(<p class="pc-build-lede">[\s\S]*?<\/p>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (html.includes('class="setup-detail__back"')) {
		const next = html.replace(/(<p class="setup-detail__back">[\s\S]*?<\/p>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Gaming/gaming.html')) {
		const next = html.replace(/(<p class="gaming-hub__lede">[\s\S]*?<\/p>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Gaming/cs2-merch.html')) {
		const next = html.replace(/(<p class="setup-detail__back">[\s\S]*?<\/p>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Garage Sale/garage-sale.html')) {
		const next = html.replace(/(<p class="garage-sale-intro-direct-note">[\s\S]*?<\/p>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('The Setup/the-setup.html')) {
		html = removeTheSetupDisclosurePanel(html);
		const next = html.replace(/(<p class="jungle-hub__intro-lede"[\s\S]*?<\/p>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Keyboard/60he.html')) {
		const next = html.replace(
			/(<p style="text-align:left; padding: 0 0\.75rem 0\.5rem; max-width: 42rem; margin: 0 auto; font-size: 0\.95rem;">[\s\S]*?<\/p>)/,
			`$1${block}`
		);
		if (next !== html) return { html: next, changed: true };
	}

	if (/Keyboard\/60he-20(23|25)\.html$/i.test(rel)) {
		html = removeOldTopDisclosures(html);
		const next = html.replace(/(<h3>[\s\S]*?<\/h3>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Desk Setup/setup.html')) {
		const next = html.replace(/(<div class="intro">)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('The Setup/gaming-pc.html')) {
		const next = html.replace(/(<p style="margin: 0 0 0\.75rem">[\s\S]*?<\/p>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Upgrades/upgrades.html')) {
		html = removeOldTopDisclosures(html);
		const next = html.replace(
			/(<p style="text-align: left; padding: 0 0\.75rem 0\.5rem; max-width: 42rem; margin: 0 auto">[\s\S]*?<\/p>)/,
			`$1${block}`
		);
		if (next !== html) return { html: next, changed: true };
	}

	if (html.includes('<div class="intro"')) {
		const next = html.replace(/(<div class="intro">)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	return { html, changed: false };
}

const changed = [];
const skipped = [];

for (const file of walk('.')) {
	const rel = file.replace(/\\/g, '/').replace(/^\.\//, '');
	let raw = fs.readFileSync(file, 'utf8');
	if (!affiliateRe.test(raw) && !/class="affiliate-disclosure"/i.test(raw)) continue;

	let did = false;

	if (/class="affiliate-disclosure"/i.test(raw)) {
		const synced = syncExistingDisclosure(raw, rel);
		if (synced.changed) {
			raw = synced.html;
			did = true;
		}
	} else {
		const inserted = insertDisclosure(raw, rel);
		if (inserted.changed) {
			raw = inserted.html;
			did = true;
		}
	}

	if (did) {
		fs.writeFileSync(file, raw, 'utf8');
		changed.push(rel);
	} else if (!/class="affiliate-disclosure"/i.test(raw)) {
		skipped.push(rel);
	}
}

console.log('Updated', changed.length, 'files');
changed.forEach((f) => console.log(' +', f));
if (skipped.length) {
	console.log('Skipped (no insertion point)', skipped.length);
	skipped.forEach((f) => console.log(' ?', f));
}
