// Determine the base path to the root of the site by looking at this script's URL
const scriptUrl = document.querySelector('script[src*="components.js"]').src;
const siteRoot = scriptUrl.replace('scripts/components.js', '');

const THEME_STORAGE_KEY = 'owenminercs-theme';
const TEXT_ENTRY_SELECTOR =
	'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="password"], input[type="tel"], input[type="number"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="week"], input[type="time"], input[type="file"]';

/** Light mode uses a processed asset without the dark stippled outer fringe (see images/owenminercs-logo-light.png). */
function brandLogoFilename(theme) {
	return theme === 'light' ? 'owenminercs-logo-light.png' : 'owenminercs-logo.png';
}

function syncBrandLogosForTheme(theme) {
	const url = `${siteRoot}images/${brandLogoFilename(theme)}`;
	document.querySelectorAll('img.site-logo').forEach((img) => {
		img.src = url;
	});
}

function applyStoredTheme() {
	const root = document.documentElement;
	delete root.dataset.theme;
	try {
		localStorage.setItem(THEME_STORAGE_KEY, 'dark');
	} catch (_) {}
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) {
		meta.setAttribute('content', '#050505');
	}
	syncBrandLogosForTheme('dark');
}

applyStoredTheme();

// Detect if running locally (Live Server, file://, etc.)
const isLocal =
	window.location.hostname === '127.0.0.1' ||
	window.location.hostname === 'localhost' ||
	window.location.protocol === 'file:';

function getLink(path) {
	if (path === '') return siteRoot;
	return siteRoot + path + (isLocal ? '.html' : '');
}

/** Resolve a canonical site path (same shape as `getLink` paths) to an href for anchors. */
function resolveSiteSearchHref(pagePath) {
	if (pagePath === '' || pagePath === '/') return siteRoot;
	const normalized = String(pagePath).replace(/^\/+/, '');
	return siteRoot + normalized + (isLocal ? '.html' : '');
}

/** Dedicated search results page URL (same extension rules as `getLink`). */
function getSearchPageUrl() {
	return siteRoot + 'search' + (isLocal ? '.html' : '');
}

function searchNormalizeBlob(entry) {
	let pathDec = '';
	try {
		pathDec = decodeURIComponent(entry.path || '').toLowerCase();
	} catch {
		pathDec = String(entry.path || '').toLowerCase();
	}
	const body = (entry.text || '').toLowerCase();
	return `${(entry.title || '').toLowerCase()} ${(entry.snippet || '').toLowerCase()} ${body} ${pathDec}`;
}

/**
 * True when `data/search-manual-keywords.json` listed this query (or phrase) for this page.
 * Lets curated pages outrank long pages that only mention the term incidentally (e.g. a video title).
 */
function searchManualKeywordHit(entry, qLower, tokens) {
	const manual = entry.manualTerms;
	if (!Array.isArray(manual) || !manual.length) return false;
	if (manual.includes(qLower)) return true;
	if (tokens.length > 1) {
		const joined = tokens.join(' ');
		if (manual.includes(joined)) return true;
	}
	return false;
}

/**
 * Rank using title, full indexed page text (`entry.text`), snippet, and path.
 * Multi-word queries match when every token appears somewhere in the combined blob.
 */
function searchRankEntry(entry, qLower) {
	if (!qLower || qLower.length < 2) return 0;
	const title = (entry.title || '').toLowerCase();
	const text = (entry.text || '').toLowerCase();
	const snippet = (entry.snippet || '').toLowerCase();
	let pathDec = '';
	try {
		pathDec = decodeURIComponent(entry.path || '').toLowerCase();
	} catch {
		pathDec = String(entry.path || '').toLowerCase();
	}
	const blob = `${title} ${snippet} ${text} ${pathDec}`.replace(/\s+/g, ' ');

	const tokens = qLower.split(/\s+/).filter(Boolean);
	let matched = blob.includes(qLower);
	if (!matched) {
		if (tokens.length >= 2) {
			matched = tokens.every((t) => blob.includes(t));
		} else if (tokens.length === 1) {
			const t = tokens[0];
			matched = t.length >= 2 && blob.includes(t);
		}
	}
	if (!matched) return 0;

	let score = 28;
	if (title.includes(qLower)) score += 40;
	else if (tokens.length > 1 && tokens.every((t) => title.includes(t))) score += 34;
	else if (tokens.some((t) => t.length >= 2 && title.includes(t))) score += 16;

	if (text.includes(qLower)) score += 34;
	else if (tokens.length > 1 && tokens.every((t) => text.includes(t))) score += 26;
	else if (tokens.some((t) => t.length >= 2 && text.includes(t))) score += 12;

	if (snippet.includes(qLower)) score += 10;
	if (pathDec.includes(qLower)) score += 6;

	if (searchManualKeywordHit(entry, qLower, tokens)) score += 36;

	return Math.min(score, 100);
}

/**
 * @param {number} maxResults Cap matches; use `Infinity` for the full results page.
 */
function searchFilterEntries(entries, query, maxResults = 40) {
	const q = query.trim().toLowerCase();
	if (!q || q.length < 2) return [];
	const out = [];
	for (let i = 0; i < entries.length; i++) {
		const e = entries[i];
		if (searchRankEntry(e, q) > 0) out.push(e);
	}
	out.sort((a, b) => {
		const ra = searchRankEntry(a, q);
		const rb = searchRankEntry(b, q);
		if (rb !== ra) return rb - ra;
		return String(a.path || '').localeCompare(String(b.path || ''));
	});
	if (maxResults === Infinity || out.length <= maxResults) return out;
	return out.slice(0, maxResults);
}

/**
 * @param {'preview'|'fullPage'} variant Empty-query messaging for modal/home vs dedicated page.
 */
function searchRenderResults(container, list, query, variant) {
	container.textContent = '';
	const q = query.trim();
	if (!q) {
		const p = document.createElement('p');
		p.className = 'site-search-results__hint';
		p.textContent =
			variant === 'fullPage'
				? 'No search terms were in the link. Use Search in the navigation bar or the search section on the home page.'
				: 'Type at least 2 characters to search page copy, titles, image captions, and paths.';
		container.appendChild(p);
		return;
	}
	if (q.length < 2) {
		const p = document.createElement('p');
		p.className = 'site-search-results__hint';
		p.textContent = 'Use at least 2 characters to search the full site.';
		container.appendChild(p);
		return;
	}
	if (!list.length) {
		const p = document.createElement('p');
		p.className = 'site-search-results__empty';
		p.textContent = 'No matching pages.';
		container.appendChild(p);
		return;
	}
	const ul = document.createElement('ul');
	ul.className = 'site-search-results__list';
	for (let i = 0; i < list.length; i++) {
		const item = list[i];
		const li = document.createElement('li');
		li.className = 'site-search-results__item';
		const a = document.createElement('a');
		a.className = 'site-search-results__link';
		a.href = resolveSiteSearchHref(item.path);
		a.textContent = item.title || item.path || 'Page';
		const sn = document.createElement('span');
		sn.className = 'site-search-results__snippet';
		sn.textContent = item.snippet || '';
		li.appendChild(a);
		li.appendChild(sn);
		ul.appendChild(li);
	}
	container.appendChild(ul);
}

const SITE_SEARCH_INDEX_URL = `${siteRoot}data/site-search-index.json`;

window.owenminercsSiteSearchApi = {
	indexUrl: SITE_SEARCH_INDEX_URL,
	resolveHref: resolveSiteSearchHref,
	getSearchPageUrl,
	filterEntries: searchFilterEntries,
	renderResults: searchRenderResults,
};

const DISCORD_INVITE_URL = 'https://discord.gg/fA9GbxmAge';

const ACHIEVEMENT_STORAGE_KEY = 'owenminercs-achievements-v1';

function readUnlockedAchievementIds() {
	try {
		const raw = localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
	} catch (_) {
		return new Set();
	}
}

function writeUnlockedAchievementIds(set) {
	try {
		localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify([...set]));
	} catch (_) {}
}

/** Unlock a site easter-egg achievement by id (persists in localStorage). Safe to call from any page script. */
window.owenminercsUnlockAchievement = function owenminercsUnlockAchievement(id) {
	if (typeof id !== 'string') return false;
	const trimmed = id.trim();
	if (!trimmed) return false;
	const s = readUnlockedAchievementIds();
	if (s.has(trimmed)) return false;
	s.add(trimmed);
	writeUnlockedAchievementIds(s);
	try {
		window.dispatchEvent(
			new CustomEvent('owenminercs-achievement-unlocked', { detail: { id: trimmed } })
		);
	} catch (_) {}
	return true;
};

window.owenminercsIsAchievementUnlocked = function owenminercsIsAchievementUnlocked(id) {
	if (typeof id !== 'string' || !id.trim()) return false;
	return readUnlockedAchievementIds().has(id.trim());
};

const SOCIAL_DOCK_TOUR_PROGRESS_KEY = 'owenminercs-social-dock-tour-v1';
const ACH_SOCIAL_DOCK_GRAND_TOUR = 'social-dock-grand-tour';
const SOCIAL_DOCK_TOUR_SLOTS = Object.freeze([
	'x',
	'reddit',
	'youtube',
	'twitch',
	'instagram',
	'facebook',
	'tiktok',
	'discord',
]);

function readSocialDockTourVisited() {
	try {
		const raw = localStorage.getItem(SOCIAL_DOCK_TOUR_PROGRESS_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
	} catch (_) {
		return new Set();
	}
}

function writeSocialDockTourVisited(set) {
	try {
		localStorage.setItem(SOCIAL_DOCK_TOUR_PROGRESS_KEY, JSON.stringify([...set]));
	} catch (_) {}
}

/** Map external profile URL to a stable slot id (must match `SOCIAL_DOCK_TOUR_SLOTS`). */
function socialDockTourSlotFromHref(href) {
	if (typeof href !== 'string' || !href.trim()) return null;
	let u;
	try {
		u = new URL(href);
	} catch (_) {
		return null;
	}
	const host = u.hostname.replace(/^www\./i, '').toLowerCase();
	if (host === 'x.com' || host === 'twitter.com') return 'x';
	if (host === 'reddit.com' || host.endsWith('.reddit.com')) return 'reddit';
	if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'youtube';
	if (host.endsWith('twitch.tv')) return 'twitch';
	if (host.endsWith('instagram.com')) return 'instagram';
	if (host === 'facebook.com' || host.endsWith('.facebook.com')) return 'facebook';
	if (host.endsWith('tiktok.com')) return 'tiktok';
	if (host === 'discord.gg' || host.endsWith('discord.com')) return 'discord';
	return null;
}

function recordSocialDockTourClick(anchor) {
	if (!(anchor instanceof HTMLAnchorElement)) return;
	if (!anchor.classList.contains('site-social-nav__link')) return;
	if (
		typeof window.owenminercsIsAchievementUnlocked === 'function' &&
		window.owenminercsIsAchievementUnlocked(ACH_SOCIAL_DOCK_GRAND_TOUR)
	) {
		return;
	}
	const slot = socialDockTourSlotFromHref(anchor.getAttribute('href') || '');
	if (!slot || !SOCIAL_DOCK_TOUR_SLOTS.includes(slot)) return;
	const visited = readSocialDockTourVisited();
	visited.add(slot);
	writeSocialDockTourVisited(visited);
	for (let i = 0; i < SOCIAL_DOCK_TOUR_SLOTS.length; i++) {
		if (!visited.has(SOCIAL_DOCK_TOUR_SLOTS[i])) return;
	}
	if (typeof window.owenminercsUnlockAchievement === 'function') {
		window.owenminercsUnlockAchievement(ACH_SOCIAL_DOCK_GRAND_TOUR);
	}
}

const MAIN_NAV_TOUR_PROGRESS_KEY = 'owenminercs-main-nav-tour-v1';
const ACH_MAIN_NAV_FULL_TOUR = 'main-nav-full-tour';
const NAV_RETURN_STATE_KEY = 'owenminercs-nav-return-state-v1';
const NAV_RETURN_SCROLL_KEY = 'owenminercs-nav-return-scroll-v1';
const NAV_RETURN_MAX_AGE_MS = 1000 * 60 * 60 * 8;
/** Stable ids matching header/footer `data-nav` (order matches the bar). */
const MAIN_NAV_TOUR_SLOTS = Object.freeze([
	'index.html',
	'The Setup',
	'Gaming',
	'Donators',
	'garage-sale',
	'Help Wanted',
	'QA',
	'Achievements',
	'Socials',
]);

function readMainNavTourVisited() {
	try {
		const raw = localStorage.getItem(MAIN_NAV_TOUR_PROGRESS_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
	} catch (_) {
		return new Set();
	}
}

function writeMainNavTourVisited(set) {
	try {
		localStorage.setItem(MAIN_NAV_TOUR_PROGRESS_KEY, JSON.stringify([...set]));
	} catch (_) {}
}

/**
 * Map current URL to a main-nav `data-nav` slot, or null if this page is not one of those sections.
 * Mirrors `resolveActiveNavLink` behavior so subpages (e.g. CS2, keyboard) count toward the right tab.
 */
function getMainNavTourSlotFromLocation() {
	let currentPath;
	try {
		currentPath = decodeURIComponent(window.location.pathname || '/');
	} catch (_) {
		currentPath = window.location.pathname || '/';
	}
	const lc = currentPath.toLowerCase();

	// Home (`index.html`) only — do not treat `/Socials/` etc. as home (unlike a loose trailing-slash check).
	if (currentPath === '/' || currentPath === '' || lc.endsWith('index.html')) {
		return 'index.html';
	}
	if (lc.includes('nosmoking') || lc.includes('/counter-strike/')) {
		return 'Gaming';
	}
	if (lc.includes('/keyboard/') && lc.includes('60he')) {
		return 'The Setup';
	}
	if (lc.includes('/pc/')) {
		return 'The Setup';
	}
	if (lc.includes('socials')) {
		return 'Socials';
	}
	if (lc.includes('achievements')) {
		return 'Achievements';
	}
	if (lc.includes('/qa/') || lc.endsWith('/qa')) {
		return 'QA';
	}
	if (lc.includes('help') && lc.includes('wanted')) {
		return 'Help Wanted';
	}
	if (lc.includes('garage') && lc.includes('sale')) {
		return 'garage-sale';
	}
	if (lc.includes('donators')) {
		return 'Donators';
	}
	if (lc.includes('upgrades')) {
		return 'The Setup';
	}
	if (lc.includes('gaming')) {
		return 'Gaming';
	}
	if (lc.includes('the-setup') || lc.includes('the setup') || lc.includes('the%20setup')) {
		return 'The Setup';
	}
	return null;
}

function recordMainNavTourPageVisit() {
	if (document.documentElement.dataset.owenMainNavTourRecorded === '1') return;
	document.documentElement.dataset.owenMainNavTourRecorded = '1';

	const slot = getMainNavTourSlotFromLocation();
	if (!slot || !MAIN_NAV_TOUR_SLOTS.includes(slot)) {
		return;
	}
	if (
		typeof window.owenminercsIsAchievementUnlocked === 'function' &&
		window.owenminercsIsAchievementUnlocked(ACH_MAIN_NAV_FULL_TOUR)
	) {
		return;
	}
	const visited = readMainNavTourVisited();
	visited.add(slot);
	writeMainNavTourVisited(visited);
	for (let i = 0; i < MAIN_NAV_TOUR_SLOTS.length; i++) {
		if (!visited.has(MAIN_NAV_TOUR_SLOTS[i])) return;
	}
	if (typeof window.owenminercsUnlockAchievement === 'function') {
		window.owenminercsUnlockAchievement(ACH_MAIN_NAV_FULL_TOUR);
	}
}

function readJsonStorage(key) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch (_) {
		return null;
	}
}

function writeJsonStorage(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (_) {}
}

function normalizeUrlForMatch(rawUrl) {
	try {
		const parsed = new URL(rawUrl, window.location.href);
		return `${parsed.origin}${parsed.pathname}${parsed.search}`;
	} catch (_) {
		return '';
	}
}

function captureNavReturnState(anchor) {
	if (!(anchor instanceof HTMLAnchorElement)) return;
	if (!anchor.classList.contains('site-nav-link')) return;
	if (anchor.target && anchor.target !== '_self') return;
	const href = anchor.getAttribute('href');
	if (!href) return;
	let destination;
	try {
		destination = new URL(href, window.location.href);
	} catch (_) {
		return;
	}
	if (destination.origin !== window.location.origin) return;

	const fromUrl = window.location.href;
	const toUrl = destination.toString();
	if (normalizeUrlForMatch(fromUrl) === normalizeUrlForMatch(toUrl)) return;

	writeJsonStorage(NAV_RETURN_STATE_KEY, {
		fromUrl,
		fromTitle: (document.title || '').trim(),
		fromScrollX: window.scrollX || 0,
		fromScrollY: window.scrollY || 0,
		toUrl,
		createdAt: Date.now(),
	});
}

function applyPendingNavReturnScrollRestore() {
	const payload = readJsonStorage(NAV_RETURN_SCROLL_KEY);
	if (!payload || typeof payload !== 'object') return;
	if (Date.now() - Number(payload.createdAt || 0) > NAV_RETURN_MAX_AGE_MS) {
		localStorage.removeItem(NAV_RETURN_SCROLL_KEY);
		return;
	}
	const here = normalizeUrlForMatch(window.location.href);
	const target = normalizeUrlForMatch(payload.targetUrl || '');
	if (!here || !target || here !== target) return;

	const x = Number(payload.scrollX);
	const y = Number(payload.scrollY);
	localStorage.removeItem(NAV_RETURN_SCROLL_KEY);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return;

	const restore = function () {
		window.scrollTo(x, y);
	};
	requestAnimationFrame(restore);
	window.setTimeout(restore, 160);
	window.setTimeout(restore, 420);
}

function buildNavReturnButton(record) {
	const wrap = document.createElement('div');
	wrap.className = 'site-nav-return-popup';
	wrap.setAttribute('role', 'status');
	wrap.setAttribute('aria-live', 'polite');
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'site-nav-return-popup__button';
	button.textContent = 'Back';
	const labelSource = record.fromTitle || 'your previous page';
	button.setAttribute('aria-label', `Back to ${labelSource}`);
	button.addEventListener('click', function () {
		writeJsonStorage(NAV_RETURN_SCROLL_KEY, {
			targetUrl: record.fromUrl,
			scrollX: Number(record.fromScrollX) || 0,
			scrollY: Number(record.fromScrollY) || 0,
			createdAt: Date.now(),
		});
		localStorage.removeItem(NAV_RETURN_STATE_KEY);
		window.location.href = record.fromUrl;
	});
	wrap.appendChild(button);
	return wrap;
}

function maybeShowNavReturnButton() {
	const record = readJsonStorage(NAV_RETURN_STATE_KEY);
	if (!record || typeof record !== 'object') return;
	if (Date.now() - Number(record.createdAt || 0) > NAV_RETURN_MAX_AGE_MS) {
		localStorage.removeItem(NAV_RETURN_STATE_KEY);
		return;
	}
	const current = normalizeUrlForMatch(window.location.href);
	const expected = normalizeUrlForMatch(record.toUrl || '');
	const source = normalizeUrlForMatch(record.fromUrl || '');
	if (!current || !expected || current !== expected || current === source) return;
	if (document.querySelector('.site-nav-return-popup')) return;
	document.body.appendChild(buildNavReturnButton(record));
}

function initMainNavReturnHistory() {
	if (document.documentElement.dataset.owenNavReturnBound === '1') return;
	document.documentElement.dataset.owenNavReturnBound = '1';
	document.addEventListener(
		'click',
		function (event) {
			if (event.defaultPrevented) return;
			if (event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const target = event.target;
			const anchor = target && target.closest ? target.closest('a.site-nav-link') : null;
			if (!anchor) return;
			captureNavReturnState(anchor);
		},
		true
	);
	const run = function () {
		applyPendingNavReturnScrollRestore();
		maybeShowNavReturnButton();
	};
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run, { once: true });
	} else {
		run();
	}
}

