import fs from 'fs';
import path from 'path';

const STANDARD =
	'Some links on this page are affiliate links. If you buy through them, Owen Miner may earn a commission at no extra cost to you. That support helps fund videos, streams, and site content. Thanks for supporting the channel.';
const AMAZON =
	'Some links on this page are affiliate links. If you buy through them, Owen Miner may earn a commission at no extra cost to you. That support helps fund videos, streams, and site content. As an Amazon Associate I earn from qualifying purchases. Thanks for supporting the channel.';
const ALIEXPRESS =
	'Some links on this page are compensated AliExpress store links. If you buy through them, Owen Miner may earn a commission at no extra cost to you. That support helps fund videos, streams, and site content. Thanks for supporting the channel.';
const SHOP =
	'Direct shop checkout and eBay listings on this page complete through Stripe or eBay respectively; payment processor and marketplace terms apply.';

const FOOTER_REPLACEMENTS = [
	[
		/This page includes Amazon shopping links tagged with my Amazon Associates ID\. As an Amazon Associate I earn from qualifying purchases through eligible links on this page\./g,
		'Amazon links on this page are part of the Amazon Associates Program and may earn commission at no extra cost to you.',
	],
	[
		/This page includes Amazon shopping links tagged with my Amazon Associates ID\. As an Amazon Associate I earn from qualifying purchases\. Other links on this page go to third-party stores \(for example Elgato, Shure, Wallhack\) and are not necessarily affiliate links\./g,
		'Amazon shopping links on this page may earn commission. Links to other stores (like Elgato or Shure) are not affiliate links unless marked.',
	],
	[
		/This page includes Amazon Associates product links\. As an Amazon Associate I earn from qualifying purchases\./g,
		'Amazon product links on this page may earn commission through the Amazon Associates Program.',
	],
	[
		/This page includes Amazon Associates search links where shown\. As an Amazon Associate I earn from qualifying purchases\./g,
		'Amazon search links on this page may earn commission through the Amazon Associates Program.',
	],
	[
		/This page includes Amazon Associates product and search links\. As an Amazon Associate I earn from qualifying purchases\./g,
		'Amazon product and search links on this page may earn commission through the Amazon Associates Program.',
	],
	[
		/This page includes Amazon Associates search links and an AliExpress store link\. As an Amazon Associate I earn from qualifying purchases\./g,
		'Amazon search links and AliExpress store links on this page may earn commission.',
	],
	[
		/This page includes Amazon Associates links\. As an Amazon Associate I earn from qualifying purchases\./g,
		'Amazon links on this page may earn commission through the Amazon Associates Program.',
	],
	[
		/As an Amazon Associate I earn from qualifying purchases\. Other links on this page go to third-party stores and are not necessarily affiliate links\./g,
		'Amazon links on this hub and linked gear pages may earn commission. Other store links are not necessarily affiliate links.',
	],
	[
		/As an Amazon Associate I earn from qualifying purchases\./g,
		'Amazon links on this page may earn commission through the Amazon Associates Program.',
	],
	[
		/This page has no paid shopping links\. Gear, Keyboard, and PC pages include Amazon Associates links\. As an Amazon Associate I earn from qualifying purchases through eligible links on those pages\./g,
		'This page has no paid shopping links. Gear, Keyboard, and PC pages may include Amazon affiliate links.',
	],
	[
		/Gear, Keyboard, and PC pages include Amazon links where Owen Miner participates in the Amazon Associates Program\. As an Amazon Associate I earn from qualifying purchases through eligible links on those pages\./g,
		'Gear, Keyboard, and PC pages may include Amazon affiliate links.',
	],
	[
		/Gear, Keyboard, and PC pages may include Amazon links where Owen Miner participates in the Amazon Associates Program\. As an Amazon Associate I earn from qualifying purchases through eligible links on those pages\./g,
		'Gear, Keyboard, and PC pages may include Amazon affiliate links.',
	],
	[
		/AliExpress store links on this page may earn commission\./g,
		'AliExpress store links on this page are compensated and may earn commission at no extra cost to you. Thanks for supporting the channel.',
	],
	[
		/The Major merch card includes a compensated AliExpress link to the Perfect World ESports store\./g,
		'Merch cards link to a compensated Perfect World ESports AliExpress store. Thanks if you shop through them—it helps fund content.',
	],
];

