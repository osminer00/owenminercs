/**
 * Generate dense Gear affiliate quick-link page from affiliate-links.json.
 *
 * Gaming quick-links page was removed 2026-07-10 (AliExpress products unavailable).
 *
 * Run: node dev/generate-affiliate-quick-links.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const AFFILIATE_JSON = path.join(ROOT, 'affiliate-links.json');
const MERCH_HTML = path.join(ROOT, 'Gaming', 'cs2-merch.html');
const GEAR_OUT = path.join(ROOT, 'The Setup', 'gear-quick-links.html');

const GEAR_CATEGORIES = new Set(['pc_components', 'desk_setup', 'keyboard_parts']);

const STORE_URL =
	'https://pwrdesports.aliexpress.com/store/1103775565?spm=a2g0o.store_pc_allItems_or_groupList.pcShopHead_2009118762807.0';

/** Hub/list pages — never use for per-product thumbs or keep-thumbs galleries. */
const HUB_PAGES = new Set([
	'The Setup/the-setup.html',
	'The Setup/cameras.html',
	'The Setup/displays.html',
	'The Setup/keyboards.html',
	'The Setup/mice.html',
	'The Setup/consoles.html',
	'The Setup/mounts-arms.html',
	'The Setup/previous-setups.html',
	'The Setup/lighting-hub.html',
	'Desk Setup/setup.html',
	'PC/pc.html',
	'Gaming/gaming.html',
]);

/** Multi-product detail pages — do not use the first gallery image as the product thumb. */
const MULTI_PRODUCT_PAGES = new Set([
	'PC/pc.html',
	'The Setup/gaming-pc.html',
	'Desk Setup/setup.html',
	'The Setup/camera.html',
	'The Setup/audio.html',
]);

const PLACEHOLDER_THUMB = '/images/logo/globes/globe-blue.jpg';

/** Manual thumb overrides keyed by affiliate-links.json product id. */
const THUMB_OVERRIDES = {};

const SKIP_IMG_RE = /globe|logo|favicon|coming-soon/i;

const STOP_WORDS = new Set([
	'the',
	'and',
	'for',
	'with',
	'usb',
	'rgb',
	'series',
	'pack',
	'see',
	'amazon',
	'listing',
	'various',
	'style',
	'before',
	'buying',
	'verify',
	'full',
	'height',
	'desktop',
	'mini',
	'rechargeable',
	'under',
	'desk',
	'electric',
	'mechanical',
	'professional',
	'wireless',
	'gaming',
	'monitor',
	'camera',
	'microphone',
	'keyboard',
	'parts',
	'accessories',
	'tools',
	'legacy',
	'secondary',
	'phone',
	'as',
	'pro',
	'max',
	'all',
	'one',
	'inch',
	'black',
	'white',
]);

const htmlCache = new Map();