window.owenminercsClearAchievementProgress = function owenminercsClearAchievementProgress() {
	try {
		localStorage.removeItem(ACHIEVEMENT_STORAGE_KEY);
		localStorage.removeItem(SOCIAL_DOCK_TOUR_PROGRESS_KEY);
		localStorage.removeItem(MAIN_NAV_TOUR_PROGRESS_KEY);
		window.dispatchEvent(new Event('owenminercs-achievements-cleared'));
	} catch (_) {}
};

/** Until `achievement-celebration.js` loads, queue so fast unlocks still get the party. */
(function setupAchievementUnlockedQueue() {
	window.addEventListener('owenminercs-achievement-unlocked', function (e) {
		if (typeof window.owenminercsOnAchievementUnlocked === 'function') {
			window.owenminercsOnAchievementUnlocked(e);
		} else {
			(window.owenminercsAchievementUnlockedQueue =
				window.owenminercsAchievementUnlockedQueue || []).push(e);
		}
	});
})();

/** Loads homepage “What’s new” feed from `data/site-feed.json` (skipped when `#site-feed-list` has `data-site-feed-static`). */
function injectSiteFeedClient() {
	if (document.querySelector('script[data-owen-site-feed]')) return;
	const list = document.getElementById('site-feed-list');
	if (list && list.hasAttribute('data-site-feed-static')) return;
	const s = document.createElement('script');
	s.src = `${siteRoot}scripts/site-feed.js`;
	s.defer = true;
	s.setAttribute('data-owen-site-feed', '1');
	document.body.appendChild(s);
}

/** First-time achievement unlock: confetti, fireworks, toast (see `scripts/achievement-celebration.js`). */
function injectAchievementCelebrationClient() {
	if (document.querySelector('script[data-owen-achievement-celebration]')) return;
	const s = document.createElement('script');
	s.src = `${siteRoot}scripts/achievement-celebration.js`;
	s.defer = true;
	s.setAttribute('data-owen-achievement-celebration', '1');
	document.body.appendChild(s);
}

/* Brand mark paths from Simple Icons (CC0 1.0) — https://simpleicons.org/ — for compact bottom-dock nav only. */
const SOCIAL_ICON_PATHS = {
	x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
	reddit: 'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z',
	youtube:
		'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
	twitch: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z',
	instagram:
		'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
	facebook:
		'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
	tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
	discord:
		'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
};

function socialIconSvg(pathD) {
	return `<svg class="site-social-nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="${pathD}"/></svg>`;
}

/** Custom hover/focus labels for social pills (replaces native title tooltips). */
function socialNavTipMarkup(brandTitle, detailText) {
	return `<span class="site-social-nav__tip" aria-hidden="true"><span class="site-social-nav__tip-panel"><span class="site-social-nav__tip-title">${brandTitle}</span><span class="site-social-nav__tip-detail">${detailText}</span></span></span>`;
}

/** Footer (`site-social-nav--footer`), movable `#site-support-dock` (`site-social-nav--dock`), etc. share this HTML. */
function socialNavMarkup(extraClass) {
	const p = SOCIAL_ICON_PATHS;
	const cls = extraClass ? `site-social-nav ${extraClass}` : 'site-social-nav';
	return `
    <div class="${cls}" role="navigation" aria-label="External social profiles">
      <div class="site-social-nav__spin" data-owen-social-spin>
        <span class="site-social-nav__pivot-mark" aria-hidden="true"></span>
        <div class="site-social-nav__chrome">
          <div class="site-social-nav__main">
            <div class="site-social-nav__links-level">
            <a class="site-social-nav__link" data-social-brand="x" target="_blank" rel="noopener noreferrer" href="https://x.com/OwenMinerCS" aria-label="X (Twitter): @OwenMinerCS">${socialIconSvg(p.x)}${socialNavTipMarkup('X (Twitter)', '@OwenMinerCS')}</a>
            <a class="site-social-nav__link" data-social-brand="reddit" target="_blank" rel="noopener noreferrer" href="https://www.reddit.com/user/OwenMCS" aria-label="Reddit: u/OwenMCS">${socialIconSvg(p.reddit)}${socialNavTipMarkup('Reddit', 'u/OwenMCS')}</a>
            <a class="site-social-nav__link" data-social-brand="youtube" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/@OwenMinerCS" aria-label="YouTube: Owen Miner">${socialIconSvg(p.youtube)}${socialNavTipMarkup('YouTube', 'Owen Miner')}</a>
            <a class="site-social-nav__link" data-social-brand="twitch" target="_blank" rel="noopener noreferrer" href="https://www.twitch.tv/owenminercs" aria-label="Twitch: owenminercs">${socialIconSvg(p.twitch)}${socialNavTipMarkup('Twitch', 'owenminercs')}</a>
            <a class="site-social-nav__link" data-social-brand="instagram" target="_blank" rel="noopener noreferrer" href="https://www.instagram.com/owenminercs/" aria-label="Instagram: @owenminercs">${socialIconSvg(p.instagram)}${socialNavTipMarkup('Instagram', '@owenminercs')}</a>
            <a class="site-social-nav__link" data-social-brand="facebook" target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/profile.php?id=100095719715453" aria-label="Facebook: Owen Miner">${socialIconSvg(p.facebook)}${socialNavTipMarkup('Facebook', 'Owen Miner')}</a>
            <a class="site-social-nav__link" data-social-brand="tiktok" target="_blank" rel="noopener noreferrer" href="https://www.tiktok.com/@owenminercs" aria-label="TikTok: @owenminercs">${socialIconSvg(p.tiktok)}${socialNavTipMarkup('TikTok', '@owenminercs')}</a>
            <a class="site-social-nav__link" data-social-brand="discord" target="_blank" rel="noopener noreferrer" href="${DISCORD_INVITE_URL}" aria-label="Discord: Owen M community">${socialIconSvg(p.discord)}${socialNavTipMarkup('Discord', 'Owen M community')}</a>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function resolveActiveNavLink(scope) {
	const currentPath = window.location.pathname;
	const links = scope.querySelectorAll('nav a[data-nav]');
	let activeLink = null;
	if (currentPath.endsWith('/') || currentPath.endsWith('index.html')) {
		activeLink = scope.querySelector('a[data-nav="index.html"]');
	} else {
		for (const link of links) {
			const dataNav = link.getAttribute('data-nav');
			if (
				dataNav !== 'index.html' &&
				decodeURIComponent(window.location.pathname).includes(dataNav)
			) {
				activeLink = link;
				break;
			}
		}
	}
	if (!activeLink) {
		if (currentPath.includes('nosmoking') || currentPath.includes('/Counter-Strike/')) {
			activeLink = scope.querySelector('a[data-nav="Gaming"]');
		}
		if (
			!activeLink &&
			(currentPath.includes('The%20Setup') ||
				currentPath.includes('The Setup') ||
				currentPath.includes('/Upgrades/'))
		) {
			activeLink = scope.querySelector('a[data-nav="The Setup"]');
		}
		if (!activeLink && currentPath.includes('/Keyboard/') && currentPath.includes('60he')) {
			activeLink = scope.querySelector('a[data-nav="The Setup"]');
		}
		if (!activeLink && currentPath.includes('/PC/')) {
			activeLink = scope.querySelector('a[data-nav="The Setup"]');
		}
	}
	return activeLink;
}

function applyNavHighlight(scope) {
	const links = scope.querySelectorAll('nav a[data-nav]');
	links.forEach((link) => {
		link.classList.add('site-nav-link');
		link.classList.remove('site-nav-link--active');
	});
	const activeLink = resolveActiveNavLink(scope);
	if (activeLink) {
		activeLink.classList.add('site-nav-link--active');
	}
}

class SharedHeader extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
      <header class="site-shared-header">
        <div class="site-shared-header__content">
          <div class="site-header-brand-row">
            <span class="site-header-brand-row__balance" aria-hidden="true"></span>
            <a href="${siteRoot}" class="site-logo-link site-logo-link--header" title="owenminercs.com" aria-label="Home">
              <img class="site-logo" src="${siteRoot}images/${brandLogoFilename('dark')}" alt="owenminercs">
            </a>
            <div class="site-header-dock-cluster">
              <button type="button" class="site-social-dock-reset" data-owen-social-dock-reset="1" title="Reset social bar position" hidden>Reset Social Bar</button>
            </div>
          </div>
          <div class="site-header-sticky-bar">
            <nav aria-label="Primary">
            <ul>
              <li><a href="${siteRoot}" class="site-nav-link" data-nav="index.html" title="Home — bio, intro, and what’s new">Home</a></li>
              <li><a href="${getLink('The%20Setup/the-setup')}" class="site-nav-link" data-nav="The Setup" title="Desk, camping gear, PC, keyboard, and upgrades">Bigfoot's Jungle</a></li>
              <li><a href="${getLink('Gaming/gaming')}" class="site-nav-link" data-nav="Gaming" title="CS2, wallpapers, and gaming pages">Gaming</a></li>
              <li><a href="${getLink('Donators/donators')}" class="site-nav-link" data-nav="Donators" title="Supporters, tips, and thank-yous">Donators</a></li>
              <li><a href="${getLink('Garage%20Sale/garage-sale')}" class="site-nav-link" data-nav="garage-sale" title="Stickers, prints, and items for sale">For sale</a></li>
              <li><a href="${getLink('Help%20Wanted/help-wanted')}" class="site-nav-link" data-nav="Help Wanted" title="Open roles, collabs, and requests">Help Wanted</a></li>
              <li><a href="${getLink('QA/qa')}" class="site-nav-link" data-nav="QA" title="Questions and answers">Q&amp;A</a></li>
              <li><a href="${getLink('dev/dev-stack')}" class="site-nav-link" data-nav="Dev" title="Programs for coding, creative work, and streaming">Programs</a></li>
              <li><a href="${getLink('Achievements/achievements')}" class="site-nav-link" data-nav="Achievements" title="Easter eggs and site milestones">Achievements</a></li>
              <li><a href="${getLink('Socials/socials')}" class="site-nav-link" data-nav="Socials" title="Social feeds and featured posts">Content</a></li>
            </ul>
          </nav>
          <hr class="site-rule site-rule--flush">
          </div>
        </div>
      </header>
    `;

		applyNavHighlight(this);
	}
}