const OLD_PATTERNS = [
	/Affiliate links on this page cost you nothing extra but directly support content on this website and social media platforms\./gi,
	/Referral and affiliate links on this page cost you nothing extra but directly support content on this website and social media platforms\./gi,
	/Some links on this page are affiliate links\. If you buy through them, Owen Miner may earn a commission at no extra cost to you\. That support helps fund content on this website and social media\./gi,
	/Some links on this page are compensated AliExpress store links\. If you buy through them, Owen Miner may earn a commission at no extra cost to you\. That support helps fund content on this website and social media\./gi,
];

const skipDirs = new Set(['node_modules', 'backup-pre-the-setup-2026-04-08', 'mockups', 'package', '.git', 'dev']);

const affiliateRe =
	/tag=owenminercs-20|pwrdesports\.aliexpress\.com|s\.click\.aliexpress\.com/i;
const amazonRe = /tag=owenminercs-20/i;
const aliexpressRe = /pwrdesports\.aliexpress\.com|s\.click\.aliexpress\.com/i;

function disclosureBlock(text) {
	return `\n\t\t\t\t<p class="affiliate-disclosure" role="note"><span class="affiliate-disclosure__label">Disclosure:</span> ${text}</p>`;
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

function syncFooterDisclosures(html) {
	let next = html;
	for (const [pattern, replacement] of FOOTER_REPLACEMENTS) {
		next = next.replace(pattern, replacement);
	}
	return next;
}

function normalizeDisclosureLabel(html) {
	return html.replace(
		/<span class="affiliate-disclosure__label">Disclosure<\/span>/gi,
		'<span class="affiliate-disclosure__label">Disclosure:</span>'
	);
}

function disclosureAlreadyAfterTitle(html) {
	return /<\/h1>\s*<p class="affiliate-disclosure"/i.test(html);
}

/** Place affiliate disclosure immediately after the page's main h1 (title → disclosure → lede). */
function moveDisclosureAfterTitle(html, block) {
	const trimmedBlock = block.trim();
	const disclosureRe = /<p class="affiliate-disclosure" role="note">[\s\S]*?<\/p>/i;
	if (!disclosureRe.test(html)) return html;
	if (disclosureAlreadyAfterTitle(html)) return normalizeDisclosureLabel(html);

	const match = html.match(disclosureRe);
	const disclosureBlock = match[0];
	let next = html.replace(disclosureRe, '');

	const introSplitRe =
		/(<section class="hub-content-panel"|<div class="gallery2"|<div class="keep-board"|<section class="gallery2"|<div class="bd4"|<div class="case2")/i;
	const introRegion = next.split(introSplitRe)[0];
	const h1Match = introRegion.match(/(<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>)/i);

	if (h1Match) {
		next = next.replace(h1Match[0], `${h1Match[0]}\n\t\t\t\t${trimmedBlock || disclosureBlock.trim()}`);
		return normalizeDisclosureLabel(next);
	}

	// Pages without a page-level h1 (e.g. gaming-pc): keep disclosure after back link when present.
	if (next.includes('setup-detail__back') && !disclosureRe.test(next)) {
		next = next.replace(
			/(<p class="setup-detail__back">[\s\S]*?<\/p>)/,
			`$1\n\t\t\t\t${trimmedBlock || disclosureBlock.trim()}`
		);
		return normalizeDisclosureLabel(next);
	}

	// Fallback: restore original block at intro open.
	next = html;
	return normalizeDisclosureLabel(next);
}

function syncExistingDisclosure(html, rel) {
	const copy = pickCopy(rel, html);
	const block = disclosureBlock(copy).trim();
	const re = /<p class="affiliate-disclosure" role="note">[\s\S]*?<\/p>/i;
	if (!re.test(html)) return { html, changed: false };
	let next = html.replace(re, block);
	next = normalizeDisclosureLabel(next);
	if (/<p class="affiliate-disclosure"/i.test(next) && !disclosureAlreadyAfterTitle(next)) {
		next = moveDisclosureAfterTitle(next, block);
	}
	return { html: next, changed: next !== html };
}

function insertDisclosure(html, rel) {
	const copy = pickCopy(rel, html);
	const block = disclosureBlock(copy);

	if (html.includes('class="pc-build-lede"')) {
		const next = html.replace(/(<h1 class="pc-build-page-title">[\s\S]*?<\/h1>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Gaming/cs2-merch.html')) {
		const next = html.replace(
			/(<div class="gallery keep-board-intro merch-hero-panel"[\s\S]*?<h1>[\s\S]*?<\/h1>)/,
			`$1${block}`
		);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Garage Sale/garage-sale.html')) {
		const next = html.replace(/(<p class="garage-sale-intro-direct-note">[\s\S]*?<\/p>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('The Setup/the-setup.html')) {
		html = removeTheSetupDisclosurePanel(html);
		const next = html.replace(
			/(<div\s+class="gallery keep-board-intro"[\s\S]*?<h1>[\s\S]*?<\/h1>)/,
			`$1${block}`
		);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Keyboard/60he.html')) {
		const next = html.replace(/(<div class="gallery"[\s\S]*?<h1>[\s\S]*?<\/h1>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (/Keyboard\/60he-20(23|25)\.html$/i.test(rel)) {
		html = removeOldTopDisclosures(html);
		const next = html.replace(/(<div class="gallery"[\s\S]*?<h1>[\s\S]*?<\/h1>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Desk Setup/setup.html')) {
		const next = html.replace(/(<div class="gallery"[\s\S]*?<h1>[\s\S]*?<\/h1>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('The Setup/gaming-pc.html')) {
		const next = html.replace(/(<p class="setup-detail__back">[\s\S]*?<\/p>)/, `$1${block}`);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Upgrades/upgrades.html')) {
		html = removeOldTopDisclosures(html);
		const next = html.replace(
			/(<div\s+class="gallery keep-board-intro"[\s\S]*?<h1>[\s\S]*?<\/h1>)/,
			`$1${block}`
		);
		if (next !== html) return { html: next, changed: true };
	}

	if (rel.endsWith('Gaming/gaming.html')) {
		const next = html.replace(
			/(<div\s+class="gallery keep-board-intro"[\s\S]*?<h1>[\s\S]*?<\/h1>)/,
			`$1${block}`
		);
		if (next !== html) return { html: next, changed: true };
	}

	if (html.includes('<div class="intro"')) {
		const h1AfterIntro = html.match(
			/<div class="intro[^"]*">[\s\S]*?(<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>)/i
		);
		if (h1AfterIntro) {
			const next = html.replace(h1AfterIntro[1], `${h1AfterIntro[1]}${block}`);
			if (next !== html) return { html: next, changed: true };
		}
		if (html.includes('setup-detail__back')) {
			const next = html.replace(/(<p class="setup-detail__back">[\s\S]*?<\/p>)/, `$1${block}`);
			if (next !== html) return { html: next, changed: true };
		}
	}

	return { html, changed: false };
}

const changed = [];
const skipped = [];

for (const file of walk('.')) {
	const rel = file.replace(/\\/g, '/').replace(/^\.\//, '');
	let raw = fs.readFileSync(file, 'utf8');
	const hasAffiliate = affiliateRe.test(raw);
	const hasDisclosure = /class="affiliate-disclosure"/i.test(raw);
	const hasFooterDisclosure = /disclosure\s*=\s*["']/i.test(raw);
	if (!hasAffiliate && !hasDisclosure && !hasFooterDisclosure) continue;

	let did = false;
	const footerSynced = syncFooterDisclosures(raw);
	if (footerSynced !== raw) {
		raw = footerSynced;
		did = true;
	}

	if (hasDisclosure) {
		const synced = syncExistingDisclosure(raw, rel);
		if (synced.changed) {
			raw = synced.html;
			did = true;
		} else {
			const normalized = normalizeDisclosureLabel(raw);
			if (normalized !== raw) {
				raw = normalized;
				did = true;
			}
		}
	} else if (hasAffiliate) {
		const inserted = insertDisclosure(raw, rel);
		if (inserted.changed) {
			raw = inserted.html;
			did = true;
		}
	}

	if (did) {
		fs.writeFileSync(file, raw, 'utf8');
		changed.push(rel);
	} else if (hasAffiliate && !hasDisclosure) {
		skipped.push(rel);
	}
}

console.log('Updated', changed.length, 'files');
changed.forEach((f) => console.log(' +', f));
if (skipped.length) {
	console.log('Skipped (no insertion point)', skipped.length);
	skipped.forEach((f) => console.log(' ?', f));
}