function esc(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function relForAffiliate(type) {
	return type === 'aliexpress'
		? 'noopener noreferrer sponsored nofollow'
		: 'noopener noreferrer sponsored nofollow';
}

function extractAffiliateLinks(links) {
	if (!links || typeof links !== 'object') return [];
	const out = [];
	const push = (type, url, label) => {
		if (typeof url !== 'string' || !url.startsWith('http')) return;
		out.push({ type, url, label });
	};
	push('amazon', links.amazon, 'Amazon (affiliate)');
	push('amazon', links.amazon_search, 'Amazon (affiliate)');
	push('aliexpress', links.aliexpress_portals, 'AliExpress (affiliate)');
	push('aliexpress', links.aliexpress, 'AliExpress (affiliate)');
	push('aliexpress', links.aliexpress_search, 'AliExpress (affiliate)');
	return out;
}

function shouldIncludeProduct(links) {
	const aff = extractAffiliateLinks(links);
	if (aff.length) return true;
	if (links?.amazon === false && !links?.aliexpress && !links?.aliexpress_search && !links?.amazon_search)
		return false;
	return aff.length > 0;
}

function pagePriorityScore(page) {
	if (HUB_PAGES.has(page)) return 0;
	if (MULTI_PRODUCT_PAGES.has(page)) return 1;
	return 2;
}

function sortPagesByPriority(pages) {
	return [...pages].sort(
		(a, b) =>
			pagePriorityScore(b) - pagePriorityScore(a) ||
			b.split('/').length - a.split('/').length ||
			b.length - a.length,
	);
}

function pickDetailPage(pages, section) {
	if (!Array.isArray(pages) || !pages.length) return null;
	const nonHub = pages.filter((p) => !HUB_PAGES.has(p));
	const dedicated = nonHub.filter((p) => !MULTI_PRODUCT_PAGES.has(p));
	const candidates = dedicated.length ? dedicated : nonHub.length ? nonHub : pages;
	const preferPrefixes =
		section === 'gear'
			? ['Keyboard/', 'PC/', 'The Setup/', 'Desk Setup/']
			: ['Gaming/'];
	for (const prefix of preferPrefixes) {
		const hits = candidates.filter((p) => p.startsWith(prefix));
		if (hits.length) return sortPagesByPriority(hits)[0];
	}
	return sortPagesByPriority(candidates)[0];
}

function hrefFromDetailPage(detailPage, section) {
	if (!detailPage) return null;
	if (section === 'gear') {
		if (detailPage.startsWith('The Setup/')) return detailPage.replace('The Setup/', '');
		if (detailPage.startsWith('PC/')) return `../${detailPage}`;
		if (detailPage.startsWith('Keyboard/')) return `../${detailPage}`;
		if (detailPage.startsWith('Desk Setup/')) return `../${detailPage.replace(/ /g, '%20')}`;
	}
	if (section === 'gaming') {
		if (detailPage.startsWith('Gaming/')) return detailPage.replace('Gaming/', '');
	}
	return detailPage;
}

function resolveSiteImageSrc(src, detailPage) {
	if (!src) return null;
	if (src.startsWith('http')) return src;
	if (src.startsWith('/')) {
		return src.replace(/^\/The Setup\//, '/').replace(/\/+/g, '/');
	}
	const pageDir = path.posix.dirname(detailPage.replace(/\\/g, '/'));
	const joined = path.posix.normalize(`${pageDir}/${src}`);
	return `/${joined}`.replace(/\/+/g, '/');
}

function thumbFileExists(siteSrc) {
	if (!siteSrc || !siteSrc.startsWith('/') || siteSrc.startsWith('http')) return false;
	const disk = path.join(ROOT, siteSrc.slice(1).replace(/\//g, path.sep));
	return fs.existsSync(disk);
}

function isMultiProductPage(page) {
	return MULTI_PRODUCT_PAGES.has(page) || HUB_PAGES.has(page);
}

function loadPageDom(page) {
	if (htmlCache.has(page)) return htmlCache.get(page);
	const abs = path.join(ROOT, page.replace(/\//g, path.sep));
	if (!fs.existsSync(abs)) return null;
	const $ = cheerio.load(fs.readFileSync(abs, 'utf8'));
	htmlCache.set(page, $);
	return $;
}

function extractAsins(product) {
	const asins = new Set();
	if (product.asin) asins.add(String(product.asin).toUpperCase());
	for (const url of Object.values(product.links || {})) {
		if (typeof url !== 'string') continue;
		const m =
			url.match(/\/dp\/([A-Z0-9]{10})/i) ||
			url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
		if (m) asins.add(m[1].toUpperCase());
	}
	return [...asins];
}

function productSearchTerms(name) {
	const terms = new Set();
	const lower = String(name).toLowerCase();

	const rtx = lower.match(/rtx\s*(\d{4})/);
	if (rtx) {
		terms.add('rtx');
		terms.add(rtx[1]);
	}
	const ryzen = lower.match(/ryzen[^0-9]*(\d{4}[a-z0-9]*)/i);
	if (ryzen) {
		terms.add('ryzen');
		terms.add(ryzen[1].toLowerCase());
	}

	for (const m of String(name).matchAll(/\b([A-Z]{1,3}[-]?\d{2,}[A-Z0-9]*)\b/g)) {
		terms.add(m[1].toLowerCase());
	}

	for (const raw of lower.replace(/[^a-z0-9]+/g, ' ').split(/\s+/)) {
		if (raw.length >= 3 && !STOP_WORDS.has(raw)) terms.add(raw);
	}

	return [...terms].filter((t) => t.length >= 2);
}

function termsMatchText(text, terms) {
	if (!text || !terms.length) return false;
	const lower = String(text).toLowerCase();
	const matched = terms.filter((t) => lower.includes(t));
	if (!matched.length) return false;
	if (matched.some((t) => t.length >= 4 || /\d/.test(t))) return true;
	return matched.length >= 2;
}

const GENERIC_IMG_TERMS = new Set([
	'sony',
	'camera',
	'mirrorless',
	'alpha',
	'amazon',
	'elgato',
	'logitech',
	'monitor',
	'monitors',
]);

function altConflictsWithProduct(alt, terms) {
	const lower = String(alt || '').toLowerCase();
	const productIsGpu = terms.some((t) => /^(rtx|4090|gpu|geforce)/.test(t) || t === '4090');
	const altIsGpu = /\b(rtx|4090|geforce|gpu)\b/.test(lower);
	return altIsGpu && !productIsGpu;
}

function termsMatchImage(text, terms) {
	if (!termsMatchText(text, terms)) return false;
	if (altConflictsWithProduct(text, terms)) return false;
	const lower = String(text).toLowerCase();
	const distinctive = terms.filter((t) => t.length >= 4 && !GENERIC_IMG_TERMS.has(t));
	if (!distinctive.length) return true;
	return distinctive.some((t) => lower.includes(t));
}

function termsMatchKeepCardLabel(label, terms) {
	if (!termsMatchText(label, terms)) return false;
	const lower = String(label).toLowerCase();
	const hits = terms.filter((t) => lower.includes(t));
	return hits.length >= 2;
}

function isLegacyContext($el) {
	if (!$el || !$el.length) return false;
	if ($el.closest('#hyperx-duocast-legacy, [id*="legacy"]').length) return true;
	const section = $el.closest('section');
	return section.length > 0 && section.find('.setup-archive-detail__badge').length > 0;
}

function resolveImgRaw(raw, page) {
	if (!raw || SKIP_IMG_RE.test(raw)) return null;
	const resolved = resolveSiteImageSrc(raw, page);
	return resolved && thumbFileExists(resolved) ? resolved : null;
}

function firstUsableImgIn($, $container, terms, page, { loose = false, trustLink = false } = {}) {
	if (!$container.length) return null;
	const imgs = $container.find('img[src]').not('.keep-card__thumb--empty');
	for (let i = 0; i < imgs.length; i++) {
		const $img = imgs.eq(i);
		if (isLegacyContext($img)) continue;
		const src = $img.attr('src');
		const alt = $img.attr('alt') || '';
		const combined = `${alt} ${src}`;
		if (!loose && terms.length && !termsMatchText(combined, terms)) continue;
		if (loose && terms.length && !termsMatchImage(combined, terms) && !trustLink) continue;
		const resolved = resolveImgRaw(src, page);
		if (resolved) return resolved;
	}
	return null;
}

function findImgNearLink($, $link, terms, page) {
	if (!$link.length) return null;

	const linkMatches = termsMatchText($link.text(), terms);

	const tightContainers = [
		$link.closest('li.pc-build-part'),
		$link.closest('.affiliate-price-host'),
		$link.closest('a.itemlink').parent(),
		$link.closest('.keep-card'),
	];

	for (const $c of tightContainers) {
		if (!$c.length || isLegacyContext($c)) continue;
		const img = firstUsableImgIn($, $c, terms, page, { loose: true, trustLink: linkMatches });
		if (img) return img;
	}

	let $bd4 = $link.closest('.bd4');
	if (!$bd4.length && $link.closest('h4').length) {
		$bd4 = $link.closest('h4').nextAll('.bd4').first();
	}
	if ($bd4.length && !isLegacyContext($bd4)) {
		const img = firstUsableImgIn($, $bd4, terms, page, { loose: linkMatches, trustLink: linkMatches });
		if (img) return img;
	}

	const $partsBlock = $link.closest('.case2');
	if ($partsBlock.length) {
		let $walk = $partsBlock.prev();
		while ($walk.length) {
			if ($walk.is('section')) {
				const heading = $walk.find('h1, h2').first().text();
				if (termsMatchText(heading, terms)) {
					const img = firstUsableImgIn($, $walk, terms, page, { loose: true });
					if (img) return img;
				}
			}
			$walk = $walk.prev();
		}
	}

	return null;
}

function thumbFromKeepCards($, terms, page) {
	let hit = null;
	$('.keep-card').each((_, card) => {
		if (hit) return;
		const $card = $(card);
		const label = $card.find('.keep-card__label, .keep-card__body h4').text();
		if (!termsMatchKeepCardLabel(label, terms)) return;
		const img = $card.find('img.keep-card__thumb[src]').not('[src*="globe"]').first().attr('src');
		hit = resolveImgRaw(img, page);
	});
	return hit;
}

function isSharedHeroImage(src, alt) {
	const combined = `${alt || ''} ${src || ''}`.toLowerCase();
	return (
		/\/pc\.webp$/i.test(src || '') ||
		combined.includes('gaming pc build') ||
		combined.includes('custom gaming pc')
	);
}

function thumbFromPage(page, product) {
	const $ = loadPageDom(page);
	if (!$) return null;

	const terms = productSearchTerms(product.name);
	const asins = extractAsins(product);
	const multi = isMultiProductPage(page);

	for (const asin of asins) {
		const links = $(`a[href*="${asin}"]`);
		for (let i = 0; i < links.length; i++) {
			const img = findImgNearLink($, links.eq(i), terms, page);
			if (img) return img;
		}
	}

	let linkHit = null;
	$('a[href*="amazon.com"][href*="owenminercs"]').each((_, el) => {
		if (linkHit) return;
		const $a = $(el);
		const label = `${$a.text()} ${$a.attr('title') || ''} ${$a.attr('alt') || ''}`;
		if (!termsMatchText(label, terms)) return;
		linkHit = findImgNearLink($, $a, terms, page);
	});
	if (linkHit) return linkHit;

	let sectionHit = null;
	$('section, li.pc-build-part').each((_, el) => {
		if (sectionHit) return;
		const $el = $(el);
		if (isLegacyContext($el)) return;
		const heading = $el.find('h1, h2, h3, .pc-part-label').first().text();
		if (!termsMatchText(heading, terms)) return;
		sectionHit = firstUsableImgIn($, $el, terms, page, { loose: true });
	});
	if (sectionHit) return sectionHit;

	if ($('.keep-board .keep-card').length > 1) {
		const cardHit = thumbFromKeepCards($, terms, page);
		if (cardHit) return cardHit;
	}

	$('img[src]').each((_, el) => {
		if (sectionHit) return;
		const $img = $(el);
		if (isLegacyContext($img)) return;
		const src = $img.attr('src');
		const alt = $img.attr('alt') || '';
		if (isSharedHeroImage(src, alt)) return;
		if (!termsMatchImage(`${alt} ${src}`, terms)) return;
		sectionHit = resolveImgRaw(src, page);
	});
	if (sectionHit) return sectionHit;

	if (!multi) {
		const pageText = `${$('title').text()} ${$('h1').first().text()}`;
		if (termsMatchText(pageText, terms) && $('.keep-board .keep-card').length <= 1) {
			const heroes = $('.ultrawide img[src], .gallery2 > img[src], .bd4 img[src], .intro .gallery img[src]').filter(
				(_, img) => !isLegacyContext($(img)),
			);
			for (let i = 0; i < heroes.length; i++) {
				const $img = heroes.eq(i);
				const src = $img.attr('src');
				const alt = $img.attr('alt') || '';
				if (isSharedHeroImage(src, alt)) continue;
				const combined = `${alt} ${src}`;
				if (termsMatchImage(combined, terms)) {
					const resolved = resolveImgRaw(src, page);
					if (resolved) return resolved;
				}
			}
		}
	}

	if (multi) {
		let multiHit = null;
		$('section').each((_, sec) => {
			if (multiHit) return;
			const $sec = $(sec);
			const heading = $sec.find('h1, h2').first().text();
			if (!termsMatchText(heading, terms)) return;
			multiHit = firstUsableImgIn($, $sec, terms, page, { loose: true });
		});
		if (multiHit) return multiHit;
	}

	return null;
}

function validateThumbForProduct(thumbSrc, productName) {
	if (!thumbSrc || thumbSrc === PLACEHOLDER_THUMB) return thumbSrc;
	const name = String(productName).toLowerCase();
	const src = thumbSrc.toLowerCase();
	const rules = [
		{ pattern: 'streamerx', allow: /streamer|rode/ },
		{ pattern: '4090', allow: /4090|rtx|geforce/ },
		{ pattern: 'superlight', allow: /superlight|logitech.*mouse|mouse.*logitech/ },
		{
			pattern: 'gamingsetup',
			allow: /rog|pg27|oled|swift|asus.*monitor|gaming monitor/,
		},
	];
	for (const rule of rules) {
		if (!src.includes(rule.pattern)) continue;
		if (!rule.allow.test(name)) return PLACEHOLDER_THUMB;
	}
	return thumbSrc;
}

function resolveProductThumb(product, productKey, pages) {
	const explicit = product.thumb || product.image || THUMB_OVERRIDES[productKey];
	if (explicit) {
		const src = explicit.startsWith('/')
			? explicit
			: resolveSiteImageSrc(explicit, pages?.[0] || '');
		if (src && thumbFileExists(src)) return validateThumbForProduct(src, product.name);
	}

	const sorted = sortPagesByPriority(Array.isArray(pages) ? pages : []);
	for (const page of sorted) {
		const thumb = thumbFromPage(page, product);
		if (thumb) return validateThumbForProduct(thumb, product.name);
	}

	return PLACEHOLDER_THUMB;
}

function renderThumb(thumbSrc, detailHref) {
	const hasThumb = thumbSrc && thumbFileExists(thumbSrc);
	const src = hasThumb ? thumbSrc : PLACEHOLDER_THUMB;
	if (!thumbFileExists(src)) {
		return `<span class="affiliate-quick-item__thumb affiliate-quick-item__thumb--empty" aria-hidden="true"></span>`;
	}
	if (detailHref) {
		return `<a class="affiliate-quick-item__thumb" href="${esc(detailHref)}" aria-hidden="true" tabindex="-1">
						<img src="${esc(src)}" alt="" width="48" height="48" loading="lazy" decoding="async" />
					</a>`;
	}
	return `<span class="affiliate-quick-item__thumb" aria-hidden="true">
						<img src="${esc(src)}" alt="" width="48" height="48" loading="lazy" decoding="async" />
					</span>`;
}

function renderAffiliateLinks(links) {
	return links
		.map(
			(l) =>
				`<a class="affiliate-quick-item__shop" href="${esc(l.url)}" target="_blank" rel="${relForAffiliate(l.type)}">${esc(l.label)}</a>`,
		)
		.join('');
}

function renderListItem({ title, affiliateLinks, detailHref, thumbSrc }) {
	const shops = renderAffiliateLinks(affiliateLinks);
	const more =
		detailHref != null
			? `<a href="${esc(detailHref)}" class="affiliate-quick-item__more">More →</a>`
			: '';
	const thumb = renderThumb(thumbSrc, detailHref);
	return `				<article class="affiliate-quick-item" role="listitem">
					${thumb}
					<div class="affiliate-quick-item__main">
						<p class="affiliate-quick-item__title">${esc(title)}</p>
						<p class="affiliate-quick-item__links">${shops}${more}</p>
					</div>
				</article>`;
}

function gearProductsFromJson(data) {
	const items = [];
	for (const [category, products] of Object.entries(data.products)) {
		if (!GEAR_CATEGORIES.has(category)) continue;
		for (const [productKey, product] of Object.entries(products)) {
			if (!shouldIncludeProduct(product.links)) continue;
			const affiliateLinks = extractAffiliateLinks(product.links);
			if (!affiliateLinks.length) continue;
			const detailPage = pickDetailPage(product.pages, 'gear');
			items.push({
				title: product.name,
				affiliateLinks,
				detailPage,
				detailHref: hrefFromDetailPage(detailPage, 'gear'),
				thumbSrc: resolveProductThumb(product, productKey, product.pages),
				category: product.category || category,
			});
		}
	}
	items.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
	return items;
}

function gamingProductsFromMerch() {
	const html = fs.readFileSync(MERCH_HTML, 'utf8');
	const $ = cheerio.load(html);
	const seen = new Map();
	$('a.merch-affiliate-link[href]').each((_, el) => {
		const href = $(el).attr('href') || '';
		const text = $(el).text().replace(/\s+/g, ' ').trim();
		if (!text || !href.startsWith('http')) return;
		const key = text.toLowerCase();
		if (seen.has(key)) return;
		const card = $(el).closest('article.keep-card');
		let thumbSrc = null;
		const cardImg = card.find('img.keep-card__thumb').first().attr('src');
		if (cardImg) {
			const resolved = resolveSiteImageSrc(cardImg, 'Gaming/cs2-merch.html');
			if (resolved && thumbFileExists(resolved)) thumbSrc = resolved;
		}
		seen.set(key, {
			title: text,
			affiliateLinks: [{ type: 'aliexpress', url: href, label: 'AliExpress (affiliate)' }],
			detailPage: 'Gaming/cs2-merch.html',
			detailHref: 'cs2-merch.html',
			thumbSrc,
		});
	});
	const items = [...seen.values()];
	items.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
	// Store-wide link as first row
	const storeThumb = thumbFileExists('/images/csShelves.webp') ? '/images/csShelves.webp' : null;
	items.unshift({
		title: 'Perfect World ESports Store (Shanghai Major merch)',
		affiliateLinks: [{ type: 'aliexpress', url: STORE_URL, label: 'AliExpress store (affiliate)' }],
		detailPage: 'Gaming/cs2-merch.html',
		detailHref: 'cs2-merch.html',
		thumbSrc: storeThumb,
	});
	return items;
}

function pageShell({ section, title, description, canonicalPath, bodyClass, disclosure, listHtml, count }) {
	const isGear = section === 'gear';
	const cssDepth = isGear ? '..' : '..';
	const bubbleSection = isGear ? 'gear' : 'gaming';
	const hubBack = isGear
		? `<p class="setup-detail__back"><a href="the-setup.html">← Gear hub</a></p>`
		: `<p class="setup-detail__back"><a href="gaming.html">← Gaming hub</a></p>`;
	const footerDisclosure = isGear
		? 'Amazon links on this page are part of the Amazon Associates Program and may earn commission at no extra cost to you.'
		: 'AliExpress store links on this page are compensated and may earn commission at no extra cost to you. Thanks for supporting the channel.';
	const ogImage = isGear
		? 'https://www.owenminercs.com/images/gamingSetup.webp'
		: 'https://www.owenminercs.com/Counter-Strike/Images/cs2-banner.webp';

	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
		<link
			href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800;900&display=swap"
			rel="stylesheet"
		/>
		<link rel="stylesheet" href="${cssDepth}/css/owenminercs.css" />
		<link rel="stylesheet" href="${cssDepth}/css/bubble-theme-base.css" />
		<link rel="stylesheet" href="${cssDepth}/css/bubble-themes/${bubbleSection}.css" />
		<link rel="apple-touch-icon" href="/images/logo/apple-touch-icon.png" />
		<script async src="https://www.googletagmanager.com/gtag/js?id=G-GYG1QRQ8DY"></script>
		<script>
			window.dataLayer = window.dataLayer || [];
			function gtag() {
				dataLayer.push(arguments);
			}
			gtag('js', new Date());
			gtag('config', 'G-GYG1QRQ8DY');
		</script>
		<title>${esc(title)} | Owen Miner</title>
		<meta name="author" content="Owen Miner" />
		<meta name="description" content="${esc(description)}" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="robots" content="index, follow" />
		<meta name="twitter:site" content="@OwenMiner" />
		<meta http-equiv="X-UA-Compatible" content="IE=edge" />
		<meta name="theme-color" content="#0f0f0f" />
		<link rel="icon" href="/images/logo/favicon.ico" sizes="any" />
		<link rel="icon" href="/images/logo/favicon-32.png" type="image/png" sizes="32x32" />
		<link rel="icon" href="/images/logo/favicon-16.png" type="image/png" sizes="16x16" />
		<meta property="og:title" content="${esc(title)} | Owen Miner" />
		<meta property="og:description" content="${esc(description)}" />
		<meta property="og:image" content="${ogImage}" />
		<meta property="og:url" content="https://www.owenminercs.com/${canonicalPath}" />
		<meta property="og:type" content="website" />
		<meta property="og:site_name" content="Owen Miner CS" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content="${esc(title)} | Owen Miner" />
		<meta name="twitter:description" content="${esc(description)}" />
		<meta name="twitter:image" content="${ogImage}" />
		<link rel="canonical" href="https://www.owenminercs.com/${canonicalPath}" />
		<link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
		<script src="${cssDepth}/scripts/components.js" defer></script>
		<script src="${cssDepth}/scripts/bubble-scroll.js" defer></script>
	</head>
	<body id="top" class="site-card-ui bubble-theme bubble-theme--${bubbleSection} ${bodyClass}" style="zoom: 95%">
		<div class="bubble-bg" aria-hidden="true">
			<div class="bubble-bg__media">
				<video
					id="bubble-bg-video"
					class="bubble-bg__video"
					autoplay
					muted
					loop
					playsinline
					preload="metadata"
					poster="/images/bubble-themes/${bubbleSection}/poster.jpg"
				>
					<source src="/images/bubble-themes/${bubbleSection}/bg.mp4" type="video/mp4" />
				</video>
			</div>
			<div class="bubble-bg__veil"></div>
		</div>
		<shared-header></shared-header>
		<div class="container">
			<div class="intro affiliate-quick-intro">
				${hubBack}
				<div
					class="gallery keep-board-intro"
					style="border: solid black; border-radius: 7px; box-shadow: 5px 5px black"
				>
					<h1>${esc(title)}</h1>
					<p class="affiliate-disclosure" role="note"><span class="affiliate-disclosure__label">Disclosure:</span> ${esc(disclosure)}</p>
					<p class="affiliate-quick-intro__tagline">${count} affiliate shopping links — title and shop link only.</p>
				</div>
			</div>

			<section class="hub-content-panel affiliate-quick-panel" aria-label="${esc(title)}">
				<div class="affiliate-quick-list" role="list" aria-label="Affiliate product links">
${listHtml}
				</div>
			</section>
		</div>
		<shared-footer disclosure="<i>${esc(footerDisclosure)}</i>"></shared-footer>
	</body>
</html>
`;
}

const data = JSON.parse(fs.readFileSync(AFFILIATE_JSON, 'utf8'));
const gearItems = gearProductsFromJson(data);

const gearList = gearItems.map((item) => renderListItem(item)).join('\n');

fs.writeFileSync(
	GEAR_OUT,
	pageShell({
		section: 'gear',
		title: 'Gear affiliate quick links',
		description: `Dense ${gearItems.length} Amazon and AliExpress affiliate links for desk gear, PC parts, keyboards, and setup accessories.`,
		canonicalPath: 'The%20Setup/gear-quick-links',
		bodyClass: 'affiliate-quick-page affiliate-quick-page--gear',
		disclosure: data.disclosure.topAmazon,
		listHtml: gearList,
		count: gearItems.length,
	}),
);

console.log(`Wrote ${GEAR_OUT} (${gearItems.length} links)`);

const gearReal = gearItems.filter((i) => i.thumbSrc !== PLACEHOLDER_THUMB).length;
const gearPlaceholder = gearItems.length - gearReal;
console.log(`Gear thumbs: ${gearReal} product photos, ${gearPlaceholder} globe placeholders`);
if (gearPlaceholder) {
	console.log('Gear placeholder items:');
	for (const item of gearItems.filter((i) => i.thumbSrc === PLACEHOLDER_THUMB)) {
		console.log(`  - ${item.title}`);
	}
}