/** Disclosure column: remove earnings line when it is duplicated in the footer byline (cross-page Amazon note). */
function stripFooterAmazonEarningsSuffix(html) {
	if (!html || typeof html !== 'string') return html;
	let s = html;
	s = s.replace(
		/\s*As an Amazon Associate I earn from qualifying purchases through eligible links on those pages\.?(?=\s*<\/i>)/i,
		''
	);
	s = s.replace(
		/\s*As an Amazon Associate I earn from qualifying purchases through eligible links on this page\.?(?=\s*<\/i>)/i,
		''
	);
	s = s.replace(/\s*As an Amazon Associate I earn from qualifying purchases\.?(?=\s*<\/i>)/i, '');
	return s;
}

class SharedFooter extends HTMLElement {
	connectedCallback() {
		// For disclosures, some pages have custom text (like the Bigfoot's Jungle page specifying affiliate links).
		const customDisclosure =
			this.getAttribute('disclosure') ||
			'<i>This page has optional tip links (<a href="https://ko-fi.com/owenminer" data-kofi-link target="_blank" rel="noopener noreferrer">Ko-fi</a>, <a href="https://streamelements.com/owenminercs/tip" data-streamelements-tip-link target="_blank" rel="noopener noreferrer">StreamElements</a>) and no paid shopping links. Bigfoot&#39;s Jungle, Keyboard, and PC pages include Amazon links where Owen Miner participates in the Amazon Associates Program.</i>';

		const pageSpecificAmazonDisclosure = /This page includes Amazon shopping links/i.test(customDisclosure);
		const disclosureForRight = pageSpecificAmazonDisclosure
			? customDisclosure
			: stripFooterAmazonEarningsSuffix(customDisclosure);
		const showCrossPageAmazonByline = !pageSpecificAmazonDisclosure;

		this.innerHTML = `
      <footer>
        <hr class="site-rule site-rule--spaced">
        <h4><a href="#top" class="site-footer-back-top">Back To Top</a></h4>
        <hr class="site-rule site-rule--spaced">
        
        <div>
          <nav aria-label="Main navigation">
            <ul>
              <li><a href="${siteRoot}" class="site-nav-link" data-nav="index.html" title="Home — bio, intro, and what’s new">Home</a></li>
              <li><a href="${getLink('The%20Setup/the-setup')}" class="site-nav-link" data-nav="The Setup" title="Desk, camping gear, PC, keyboard, and upgrades">Bigfoot's Jungle</a></li>
              <li><a href="${getLink('Gaming/gaming')}" class="site-nav-link" data-nav="Gaming" title="CS2, wallpapers, and gaming pages">Gaming</a></li>
              <li><a href="${getLink('Donators/donators')}" class="site-nav-link" data-nav="Donators" title="Supporters, tips, and thank-yous">Donators</a></li>
              <li><a href="${getLink('Garage%20Sale/garage-sale')}" class="site-nav-link" data-nav="garage-sale" title="Stickers, prints, and items for sale">For sale</a></li>
              <li><a href="${getLink('Help%20Wanted/help-wanted')}" class="site-nav-link" data-nav="Help Wanted" title="Open roles, collabs, and requests">Help Wanted</a></li>
              <li><a href="${getLink('QA/qa')}" class="site-nav-link" data-nav="QA" title="Questions and answers">Q&amp;A</a></li>
              <li><a href="${getLink('dev/dev-stack')}" class="site-nav-link" data-nav="Dev" title="Programs for coding, creative work, and streaming">Programs</a></li>
              <li><a href="${getLink('Achievements/achievements')}" class="site-nav-link" data-nav="Achievements" title="Easter eggs and site milestones">Achievements</a></li>
              <li><a href="${getLink('Socials/socials')}" class="site-nav-link" data-nav="Socials" title="Social feeds and featured posts">Content</a></li>
            </ul>
          </nav>
        </div>
        <div class="site-footer-top-row">
          <div class="site-footer-social-bar">
            ${socialNavMarkup('site-social-nav--footer')}
          </div>
          <div class="site-footer-bug-report">
            <p class="site-footer-bug-report__line">If you run into any problems on this website, report bugs in the <a href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer">Discord</a>.</p>
            <p class="site-footer-bug-report__line">Suggestions for the site are welcome there too, so I can track ideas alongside bug reports.</p>
          </div>
        </div>
        <hr class="site-rule site-rule--spaced">
        <div class="site-footer-meta">
          <div class="site-footer-meta__disclosure">
            <h4 id="Disclosure" class="site-footer-meta__disclosure-heading"><span class="site-footer-meta__disclosure-label">Disclosure:</span> ${disclosureForRight}</h4>
            ${
							showCrossPageAmazonByline
								? '<p class="site-footer-meta__amazon">As an Amazon Associate I earn from qualifying purchases through eligible links on those pages.</p>'
								: ''
						}
          </div>
          <div class="site-footer-meta__brand">
            <a href="${siteRoot}" class="site-logo-link site-logo-link--footer" title="owenminercs.com" aria-label="Home — owenminercs.com">
              <img class="site-logo site-logo--footer" src="${siteRoot}images/${brandLogoFilename('dark')}" alt="owenminercs" loading="lazy" decoding="async" />
            </a>
          </div>
          <div class="site-footer-meta__usage">
            <h4 class="site-footer-meta__photos">Reach out on <a href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer">Discord</a> for usage rights on any content on this page. Small creators and individuals are highly encouraged to reach out and I usually give out rights for free! Large companies need to pay for usage for any commercial use including in AI models.</h4>
          </div>
        </div>  
        <hr class="site-rule site-rule--footer-end">
      </footer>
    `;

		applyNavHighlight(this);
		injectSiteFeedClient();
	}
}

customElements.define('shared-header', SharedHeader);
customElements.define('shared-footer', SharedFooter);

/** Client-side search over static JSON; results rendered with DOM APIs only (no HTML injection). */
function initSiteSearch() {
	let entries = [];

	function wireInputToResults(input, resultsEl) {
		function run() {
			const q = input.value || '';
			searchRenderResults(
				resultsEl,
				searchFilterEntries(entries, q, 40),
				q,
				'preview'
			);
		}
		input.addEventListener('input', run);
		input.addEventListener('change', run);
		run();
	}

	const homeInput = document.getElementById('home-site-search-input');
	const homeResults = document.getElementById('home-site-search-results');
	if (!homeInput || !homeResults) return;

	wireInputToResults(homeInput, homeResults);
	const homeForm = homeInput.closest('.site-search-form--home');
	if (homeForm) {
		homeForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const first = homeResults.querySelector('.site-search-results__link');
			if (first instanceof HTMLAnchorElement) first.click();
		});
	}

	fetch(SITE_SEARCH_INDEX_URL)
		.then((r) => {
			if (!r.ok) throw new Error('search index');
			return r.json();
		})
		.then((data) => {
			if (data && Array.isArray(data.entries)) entries = data.entries;
			if (homeInput) {
				const ev = new Event('input', { bubbles: true });
				homeInput.dispatchEvent(ev);
			}
		})
		.catch(() => {
			entries = [];
			if (homeResults) {
				homeResults.textContent = '';
				const p = document.createElement('p');
				p.className = 'site-search-results__empty';
				p.textContent = 'Could not load search index.';
				homeResults.appendChild(p);
			}
		});
}

function disableTextInputControls(root) {
	if (!root || typeof root.querySelectorAll !== 'function') return;

	root.querySelectorAll(TEXT_ENTRY_SELECTOR).forEach((el) => {
		if (el.closest && el.closest('[data-owen-site-search]')) return;
		if (el.dataset && el.dataset.inputDisabledForNow === '1') return;
		el.disabled = true;
		if ('readOnly' in el) el.readOnly = true;
		if (typeof el.placeholder === 'string') {
			el.placeholder = 'Temporarily disabled';
		}
		el.setAttribute('aria-disabled', 'true');
		if (el.dataset) el.dataset.inputDisabledForNow = '1';
	});

	root.querySelectorAll('[contenteditable=""], [contenteditable="true"]').forEach((el) => {
		el.setAttribute('contenteditable', 'false');
		el.setAttribute('aria-disabled', 'true');
	});
}

function initTemporaryInputLockdown() {
	disableTextInputControls(document);
	const observer = new MutationObserver((records) => {
		records.forEach((record) => {
			if (!(record.target instanceof Element)) return;
			disableTextInputControls(record.target);
			record.addedNodes.forEach((node) => {
				if (node instanceof Element) disableTextInputControls(node);
			});
		});
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });
}

const WORD_GLOW_SKIP =
	'script, style, noscript, template, pre, code, textarea, kbd, samp, svg, math, [data-no-word-glow], .no-word-glow, h1, h2, h3, h4, h5, h6, .keep-card__label, .keep-card__affiliate a, .keep-card__cta';

/** Per-word hover/bookmark only inside a long `p` or `li` (nav + short copy stay on normal link/card styles). */
const WORD_GLOW_MIN_PROSE_CHARS = 200;

function isWordGlowProseBlock(el) {
	const block = el.closest('p, li');
	if (!block) return false;
	const len = block.textContent.replace(/\s+/g, ' ').trim().length;
	return len >= WORD_GLOW_MIN_PROSE_CHARS;
}

/** One green block for the whole link (not per-word); skip chrome / image-only / nested links. */
function shouldWrapLinkAsLineGlow(a) {
	if (!(a instanceof HTMLAnchorElement)) return false;
	const href = a.getAttribute('href');
	if (!href || !String(href).trim()) return false;
	if (a.querySelector('.text-word-glow')) return false;
	if (a.querySelector('a')) return false;
	if (a.closest('script, style, noscript, template, pre, code, textarea, kbd, samp, svg, math'))
		return false;
	if (a.closest('[data-no-word-glow], .no-word-glow')) return false;
	if (a.matches('.site-nav-link, .site-logo-link, .site-social-nav__link')) return false;
	if (a.matches('.donators-support-hero')) return false;
	if (a.closest('.site-nav-link, .site-social-nav')) return false;
	if (
		a.closest('.keep-card__affiliate') ||
		a.closest('.keep-card__cta') ||
		a.matches('.keep-card__cta')
	)
		return false;
	if (!/\S/.test(a.textContent || '')) return false;
	const imgs = a.querySelectorAll('img');
	if (imgs.length && !/\S/.test(a.textContent.replace(/\u00a0/g, ' '))) return false;
	return true;
}

function wrapLinkContentsInLineGlow(a) {
	const span = document.createElement('span');
	span.className = 'text-word-glow text-word-glow--line';
	while (a.firstChild) span.appendChild(a.firstChild);
	a.appendChild(span);
}

function wrapAllEligibleLinksAsLineGlow(root) {
	const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
	scope.querySelectorAll('a[href]').forEach((a) => {
		if (!shouldWrapLinkAsLineGlow(a)) return;
		wrapLinkContentsInLineGlow(a);
	});
}

function collectWordGlowTextNodes(root) {
	const out = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			if (!node.nodeValue || !/\S/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
			const p = node.parentElement;
			if (!p) return NodeFilter.FILTER_REJECT;
			/* Header/footer nav pills use their own border + outer glow — no per-word highlight */
			if (p.closest('.site-nav-link')) return NodeFilter.FILTER_REJECT;
			if (p.closest(WORD_GLOW_SKIP)) return NodeFilter.FILTER_REJECT;
			if (p.closest('a[href]')) return NodeFilter.FILTER_REJECT;
			if (p.classList?.contains('text-word-glow')) return NodeFilter.FILTER_REJECT;
			if (p.closest('.text-word-glow--line')) return NodeFilter.FILTER_REJECT;
			if (!isWordGlowProseBlock(p)) return NodeFilter.FILTER_REJECT;
			return NodeFilter.FILTER_ACCEPT;
		},
	});
	let n;
	while ((n = walker.nextNode())) out.push(n);
	return out;
}

function debounce(fn, ms) {
	let t;
	return function (...args) {
		clearTimeout(t);
		t = setTimeout(() => fn.apply(this, args), ms);
	};
}

function isShortFormIframeSrc(rawSrc, iframeEl) {
	if (!rawSrc) return false;
	const markerText = `${iframeEl?.className || ''} ${iframeEl?.title || ''}`.toLowerCase();
	const hasShortMarker =
		iframeEl?.dataset?.shortForm === '1' ||
		markerText.includes('short') ||
		markerText.includes('reel') ||
		markerText.includes('tiktok');
	const attrWidth = Number.parseInt(String(iframeEl?.getAttribute?.('width') || ''), 10);
	const attrHeight = Number.parseInt(String(iframeEl?.getAttribute?.('height') || ''), 10);
	const looksPortrait =
		Number.isFinite(attrWidth) &&
		Number.isFinite(attrHeight) &&
		attrWidth > 0 &&
		attrHeight > attrWidth;
	try {
		const parsed = new URL(rawSrc, window.location.origin);
		const host = parsed.hostname.toLowerCase();
		const path = parsed.pathname.toLowerCase();
		const shortsFlag = parsed.searchParams.get('shorts');
		if (host.includes('tiktok.com')) return true;
		if (host.includes('instagram.com') && (path.includes('/reel/') || path.includes('/reels/')))
			return true;
		if (host.includes('youtube.com') || host.includes('youtu.be')) {
			return (
				path.includes('/shorts/') ||
				shortsFlag === '1' ||
				(path.includes('/embed/') && (hasShortMarker || looksPortrait))
			);
		}
	} catch (_) {
		const fallback = String(rawSrc).toLowerCase();
		if (fallback.includes('tiktok.com')) return true;
		if (fallback.includes('instagram.com/reel') || fallback.includes('instagram.com/reels'))
			return true;
		if (fallback.includes('youtube.com/shorts/') || fallback.includes('shorts=1')) return true;
		if (fallback.includes('youtube.com/embed/') && (hasShortMarker || looksPortrait))
			return true;
	}
	return false;
}

function getYouTubeEmbedId(rawSrc) {
	if (!rawSrc) return '';
	try {
		const parsed = new URL(rawSrc, window.location.origin);
		const path = parsed.pathname;
		if (path.includes('/embed/')) {
			return (path.split('/embed/')[1] || '').split('/')[0].trim();
		}
		if (path.includes('/shorts/')) {
			return (path.split('/shorts/')[1] || '').split('/')[0].trim();
		}
		if (parsed.searchParams.get('v')) {
			return parsed.searchParams.get('v').trim();
		}
	} catch (_) {
		const idMatch = String(rawSrc).match(/(?:\/embed\/|\/shorts\/|[?&]v=)([A-Za-z0-9_-]{8,})/i);
		if (idMatch && idMatch[1]) return idMatch[1].trim();
	}
	return '';
}

function buildShortFormLoopSrc(rawSrc) {
	if (!rawSrc) return '';
	try {
		const parsed = new URL(rawSrc, window.location.origin);
		parsed.searchParams.set('loop', '1');
		parsed.searchParams.set('playsinline', '1');
		const host = parsed.hostname.toLowerCase();
		if (host.includes('youtube.com') || host.includes('youtu.be')) {
			const videoId = getYouTubeEmbedId(parsed.toString());
			if (videoId) {
				parsed.searchParams.set('playlist', videoId);
			}
		}
		return parsed.toString();
	} catch (_) {
		const hasQuery = rawSrc.includes('?');
		return `${rawSrc}${hasQuery ? '&' : '?'}loop=1&playsinline=1`;
	}
}

function shouldLoopVideoElement(video) {
	if (!video) return false;
	if (video.dataset.noLoop === '1') return false;
	if (video.dataset.shortForm === '1') return true;
	const src = (video.currentSrc || video.src || '').toLowerCase();
	if (src.includes('tiktok') || src.includes('instagram') || src.includes('/shorts/'))
		return true;
	if (
		video.classList &&
		(video.classList.contains('short') ||
			video.classList.contains('short-form') ||
			video.classList.contains('reel'))
	)
		return true;
	return video.closest('[data-short-form="1"], .short, .short-form, .reel') !== null;
}

function enforceShortFormLooping(scope) {
	const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;

	root.querySelectorAll('video').forEach((video) => {
		if (!shouldLoopVideoElement(video)) return;
		if (!video.loop) video.loop = true;
		if (video.dataset.shortLoopBound === '1') return;
		video.dataset.shortLoopBound = '1';
		video.addEventListener('ended', () => {
			video.currentTime = 0;
			const playPromise = video.play();
			if (playPromise && typeof playPromise.catch === 'function') {
				playPromise.catch(() => {});
			}
		});
	});

	root.querySelectorAll('iframe[src]').forEach((iframe) => {
		if (iframe.dataset.noLoop === '1') return;
		const currentSrc = iframe.getAttribute('src') || '';
		if (!isShortFormIframeSrc(currentSrc, iframe)) return;
		const nextSrc = buildShortFormLoopSrc(currentSrc);
		if (nextSrc && nextSrc !== currentSrc) {
			iframe.setAttribute('src', nextSrc);
		}
		iframe.dataset.shortLoopApplied = '1';
	});
}

function initShortFormLooping() {
	enforceShortFormLooping(document);
	const observer = new MutationObserver((records) => {
		records.forEach((record) => {
			record.addedNodes.forEach((node) => {
				if (!(node instanceof Element)) return;
				if (node.matches && (node.matches('video') || node.matches('iframe[src]'))) {
					enforceShortFormLooping(node.parentElement || document);
					return;
				}
				enforceShortFormLooping(node);
			});
		});
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });
}

/** Flatten legacy marquee markup so titles are plain text and can wrap. */
function flattenLegacyKeepCardLabel(el) {
	const clip = el.querySelector(':scope > .keep-card__label-clip');
	if (!clip) return;
	const text = el.textContent.replace(/\s+/g, ' ').trim();
	el.replaceChildren();
	if (text) el.appendChild(document.createTextNode(text));
	el.classList.remove('keep-card__label--overflow');
}

function prepareKeepCardLineGlows() {
	document.querySelectorAll('.keep-card__label').forEach((el) => {
		flattenLegacyKeepCardLabel(el);
	});
}

function wrapWordsInTextNode(textNode) {
	const text = textNode.nodeValue;
	const parts = text.split(/(\s+)/);
	const frag = document.createDocumentFragment();
	for (const part of parts) {
		if (!part) continue;
		if (/^\s+$/.test(part)) {
			frag.appendChild(document.createTextNode(part));
		} else {
			const span = document.createElement('span');
			span.className = 'text-word-glow';
			span.textContent = part;
			frag.appendChild(span);
		}
	}
	textNode.parentNode.replaceChild(frag, textNode);
}

/** Per-word glow in long `p` / `li` only; whole-link glow on eligible anchors site-wide. */
function initWordBackgroundGlow() {
	prepareKeepCardLineGlows();
	wrapAllEligibleLinksAsLineGlow(document.body);
	const textNodes = collectWordGlowTextNodes(document.body);
	for (const tn of textNodes) {
		wrapWordsInTextNode(tn);
	}
	initWordGlowBookmark();
	restoreWordGlowBookmarksFromStorage();
}

const WORD_GLOW_BOOKMARK_SKIP =
	'button, input, select, textarea, label, summary, [contenteditable="true"], [role="button"], [role="tab"]';

const WORD_GLOW_BOOKMARK_STORAGE_KEY = 'owenminercs-word-glow-bookmarks';

/** Stable per-page key (path only; trailing slash normalized). */
function wordGlowBookmarkPathKey() {
	let p = typeof location !== 'undefined' && location.pathname ? location.pathname : '/';
	if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
	return p || '/';
}

function listWordGlowSpansInDocumentOrder() {
	return Array.from(document.querySelectorAll('.text-word-glow'));
}

function persistWordGlowBookmarksFromDom() {
	try {
		if (!document.querySelector('.text-word-glow')) return;
		const path = wordGlowBookmarkPathKey();
		const all = listWordGlowSpansInDocumentOrder();
		const indices = [];
		for (let i = 0; i < all.length; i += 1) {
			if (all[i].classList.contains('text-word-glow--bookmark')) indices.push(i);
		}
		const raw = localStorage.getItem(WORD_GLOW_BOOKMARK_STORAGE_KEY);
		const store = raw ? JSON.parse(raw) : {};
		if (typeof store !== 'object' || store === null) return;
		if (!indices.length) delete store[path];
		else store[path] = indices;
		localStorage.setItem(WORD_GLOW_BOOKMARK_STORAGE_KEY, JSON.stringify(store));
	} catch (_) {}
}

function restoreWordGlowBookmarksFromStorage() {
	try {
		const raw = localStorage.getItem(WORD_GLOW_BOOKMARK_STORAGE_KEY);
		if (!raw) return;
		const store = JSON.parse(raw);
		if (typeof store !== 'object' || store === null) return;
		const path = wordGlowBookmarkPathKey();
		const saved = store[path];
		if (!Array.isArray(saved) || !saved.length) return;
		const want = new Set(
			saved.filter((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)
		);
		if (!want.size) return;
		const all = listWordGlowSpansInDocumentOrder();
		for (let i = 0; i < all.length; i += 1) {
			if (want.has(i)) all[i].classList.add('text-word-glow--bookmark');
		}
	} catch (_) {}
}

/**
 * Click a word to pin the green outline (many pins allowed). Click the same word again to remove
 * that pin only. Words inside links: Alt+click to add a pin so normal clicks still follow the URL;
 * a pinned word inside a link toggles off with a normal click (link does not fire).
 * Pins persist in localStorage per URL until toggled off.
 */
function initWordGlowBookmark() {
	if (document.documentElement.dataset.wordGlowBookmarkBound === '1') return;
	document.documentElement.dataset.wordGlowBookmarkBound = '1';

	document.addEventListener('click', (e) => {
		if (e.button !== 0) return;
		const t = e.target;
		if (!(t instanceof Element)) return;

		const w = t.closest('.text-word-glow');
		if (!w) return;

		if (w.closest('.site-nav-link')) return;
		if (w.closest(WORD_GLOW_BOOKMARK_SKIP)) return;

		const inLink = w.closest('a[href]');

		if (w.classList.contains('text-word-glow--bookmark')) {
			if (inLink) {
				e.preventDefault();
				e.stopPropagation();
			}
			w.classList.remove('text-word-glow--bookmark');
			persistWordGlowBookmarksFromDom();
			return;
		}

		if (inLink && !e.altKey) return;

		if (inLink && e.altKey) {
			e.preventDefault();
			e.stopPropagation();
		}

		w.classList.add('text-word-glow--bookmark');
		persistWordGlowBookmarksFromDom();
		if (typeof window.owenminercsUnlockAchievement === 'function') {
			window.owenminercsUnlockAchievement('lexicon-pin');
		}
	});

	window.addEventListener('pagehide', persistWordGlowBookmarksFromDom);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') persistWordGlowBookmarksFromDom();
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initWordBackgroundGlow);
	document.addEventListener('DOMContentLoaded', initTemporaryInputLockdown);
	document.addEventListener('DOMContentLoaded', initShortFormLooping);
	document.addEventListener('DOMContentLoaded', initSiteSearch);
} else {
	initWordBackgroundGlow();
	initTemporaryInputLockdown();
	initShortFormLooping();
	initSiteSearch();
}

const SOCIAL_DOCK_POS_KEY = 'owenminercs-social-dock-pos';
const SOCIAL_DOCK_CUSTOMIZED_CLASS = 'site-support-dock--customized';
const SOCIAL_DOCK_DRAG_LOCK_CLASS = 'site-support-dock--drag-lock-horizontal';

function querySocialDockHeaderSlot() {
	return document.querySelector('.site-header-dock-cluster');
}

/** Order: reset button (if any), then dock. Returns false when no header slot exists yet. */
function appendDockToDefaultSlot(wrap) {
	const slot = querySocialDockHeaderSlot();
	if (!slot) return false;
	const reset = slot.querySelector('[data-owen-social-dock-reset]');
	if (reset) {
		reset.after(wrap);
	} else {
		slot.appendChild(wrap);
	}
	return true;
}

/** Move dock into `.site-header-dock-cluster` when possible; otherwise fixed near header (same as inject fallback). */
function relocateSocialDockToDefaultMount(wrap) {
	if (appendDockToDefaultSlot(wrap)) return;
	document.body.appendChild(wrap);
	wrap.classList.add('site-support-dock--placed');
	requestAnimationFrame(() => {
		const pos = getSocialDockDefaultViewportPosition(wrap);
		const c = clampSocialDockToViewport(wrap, pos.left, pos.top);
		wrap.style.left = `${c.left}px`;
		wrap.style.top = `${c.top}px`;
	});
}

const SOCIAL_DOCK_DRAG_ARIA_DESC =
	'Drag the middle of the pill to move the bar (you can drag it partly or fully off-screen). Drag near the outer edge of the pill to rotate and resize. Double-click empty space on the bar to reset, or use Reset Social Bar in the header if the bar is off-screen.';
const SOCIAL_DOCK_DRAG_THRESHOLD_PX = 6;
/** After release, short “ice” coast — scales pointer speed (keeps glide slow). */
const SOCIAL_DOCK_ICE_VELOCITY_SCALE = 0.3;
const SOCIAL_DOCK_ICE_FRICTION_PER_S = 6.2;
const SOCIAL_DOCK_ICE_MIN_SPEED_PX_S = 7.5;
const SOCIAL_DOCK_ICE_MAX_COAST_PX = 168;
const SOCIAL_DOCK_ICE_MIN_FLING_PX_S = 35;
const SOCIAL_DOCK_ICE_VEL_SMOOTH = 0.4;
const SOCIAL_DOCK_SCALE_MIN = 0.5;
const SOCIAL_DOCK_SCALE_MAX = 2;
/** Avoid unstable ratio when the pointer starts very close to the pivot. */
const SOCIAL_DOCK_RESIZE_R0_MIN_PX = 6;
/** Distance from the pill edge (axis-aligned bounds) that counts as an edge drag for rotate/resize */
const SOCIAL_DOCK_EDGE_ROTATE_PX = 14;

/** True when the pointer lies inside the pill but within {@link SOCIAL_DOCK_EDGE_ROTATE_PX} of its rim */
function isPointerOnSocialBarEdge(clientX, clientY, mainEl) {
	if (!(mainEl instanceof Element)) return false;
	const r = mainEl.getBoundingClientRect();
	if (r.width < 2 || r.height < 2) return false;
	const inside =
		clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
	if (!inside) return false;
	const dl = clientX - r.left;
	const dt = clientY - r.top;
	const dr = r.right - clientX;
	const db = r.bottom - clientY;
	return Math.min(dl, dt, dr, db) <= SOCIAL_DOCK_EDGE_ROTATE_PX;
}

function clampSocialDockScale(s) {
	if (!Number.isFinite(s)) return 1;
	return Math.min(SOCIAL_DOCK_SCALE_MAX, Math.max(SOCIAL_DOCK_SCALE_MIN, s));
}

/** Parse `--site-social-tilt` inline value like `12.5deg` (degrees may be unbounded). */
function parseSocialDockTiltDeg(tv) {
	if (!tv || typeof tv !== 'string') return null;
	const t = parseFloat(tv.replace(/deg\s*$/i, '').trim());
	return Number.isFinite(t) ? t : null;
}

/** Integer coords for fixed positioning (no viewport clamp — users may drag partially off-screen). */
function socialDockCoordsRounded(x, y) {
	return { left: Math.round(x), top: Math.round(y) };
}

/**
 * Keeps the dock inside the viewport with a small margin. Use only for **default** anchor
 * placement (header fallback, resize when not customized). Do not use while dragging — the
 * iterative correction fights the pointer near edges and feels glitchy.
 */
function clampSocialDockToViewport(wrap, x, y) {
	/* 2px: allow the dock to sit almost flush with the viewport when placed */
	const margin = 2;
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	let nx = Math.round(x);
	let ny = Math.round(y);
	/*
	 * offsetWidth/offsetHeight ignore transforms on descendants. A rotated/scaled bar
	 * can be visually tall/narrow while the wrap stays wide — clamping on layout size
	 * leaves large fake “margins”. Use the spin’s transformed bounds instead.
	 */
	const probe =
		wrap.querySelector('.site-social-nav__spin') ||
		wrap.querySelector('.site-social-nav--dock') ||
		wrap;
	for (let i = 0; i < 8; i++) {
		wrap.style.left = `${nx}px`;
		wrap.style.top = `${ny}px`;
		const rects = [probe.getBoundingClientRect()];
		let adjX = 0;
		let adjY = 0;
		for (const r of rects) {
			if (r.left < margin) adjX += margin - r.left;
			if (r.right > vw - margin) adjX -= r.right - (vw - margin);
			if (r.top < margin) adjY += margin - r.top;
			if (r.bottom > vh - margin) adjY -= r.bottom - (vh - margin);
		}
		if (adjX === 0 && adjY === 0) break;
		nx += adjX;
		ny += adjY;
	}
	return { left: Math.round(nx), top: Math.round(ny) };
}

function setSocialDockCustomized(wrap, customized) {
	if (!(wrap instanceof Element)) return;
	const isCustomized = Boolean(customized);
	wrap.classList.toggle(SOCIAL_DOCK_CUSTOMIZED_CLASS, isCustomized);
	const reset = document.querySelector('[data-owen-social-dock-reset]');
	if (reset) {
		reset.hidden = !isCustomized;
	}
}

/** Normalize fractional pixels after a gesture; does not pull the bar back into view. */
function clampPlacedSocialDockInViewport(wrap) {
	if (!wrap.classList.contains('site-support-dock--placed')) return;
	const left = parseFloat(wrap.style.left);
	const top = parseFloat(wrap.style.top);
	if (!Number.isFinite(left) || !Number.isFinite(top)) return;
	const c = socialDockCoordsRounded(left, top);
	wrap.style.left = `${c.left}px`;
	wrap.style.top = `${c.top}px`;
}

function applySavedSocialDockPosition(wrap) {
	try {
		setSocialDockCustomized(wrap, false);
		const raw = localStorage.getItem(SOCIAL_DOCK_POS_KEY);
		if (!raw) return;
		const pos = JSON.parse(raw);
		const defaultPos = getSocialDockDefaultViewportPosition(wrap);
		const placementCustomized =
			typeof pos.left === 'number' &&
			typeof pos.top === 'number' &&
			(Math.abs(pos.left - defaultPos.left) > SOCIAL_DOCK_DRAG_THRESHOLD_PX ||
				Math.abs(pos.top - defaultPos.top) > SOCIAL_DOCK_DRAG_THRESHOLD_PX);
		const isCustomized =
			placementCustomized ||
			(typeof pos.scale === 'number' &&
				Number.isFinite(pos.scale) &&
				Math.abs(clampSocialDockScale(pos.scale) - 1) > 0.001) ||
			(typeof pos.tilt === 'number' &&
				Number.isFinite(pos.tilt) &&
				Math.abs(pos.tilt) > 0.001);
		if (!isCustomized) {
			localStorage.removeItem(SOCIAL_DOCK_POS_KEY);
			ensureSocialDockDefaultSlotIfUnplaced(wrap);
			return;
		}
		if (typeof pos.left === 'number' && typeof pos.top === 'number') {
			document.body.appendChild(wrap);
			wrap.classList.add('site-support-dock--placed');
			const c = socialDockCoordsRounded(pos.left, pos.top);
			wrap.style.left = `${c.left}px`;
			wrap.style.top = `${c.top}px`;
		}
		const spin = wrap.querySelector('.site-social-nav__spin');
		if (spin && typeof pos.scale === 'number' && Number.isFinite(pos.scale)) {
			spin.style.setProperty('--site-social-scale', String(clampSocialDockScale(pos.scale)));
		}
		if (spin && typeof pos.tilt === 'number' && Number.isFinite(pos.tilt)) {
			spin.style.setProperty('--site-social-tilt', `${pos.tilt}deg`);
		}
		setSocialDockCustomized(wrap, isCustomized);
		if (isCustomized) {
			clampPlacedSocialDockInViewport(wrap);
		}
	} catch (_) {}
}

function persistSocialDockPosition(wrap) {
	try {
		/** @type { { left?: number; top?: number; scale?: number; tilt?: number; customized?: boolean } } */
		const next = {};
		if (wrap.classList.contains(SOCIAL_DOCK_CUSTOMIZED_CLASS)) {
			next.customized = true;
		}
		if (next.customized === true && wrap.classList.contains('site-support-dock--placed')) {
			const left = parseFloat(wrap.style.left);
			const top = parseFloat(wrap.style.top);
			if (Number.isFinite(left) && Number.isFinite(top)) {
				next.left = left;
				next.top = top;
			}
		}
		const spin = wrap.querySelector('.site-social-nav__spin');
		if (spin) {
			const sv = spin.style.getPropertyValue('--site-social-scale').trim();
			const n = parseFloat(sv);
			if (Number.isFinite(n) && Math.abs(n - 1) > 0.001) {
				next.scale = clampSocialDockScale(n);
			}
			const tv = spin.style.getPropertyValue('--site-social-tilt').trim();
			const tiltParsed = parseSocialDockTiltDeg(tv);
			if (tiltParsed !== null && Math.abs(tiltParsed) > 0.001) {
				next.tilt = tiltParsed;
			}
		}
		if (
			typeof next.left !== 'number' &&
			typeof next.top !== 'number' &&
			typeof next.scale !== 'number' &&
			typeof next.tilt !== 'number' &&
			next.customized !== true
		) {
			localStorage.removeItem(SOCIAL_DOCK_POS_KEY);
			return;
		}
		localStorage.setItem(SOCIAL_DOCK_POS_KEY, JSON.stringify(next));
	} catch (_) {}
}

function unlockSocialDockMoveAchievement() {
	if (typeof window.owenminercsUnlockAchievement !== 'function') return;
	try {
		window.owenminercsUnlockAchievement(ACH_SOCIAL_DOCK_MOVE);
	} catch (_) {}
}

function clearSocialDockPosition(wrap) {
	wrap.classList.remove('site-support-dock--placed', 'site-support-dock--dragging');
	setSocialDockCustomized(wrap, false);
	wrap.style.left = '';
	wrap.style.top = '';
	const spin = wrap.querySelector('.site-social-nav__spin');
	if (spin) {
		spin.style.removeProperty('--site-social-scale');
		spin.style.removeProperty('--site-social-tilt');
	}
	relocateSocialDockToDefaultMount(wrap);
	try {
		localStorage.removeItem(SOCIAL_DOCK_POS_KEY);
	} catch (_) {}
}

function resetSocialDockToDefault(wrap) {
	try {
		wrap.dispatchEvent(new CustomEvent('owen-social-dock-reset'));
	} catch (_) {}
	clearSocialDockPosition(wrap);
	ensureSocialDockDefaultSlotIfUnplaced(wrap);
	applyDefaultSocialDockAnchor(wrap);
	setSocialDockCustomized(wrap, false);
	persistSocialDockPosition(wrap);
}

/** Gap from viewport edge when floating without a header slot (fallback). */
const SOCIAL_DOCK_VIEWPORT_FALLBACK_GAP_PX = 10;

/**
 * Reference viewport position for persistence comparisons and rare no-header fallback.
 * When the dock sits in `.site-header-dock-cluster`, matches that slot on screen.
 */
function getSocialDockDefaultViewportPosition(wrap) {
	const margin = 2;
	if (!(wrap instanceof Element)) {
		return { left: margin, top: margin };
	}
	const slot = querySocialDockHeaderSlot();
	if (slot && slot.contains(wrap)) {
		const sr = slot.getBoundingClientRect();
		const wr = wrap.getBoundingClientRect();
		const dockW = Math.max(wr.width, 40);
		const dockH = Math.max(wr.height, 32);
		let left = Math.round(sr.right - dockW);
		let top = Math.round(sr.top + (sr.height - dockH) / 2);
		left = Math.max(margin, Math.min(left, window.innerWidth - margin - dockW));
		top = Math.max(margin, Math.min(top, window.innerHeight - margin - dockH));
		return { left, top };
	}
	const brand = document.querySelector('.site-header-brand-row');
	const anchor = brand || document.querySelector('.site-shared-header');
	if (!anchor) {
		return { left: margin, top: margin };
	}
	const ar = anchor.getBoundingClientRect();
	const wr = wrap.getBoundingClientRect();
	const dockW = Math.max(wr.width, 40);
	const dockH = Math.max(wr.height, 40);
	let left = Math.round(ar.right - dockW - SOCIAL_DOCK_VIEWPORT_FALLBACK_GAP_PX);
	left = Math.max(margin, left);
	let top = Math.round(ar.top + (ar.height - dockH) / 2);
	return { left, top };
}

/**
 * Recompute default anchor (header-relative) when the dock is not user-customized.
 * Safe after layout: uses live dock bounds for centering.
 */
function applyDefaultSocialDockAnchor(wrap) {
	if (!(wrap instanceof Element)) return;
	if (wrap.classList.contains(SOCIAL_DOCK_CUSTOMIZED_CLASS)) return;
	if (!wrap.classList.contains('site-support-dock--placed')) return;
	const pos = getSocialDockDefaultViewportPosition(wrap);
	const c = clampSocialDockToViewport(wrap, pos.left, pos.top);
	wrap.style.left = `${c.left}px`;
	wrap.style.top = `${c.top}px`;
}

/** Default: dock lives in the header cluster (not fixed / not placed). Body fallback uses `--placed` + coords until the header exists. */
function ensureSocialDockDefaultSlotIfUnplaced(wrap) {
	if (wrap.classList.contains(SOCIAL_DOCK_CUSTOMIZED_CLASS)) return;
	wrap.style.left = '';
	wrap.style.top = '';
	if (appendDockToDefaultSlot(wrap)) {
		wrap.classList.remove('site-support-dock--placed');
	} else {
		relocateSocialDockToDefaultMount(wrap);
	}
	persistSocialDockPosition(wrap);
}

/** After `shared-header` connects, move dock from body fallback into `.site-header-dock-cluster`. */
function syncSocialDockIntoHeaderWhenPossible(wrap) {
	if (!(wrap instanceof Element)) return;
	if (wrap.classList.contains(SOCIAL_DOCK_CUSTOMIZED_CLASS)) return;
	if (!appendDockToDefaultSlot(wrap)) return;
	wrap.classList.remove('site-support-dock--placed');
	wrap.style.left = '';
	wrap.style.top = '';
	persistSocialDockPosition(wrap);
}

const TWO_PI = Math.PI * 2;
/** Flick the rotate handle: carry angular velocity, damp over time, tap anywhere on the bar to stop */
const MOMENTUM_MIN_SPEED = 100;
const MOMENTUM_STOP_SPEED = 5;
const MOMENTUM_DAMP = 2.2;
const MOMENTUM_MAX_SPEED = 2200;
/** 5+ full net turns in one drag (or one-way wiggle-free path), then 2s ultra-fast coast + spin-down (unlock) */
const FIDGET_FIVE_REV_DEG = 5 * 360;
/** Slight under-threshold: float math + wobble that splits one-way odometer without changing net */
const FIDGET_DEG_TOL = 20;
const FIDGET_TURBO_MS = 2000;
const FIDGET_TURBO_DEG_PER_SEC = 8200;
const ACH_FIDGET_SPINNER = 'fidget-spinner';
const ACH_SOCIAL_DOCK_MOVE = 'social-dock-move';
/** Visual preset for the achievement “turbo” spin; CSS keyed by `data-fidget-fx`. */
const FIDGET_FX_VARIANTS = 6;
function pickFidgetFxVariant() {
	return Math.floor(Math.random() * FIDGET_FX_VARIANTS);
}
/** @param { Element | null } spinEl */
function clearFidgetTurboVisual(spinEl) {
	if (!(spinEl instanceof Element)) return;
	spinEl.classList.remove('is-fidget-turbo');
	spinEl.removeAttribute('data-fidget-fx');
}

function getPivotFromMark(mark) {
	if (!(mark instanceof Element)) return null;
	const r = mark.getBoundingClientRect();
	return {
		x: r.left + r.width / 2,
		y: r.top + r.height / 2,
	};
}

function initSiteSocialDragRotate(wrap) {
	const nav = wrap.querySelector('.site-social-nav--dock');
	if (!nav) return;
	const spin = nav.querySelector('.site-social-nav__spin');
	const mark = nav.querySelector('.site-social-nav__pivot-mark');
	if (!spin || !mark) return;
	function readTiltDegFromSpin() {
		const tv = spin.style.getPropertyValue('--site-social-tilt').trim();
		const p = parseSocialDockTiltDeg(tv);
		return p !== null ? p : 0;
	}
	let currentDeg = readTiltDegFromSpin();
	function readScaleFromSpin() {
		const sv = spin.style.getPropertyValue('--site-social-scale').trim();
		if (!sv) return 1;
		const n = parseFloat(sv);
		return Number.isFinite(n) ? clampSocialDockScale(n) : 1;
	}
	let currentScale = readScaleFromSpin();
	/**
	 * @type { { lastT: number; rafId: number; phase: 'damp' | 'turbo'; v: number; turboMs: number; sign: 1 | -1 } | null }
	 */
	let spinMomentum = null;
	/** Unbounded total rotation; CSS `rotate(deg)` is periodic so values need not be mod 360. */
	function setRotation(deg) {
		if (!Number.isFinite(deg)) return;
		currentDeg = deg;
		spin.style.setProperty('--site-social-tilt', `${deg}deg`);
	}
	/** Uniform scale keeps bar proportions; driven by pointer distance from pivot vs gesture start. */
	function setScale(s) {
		const sc = clampSocialDockScale(s);
		currentScale = sc;
		if (Math.abs(sc - 1) < 0.0005) {
			spin.style.removeProperty('--site-social-scale');
		} else {
			spin.style.setProperty('--site-social-scale', String(sc));
		}
	}
	function onVisibilityForMomentum() {
		if (document.hidden) {
			/* rAF throttles in the background; stop the loop to avoid a pile-up of state */
			stopSpinMomentum();
		}
	}
	function stopSpinMomentum() {
		if (!spinMomentum) return;
		cancelAnimationFrame(spinMomentum.rafId);
		document.removeEventListener('visibilitychange', onVisibilityForMomentum);
		spinMomentum = null;
		clearFidgetTurboVisual(spin);
		persistSocialDockPosition(wrap);
	}
	wrap.addEventListener('owen-social-dock-reset', () => {
		stopSpinMomentum();
	});
	function startFidgetChampionSpin(sign) {
		stopSpinMomentum();
		if (sign !== 1 && sign !== -1) return;
		/** @type { typeof spinMomentum } */
		const state = {
			phase: /** @type { 'turbo' } */ ('turbo'),
			sign: /** @type { 1 | -1 } */ (sign),
			turboMs: 0,
			v: FIDGET_TURBO_DEG_PER_SEC * sign,
			lastT: performance.now(),
			rafId: 0,
		};
		if (typeof window.owenminercsUnlockAchievement === 'function') {
			try {
				window.owenminercsUnlockAchievement(ACH_FIDGET_SPINNER);
			} catch (_) {}
		}
		if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			spin.setAttribute('data-fidget-fx', String(pickFidgetFxVariant()));
			spin.classList.add('is-fidget-turbo');
		}
		function step(rafT) {
			if (spinMomentum !== state) return;
			const tMs = typeof rafT === 'number' ? rafT : performance.now();
			const dt = Math.max(0, Math.min(0.05, (tMs - state.lastT) / 1000));
			state.lastT = tMs;
			if (state.phase === 'turbo') {
				const rate = FIDGET_TURBO_DEG_PER_SEC * state.sign;
				setRotation(currentDeg + rate * dt);
				state.turboMs += dt * 1000;
				if (state.turboMs >= FIDGET_TURBO_MS) {
					/* Start coast at full turbo speed, then let exponential damp take over */
					state.v = FIDGET_TURBO_DEG_PER_SEC * state.sign;
					state.phase = 'damp';
				}
			} else {
				const nextV = state.v * Math.exp(-MOMENTUM_DAMP * dt);
				setRotation(currentDeg + state.v * dt);
				if (Math.abs(nextV) < MOMENTUM_STOP_SPEED) {
					document.removeEventListener('visibilitychange', onVisibilityForMomentum);
					if (spinMomentum === state) {
						spinMomentum = null;
					}
					clearFidgetTurboVisual(spin);
					persistSocialDockPosition(wrap);
					return;
				}
				state.v = nextV;
			}
			state.rafId = requestAnimationFrame(step);
		}
		spinMomentum = state;
		state.rafId = requestAnimationFrame(step);
		document.addEventListener('visibilitychange', onVisibilityForMomentum);
	}
	function startSpinMomentum(v0DegPerSec) {
		stopSpinMomentum();
		const v0 = Math.max(-MOMENTUM_MAX_SPEED, Math.min(MOMENTUM_MAX_SPEED, v0DegPerSec));
		if (Math.abs(v0) < MOMENTUM_MIN_SPEED) return;
		/** @type { typeof spinMomentum } */
		const state = {
			phase: /** @type { 'damp' } */ ('damp'),
			v: v0,
			lastT: performance.now(),
			rafId: 0,
			turboMs: 0,
			sign: /** @type { 1 | -1 } */ (v0 >= 0 ? 1 : -1),
		};
		function step(rafT) {
			if (spinMomentum !== state) return;
			const tMs = typeof rafT === 'number' ? rafT : performance.now();
			const dt = Math.max(0, Math.min(0.05, (tMs - state.lastT) / 1000));
			state.lastT = tMs;
			setRotation(currentDeg + state.v * dt);
			const nextV = state.v * Math.exp(-MOMENTUM_DAMP * dt);
			if (Math.abs(nextV) < MOMENTUM_STOP_SPEED) {
				document.removeEventListener('visibilitychange', onVisibilityForMomentum);
				if (spinMomentum === state) {
					spinMomentum = null;
				}
				persistSocialDockPosition(wrap);
				return;
			}
			state.v = nextV;
			state.rafId = requestAnimationFrame(step);
		}
		spinMomentum = state;
		state.rafId = requestAnimationFrame(step);
		document.addEventListener('visibilitychange', onVisibilityForMomentum);
	}
	/** @param { boolean } fromCancel */
	function endRotate(e, fromCancel) {
		if (!active || e.pointerId !== active.pointerId) return;
		const { samples, posDeg, negDeg } = active;
		if (!fromCancel) {
			const p = posDeg > 0 ? posDeg : 0;
			const n = negDeg > 0 ? negDeg : 0;
			const maxOneWay = Math.max(p, n);
			const netAbs = Math.abs(
				typeof active.gestureStartDeg === 'number' ? currentDeg - active.gestureStartDeg : 0
			);
			/* Wobble in a slow spin can add to pos and neg separately so both one-way sums stay under 5×360; net travel still matches the bar. */
			const overThreshold = FIDGET_FIVE_REV_DEG - FIDGET_DEG_TOL;
			if (maxOneWay >= overThreshold || netAbs >= overThreshold) {
				const sign =
					maxOneWay >= overThreshold
						? p > n
							? 1
							: p < n
								? -1
								: currentDeg >= (active.gestureStartDeg || 0)
									? 1
									: -1
						: currentDeg >= (active.gestureStartDeg || 0)
							? 1
							: -1;
				startFidgetChampionSpin(sign);
			} else if (samples && samples.length >= 2) {
				const a = samples[0];
				const b = samples[samples.length - 1];
				const tDiff = b.t - a.t;
				let v0 = 0;
				if (tDiff > 0) {
					v0 = ((b.deg - a.deg) / tDiff) * 1000;
				} else {
					const s2 = samples[samples.length - 2];
					if (s2) {
						const t2 = b.t - s2.t;
						if (t2 > 0) v0 = ((b.deg - s2.deg) / t2) * 1000;
					}
				}
				if (Number.isFinite(v0)) {
					if (samples.length >= 2) {
						const p0 = samples[samples.length - 2];
						const p1 = samples[samples.length - 1];
						const dt0 = p1.t - p0.t;
						if (dt0 > 0) {
							const vInstant = ((p1.deg - p0.deg) / dt0) * 1000;
							if (Number.isFinite(vInstant)) {
								v0 = v0 * 0.35 + vInstant * 0.65;
							}
						}
					}
					startSpinMomentum(v0);
				}
			}
			if (active.changed) {
				setSocialDockCustomized(wrap, true);
				clampPlacedSocialDockInViewport(wrap);
			}
			persistSocialDockPosition(wrap);
		}
		try {
			nav.releasePointerCapture(e.pointerId);
		} catch (_) {}
		nav.classList.remove('site-social-nav--edge-rotating');
		active = null;
	}
	function pushAngleSample(/** @type { { t: number; deg: number; }[] } */ arr) {
		const now = performance.now();
		arr.push({ t: now, deg: currentDeg });
		/* keep ~100ms of history for a stable release velocity, cap length */
		while (arr.length > 1 && now - arr[0].t > 100) {
			arr.shift();
		}
		while (arr.length > 8) {
			arr.shift();
		}
	}
	let active = null;
	function onPointerDown(e) {
		if (e.button !== 0) return;
		stopSpinMomentum();
		const pivot = getPivotFromMark(mark);
		if (!pivot) return;
		const a0 = Math.atan2(e.clientY - pivot.y, e.clientX - pivot.x);
		e.preventDefault();
		const t0 = performance.now();
		const startDeg = currentDeg;
		const rGesture = Math.hypot(e.clientX - pivot.x, e.clientY - pivot.y);
		const r0 = Math.max(rGesture, SOCIAL_DOCK_RESIZE_R0_MIN_PX);
		active = {
			pointerId: e.pointerId,
			pivot,
			lastPointerAngle: a0,
			samples: [{ t: t0, deg: currentDeg }],
			posDeg: 0,
			negDeg: 0,
			gestureStartDeg: startDeg,
			r0,
			scale0: currentScale,
			changed: false,
		};
		try {
			nav.setPointerCapture(e.pointerId);
		} catch (_) {}
	}
	function onEdgeRotatePointerDown(e) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (e.target.closest('a.site-social-nav__link')) return;
		/*
		 * Default header pill is small; most of the hit area reads as “edge” and would
		 * steal the gesture for rotate/resize. Only enable edge gestures after the user
		 * has moved the dock at least once (`site-support-dock--customized`).
		 */
		if (!wrap.classList.contains(SOCIAL_DOCK_CUSTOMIZED_CLASS)) return;
		const mainEl = nav.querySelector('.site-social-nav__main');
		if (!isPointerOnSocialBarEdge(e.clientX, e.clientY, mainEl)) return;
		e.preventDefault();
		e.stopPropagation();
		onPointerDown(e);
		if (active) nav.classList.add('site-social-nav--edge-rotating');
	}
	function onPointerMove(e) {
		if (!active || e.pointerId !== active.pointerId) return;
		/* Re-sample pivot: layout / dock position can change during the gesture. */
		const pNow = getPivotFromMark(mark);
		if (pNow) {
			active.pivot = pNow;
		}
		const a = Math.atan2(e.clientY - active.pivot.y, e.clientX - active.pivot.x);
		/* Incremental delta (unwrap atan2 -π/π steps) so full 360°+ drags and passing the start do not snap */
		let delta = a - active.lastPointerAngle;
		while (delta > Math.PI) delta -= TWO_PI;
		while (delta < -Math.PI) delta += TWO_PI;
		active.lastPointerAngle = a;
		const dDeg = (delta * 180) / Math.PI;
		if (dDeg > 0) {
			active.posDeg += dDeg;
		} else if (dDeg < 0) {
			active.negDeg += -dDeg;
		}
		if (Math.abs(dDeg) > 0.001) {
			active.changed = true;
		}
		setRotation(currentDeg + dDeg);
		pushAngleSample(active.samples);
		const rNow = Math.hypot(e.clientX - active.pivot.x, e.clientY - active.pivot.y);
		const nextScale = active.scale0 * (rNow / active.r0);
		if (Math.abs(clampSocialDockScale(nextScale) - currentScale) > 0.001) {
			active.changed = true;
		}
		setScale(nextScale);
	}
	function onPointerUp(e) {
		endRotate(e, false);
	}
	function onPointerCancel(e) {
		endRotate(e, true);
	}
	nav.addEventListener(
		'pointerdown',
		() => {
			stopSpinMomentum();
		},
		{ capture: true }
	);
	nav.addEventListener('pointerdown', onEdgeRotatePointerDown, true);
	nav.addEventListener('pointermove', (e) => onPointerMove(e), { passive: false });
	nav.addEventListener('pointerup', (e) => onPointerUp(e));
	nav.addEventListener('pointercancel', (e) => onPointerCancel(e));
}

function initSiteSupportDockDrag(wrap) {
	const nav = wrap.querySelector('.site-social-nav--dock');
	if (!nav) return;
	const spin = nav.querySelector('.site-social-nav__spin');

	let drag = null;
	let iceRaf = 0;

	function setHeaderDragLock(enabled) {
		if (enabled) {
			wrap.classList.add(SOCIAL_DOCK_DRAG_LOCK_CLASS);
			spin?.style.setProperty('--site-social-tilt', '0deg');
			return;
		}
		if (!wrap.classList.contains(SOCIAL_DOCK_DRAG_LOCK_CLASS)) return;
		wrap.classList.remove(SOCIAL_DOCK_DRAG_LOCK_CLASS);
		spin?.style.removeProperty('--site-social-tilt');
	}

	function socialDockPrefersIceCoast() {
		return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function stopIceSlide() {
		if (!iceRaf) return;
		cancelAnimationFrame(iceRaf);
		iceRaf = 0;
		clampPlacedSocialDockInViewport(wrap);
		persistSocialDockPosition(wrap);
	}

	function finalizePlacedDrag() {
		setSocialDockCustomized(wrap, true);
		clampPlacedSocialDockInViewport(wrap);
		persistSocialDockPosition(wrap);
		unlockSocialDockMoveAchievement();
		wrap.classList.remove('site-support-dock--dragging');
	}

	function startIceCoast(vx, vy) {
		if (iceRaf) {
			cancelAnimationFrame(iceRaf);
			iceRaf = 0;
		}
		let vxr = vx * SOCIAL_DOCK_ICE_VELOCITY_SCALE;
		let vyr = vy * SOCIAL_DOCK_ICE_VELOCITY_SCALE;
		const initialSpeed = Math.hypot(vxr, vyr);
		if (initialSpeed < SOCIAL_DOCK_ICE_MIN_SPEED_PX_S) {
			finalizePlacedDrag();
			return;
		}
		let left = parseFloat(wrap.style.left);
		let top = parseFloat(wrap.style.top);
		if (!Number.isFinite(left) || !Number.isFinite(top)) {
			finalizePlacedDrag();
			return;
		}
		let traveled = 0;
		const maxDist = SOCIAL_DOCK_ICE_MAX_COAST_PX;
		let lastT = performance.now();

		function frame(now) {
			const dt = Math.min(1 / 24, Math.max(0.001, (now - lastT) / 1000));
			lastT = now;

			let dx = vxr * dt;
			let dy = vyr * dt;
			let step = Math.hypot(dx, dy);
			if (step < 0.015) {
				iceRaf = 0;
				finalizePlacedDrag();
				return;
			}
			if (traveled + step > maxDist) {
				const s = (maxDist - traveled) / step;
				dx *= s;
				dy *= s;
				step = maxDist - traveled;
			}
			traveled += step;
			left += dx;
			top += dy;
			const c = socialDockCoordsRounded(left, top);
			wrap.style.left = `${c.left}px`;
			wrap.style.top = `${c.top}px`;
			left = c.left;
			top = c.top;

			const damp = Math.exp(-SOCIAL_DOCK_ICE_FRICTION_PER_S * dt);
			vxr *= damp;
			vyr *= damp;
			const speed = Math.hypot(vxr, vyr);
			if (speed < SOCIAL_DOCK_ICE_MIN_SPEED_PX_S || traveled >= maxDist - 0.02) {
				iceRaf = 0;
				finalizePlacedDrag();
				return;
			}
			iceRaf = requestAnimationFrame(frame);
		}
		iceRaf = requestAnimationFrame(frame);
	}

	wrap.addEventListener('owen-social-dock-reset', () => {
		stopIceSlide();
	});

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden' && iceRaf) stopIceSlide();
	});

	function isBackdropPointerTarget(target) {
		if (!(target instanceof Element)) return false;
		if (target.closest('a.site-social-nav__link')) return false;
		return Boolean(target.closest('.site-social-nav--dock'));
	}

	nav.addEventListener(
		'pointerdown',
		(e) => {
			if (!isBackdropPointerTarget(e.target)) return;
			if (e.pointerType === 'mouse' && e.button !== 0) return;
			stopIceSlide();
			/* Touch browsers may scroll the page instead of delivering movement; keep this in
			   sync with `#site-support-dock .site-social-nav--dock { touch-action: none }`.
			   `passive: false` is required for preventDefault to bite on some engines. */
			if (e.pointerType === 'touch' || e.pointerType === 'pen') {
				try {
					e.preventDefault();
				} catch (_) {}
			}
			const promotedFromHeader = !wrap.classList.contains('site-support-dock--placed');
			setHeaderDragLock(promotedFromHeader);
			const r = wrap.getBoundingClientRect();
			if (!wrap.classList.contains('site-support-dock--placed')) {
				document.body.appendChild(wrap);
				wrap.style.left = `${r.left}px`;
				wrap.style.top = `${r.top}px`;
				wrap.classList.add('site-support-dock--placed');
			}
			const baseLeft = Number.parseFloat(wrap.style.left);
			const baseTop = Number.parseFloat(wrap.style.top);
			drag = {
				pointerId: e.pointerId,
				originX: e.clientX,
				originY: e.clientY,
				baseLeft: Number.isFinite(baseLeft) ? baseLeft : r.left,
				baseTop: Number.isFinite(baseTop) ? baseTop : r.top,
				active: false,
				promotedFromHeader,
				lastSampleT: e.timeStamp,
				lastSampleX: e.clientX,
				lastSampleY: e.clientY,
				velX: 0,
				velY: 0,
			};
			try {
				nav.setPointerCapture(e.pointerId);
			} catch (_) {}
		},
		{ passive: false }
	);

	nav.addEventListener(
		'pointermove',
		(e) => {
			if (!drag || e.pointerId !== drag.pointerId) return;
			const dx = e.clientX - drag.originX;
			const dy = e.clientY - drag.originY;
			if (!drag.active) {
				if (
					dx * dx + dy * dy <
					SOCIAL_DOCK_DRAG_THRESHOLD_PX * SOCIAL_DOCK_DRAG_THRESHOLD_PX
				)
					return;
				drag.active = true;
				wrap.classList.add('site-support-dock--dragging');
			}
			e.preventDefault();
			const c = socialDockCoordsRounded(drag.baseLeft + dx, drag.baseTop + dy);
			wrap.style.left = `${c.left}px`;
			wrap.style.top = `${c.top}px`;

			const dt = (e.timeStamp - drag.lastSampleT) / 1000;
			if (dt > 0.001 && dt < 0.22) {
				const ix = (e.clientX - drag.lastSampleX) / dt;
				const iy = (e.clientY - drag.lastSampleY) / dt;
				const a = SOCIAL_DOCK_ICE_VEL_SMOOTH;
				drag.velX = drag.velX * (1 - a) + ix * a;
				drag.velY = drag.velY * (1 - a) + iy * a;
			}
			drag.lastSampleT = e.timeStamp;
			drag.lastSampleX = e.clientX;
			drag.lastSampleY = e.clientY;
		},
		{ passive: false }
	);

	function endPointer(e) {
		if (!drag || e.pointerId !== drag.pointerId) return;
		const wasActive = drag.active;
		const promotedFromHeader = drag.promotedFromHeader;
		const velX = drag.velX;
		const velY = drag.velY;
		try {
			nav.releasePointerCapture(e.pointerId);
		} catch (_) {}
		drag = null;
		setHeaderDragLock(false);

		if (wasActive) {
			wrap.classList.remove('site-support-dock--dragging');
			const fling = Math.hypot(velX, velY);
			if (socialDockPrefersIceCoast() && fling >= SOCIAL_DOCK_ICE_MIN_FLING_PX_S) {
				startIceCoast(velX, velY);
			} else {
				finalizePlacedDrag();
			}
		} else if (promotedFromHeader) {
			wrap.classList.remove('site-support-dock--placed', 'site-support-dock--dragging');
			wrap.style.left = '';
			wrap.style.top = '';
			relocateSocialDockToDefaultMount(wrap);
		}
	}

	nav.addEventListener('pointerup', endPointer);
	nav.addEventListener('pointercancel', endPointer);

	nav.addEventListener('lostpointercapture', (e) => {
		if (!drag || e.pointerId !== drag.pointerId) return;
		const wasActive = drag.active;
		const promotedFromHeader = drag.promotedFromHeader;
		const velX = drag.velX;
		const velY = drag.velY;
		drag = null;
		setHeaderDragLock(false);

		if (wasActive) {
			wrap.classList.remove('site-support-dock--dragging');
			const fling = Math.hypot(velX, velY);
			if (socialDockPrefersIceCoast() && fling >= SOCIAL_DOCK_ICE_MIN_FLING_PX_S) {
				startIceCoast(velX, velY);
			} else {
				finalizePlacedDrag();
			}
		} else if (promotedFromHeader) {
			wrap.classList.remove('site-support-dock--placed', 'site-support-dock--dragging');
			wrap.style.left = '';
			wrap.style.top = '';
			relocateSocialDockToDefaultMount(wrap);
		}
	});

	nav.addEventListener('dblclick', (e) => {
		if (e.target.closest('a.site-social-nav__link')) return;
		resetSocialDockToDefault(wrap);
	});

	document.addEventListener(
		'click',
		(e) => {
			const t = e.target;
			if (!(t instanceof Element)) return;
			const btn = t.closest('[data-owen-social-dock-reset]');
			if (!btn) return;
			e.preventDefault();
			resetSocialDockToDefault(wrap);
		},
		true
	);

	window.addEventListener(
		'resize',
		debounce(() => {
			if (iceRaf) stopIceSlide();
			if (!wrap.classList.contains('site-support-dock--placed')) return;
			if (!wrap.classList.contains(SOCIAL_DOCK_CUSTOMIZED_CLASS)) {
				applyDefaultSocialDockAnchor(wrap);
				persistSocialDockPosition(wrap);
				return;
			}
			const left = parseFloat(wrap.style.left);
			const top = parseFloat(wrap.style.top);
			if (!Number.isFinite(left) || !Number.isFinite(top)) return;
			const c = socialDockCoordsRounded(left, top);
			wrap.style.left = `${c.left}px`;
			wrap.style.top = `${c.top}px`;
			persistSocialDockPosition(wrap);
		}, 120)
	);
}

/**
 * Idle-only micro-animations on the floating social dock (dog hop, marble roll, bump, rainbow, plinko, “rack” trio).
 * Throttled scheduling + transform/opacity-only CSS; skipped when `prefers-reduced-motion: reduce`.
 */
function initSocialDockEasterEggs(wrap) {
	const nav = wrap.querySelector('.site-social-nav--dock');
	if (!nav) return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const EE_HOP = 'site-social-nav__link--ee-hop';
	const EE_MARBLE = 'site-social-nav__link--ee-marble';
	const EE_BUMP_L = 'site-social-nav__link--ee-bump-left';
	const EE_BUMP_R = 'site-social-nav__link--ee-bump-right';
	const EE_RAIN = 'site-social-nav__links-level--ee-rainbow';
	const EE_PLINKO = 'site-social-nav__link--ee-plinko';
	const EE_RACK = 'site-social-nav__link--ee-rack789';
	const EE_PLINKO_SHELL = 'site-social-nav--ee-plinko-mode';

	const IDLE_MS = 36000;
	const ROLL_WHEN_IDLE = 0.23;

	let lastActivity = Date.now();
	let quirkBusy = false;
	let timerId = 0;

	function links() {
		return Array.from(nav.querySelectorAll('a.site-social-nav__link'));
	}

	function bumpActivity() {
		lastActivity = Date.now();
	}

	function delay(ms) {
		return new Promise((r) => setTimeout(r, ms));
	}

	function shuffleInPlace(arr) {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}

	function pickRandomDistinct(arr, n) {
		const c = arr.slice();
		shuffleInPlace(c);
		return c.slice(0, Math.min(n, c.length));
	}

	async function dogHop() {
		const L = links();
		if (L.length < 2) return;
		const picks = pickRandomDistinct(L, 2);
		picks[0].classList.add(EE_HOP);
		picks[1].classList.add(EE_HOP);
		picks[1].style.animationDelay = '0.14s';
		await delay(1500);
		picks[0].classList.remove(EE_HOP);
		picks[1].classList.remove(EE_HOP);
		picks[1].style.animationDelay = '';
	}

	async function marbleRoll() {
		const L = links();
		const n = Math.min(L.length, 2 + (Math.random() < 0.55 ? 1 : 0));
		const picks = pickRandomDistinct(L, n);
		picks.forEach((el, i) => {
			el.classList.add(EE_MARBLE);
			el.style.animationDelay = `${i * 0.16}s`;
		});
		await delay(1680 + n * 160);
		picks.forEach((el) => {
			el.classList.remove(EE_MARBLE);
			el.style.animationDelay = '';
		});
	}

	async function billiardBump() {
		const L = links();
		if (L.length < 2) return;
		const i = Math.floor(Math.random() * (L.length - 1));
		const a = L[i];
		const b = L[i + 1];
		a.classList.add(EE_BUMP_L);
		b.classList.add(EE_BUMP_R);
		await delay(650);
		a.classList.remove(EE_BUMP_L);
		b.classList.remove(EE_BUMP_R);
	}

	async function rainbowFlash() {
		const row = nav.querySelector('.site-social-nav__links-level');
		if (!row) return;
		row.classList.add(EE_RAIN);
		await delay(2500);
		row.classList.remove(EE_RAIN);
	}

	async function plinkoDrop() {
		const L = links();
		if (!L.length) return;
		nav.classList.add(EE_PLINKO_SHELL);
		L.forEach((el, i) => {
			el.classList.add(EE_PLINKO);
			el.style.animationDelay = `${i * 0.08}s`;
		});
		await delay(3300);
		L.forEach((el) => {
			el.classList.remove(EE_PLINKO);
			el.style.animationDelay = '';
		});
		nav.classList.remove(EE_PLINKO_SHELL);
	}

	/** Three adjacent “balls” jostle like a sloppy break (789 / taboli energy, not literal gambling). */
	async function rackTrio() {
		const L = links();
		if (L.length < 3) return;
		const start = Math.floor(Math.random() * (L.length - 2));
		const trio = L.slice(start, start + 3);
		trio.forEach((el, i) => {
			el.classList.add(EE_RACK);
			el.style.animationDelay = `${i * 0.08}s`;
		});
		await delay(900);
		trio.forEach((el) => {
			el.classList.remove(EE_RACK);
			el.style.animationDelay = '';
		});
	}

	const quirks = [dogHop, marbleRoll, billiardBump, rainbowFlash, plinkoDrop, rackTrio];

	function schedulePeek() {
		if (timerId) window.clearTimeout(timerId);
		const wait = 26000 + Math.random() * 54000;
		timerId = window.setTimeout(runMaybeQuirk, wait);
	}

	function runMaybeQuirk() {
		schedulePeek();
		if (document.hidden || quirkBusy) return;
		if (Date.now() - lastActivity < IDLE_MS) return;
		if (Math.random() > ROLL_WHEN_IDLE) return;
		quirkBusy = true;
		const run = quirks[Math.floor(Math.random() * quirks.length)];
		Promise.resolve(run())
			.catch(() => {})
			.finally(() => {
				quirkBusy = false;
			});
	}

	const capOpt = { capture: true, passive: true };
	let lastScrollBump = 0;
	function bumpActivityScroll() {
		const n = Date.now();
		if (n - lastScrollBump < 500) return;
		lastScrollBump = n;
		bumpActivity();
	}
	document.addEventListener('pointerdown', bumpActivity, capOpt);
	document.addEventListener('keydown', bumpActivity, capOpt);
	window.addEventListener('scroll', bumpActivityScroll, { passive: true });
	nav.addEventListener('pointerdown', bumpActivity, capOpt);

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			if (timerId) window.clearTimeout(timerId);
			timerId = 0;
		} else {
			schedulePeek();
		}
	});

	schedulePeek();
}

(function injectSiteSupportDock() {
	if (document.getElementById('site-support-dock')) return;
	if (!document.body) {
		document.addEventListener('DOMContentLoaded', injectSiteSupportDock, { once: true });
		return;
	}
	const wrap = document.createElement('div');
	wrap.id = 'site-support-dock';
	wrap.setAttribute('aria-description', SOCIAL_DOCK_DRAG_ARIA_DESC);
	wrap.innerHTML = socialNavMarkup('site-social-nav--dock');
	if (!document.querySelector('[data-owen-social-dock-reset]')) {
		const resetButton = document.createElement('button');
		resetButton.type = 'button';
		resetButton.className = 'site-social-dock-reset';
		resetButton.setAttribute('data-owen-social-dock-reset', '1');
		resetButton.setAttribute('title', 'Reset social bar position');
		resetButton.hidden = true;
		resetButton.textContent = 'Reset Social Bar';
		const slot = querySocialDockHeaderSlot();
		const brandRow = document.querySelector('.site-header-brand-row');
		if (slot) {
			slot.insertBefore(resetButton, slot.firstChild);
		} else if (brandRow) {
			brandRow.appendChild(resetButton);
		} else {
			document.body.appendChild(resetButton);
		}
	}
	document.body.classList.add('has-site-support-dock');
	applySavedSocialDockPosition(wrap);
	ensureSocialDockDefaultSlotIfUnplaced(wrap);
	requestAnimationFrame(() => {
		applySavedSocialDockPosition(wrap);
		ensureSocialDockDefaultSlotIfUnplaced(wrap);
		applyDefaultSocialDockAnchor(wrap);
	});
	customElements.whenDefined('shared-header').then(() => {
		syncSocialDockIntoHeaderWhenPossible(wrap);
	});
	initSiteSocialDragRotate(wrap);
	initSiteSupportDockDrag(wrap);
	initSocialDockEasterEggs(wrap);
	function flushSocialDockState() {
		try {
			persistSocialDockPosition(wrap);
		} catch (_) {}
	}
	window.addEventListener('pagehide', flushSocialDockState);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flushSocialDockState();
	});
})();

/** Opens the Ko-fi overlay (same as clicking the floating donate control). Widget_2.js only renders an external link; overlay-widget.js is Ko-fi’s in-page iframe. */
function tryOpenKofiWidgetOverlayFromLink() {
	const host = document.querySelector('div[id^="kofi-widget-overlay-"]');
	if (!host) return false;
	const cssId = host.id;
	const iframeIds = ['kofi-wo-container' + cssId, 'kofi-wo-container-mobi' + cssId];
	for (let i = 0; i < iframeIds.length; i++) {
		const iframe = document.getElementById(iframeIds[i]);
		if (!iframe) continue;
		const rect = iframe.getBoundingClientRect();
		if (rect.width < 2 || rect.height < 2) continue;
		const doc = iframe.contentDocument;
		if (!doc) continue;
		const btn = doc.getElementById(cssId + '-donate-button');
		if (!btn) continue;
		if (btn.classList.contains('open')) return true;
		btn.click();
		return true;
	}
	for (let j = 0; j < iframeIds.length; j++) {
		const iframe2 = document.getElementById(iframeIds[j]);
		if (!iframe2) continue;
		const doc2 = iframe2.contentDocument;
		if (!doc2) continue;
		const btn2 = doc2.getElementById(cssId + '-donate-button');
		if (!btn2) continue;
		if (btn2.classList.contains('open')) return true;
		btn2.click();
		return true;
	}
	return false;
}

const KOFI_FLOAT_POS_KEY = 'owenminercs-kofi-floating-chat-pos';
const KOFI_FLOAT_DRAG_THRESHOLD_PX = 5;

function clampKofiFloatingHostToViewport(host, left, top) {
	const margin = 2;
	const rect = host.getBoundingClientRect();
	const width = Math.max(1, Math.round(rect.width));
	const height = Math.max(1, Math.round(rect.height));
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const minLeft = margin;
	const minTop = margin;
	const maxLeft = Math.max(margin, vw - margin - width);
	const maxTop = Math.max(margin, vh - margin - height);
	return {
		left: Math.round(Math.min(maxLeft, Math.max(minLeft, left))),
		top: Math.round(Math.min(maxTop, Math.max(minTop, top))),
	};
}

function placeKofiFloatingHost(host, left, top) {
	const clamped = clampKofiFloatingHostToViewport(host, left, top);
	host.style.position = 'fixed';
	host.style.left = `${clamped.left}px`;
	host.style.top = `${clamped.top}px`;
	host.style.right = 'auto';
	host.style.bottom = 'auto';
	return clamped;
}

function applySavedKofiFloatingPosition(host) {
	if (!(host instanceof Element)) return;
	if (host.dataset.owenKofiPosApplied === '1') return;
	host.dataset.owenKofiPosApplied = '1';
	try {
		const raw = localStorage.getItem(KOFI_FLOAT_POS_KEY);
		if (!raw) return;
		const pos = JSON.parse(raw);
		if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') {
			localStorage.removeItem(KOFI_FLOAT_POS_KEY);
			return;
		}
		const clamped = placeKofiFloatingHost(host, pos.left, pos.top);
		host.dataset.owenKofiCustomized = '1';
		host.dataset.owenKofiLeft = String(clamped.left);
		host.dataset.owenKofiTop = String(clamped.top);
	} catch (_) {}
}

function persistKofiFloatingPosition(host) {
	if (!(host instanceof Element)) return;
	try {
		if (host.dataset.owenKofiCustomized !== '1') {
			localStorage.removeItem(KOFI_FLOAT_POS_KEY);
			return;
		}
		const left = parseFloat(host.style.left);
		const top = parseFloat(host.style.top);
		if (!Number.isFinite(left) || !Number.isFinite(top)) {
			localStorage.removeItem(KOFI_FLOAT_POS_KEY);
			return;
		}
		localStorage.setItem(
			KOFI_FLOAT_POS_KEY,
			JSON.stringify({
				left: Math.round(left),
				top: Math.round(top),
			})
		);
	} catch (_) {}
}

function bindKofiFloatingDonateDragFromIframe(host, iframe) {
	if (!(host instanceof Element) || !(iframe instanceof HTMLIFrameElement)) return false;
	let doc;
	try {
		doc = iframe.contentDocument;
	} catch (_) {
		return false;
	}
	if (!doc) return false;
	const donateButton = doc.getElementById(host.id + '-donate-button');
	if (!(donateButton instanceof Element)) return false;
	if (donateButton.dataset.owenKofiDragBound === '1') return true;
	donateButton.dataset.owenKofiDragBound = '1';
	donateButton.style.cursor = 'grab';
	donateButton.style.touchAction = 'none';

	let dragging = false;
	let moved = false;
	let startPointerX = 0;
	let startPointerY = 0;
	let startLeft = 0;
	let startTop = 0;
	let suppressNextClick = false;

	const onPointerMove = (e) => {
		if (!dragging) return;
		const nextLeft = startLeft + (e.clientX - startPointerX);
		const nextTop = startTop + (e.clientY - startPointerY);
		const clamped = placeKofiFloatingHost(host, nextLeft, nextTop);
		host.dataset.owenKofiLeft = String(clamped.left);
		host.dataset.owenKofiTop = String(clamped.top);
		const dist = Math.hypot(e.clientX - startPointerX, e.clientY - startPointerY);
		if (dist >= KOFI_FLOAT_DRAG_THRESHOLD_PX) {
			moved = true;
		}
		e.preventDefault();
	};

	const finishDrag = () => {
		if (!dragging) return;
		dragging = false;
		donateButton.style.cursor = 'grab';
		if (moved) {
			host.dataset.owenKofiCustomized = '1';
			persistKofiFloatingPosition(host);
			suppressNextClick = true;
		}
	};

	donateButton.addEventListener(
		'pointerdown',
		(e) => {
			if (e.button !== 0) return;
			const hostRect = host.getBoundingClientRect();
			dragging = true;
			moved = false;
			startPointerX = e.clientX;
			startPointerY = e.clientY;
			startLeft = Math.round(hostRect.left);
			startTop = Math.round(hostRect.top);
			donateButton.style.cursor = 'grabbing';
			try {
				donateButton.setPointerCapture(e.pointerId);
			} catch (_) {}
			e.preventDefault();
		},
		true
	);
	donateButton.addEventListener('pointermove', onPointerMove, true);
	donateButton.addEventListener(
		'pointerup',
		(e) => {
			try {
				donateButton.releasePointerCapture(e.pointerId);
			} catch (_) {}
			finishDrag();
		},
		true
	);
	donateButton.addEventListener('pointercancel', finishDrag, true);
	donateButton.addEventListener(
		'click',
		(e) => {
			if (!suppressNextClick) return;
			suppressNextClick = false;
			e.preventDefault();
			e.stopPropagation();
		},
		true
	);
	return true;
}

function bindKofiFloatingDonateDrag() {
	const host = document.querySelector('div[id^="kofi-widget-overlay-"]');
	if (!(host instanceof Element)) return false;
	applySavedKofiFloatingPosition(host);
	const iframeIds = ['kofi-wo-container' + host.id, 'kofi-wo-container-mobi' + host.id];
	let bound = false;
	for (let i = 0; i < iframeIds.length; i++) {
		const frame = document.getElementById(iframeIds[i]);
		if (!(frame instanceof HTMLIFrameElement)) continue;
		if (bindKofiFloatingDonateDragFromIframe(host, frame)) {
			bound = true;
		}
	}
	return bound;
}

(function initKofiFloatingDonateDragBinding() {
	let tries = 0;
	const maxTries = 120;
	function runBindAttempt() {
		const bound = bindKofiFloatingDonateDrag();
		tries += 1;
		if (bound || tries >= maxTries) return;
		window.setTimeout(runBindAttempt, 250);
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', runBindAttempt, { once: true });
	} else {
		runBindAttempt();
	}
	window.addEventListener('resize', () => {
		const host = document.querySelector('div[id^="kofi-widget-overlay-"]');
		if (!(host instanceof Element)) return;
		if (host.dataset.owenKofiCustomized !== '1') return;
		const left = parseFloat(host.style.left);
		const top = parseFloat(host.style.top);
		if (!Number.isFinite(left) || !Number.isFinite(top)) return;
		placeKofiFloatingHost(host, left, top);
		persistKofiFloatingPosition(host);
	});
	window.addEventListener('pagehide', () => {
		const host = document.querySelector('div[id^="kofi-widget-overlay-"]');
		if (!(host instanceof Element)) return;
		persistKofiFloatingPosition(host);
	});
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'hidden') return;
		const host = document.querySelector('div[id^="kofi-widget-overlay-"]');
		if (!(host instanceof Element)) return;
		persistKofiFloatingPosition(host);
	});
})();

/** Used by e.g. Donators — open the same in-page donation overlay as clicking a Ko-fi link, without a separate “open Ko-fi” step. */
window.owenminercsOpenKofiDonateOverlay = function () {
	return tryOpenKofiWidgetOverlayFromLink();
};

(function initKofiLinkOverlayBinding() {
	if (document.documentElement.dataset.kofiLinkOverlayBound) return;
	document.documentElement.dataset.kofiLinkOverlayBound = '1';
	document.addEventListener(
		'click',
		function (e) {
			const a = e.target.closest && e.target.closest('a[data-kofi-link]');
			if (!a) return;
			if (tryOpenKofiWidgetOverlayFromLink()) {
				e.preventDefault();
				e.stopPropagation();
			}
		},
		true
	);
})();

(function loadKofiOverlayWidget() {
	if (document.querySelector('script[data-kofi-overlay]')) return;
	const el = document.createElement('script');
	el.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
	el.dataset.kofiOverlay = '1';
	el.onload = function () {
		if (typeof kofiWidgetOverlay === 'undefined') return;
		kofiWidgetOverlay.draw('owenminer', {
			type: 'floating-chat',
			'floating-chat.donateButton.text': 'Donate',
			'floating-chat.donateButton.background-color': '#323842',
			'floating-chat.donateButton.text-color': '#fff',
		});
		window.setTimeout(bindKofiFloatingDonateDrag, 0);
		window.setTimeout(bindKofiFloatingDonateDrag, 300);
	};
	document.body.appendChild(el);
})();

(function initAchievementCelebration() {
	if (!document.body) {
		document.addEventListener('DOMContentLoaded', initAchievementCelebration, { once: true });
		return;
	}
	injectAchievementCelebrationClient();
})();

(function initConstructionNotice() {
	const STORAGE_KEY = 'owenminercs-construction-notice-dismissed-v1';

	function dismiss(host, backdrop, onKey) {
		try {
			localStorage.setItem(STORAGE_KEY, '1');
		} catch (_) {}
		if (typeof onKey === 'function') {
			document.removeEventListener('keydown', onKey, true);
		}
		host.remove();
		backdrop.remove();
		document.body.style.overflow = '';
	}

	function run() {
		if (document.documentElement.dataset.owenConstructionNoticeInit) return;
		document.documentElement.dataset.owenConstructionNoticeInit = '1';
		try {
			if (localStorage.getItem(STORAGE_KEY) === '1') return;
		} catch (_) {}

		const backdrop = document.createElement('div');
		backdrop.className = 'site-construction-backdrop';
		backdrop.setAttribute('aria-hidden', 'true');

		const dialog = document.createElement('div');
		dialog.className = 'site-construction-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		dialog.setAttribute('aria-labelledby', 'site-construction-title');

		dialog.innerHTML = [
			'<h2 id="site-construction-title" class="site-construction-dialog__title">Site under construction</h2>',
			'<p class="site-construction-dialog__lede">',
			'Pictures, graphics, theme, and most of the site can change <strong>day to day</strong> while work is in progress.',
			'</p>',
			'<p class="site-construction-dialog__sub">Here&rsquo;s the rough timeline:</p>',
			'<ul class="site-construction-dialog__timeline">',
			'<li><span class="site-construction-dialog__when">Now / this weekend</span>',
			'<span class="site-construction-dialog__what">Heavy work on the backend and new features &mdash; I might push an update <strong>this weekend</strong> for testing.</span></li>',
			'<li><span class="site-construction-dialog__when">Next week or two</span>',
			'<span class="site-construction-dialog__what"><strong>Design and theme</strong> updates as I work on graphics and the site background.</span></li>',
			'<li><span class="site-construction-dialog__when">Late May</span>',
			'<span class="site-construction-dialog__what"><strong>New content</strong> (photos, reviews, etc.) as I experiment with my Insta360 and finish decorating my apartment.</span></li>',
			'<li><span class="site-construction-dialog__when">July (hopefully)</span>',
			'<span class="site-construction-dialog__what"><strong>Setup tour video</strong> &mdash; it&rsquo;s been at the top of my bucket list since I was 11, so I&rsquo;m taking my time to get it right.</span></li>',
			'</ul>',
			'<p class="site-construction-dialog__bugs">',
			'Spotted a bug while things are moving fast? ',
			'<a href="',
			DISCORD_INVITE_URL,
			'" target="_blank" rel="noopener noreferrer" class="site-construction-dialog__discord-link">Report it in Discord</a>',
			' so I can track fixes alongside everything else.',
			'</p>',
			'<div class="site-construction-dialog__actions">',
			'<button type="button" class="site-construction-dialog__btn">Got it</button>',
			'</div>',
		].join('');

		const btn = dialog.querySelector('.site-construction-dialog__btn');
		document.body.appendChild(backdrop);
		document.body.appendChild(dialog);
		document.body.style.overflow = 'hidden';

		function onKey(e) {
			if (e.key === 'Escape') {
				dismiss(dialog, backdrop, onKey);
			}
		}

		function close() {
			dismiss(dialog, backdrop, onKey);
		}

		btn.addEventListener('click', close);
		backdrop.addEventListener('click', close);
		dialog.addEventListener('click', function (e) {
			e.stopPropagation();
		});

		document.addEventListener('keydown', onKey, true);

		window.setTimeout(function () {
			try {
				btn.focus();
			} catch (_) {}
		}, 0);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run, { once: true });
	} else {
		run();
	}
})();

(function initSocialDockGrandTourTracking() {
	if (document.documentElement.dataset.owenSocialDockTourBound) return;
	document.documentElement.dataset.owenSocialDockTourBound = '1';
	document.addEventListener(
		'click',
		function (e) {
			const t = e.target;
			const a = t && t.closest && t.closest('a.site-social-nav__link');
			if (!a) return;
			recordSocialDockTourClick(a);
		},
		true
	);
})();

(function initMainNavTourTracking() {
	function run() {
		recordMainNavTourPageVisit();
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run, { once: true });
	} else {
		run();
	}
})();

(function initMainNavReturnTracking() {
	initMainNavReturnHistory();
})();

/**
 * Re-run DOM helpers under `root` after injecting fetched page HTML (moss-nocturne-site preview shell).
 * Does not re-bind global listeners from initWordBackgroundGlow / initWordGlowBookmark.
 */
window.owenminercsHydrateRoot = function (root) {
	if (!(root instanceof Element)) return;
	disableTextInputControls(root);
	enforceShortFormLooping(root);
	prepareKeepCardLineGlows();
	wrapAllEligibleLinksAsLineGlow(root);
	const textNodes = collectWordGlowTextNodes(root);
	for (let i = 0; i < textNodes.length; i++) {
		wrapWordsInTextNode(textNodes[i]);
	}
};

/** Scroll to the image matching #keep-img-xxxxxxxx (hash from scripts/keep-thumbs.js jump links). */
(function initPhotoFocusFromHash() {
	function hash8(str) {
		let h = 2166136261;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return ('00000000' + (h >>> 0).toString(16)).slice(-8);
	}
	function resolveUrl(src, base) {
		try {
			return new URL(src, base).href;
		} catch (_) {
			return src;
		}
	}
	function run() {
		const m = /^#keep-img-([0-9a-f]{8})$/i.exec(window.location.hash || '');
		if (!m) return;
		const want = m[1].toLowerCase();
		const imgs = document.querySelectorAll('img[src], picture > img[src]');
		for (let i = 0; i < imgs.length; i++) {
			const abs = resolveUrl(imgs[i].getAttribute('src'), window.location.href);
			if (hash8(abs) === want) {
				imgs[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
				try {
					imgs[i].style.outline = '2px solid rgba(255, 190, 90, 0.95)';
					imgs[i].style.outlineOffset = '3px';
					window.setTimeout(() => {
						imgs[i].style.outline = '';
						imgs[i].style.outlineOffset = '';
					}, 2200);
				} catch (_) {}
				return;
			}
		}
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run, { once: true });
	} else {
		run();
	}
	window.addEventListener('hashchange', run);
})();
