// Apply stored lite-visuals preference before paint when possible.
try {
	if (localStorage.getItem('owenminercs-low-effects') === 'on') {
		document.documentElement.setAttribute('data-low-effects', '');
	}
} catch (_) {}

// Determine the base path to the root of the site by looking at this script's URL
const scriptUrl = document.querySelector('script[src*="components.js"]').src;
const siteRoot = scriptUrl.replace('scripts/components.js', '');

function owenminercsPrefersLiteVisuals() {
	return (
		document.documentElement.hasAttribute('data-low-effects') ||
		(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
	);
}

function whenLowEffectsReady(fn) {
	if (window.owenminercsLowEffectsReady && typeof window.owenminercsLowEffectsReady.then === 'function') {
		window.owenminercsLowEffectsReady.then(fn);
		return;
	}
	fn();
}

function injectLowEffectsClient() {
	if (globalThis.__owenLowEffectsLoaded || document.querySelector('script[data-owen-low-effects]')) return;
	const s = document.createElement('script');
	s.src = `${siteRoot}scripts/low-effects.js`;
	s.defer = true;
	s.setAttribute('data-owen-low-effects', '1');
	document.head.appendChild(s);
}
injectLowEffectsClient();

const THEME_STORAGE_KEY = 'owenminercs-theme';
const TEXT_ENTRY_SELECTOR =
	'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="password"], input[type="tel"], input[type="number"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="week"], input[type="time"], input[type="file"]';

/** Static PNG fallback / poster (see images/logo/owenminercs-logo.webm for animated header logo). */
function brandLogoFilename(theme) {
	return theme === 'light' ? 'owenminercs-logo-light.png' : 'owenminercs-logo.png';
}

function brandLogoStaticUrl(theme) {
	return `${siteRoot}images/${brandLogoFilename(theme)}`;
}

function brandLogoVideoUrl() {
	return `${siteRoot}images/logo/owenminercs-logo.webm`;
}

function siteLogoMarkup(options = {}) {
	const footer = Boolean(options.footer);
	const staticSrc = brandLogoStaticUrl('dark');
	const footerClass = footer ? ' site-logo--footer' : '';
	const lazyAttrs = footer ? 'loading="lazy" decoding="async"' : 'fetchpriority="high" decoding="async"';

	const videoSrc = brandLogoVideoUrl();
	const videoPreload = 'preload="metadata"';

	return `
              <video class="site-logo site-logo--motion${footerClass}" autoplay loop muted playsinline ${videoPreload} poster="${staticSrc}" aria-hidden="true">
                <source src="${videoSrc}" type="video/webm">
              </video>
              <img class="site-logo site-logo--still${footerClass}" src="${staticSrc}" alt="owenminercs" ${lazyAttrs}>`;
}

function visualsControlMarkup(placement) {
	const modifier =
		placement === 'header' ? ' site-visuals-control--header' : ' site-visuals-control--footer';
	return `<label class="site-visuals-control${modifier}">
              <span class="site-visuals-control__label">Visuals:</span>
              <select class="site-visuals-control__select" data-owen-low-effects-select aria-label="Visual quality">
                <option value="auto">auto</option>
                <option value="on">lite</option>
                <option value="off">high</option>
              </select>
            </label>`;
}

function syncBrandLogosForTheme(theme) {
	const url = brandLogoStaticUrl(theme);
	document.querySelectorAll('img.site-logo--still').forEach((img) => {
		img.src = url;
	});
	document.querySelectorAll('video.site-logo--motion').forEach((video) => {
		video.poster = url;
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

const SITE_SEARCH_ACTIVE_LINK_CLASS = 'site-search-results__link--active';

function searchGetResultLinks(container) {
	if (!container || typeof container.querySelectorAll !== 'function') return [];
	return [...container.querySelectorAll('.site-search-results__link')];
}

function searchGetActiveResultIndex(container) {
	const links = searchGetResultLinks(container);
	return links.findIndex((link) => link.classList.contains(SITE_SEARCH_ACTIVE_LINK_CLASS));
}

function searchSetActiveResultIndex(container, index) {
	const links = searchGetResultLinks(container);
	links.forEach((link, i) => {
		const active = i === index;
		link.classList.toggle(SITE_SEARCH_ACTIVE_LINK_CLASS, active);
		if (active) link.setAttribute('aria-current', 'true');
		else link.removeAttribute('aria-current');
	});
	const active = index >= 0 && index < links.length ? links[index] : null;
	if (active) searchScrollActiveResultIntoView(active);
	return active;
}

function searchScrollActiveResultIntoView(link) {
	if (!link || typeof link.scrollIntoView !== 'function') return;
	link.scrollIntoView({ block: 'nearest' });
}

function searchResetActiveResult(container) {
	const links = searchGetResultLinks(container);
	if (!links.length) return null;
	return searchSetActiveResultIndex(container, 0);
}

function searchMoveActiveResult(container, delta) {
	const links = searchGetResultLinks(container);
	if (!links.length) return null;
	let idx = searchGetActiveResultIndex(container);
	if (idx < 0) idx = delta > 0 ? -1 : links.length;
	idx = Math.max(0, Math.min(links.length - 1, idx + delta));
	return searchSetActiveResultIndex(container, idx);
}

function searchNavigateActiveResult(container) {
	const links = searchGetResultLinks(container);
	if (!links.length) return;
	const idx = searchGetActiveResultIndex(container);
	const link = idx >= 0 ? links[idx] : links[0];
	if (link instanceof HTMLAnchorElement) window.location.assign(link.href);
}

function searchHandleResultsKeyDown(resultsEl, e) {
	if (!resultsEl) return false;
	const links = searchGetResultLinks(resultsEl);
	if (!links.length) return false;
	if (e.key === 'ArrowDown') {
		e.preventDefault();
		searchMoveActiveResult(resultsEl, 1);
		return true;
	}
	if (e.key === 'ArrowUp') {
		e.preventDefault();
		searchMoveActiveResult(resultsEl, -1);
		return true;
	}
	if (e.key === 'Enter') {
		e.preventDefault();
		searchNavigateActiveResult(resultsEl);
		return true;
	}
	return false;
}

/** Keyboard highlight + Enter navigation for a rendered results list. */
function searchWireResultsNavigation(resultsEl, options = {}) {
	if (!resultsEl || resultsEl.dataset.siteSearchNavWired === '1') return;
	resultsEl.dataset.siteSearchNavWired = '1';

	resultsEl.addEventListener('mouseover', (e) => {
		const link = e.target.closest('.site-search-results__link');
		if (!link || !resultsEl.contains(link)) return;
		const links = searchGetResultLinks(resultsEl);
		const idx = links.indexOf(link);
		if (idx >= 0) searchSetActiveResultIndex(resultsEl, idx);
	});

	const input = options.input;
	if (input) {
		input.addEventListener('keydown', (e) => {
			searchHandleResultsKeyDown(resultsEl, e);
		});
	}
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
	searchResetActiveResult(container);
}

const SITE_SEARCH_INDEX_URL = `${siteRoot}data/site-search-index.json`;
const SITE_MAP_ORDER_URL = `${siteRoot}data/site-map-order.json`;

window.owenminercsSiteSearchApi = {
	indexUrl: SITE_SEARCH_INDEX_URL,
	resolveHref: resolveSiteSearchHref,
	getSearchPageUrl,
	filterEntries: searchFilterEntries,
	renderResults: searchRenderResults,
	wireResultsNavigation: searchWireResultsNavigation,
	handleResultsKeyDown: searchHandleResultsKeyDown,
	navigateActiveResult: searchNavigateActiveResult,
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
const SCROLL_POSITIONS_KEY = 'owenminercs-scroll-positions-v1';
const SCROLL_POSITION_MAX_AGE_MS = 1000 * 60 * 60 * 2;
const SCROLL_POSITION_MAX_ENTRIES = 50;
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

	// Home (`index.html`) only, do not treat `/Socials/` etc. as home (unlike a loose trailing-slash check).
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

	localStorage.removeItem(NAV_RETURN_SCROLL_KEY);
	restoreScrollPositionWithRetries(payload);
}

/** Detail/sub-hub "← Gear" style links inside `.setup-detail__back` / `.vac-back`. */
function isHubBackLink(anchor) {
	if (!(anchor instanceof HTMLAnchorElement)) return false;
	if (anchor.classList.contains('hub-back-link')) return true;
	return Boolean(anchor.closest('.setup-detail__back, .vac-back'));
}

function isPrimaryHubBackLink(anchor) {
	if (!isHubBackLink(anchor)) return false;
	const container = anchor.closest('.setup-detail__back, .vac-back');
	if (!container) return false;
	const first = container.querySelector('a[href]');
	return first === anchor;
}

function canUseHistoryBack() {
	if (window.history.length <= 1) return false;
	try {
		const ref = document.referrer;
		if (!ref) return false;
		const refUrl = new URL(ref);
		if (refUrl.origin !== window.location.origin) return false;
		return normalizeUrlForMatch(ref) !== normalizeUrlForMatch(window.location.href);
	} catch (_) {
		return false;
	}
}

function tryHubBackViaHistory(event, anchor) {
	if (!isPrimaryHubBackLink(anchor)) return false;
	if (event.defaultPrevented) return false;
	if (event.button !== 0) return false;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
	if (anchor.target && anchor.target !== '_self') return false;
	if (!canUseHistoryBack()) return false;

	event.preventDefault();
	persistScrollPosition();
	window.history.back();
	return true;
}

function applyHubBackLinkLabels(root) {
	const scope = root instanceof Element ? root : document;
	scope.querySelectorAll('.setup-detail__back, .vac-back').forEach(function (container) {
		const anchor = container.querySelector('a[href]');
		if (!anchor) return;
		if (!canUseHistoryBack()) return;
		anchor.textContent = '\u2190 Back';
		anchor.setAttribute('aria-label', 'Back to previous page');
	});
}

function queueHubBackScrollRestore(anchor) {
	if (!isHubBackLink(anchor)) return;
	if (anchor.target && anchor.target !== '_self') return;
	const href = anchor.getAttribute('href');
	if (!href || href.startsWith('#')) return;
	let destination;
	try {
		destination = new URL(href, window.location.href);
	} catch (_) {
		return;
	}
	if (destination.origin !== window.location.origin) return;

	const destKey = normalizeUrlForMatch(destination.href);
	if (!destKey) return;
	const record = readScrollPositionsMap()[destKey];
	if (!record || typeof record !== 'object') return;

	writeJsonStorage(NAV_RETURN_SCROLL_KEY, {
		targetUrl: destination.href,
		scrollX: Number(record.scrollX) || 0,
		scrollY: Number(record.scrollY) || 0,
		createdAt: Date.now(),
	});
}

function readScrollPositionsMap() {
	try {
		const raw = sessionStorage.getItem(SCROLL_POSITIONS_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch (_) {
		return {};
	}
}

function writeScrollPositionsMap(map) {
	try {
		sessionStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify(map));
	} catch (_) {}
}

function scrollPositionStorageKey() {
	return normalizeUrlForMatch(window.location.href);
}

function shouldSkipScrollRestoreForHash() {
	const hash = window.location.hash || '';
	return hash !== '' && hash !== '#top';
}

function isBackForwardNavigation() {
	try {
		const nav = performance.getEntriesByType('navigation')[0];
		return Boolean(nav && nav.type === 'back_forward');
	} catch (_) {
		return false;
	}
}

function hasPendingNavReturnScrollRestore() {
	const payload = readJsonStorage(NAV_RETURN_SCROLL_KEY);
	if (!payload || typeof payload !== 'object') return false;
	const here = normalizeUrlForMatch(window.location.href);
	const target = normalizeUrlForMatch(payload.targetUrl || '');
	return Boolean(here && target && here === target);
}

function persistScrollPosition() {
	const key = scrollPositionStorageKey();
	if (!key) return;

	const map = readScrollPositionsMap();
	map[key] = {
		scrollX: window.scrollX || 0,
		scrollY: window.scrollY || 0,
		updatedAt: Date.now(),
	};

	const now = Date.now();
	const entries = Object.entries(map).filter(
		([, value]) => now - Number(value && value.updatedAt) <= SCROLL_POSITION_MAX_AGE_MS
	);
	entries.sort((a, b) => Number(b[1].updatedAt || 0) - Number(a[1].updatedAt || 0));

	const pruned = {};
	for (let i = 0; i < Math.min(entries.length, SCROLL_POSITION_MAX_ENTRIES); i++) {
		pruned[entries[i][0]] = entries[i][1];
	}
	writeScrollPositionsMap(pruned);
}

function readSavedScrollPosition() {
	const key = scrollPositionStorageKey();
	if (!key) return null;
	const record = readScrollPositionsMap()[key];
	if (!record || typeof record !== 'object') return null;
	if (Date.now() - Number(record.updatedAt || 0) > SCROLL_POSITION_MAX_AGE_MS) return null;
	return record;
}

function restoreScrollPositionWithRetries(record) {
	const x = Number(record.scrollX);
	const y = Number(record.scrollY);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return;

	const restore = function () {
		window.scrollTo(x, y);
	};
	requestAnimationFrame(restore);
	window.setTimeout(restore, 0);
	window.setTimeout(restore, 160);
	window.setTimeout(restore, 420);
	window.setTimeout(restore, 900);
}

function shouldAttemptSessionScrollRestore() {
	if (shouldSkipScrollRestoreForHash()) return false;
	if (hasPendingNavReturnScrollRestore()) return false;
	return isBackForwardNavigation();
}

function applySessionScrollRestore() {
	if (!shouldAttemptSessionScrollRestore()) return;
	const record = readSavedScrollPosition();
	if (!record) return;
	restoreScrollPositionWithRetries(record);
}

function scheduleSessionScrollRestoreAfterDom() {
	requestAnimationFrame(function () {
		requestAnimationFrame(applySessionScrollRestore);
	});
}

function initSiteScrollRestoration() {
	if (document.documentElement.dataset.owenScrollRestoreBound === '1') return;
	document.documentElement.dataset.owenScrollRestoreBound = '1';

	if ('scrollRestoration' in history) {
		history.scrollRestoration = 'auto';
	}

	let saveTimer = 0;
	function schedulePersistScroll() {
		if (saveTimer) return;
		saveTimer = window.setTimeout(function () {
			saveTimer = 0;
			persistScrollPosition();
		}, 150);
	}

	window.addEventListener('scroll', schedulePersistScroll, { passive: true });
	window.addEventListener('pagehide', persistScrollPosition);

	document.addEventListener(
		'click',
		function (event) {
			if (event.defaultPrevented) return;
			const target = event.target;
			const anchor = target && target.closest ? target.closest('a[href]') : null;
			if (!anchor) return;
			if (tryHubBackViaHistory(event, anchor)) return;
			if (anchor.target && anchor.target !== '_self') return;
			const href = anchor.getAttribute('href');
			if (!href || href.startsWith('#')) return;
			try {
				const destination = new URL(href, window.location.href);
				if (destination.origin !== window.location.origin) return;
			} catch (_) {
				return;
			}
			persistScrollPosition();
			queueHubBackScrollRestore(anchor);
		},
		true
	);

	window.addEventListener('pageshow', function (event) {
		if (!event.persisted && !isBackForwardNavigation()) return;
		scheduleSessionScrollRestoreAfterDom();
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', scheduleSessionScrollRestoreAfterDom, {
			once: true,
		});
		document.addEventListener('DOMContentLoaded', function () {
			applyHubBackLinkLabels(document);
		}, { once: true });
	} else {
		scheduleSessionScrollRestoreAfterDom();
		applyHubBackLinkLabels(document);
	}
}

function readNavReturnRecord() {
	const record = readJsonStorage(NAV_RETURN_STATE_KEY);
	if (!record || typeof record !== 'object') return null;
	if (Date.now() - Number(record.createdAt || 0) > NAV_RETURN_MAX_AGE_MS) {
		localStorage.removeItem(NAV_RETURN_STATE_KEY);
		return null;
	}
	const current = normalizeUrlForMatch(window.location.href);
	const expected = normalizeUrlForMatch(record.toUrl || '');
	const source = normalizeUrlForMatch(record.fromUrl || '');
	if (!current || !expected || current !== expected || current === source) return null;
	return record;
}

function buildSiteFloatingNavBackButton(record) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'site-nav-return-popup__button site-nav-return-popup__button--back';
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
	return button;
}

function buildSiteFloatingNavTopButton() {
	const link = document.createElement('a');
	link.href = '#top';
	link.className = 'site-nav-return-popup__button site-nav-return-popup__button--top';
	link.textContent = 'Top';
	link.setAttribute('aria-label', 'Back to top of page');
	link.addEventListener('click', function (event) {
		event.preventDefault();
		const prefersReducedMotion =
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
		const topTarget = document.getElementById('top');
		if (topTarget && typeof topTarget.focus === 'function') {
			topTarget.focus({ preventScroll: true });
		}
	});
	return link;
}

function buildSiteFloatingNav() {
	const wrap = document.createElement('nav');
	wrap.className = 'site-nav-return-popup';
	wrap.setAttribute('aria-label', 'Page navigation');
	const record = readNavReturnRecord();
	if (record) {
		wrap.appendChild(buildSiteFloatingNavBackButton(record));
	}
	wrap.appendChild(buildSiteFloatingNavTopButton());
	return wrap;
}

function initSiteFloatingNav() {
	if (document.querySelector('.site-nav-return-popup')) return;
	document.body.appendChild(buildSiteFloatingNav());
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
		initSiteFloatingNav();
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
		injectAchievementCelebrationClient();
		if (typeof window.owenminercsOnAchievementUnlocked === 'function') {
			window.owenminercsOnAchievementUnlocked(e);
		} else {
			(window.owenminercsAchievementUnlockedQueue =
				window.owenminercsAchievementUnlockedQueue || []).push(e);
		}
	});
})();

/** Loads homepage “What’s new” feed from `data/site-feed.json`. */
function injectSiteFeedClient() {
	if (document.querySelector('script[data-owen-site-feed]')) return;
	const list = document.getElementById('site-feed-list');
	if (!list) return;
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

/** Mouse-reactive starfield canvas behind page content (see `scripts/starfield-bg.js`). */
function injectStarfieldBgClient() {
	if (document.body?.hasAttribute('data-no-starfield')) return;
	if (document.documentElement.hasAttribute('data-low-effects')) return;
	if (document.querySelector('script[data-owen-starfield-bg]')) return;
	const s = document.createElement('script');
	s.src = `${siteRoot}scripts/starfield-bg.js`;
	s.defer = true;
	s.setAttribute('data-owen-starfield-bg', '1');
	document.body.appendChild(s);
}

function scheduleStarfieldBgClient() {
	whenLowEffectsReady(function () {
		if (document.documentElement.hasAttribute('data-low-effects')) return;
		injectStarfieldBgClient();
	});
}

/* Brand mark paths from Simple Icons (CC0 1.0), https://simpleicons.org/, for compact bottom-dock nav only. */
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
            <a class="site-social-nav__link" data-social-brand="x" target="_blank" rel="noopener noreferrer" href="https://x.com/OwenMiner" aria-label="X (Twitter): @OwenMiner">${socialIconSvg(p.x)}${socialNavTipMarkup('X (Twitter)', '@OwenMiner')}</a>
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
	if (
		currentPath.endsWith('/') ||
		currentPath.endsWith('index.html') ||
		currentPath.includes('/site-map')
	) {
		if (currentPath.includes('/site-map')) {
			activeLink = scope.querySelector('a[data-nav="site-map"]');
		}
		if (!activeLink && (currentPath.endsWith('/') || currentPath.endsWith('index.html'))) {
			activeLink = scope.querySelector('a[data-nav="index.html"]');
		}
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
		if (link.closest('[data-footer-quick-links-carousel]')) {
			link.classList.remove('home-pillars__link--active');
			return;
		}
		link.classList.add('site-nav-link');
		link.classList.remove('site-nav-link--active');
	});
	const activeLink = resolveActiveNavLink(scope);
	if (!activeLink) {
		highlightFooterCarouselCurrentPage(scope);
		return;
	}
	if (activeLink.closest('[data-footer-quick-links-carousel]')) {
		scope.querySelectorAll('[data-footer-quick-links-carousel] .home-pillars__link').forEach((link) => {
			link.classList.toggle('home-pillars__link--active', link === activeLink);
		});
		return;
	}
	activeLink.classList.add('site-nav-link--active');
	highlightFooterCarouselCurrentPage(scope);
}

/** Inject the site-wide quick-links carousel at the top of `.container` (same data/behavior as footer). */
function injectSiteQuickLinks() {
	if (!document.body.classList.contains('site-card-ui')) return;
	const container = document.querySelector('body.site-card-ui > .container');
	if (!container) return;

	container.querySelector('.site-nav-pillars')?.remove();
	container
		.querySelector(':scope > .home-pillars:not([data-footer-quick-links-carousel])')
		?.remove();

	if (container.querySelector('[data-site-header-quick-links-carousel]')) return;

	const tpl = document.createElement('template');
	tpl.innerHTML = quickLinksCarouselMarkup({ placement: 'header' }).trim();
	container.insertBefore(tpl.content.firstChild, container.firstChild);

	populateFooterQuickLinksCarousel(container);
}

const SITE_HEADER_MOBILE_NAV_MQ = '(max-width: 700px)';

function initHeaderMobileNav(headerRoot) {
	const stickyBar = headerRoot.querySelector('.site-header-sticky-bar');
	const toggle = headerRoot.querySelector('.site-nav-toggle');
	const panel = headerRoot.querySelector('#site-primary-nav-panel');
	if (!stickyBar || !toggle || !panel) return () => {};

	const mobileMq = window.matchMedia(SITE_HEADER_MOBILE_NAV_MQ);

	function isMobileNav() {
		return mobileMq.matches;
	}

	function setNavOpen(open) {
		const expanded = Boolean(open);
		stickyBar.classList.toggle('site-header-sticky-bar--nav-open', expanded);
		toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
		toggle.setAttribute('aria-label', expanded ? 'Close menu' : 'Open menu');
		panel.hidden = false;
	}

	function closeNav() {
		setNavOpen(false);
	}

	function onToggleClick(event) {
		event.stopPropagation();
		setNavOpen(toggle.getAttribute('aria-expanded') !== 'true');
	}

	function onDocumentClick(event) {
		if (!isMobileNav() || toggle.getAttribute('aria-expanded') !== 'true') return;
		if (!stickyBar.contains(event.target)) closeNav();
	}

	function onDocumentKeyDown(event) {
		if (event.key === 'Escape') closeNav();
	}

	function onMobileMqChange() {
		if (isMobileNav()) {
			setNavOpen(false);
		} else {
			panel.hidden = false;
			stickyBar.classList.remove('site-header-sticky-bar--nav-open');
			toggle.setAttribute('aria-expanded', 'false');
			toggle.setAttribute('aria-label', 'Open menu');
		}
	}

	function onNavLinkClick() {
		closeNav();
	}

	toggle.addEventListener('click', onToggleClick);
	document.addEventListener('click', onDocumentClick);
	document.addEventListener('keydown', onDocumentKeyDown);
	mobileMq.addEventListener('change', onMobileMqChange);
	panel.querySelectorAll('a').forEach((anchor) => anchor.addEventListener('click', onNavLinkClick));

	onMobileMqChange();

	return () => {
		toggle.removeEventListener('click', onToggleClick);
		document.removeEventListener('click', onDocumentClick);
		document.removeEventListener('keydown', onDocumentKeyDown);
		mobileMq.removeEventListener('change', onMobileMqChange);
		panel.querySelectorAll('a').forEach((anchor) => anchor.removeEventListener('click', onNavLinkClick));
	};
}

class SharedHeader extends HTMLElement {
	#mobileNavCleanup = null;

	connectedCallback() {
		this.innerHTML = `
      <header class="site-shared-header">
        <div class="site-shared-header__content">
          <div class="site-header-brand-row">
            <a href="${siteRoot}" class="site-logo-link site-logo-link--header" title="owenminercs.com" aria-label="Home">${siteLogoMarkup()}
            </a>
            <div class="site-header-search" data-owen-site-search="1">
              <form class="site-header-search__form" role="search" action="#" method="get">
                <label for="header-site-search-input" class="site-visually-hidden">search site</label>
                <input
                  type="search"
                  id="header-site-search-input"
                  class="site-header-search__input site-search__input"
                  name="q"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="search site"
                  enterkeyhint="search"
                  role="combobox"
                  aria-expanded="false"
                  aria-controls="header-site-search-results"
                  aria-autocomplete="list"
                  data-owen-site-search="1"
                />
              </form>
              <div
                class="site-header-search__dropdown site-search-results"
                id="header-site-search-results"
                role="listbox"
                aria-live="polite"
                hidden
              ></div>
            </div>
            <div class="site-header-dock-cluster">
              ${visualsControlMarkup('header')}
              <button type="button" class="site-social-dock-reset" data-owen-social-dock-reset="1" title="Reset social bar position" hidden>Reset Social Bar</button>
            </div>
          </div>
          <div class="site-header-sticky-bar">
            <div class="site-header-sticky-bar__top">
              <button
                type="button"
                class="site-nav-toggle"
                aria-expanded="false"
                aria-controls="site-primary-nav-panel"
                aria-label="Open menu"
              >
                <span class="site-nav-toggle__bars" aria-hidden="true">
                  <span class="site-nav-toggle__bar"></span>
                  <span class="site-nav-toggle__bar"></span>
                  <span class="site-nav-toggle__bar"></span>
                </span>
              </button>
            </div>
            <div id="site-primary-nav-panel" class="site-header-nav-panel">
              <nav aria-label="Primary">
                <ul>
                  <li><a href="${siteRoot}" class="site-nav-link" data-nav="index.html" title="Home: bio, intro, and what’s new">Home</a></li>
                  <li><a href="${getLink('The%20Setup/the-setup')}" class="site-nav-link" data-nav="The Setup" title="Desk, PC, keyboard, peripherals, and priced gear">Gear</a></li>
                  <li><a href="${getLink('Gaming/gaming')}" class="site-nav-link" data-nav="Gaming" title="CS2, wallpapers, and gaming pages">Gaming</a></li>
                  <li><a href="${getLink('Donators/donators')}" class="site-nav-link" data-nav="Donators" title="Supporters, tips, and thank-yous">Donators</a></li>
                  <li><a href="${getLink('Garage%20Sale/garage-sale')}" class="site-nav-link" data-nav="garage-sale" title="Stickers, prints, and items for sale">For sale</a></li>
                  <li><a href="${getLink('Help%20Wanted/help-wanted')}" class="site-nav-link" data-nav="Help Wanted" title="Open roles, collabs, and requests">Help Wanted</a></li>
                  <li><a href="${getLink('QA/qa')}" class="site-nav-link" data-nav="QA" title="Questions and answers">Q&amp;A</a></li>
                  <li><a href="${getLink('dev/dev-stack')}" class="site-nav-link" data-nav="Dev" title="Programs for coding, creative work, and streaming">Programs</a></li>
                  <li><a href="${getLink('Achievements/achievements')}" class="site-nav-link" data-nav="Achievements" title="Easter eggs and site milestones">Achievements</a></li>
                  <li><a href="${getLink('Socials/socials')}" class="site-nav-link" data-nav="Socials" title="Social feeds and featured posts">Content</a></li>
                  <li><a href="${getLink('site-map')}" class="site-nav-link" data-nav="site-map" title="All pages on the site, grouped by section">Map</a></li>
                </ul>
              </nav>
              <hr class="site-rule site-rule--flush">
            </div>
          </div>
        </div>
      </header>
    `;

		applyNavHighlight(this);
		this.#mobileNavCleanup = initHeaderMobileNav(this);
		if (window.owenminercsLowEffects?.refreshVisualsControls) {
			window.owenminercsLowEffects.refreshVisualsControls();
		}
	}

	disconnectedCallback() {
		this.#mobileNavCleanup?.();
		this.#mobileNavCleanup = null;
	}
}

/** Disclosure column: remove earnings line when it is duplicated in the footer byline (cross-page Amazon note). */
function stripFooterAmazonEarningsSuffix(html) {
	if (!html || typeof html !== 'string') return html;
	let s = html;
	const amazonSuffixPatterns = [
		/\s*As an Amazon Associate I earn from qualifying purchases through eligible links on those pages\.?(?=\s*<\/i>)/i,
		/\s*As an Amazon Associate I earn from qualifying purchases through eligible links on this page\.?(?=\s*<\/i>)/i,
		/\s*As an Amazon Associate I earn from qualifying purchases\.?(?=\s*<\/i>)/i,
		/\s*Gear, Keyboard, and PC pages include Amazon links where Owen Miner participates in the Amazon Associates Program\.?(?=\s*<\/i>)/i,
	];
	for (const pattern of amazonSuffixPatterns) {
		s = s.replace(pattern, '');
	}
	return s;
}

/** Footer carousel fallback until site-map JSON loads (main nav pills). */
const MAIN_NAV_FOOTER_QUICK_LINKS = Object.freeze([
	{ path: 'index', label: 'Home page' },
	{ path: 'The%20Setup/the-setup', label: 'Gear' },
	{ path: 'Gaming/gaming', label: 'Gaming' },
	{ path: 'Donators/donators', label: 'Donators' },
	{ path: 'Garage%20Sale/garage-sale', label: 'For sale' },
	{ path: 'Help%20Wanted/help-wanted', label: 'Help Wanted' },
	{ path: 'QA/qa', label: 'Q&A' },
	{ path: 'dev/dev-stack', label: 'Programs' },
	{ path: 'Achievements/achievements', label: 'Achievements' },
	{ path: 'Socials/socials', label: 'Content' },
	{ path: 'site-map', label: 'Map' },
]);

function normalizeFooterCarouselPathKey(p) {
	try {
		return decodeURIComponent(p).replace(/\\/g, '/').replace(/\.html$/i, '').toLowerCase();
	} catch {
		return String(p || '').toLowerCase();
	}
}

function cleanFooterCarouselTitle(raw) {
	let t = (raw || '').trim();
	t = t.replace(/\s*\|\s*Owen Miner\s*$/i, '');
	t = t.replace(/\s*\|\s*OwenMinerCS\s*$/i, '');
	t = t.replace(/\s*\|\s*Easter eggs\s*/i, '');
	t = t.replace(/\s*\|\s*$/g, '').trim();
	return t || 'Page';
}

function footerCarouselHref(sitePath) {
	if (!sitePath || sitePath === 'index') return siteRoot;
	return getLink(sitePath);
}

const FOOTER_QUICK_LINKS_LABEL_OVERRIDES = Object.freeze({
	index: 'Home page',
	'the setup/previous-setups': 'Gaming Setup Archive',
});

function footerCarouselLabelFromPath(sitePath, entryMap) {
	const key = normalizeFooterCarouselPathKey(sitePath);
	if (FOOTER_QUICK_LINKS_LABEL_OVERRIDES[key]) return FOOTER_QUICK_LINKS_LABEL_OVERRIDES[key];
	const entry = entryMap.get(key);
	if (entry?.title) return cleanFooterCarouselTitle(entry.title);
	const segments = decodeURIComponent(sitePath).split('/');
	const leaf = segments[segments.length - 1] || 'Page';
	return leaf.replace(/-/g, ' ');
}

/** Popular destinations pulled to the front of the footer carousel (rest keep site-map order). */
const FOOTER_QUICK_LINKS_PRIORITY = Object.freeze([
	'index',
	'The%20Setup/the-setup',
	'The%20Setup/previous-setups',
	'The%20Setup/keyboards',
	'Gaming/cs2-merch',
	'PC/pc',
	'Gaming/gaming',
	'Gaming/cs2-videos',
	'Gaming/cs2-skins',
	'Donators/donators',
	'Garage%20Sale/garage-sale',
	'Socials/socials',
	'site-map',
]);

function sortFooterQuickLinksByPriority(links) {
	const rank = new Map();
	FOOTER_QUICK_LINKS_PRIORITY.forEach((p, i) => rank.set(normalizeFooterCarouselPathKey(p), i));
	const prioritized = [];
	const rest = [];
	for (const link of links) {
		if (rank.has(normalizeFooterCarouselPathKey(link.path))) prioritized.push(link);
		else rest.push(link);
	}
	prioritized.sort(
		(a, b) =>
			rank.get(normalizeFooterCarouselPathKey(a.path)) -
			rank.get(normalizeFooterCarouselPathKey(b.path))
	);
	return [...prioritized, ...rest];
}

function buildFooterQuickLinksList(order, entryMap) {
	const seen = new Set();
	const links = [];
	const push = (sitePath) => {
		const key = normalizeFooterCarouselPathKey(sitePath);
		if (!key || seen.has(key)) return;
		seen.add(key);
		links.push({
			path: sitePath,
			label: footerCarouselLabelFromPath(sitePath, entryMap),
		});
	};
	for (const section of order?.sections || []) {
		for (const sitePath of section.paths || []) push(sitePath);
	}
	// Site map isn't part of the section listings; surface it in the carousel.
	push('site-map');
	return sortFooterQuickLinksByPriority(links);
}

function normalizeFooterCarouselPageHref(href) {
	try {
		const u = new URL(href, window.location.origin);
		let p = decodeURIComponent(u.pathname);
		if (p.endsWith('/index.html')) p = p.slice(0, -10) || '/';
		else if (p.endsWith('.html')) p = p.slice(0, -5);
		if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
		return p.toLowerCase();
	} catch {
		return '';
	}
}

function highlightFooterCarouselCurrentPage(scope) {
	const carousel = scope?.querySelector('[data-footer-quick-links-carousel]');
	if (!carousel) return;
	const current = normalizeFooterCarouselPageHref(window.location.href);
	carousel.querySelectorAll('.home-pillars__link').forEach((link) => {
		link.classList.toggle(
			'home-pillars__link--active',
			normalizeFooterCarouselPageHref(link.href) === current
		);
	});
}

function appendFooterQuickLinksToTrack(track, links, { duplicate = false } = {}) {
	track.replaceChildren();
	const addSet = () => {
		links.forEach((link, index) => {
			if (index > 0) {
				const sep = document.createElement('span');
				sep.className = 'home-pillars__sep';
				sep.setAttribute('aria-hidden', 'true');
				sep.textContent = '\u00b7';
				track.appendChild(sep);
			}
			const anchor = document.createElement('a');
			anchor.className = 'home-pillars__link';
			anchor.href = footerCarouselHref(link.path);
			anchor.dataset.footerPath = link.path || 'index';
			anchor.textContent = link.label;
			track.appendChild(anchor);
		});
	};
	addSet();
	if (duplicate) addSet();
	track.dataset.uniqueLinkCount = String(links.length);
}

function quickLinksCarouselMarkup({ placement = 'footer' } = {}) {
	const isHeader = placement === 'header';
	const placementClass = isHeader ? 'home-pillars--header site-header-quick-links' : 'home-pillars--footer';
	const carouselAttr = isHeader
		? 'data-site-header-quick-links-carousel'
		: 'data-footer-quick-links-carousel';
	return `<nav class="home-pillars ${placementClass} site-footer-quick-links" aria-label="Explore all site pages" ${carouselAttr} data-footer-quick-links-carousel><button type="button" class="site-footer-quick-links__arrow site-footer-quick-links__arrow--prev" aria-label="Scroll quick links left" data-footer-quick-links-prev>\u2039</button><div class="site-footer-quick-links__viewport"><div class="site-footer-quick-links__track" data-footer-quick-links-track></div></div><button type="button" class="site-footer-quick-links__arrow site-footer-quick-links__arrow--next" aria-label="Scroll quick links right" data-footer-quick-links-next>\u203a</button></nav>`;
}

function footerQuickLinksCarouselMarkup() {
	return quickLinksCarouselMarkup({ placement: 'footer' });
}

const FOOTER_QUICK_LINKS_DRAG_THRESHOLD_PX = 6;
const FOOTER_QUICK_LINKS_MOMENTUM_MIN_VELOCITY = 0.035;
const FOOTER_QUICK_LINKS_MOMENTUM_FRICTION = 0.91;
const FOOTER_QUICK_LINKS_MOMENTUM_BOOST = 0.88;

/** Manual drag on footer quick-links; clicks on pills still navigate when movement stays below threshold. */
function bindFooterQuickLinksDrag(root, viewport) {
	if (!root || !viewport || viewport.dataset.footerQuickLinksDragBound === '1') return;
	viewport.dataset.footerQuickLinksDragBound = '1';

	let pointerActive = false;
	let dragging = false;
	let didDrag = false;
	let dragStartX = 0;
	let dragOriginScroll = 0;
	let activePointerId = null;
	let lastMoveX = 0;
	let lastMoveTime = 0;
	let velocityX = 0;
	let momentumFrame = null;

	function pauseAutoplay() {
		const autoplay = root._footerQuickLinksAutoplay;
		if (!autoplay) return;
		autoplay.paused = true;
		autoplay.stop();
	}

	function stopMomentum() {
		if (momentumFrame) {
			window.cancelAnimationFrame(momentumFrame);
			momentumFrame = null;
		}
		root._footerQuickLinksMomentumActive = false;
		root.classList.remove('site-footer-quick-links--coasting');
	}

	function startMomentum(pointerVelocityPxPerMs) {
		stopMomentum();
		let velocity = -pointerVelocityPxPerMs * FOOTER_QUICK_LINKS_MOMENTUM_BOOST;
		if (Math.abs(velocity) < FOOTER_QUICK_LINKS_MOMENTUM_MIN_VELOCITY) {
			didDrag = false;
			return;
		}

		root._footerQuickLinksMomentumActive = true;
		root.classList.add('site-footer-quick-links--coasting');
		let lastTime = performance.now();

		const tick = (now) => {
			const dt = Math.min(Math.max(now - lastTime, 0), 32);
			lastTime = now;
			viewport.scrollLeft += velocity * dt;
			velocity *= FOOTER_QUICK_LINKS_MOMENTUM_FRICTION ** (dt / (1000 / 60));
			if (Math.abs(velocity) < FOOTER_QUICK_LINKS_MOMENTUM_MIN_VELOCITY) {
				stopMomentum();
				didDrag = false;
				return;
			}
			momentumFrame = window.requestAnimationFrame(tick);
		};

		momentumFrame = window.requestAnimationFrame(tick);
	}

	function clearPointerListeners() {
		document.removeEventListener('pointermove', onPointerMove);
		document.removeEventListener('pointerup', onPointerEnd);
		document.removeEventListener('pointercancel', onPointerEnd);
	}

	function onPointerMove(event) {
		if (!pointerActive || event.pointerId !== activePointerId) return;
		const dx = event.clientX - dragStartX;
		if (!dragging && Math.abs(dx) > FOOTER_QUICK_LINKS_DRAG_THRESHOLD_PX) {
			dragging = true;
			didDrag = true;
			root.classList.add('site-footer-quick-links--dragging');
			viewport.setPointerCapture(event.pointerId);
		}
		if (!dragging) return;
		event.preventDefault();
		const now = performance.now();
		const x = event.clientX;
		if (lastMoveTime > 0) {
			const dt = now - lastMoveTime;
			if (dt > 0 && dt < 120) {
				const instant = (x - lastMoveX) / dt;
				velocityX = velocityX * 0.35 + instant * 0.65;
			}
		}
		lastMoveX = x;
		lastMoveTime = now;
		viewport.scrollLeft = dragOriginScroll - dx;
	}

	function onPointerEnd(event) {
		if (!pointerActive || event.pointerId !== activePointerId) return;
		clearPointerListeners();
		if (viewport.hasPointerCapture(event.pointerId)) {
			viewport.releasePointerCapture(event.pointerId);
		}
		const wasDragging = dragging;
		pointerActive = false;
		dragging = false;
		activePointerId = null;
		root.classList.remove('site-footer-quick-links--dragging');
		if (wasDragging) startMomentum(velocityX);
		else didDrag = false;
	}

	viewport.addEventListener('dragstart', (event) => event.preventDefault(), true);

	viewport.addEventListener('pointerdown', (event) => {
		if (event.button !== 0) return;
		stopMomentum();
		pointerActive = true;
		dragging = false;
		didDrag = false;
		activePointerId = event.pointerId;
		dragStartX = event.clientX;
		dragOriginScroll = viewport.scrollLeft;
		lastMoveX = event.clientX;
		lastMoveTime = performance.now();
		velocityX = 0;
		pauseAutoplay();
		document.addEventListener('pointermove', onPointerMove);
		document.addEventListener('pointerup', onPointerEnd);
		document.addEventListener('pointercancel', onPointerEnd);
	});

	viewport.addEventListener(
		'click',
		(event) => {
			if (!didDrag && !root._footerQuickLinksMomentumActive) return;
			event.preventDefault();
			event.stopPropagation();
			if (!root._footerQuickLinksMomentumActive) didDrag = false;
		},
		true
	);
}

/** Prev/next arrows nudge the carousel so it reads as a scroller; pauses autoplay like drag does. */
function bindFooterQuickLinksArrows(root, viewport) {
	if (!root || !viewport || root.dataset.footerQuickLinksArrowsBound === '1') return;
	const prev = root.querySelector('[data-footer-quick-links-prev]');
	const next = root.querySelector('[data-footer-quick-links-next]');
	if (!prev && !next) return;
	root.dataset.footerQuickLinksArrowsBound = '1';

	const step = () => Math.max(120, Math.round(viewport.clientWidth * 0.6));
	const nudge = (direction) => {
		const autoplay = root._footerQuickLinksAutoplay;
		if (autoplay) {
			autoplay.paused = true;
			autoplay.stop();
		}
		viewport.scrollBy({ left: direction * step(), behavior: 'smooth' });
	};

	prev?.addEventListener('click', () => nudge(-1));
	next?.addEventListener('click', () => nudge(1));
}

function bindFooterQuickLinksInfiniteLoop(viewport, track) {
	if (!viewport || !track || viewport.dataset.footerQuickLinksLoopBound === '1') return;
	viewport.dataset.footerQuickLinksLoopBound = '1';
	let adjusting = false;
	viewport.addEventListener(
		'scroll',
		() => {
			if (adjusting) return;
			const half = track.scrollWidth / 2;
			if (half <= 0) return;
			if (viewport.scrollLeft >= half) {
				adjusting = true;
				viewport.scrollLeft -= half;
				adjusting = false;
			}
		},
		{ passive: true }
	);
}

/** Load every public page from site-map order; fall back to main nav pills on error. */
function populateFooterQuickLinksCarousel(footerRoot) {
	const root = footerRoot?.querySelector('[data-footer-quick-links-carousel]');
	const track =
		root?.querySelector('[data-footer-quick-links-track]') ||
		root?.querySelector('.site-footer-quick-links__track');
	if (!root || !track) return;

	const reduced =
		window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	appendFooterQuickLinksToTrack(
		track,
		sortFooterQuickLinksByPriority([...MAIN_NAV_FOOTER_QUICK_LINKS]),
		{ duplicate: false }
	);
	highlightFooterCarouselCurrentPage(footerRoot);
	initFooterQuickLinksCarousel(footerRoot);

	Promise.all([
		fetch(SITE_MAP_ORDER_URL).then((r) => {
			if (!r.ok) throw new Error('site-map order');
			return r.json();
		}),
		fetch(SITE_SEARCH_INDEX_URL).then((r) => {
			if (!r.ok) throw new Error('search index');
			return r.json();
		}),
	])
		.then(([order, indexData]) => {
			const entryMap = new Map();
			for (const entry of indexData?.entries || []) {
				if (entry?.path) entryMap.set(normalizeFooterCarouselPathKey(entry.path), entry);
			}
			const links = buildFooterQuickLinksList(order, entryMap);
			if (links.length < 2) return;

			root._footerQuickLinksAutoplay?.stop?.();
			appendFooterQuickLinksToTrack(track, links, { duplicate: !reduced });
			const viewport = root.querySelector('.site-footer-quick-links__viewport');
			if (!reduced && viewport) bindFooterQuickLinksInfiniteLoop(viewport, track);
			highlightFooterCarouselCurrentPage(footerRoot);
			const activePill = root.querySelector('.home-pillars__link--active');
			if (activePill && viewport) {
				const target =
					activePill.offsetLeft - (viewport.clientWidth - activePill.offsetWidth) / 2;
				viewport.scrollLeft = Math.max(0, target);
			}
			initFooterQuickLinksCarousel(footerRoot);
		})
		.catch(() => {
			initFooterQuickLinksCarousel(footerRoot);
		});
}

/** Auto-scroll footer quick links when visible; pauses off-screen, hover/focus, hidden tab, reduced motion. */
function initFooterQuickLinksCarousel(footerRoot) {
	const root = footerRoot?.querySelector('[data-footer-quick-links-carousel]');
	if (!root) return;

	const viewport = root.querySelector('.site-footer-quick-links__viewport');
	const track = root.querySelector('.site-footer-quick-links__track');
	const uniqueCount = Number(track?.dataset.uniqueLinkCount) || 0;
	const allLinks = root.querySelectorAll('.home-pillars__link');
	const linkCount = uniqueCount > 0 ? uniqueCount : allLinks.length;
	if (!viewport || linkCount < 2) return;

	bindFooterQuickLinksDrag(root, viewport);
	bindFooterQuickLinksArrows(root, viewport);

	const reduced =
		window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduced) return;

	let autoplay = root._footerQuickLinksAutoplay;
	if (!autoplay) {
		autoplay = {
			viewport,
			allLinks,
			linkCount,
			index: 0,
			timer: null,
			paused: false,
			visible: false,
			holdMs: 2400,
			scrollMs: 480,
		};
		root._footerQuickLinksAutoplay = autoplay;

		autoplay.stop = function stop() {
			if (autoplay.timer) {
				window.clearInterval(autoplay.timer);
				autoplay.timer = null;
			}
		};

		autoplay.scrollToIndex = function scrollToIndex(next) {
			const link = autoplay.allLinks[next];
			if (!link) return;
			const target =
				link.offsetLeft - (autoplay.viewport.clientWidth - link.offsetWidth) / 2;
			autoplay.viewport.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
		};

		autoplay.tick = function tick() {
			if (autoplay.paused || !autoplay.visible) return;
			const next = (autoplay.index + 1) % autoplay.linkCount;
			if (next === 0) {
				autoplay.viewport.scrollTo({ left: 0, behavior: 'auto' });
			} else {
				autoplay.scrollToIndex(next);
			}
			autoplay.index = next;
		};

		autoplay.start = function start() {
			autoplay.stop();
			if (autoplay.paused || !autoplay.visible || document.visibilityState === 'hidden') {
				return;
			}
			autoplay.timer = window.setInterval(
				autoplay.tick,
				autoplay.holdMs + autoplay.scrollMs
			);
		};

		root.addEventListener('mouseenter', () => {
			autoplay.paused = true;
			autoplay.stop();
		});
		root.addEventListener('mouseleave', () => {
			autoplay.paused = false;
			autoplay.start();
		});
		root.addEventListener('focusin', () => {
			autoplay.paused = true;
			autoplay.stop();
		});
		root.addEventListener('focusout', (event) => {
			if (root.contains(event.relatedTarget)) return;
			autoplay.paused = false;
			autoplay.start();
		});
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') autoplay.stop();
			else autoplay.start();
		});

		if ('IntersectionObserver' in window) {
			const observer = new IntersectionObserver(
				(entries) => {
					autoplay.visible = !!(entries[0] && entries[0].isIntersecting);
					if (autoplay.visible && !autoplay.paused) autoplay.start();
					else autoplay.stop();
				},
				{ root: null, threshold: 0.2 }
			);
			observer.observe(root);
		} else {
			autoplay.visible = true;
			autoplay.start();
		}
	}

	autoplay.stop();
	autoplay.viewport = viewport;
	autoplay.allLinks = allLinks;
	autoplay.linkCount = linkCount;
	autoplay.index = 0;
	if (autoplay.visible && !autoplay.paused) autoplay.start();
}

class SharedFooter extends HTMLElement {
	connectedCallback() {
		const customDisclosure =
			this.getAttribute('disclosure') ||
			'<i>This page has optional tip links (<a href="https://ko-fi.com/owenminer" data-kofi-link target="_blank" rel="noopener noreferrer">Ko-fi</a>, <a href="https://streamelements.com/owenminercs/tip" data-streamelements-tip-link target="_blank" rel="noopener noreferrer">StreamElements</a>) and no paid shopping links. Gear, Keyboard, and PC pages may include Amazon affiliate links.</i>';

		const pageSpecificAmazonDisclosure =
			/(Amazon (shopping )?links on this page|Shopping links on this page|Amazon product links on this page|This page includes Amazon)/i.test(
				customDisclosure
			);
		const pageSpecificAliExpressDisclosure = /AliExpress store links on this page/i.test(customDisclosure);
		const disclosureForRight =
			pageSpecificAmazonDisclosure || pageSpecificAliExpressDisclosure
				? customDisclosure
				: stripFooterAmazonEarningsSuffix(customDisclosure);
		const showCrossPageAmazonByline = !pageSpecificAmazonDisclosure && !pageSpecificAliExpressDisclosure;

		this.innerHTML = `
      <footer>
        <hr class="site-rule site-rule--spaced site-rule--footer-compact">
        <div class="site-footer-nav-wrap">
          <nav aria-label="Main navigation">
            <ul>
              <li><a href="${siteRoot}" class="site-nav-link" data-nav="index.html" title="Home: bio, intro, and what’s new">Home</a></li>
              <li><a href="${getLink('The%20Setup/the-setup')}" class="site-nav-link" data-nav="The Setup" title="Desk, PC, keyboard, peripherals, and priced gear">Gear</a></li>
              <li><a href="${getLink('Gaming/gaming')}" class="site-nav-link" data-nav="Gaming" title="CS2, wallpapers, and gaming pages">Gaming</a></li>
              <li><a href="${getLink('Donators/donators')}" class="site-nav-link" data-nav="Donators" title="Supporters, tips, and thank-yous">Donators</a></li>
              <li><a href="${getLink('Garage%20Sale/garage-sale')}" class="site-nav-link" data-nav="garage-sale" title="Stickers, prints, and items for sale">For sale</a></li>
              <li><a href="${getLink('Help%20Wanted/help-wanted')}" class="site-nav-link" data-nav="Help Wanted" title="Open roles, collabs, and requests">Help Wanted</a></li>
              <li><a href="${getLink('QA/qa')}" class="site-nav-link" data-nav="QA" title="Questions and answers">Q&amp;A</a></li>
              <li><a href="${getLink('dev/dev-stack')}" class="site-nav-link" data-nav="Dev" title="Programs for coding, creative work, and streaming">Programs</a></li>
              <li><a href="${getLink('Achievements/achievements')}" class="site-nav-link" data-nav="Achievements" title="Easter eggs and site milestones">Achievements</a></li>
              <li><a href="${getLink('Socials/socials')}" class="site-nav-link" data-nav="Socials" title="Social feeds and featured posts">Content</a></li>
              <li><a href="${getLink('site-map')}" class="site-nav-link" data-nav="site-map" title="All pages on the site, grouped by section">Map</a></li>
            </ul>
          </nav>
        </div>
        ${footerQuickLinksCarouselMarkup()}
        <div class="site-footer-brand-band">
          <div class="site-footer-logo-layer">
            <a href="${siteRoot}" class="site-logo-link site-logo-link--footer" title="owenminercs.com" aria-label="Home: owenminercs.com">${siteLogoMarkup({ footer: true })}
            </a>
          </div>
          <div class="site-footer-meta site-footer-meta--around-globe">
            <div class="site-footer-social-bar">
              ${socialNavMarkup('site-social-nav--footer')}
            </div>
            <div class="site-footer-support">
              <p class="site-footer-support__text">If you run into any problems on this website, report bugs in the <a href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer">Discord</a>. Suggestions for the site are welcome there too, so I can track ideas alongside bug reports. Reach out on <a href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer">Discord</a> for usage rights on any content on this page. Small creators and individuals are highly encouraged to reach out and I usually give out rights for free! Large companies need to pay for usage for any commercial use including in AI models.</p>
              ${visualsControlMarkup('footer')}
            </div>
            <div class="site-footer-meta__disclosure">
              <h4 id="Disclosure" class="site-footer-meta__disclosure-heading"><span class="site-footer-meta__disclosure-label">Disclosure:</span> ${disclosureForRight}</h4>
              ${
								showCrossPageAmazonByline
									? '<p class="site-footer-meta__amazon">As an Amazon Associate I earn from qualifying purchases through eligible links on those pages.</p>'
									: ''
							}
            </div>
          </div>
        </div>
        <hr class="site-rule site-rule--footer-end">
      </footer>
    `;

		applyNavHighlight(this);
		populateFooterQuickLinksCarousel(this);
		injectSiteFeedClient();
		if (window.owenminercsLowEffects?.refreshVisualsControls) {
			window.owenminercsLowEffects.refreshVisualsControls();
		}
	}
}

customElements.define('shared-header', SharedHeader);
customElements.define('shared-footer', SharedFooter);

/** Client-side search over static JSON; results rendered with DOM APIs only (no HTML injection). */
function initSiteSearch() {
	let entries = [];
	const getEntries = () => entries;

	function wireInputToResults(input, resultsEl, options = {}) {
		const maxResults = options.maxResults ?? 40;
		const variant = options.variant ?? 'preview';
		const dropdown = options.dropdown === true;

		searchWireResultsNavigation(resultsEl, { input });

		function setDropdownOpen(open) {
			resultsEl.classList.toggle('site-header-search__dropdown--open', open);
			input.setAttribute('aria-expanded', open ? 'true' : 'false');
			resultsEl.hidden = !open;
		}

		if (dropdown) {
			resultsEl.addEventListener('mousedown', (e) => {
				if (e.target.closest('.site-search-results__link')) e.preventDefault();
			});
			input.addEventListener('blur', () => {
				window.setTimeout(() => {
					if (document.activeElement === input) return;
					setDropdownOpen(false);
				}, 150);
			});
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Escape') {
					setDropdownOpen(false);
					input.blur();
					e.preventDefault();
				}
			});
			setDropdownOpen(false);
		}

		function run() {
			const q = input.value || '';
			searchRenderResults(
				resultsEl,
				searchFilterEntries(getEntries(), q, maxResults),
				q,
				variant
			);
			if (dropdown) {
				const shouldOpen = document.activeElement === input && q.trim().length >= 2;
				setDropdownOpen(shouldOpen);
			}
		}

		input.addEventListener('input', run);
		input.addEventListener('change', run);
		if (dropdown) input.addEventListener('focus', run);
		else run();
	}

	const homeInput = document.getElementById('home-site-search-input');
	const homeResults = document.getElementById('home-site-search-results');
	if (homeInput && homeResults) {
		wireInputToResults(homeInput, homeResults);
		const homeForm = homeInput.closest('.site-search-form--home');
		if (homeForm) {
			homeForm.addEventListener('submit', (e) => {
				e.preventDefault();
				searchNavigateActiveResult(homeResults);
			});
		}
	}

	const headerInput = document.getElementById('header-site-search-input');
	const headerResults = document.getElementById('header-site-search-results');
	if (headerInput && headerResults) {
		wireInputToResults(headerInput, headerResults, {
			maxResults: Infinity,
			dropdown: true,
		});
		const headerForm = headerInput.closest('.site-header-search__form');
		if (headerForm) {
			headerForm.addEventListener('submit', (e) => {
				e.preventDefault();
				if (!headerResults.hidden) searchNavigateActiveResult(headerResults);
			});
		}
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
			if (headerInput && document.activeElement === headerInput) {
				headerInput.dispatchEvent(new Event('input', { bubbles: true }));
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
			if (headerResults && document.activeElement === headerInput) {
				headerResults.textContent = '';
				const p = document.createElement('p');
				p.className = 'site-search-results__empty';
				p.textContent = 'Could not load search index.';
				headerResults.appendChild(p);
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
	if (a.closest('.site-feed-item, .site-feed-list')) return false;
	if (a.matches('.site-header-search-open, .site-nav-search-open')) return false;
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

const LINK_HOVER_HINT_SKIP =
	'.site-logo-link, .site-nav-link, .site-social-nav__link, .site-header-search-open, .site-nav-search-open, .home-explore-card__primary, .keep-card, .keep-card__primary, .site-feed-item__link, .donators-support-hero, [aria-hidden="true"]';

/** Human-readable destination for native title tooltip when author did not set one. */
function formatLinkHoverHint(href) {
	if (!href || typeof href !== 'string') return '';
	const value = href.trim();
	if (!value || value.startsWith('#') || /^javascript:/i.test(value)) return '';
	if (/^(mailto:|tel:)/i.test(value)) return value;
	try {
		const url = new URL(value, window.location.origin);
		const path = `${url.pathname || '/'}${url.search || ''}${url.hash || ''}`;
		if (url.origin === window.location.origin) return path || '/';
		const host = url.hostname.replace(/^www\./i, '');
		return `${host}${path === '/' ? '' : path}`;
	} catch (_) {
		return value;
	}
}

function shouldAddLinkHoverHint(a) {
	if (!(a instanceof HTMLAnchorElement)) return false;
	if (a.getAttribute('title')?.trim()) return false;
	if (a.matches(LINK_HOVER_HINT_SKIP)) return false;
	if (a.closest('.site-nav-link, .site-social-nav')) return false;
	const imgs = a.querySelectorAll('img');
	if (imgs.length && !/\S/.test((a.textContent || '').replace(/\u00a0/g, ' '))) return false;
	return Boolean(formatLinkHoverHint(a.getAttribute('href')));
}

/** Set title from href so hover shows where a link goes (skips chrome + image-only links). */
function initLinkHoverHints(root = document.body) {
	if (!root || typeof root.querySelectorAll !== 'function') return;
	root.querySelectorAll('a[href]').forEach((a) => {
		if (!shouldAddLinkHoverHint(a)) return;
		const hint = formatLinkHoverHint(a.getAttribute('href'));
		if (hint) a.setAttribute('title', hint);
	});
}

function bindLinkHoverHintObserver() {
	if (document.documentElement.dataset.linkHoverHintBound === '1') return;
	document.documentElement.dataset.linkHoverHintBound = '1';
	const run = debounce(() => initLinkHoverHints(document.body), 120);
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (!(node instanceof Element)) continue;
				if (node.matches?.('a[href]') || node.querySelector?.('a[href]')) {
					run();
					return;
				}
			}
		}
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });
}

function collectWordGlowTextNodes(root) {
	const out = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			if (!node.nodeValue || !/\S/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
			const p = node.parentElement;
			if (!p) return NodeFilter.FILTER_REJECT;
			/* Header/footer nav pills use their own border + outer glow, no per-word highlight */
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
	initLinkHoverHints(document.body);
	bindLinkHoverHintObserver();
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

		if (w.closest('.site-nav-link, .site-header-search-open')) return;
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

function isAffiliateShoppingHref(href) {
	const value = String(href || '').trim().toLowerCase();
	if (!value) return false;
	if (value.includes('tag=owenminercs-20')) return true;
	if (value.includes('aliexpress.com/wholesale')) return true;
	if (value.includes('s.click.aliexpress.com') || value.includes('click.aliexpress.com')) return true;
	if (value.includes('pwrdesports.aliexpress.com')) return true;
	return false;
}

function affiliateLinkTitleForHref(href) {
	const value = String(href || '').trim().toLowerCase();
	if (!value) return '';
	if (value.includes('tag=owenminercs-20')) return 'Amazon affiliate';
	if (
		value.includes('aliexpress.com/wholesale') ||
		value.includes('s.click.aliexpress.com') ||
		value.includes('click.aliexpress.com') ||
		value.includes('pwrdesports.aliexpress.com')
	) {
		return 'AliExpress affiliate';
	}
	return '';
}

/** Hover title on compensated shopping links (Amazon / AliExpress). */
function labelAffiliateLinkTitles(root = document.body) {
	if (!root || typeof root.querySelectorAll !== 'function') return;
	root.querySelectorAll('a[href]').forEach((anchor) => {
		const existing = (anchor.getAttribute('title') || '').trim();
		if (existing) return;
		const title = affiliateLinkTitleForHref(anchor.getAttribute('href'));
		if (title) anchor.setAttribute('title', title);
	});
}

function affiliateLinkAlreadyLabeled(anchor) {
	if (!anchor) return true;
	if (/\(affiliate\)/i.test(anchor.textContent || '')) return true;
	const prev = anchor.previousSibling;
	if (prev && prev.nodeType === Node.TEXT_NODE && /\(affiliate\)/i.test(prev.textContent || '')) return true;
	return false;
}

/** Prefix visible affiliate shopping links with "(affiliate) " before the anchor. */
function labelAffiliateLinksInDocument(root = document.body) {
	if (!root || typeof root.querySelectorAll !== 'function') return;
	const skip =
		'shared-footer, shared-header, .site-footer, .site-nav, .affiliate-button, [data-no-affiliate-label]';
	root.querySelectorAll('a[href]').forEach((anchor) => {
		if (anchor.closest(skip)) return;
		if (!isAffiliateShoppingHref(anchor.getAttribute('href'))) return;
		if (affiliateLinkAlreadyLabeled(anchor)) return;
		anchor.parentNode.insertBefore(document.createTextNode('(affiliate) '), anchor);
	});
}

function initAffiliateLinkLabels() {
	labelAffiliateLinksInDocument();
	labelAffiliateLinkTitles();
}

/** Load third-party iframes on demand (click-to-play facade or near-viewport for carousel layers). */
let deferredEmbedObserver = null;

function parseDeferredEmbedUrl(src) {
	if (typeof src !== 'string' || !src.trim()) return null;
	try {
		const u = new URL(src, window.location.href);
		const host = u.hostname.replace(/^www\./i, '').toLowerCase();
		const yt = u.pathname.match(/\/embed\/([^/?#]+)/);
		if (host.includes('youtube.com') && yt) {
			return { provider: 'youtube', id: yt[1], embedUrl: u.href };
		}
		const tt = u.pathname.match(/\/player\/v1\/(\d+)/);
		if (host.includes('tiktok.com') && tt) {
			return { provider: 'tiktok', id: tt[1], embedUrl: u.href };
		}
		if (host.includes('platform.twitter.com') && u.searchParams.get('id')) {
			return { provider: 'twitter', id: u.searchParams.get('id'), embedUrl: u.href };
		}
		if (host.includes('redditmedia.com')) {
			return { provider: 'reddit', id: u.pathname, embedUrl: u.href };
		}
	} catch (_) {}
	return { provider: 'unknown', id: null, embedUrl: src };
}

function applyTikTokIframeReferrerPolicy(iframe) {
	if (!(iframe instanceof HTMLIFrameElement)) return;
	const src = iframe.getAttribute('data-embed-src') || iframe.getAttribute('src') || '';
	if (!/tiktok\.com\/player\/v1/i.test(src)) return;
	iframe.referrerPolicy = 'origin-when-cross-origin';
}

function youtubePosterUrl(videoId, quality) {
	if (quality === 'oar') return `https://i.ytimg.com/vi/${videoId}/oardefault.jpg`;
	const q = quality === 'hq' ? 'hqdefault' : 'maxresdefault';
	return `https://i.ytimg.com/vi/${videoId}/${q}.jpg`;
}

function bindYoutubePosterFallback(poster, videoId) {
	if (!(poster instanceof HTMLImageElement) || !videoId) return;
	poster.addEventListener('error', () => {
		const src = poster.src || '';
		if (src.includes('maxresdefault')) {
			poster.src = youtubePosterUrl(videoId, 'hq');
		} else if (src.includes('hqdefault')) {
			poster.src = youtubePosterUrl(videoId, 'oar');
		}
	});
}

function tiktokPosterUrl(videoId) {
	if (!videoId) return '';
	return `/Socials/images/content-thumbs/tiktok/${videoId}.jpg`;
}

function promoteIframeSrcToDeferred(iframe) {
	if (!(iframe instanceof HTMLIFrameElement)) return;
	const src = iframe.getAttribute('src');
	if (!src || iframe.hasAttribute('data-embed-src')) return;
	applyTikTokIframeReferrerPolicy(iframe);
	iframe.setAttribute('data-embed-src', src);
	iframe.removeAttribute('src');
	iframe.removeAttribute('loading');
}

function shouldUseEmbedFacade(iframe) {
	if (!(iframe instanceof HTMLIFrameElement)) return false;
	if (iframe.closest('[data-embed-facade="off"]')) return false;
	if (iframe.closest('.embed-facade')) return false;
	if (iframe.classList.contains('keep-card__album-layer')) return false;
	const src = iframe.getAttribute('data-embed-src') || iframe.getAttribute('src') || '';
	if (/platform\.twitter\.com\/embed/i.test(src)) {
		return iframe.hasAttribute('data-embed-poster');
	}
	if (/redditmedia\.com/i.test(src)) {
		return iframe.hasAttribute('data-embed-poster');
	}
	return /youtube\.com\/embed|tiktok\.com\/player/i.test(src);
}

/** Append autoplay params for facade clicks (user gesture → start playback in one tap). */
function getAutoplayEmbedUrl(rawSrc) {
	if (!rawSrc) return '';
	try {
		const parsed = new URL(rawSrc, window.location.href);
		parsed.searchParams.set('autoplay', '1');
		parsed.searchParams.set('playsinline', '1');
		const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
		if (host.includes('youtube.com') || host.includes('youtu.be')) {
			parsed.searchParams.set('enablejsapi', '1');
			if (window.location?.origin) {
				parsed.searchParams.set('origin', window.location.origin);
			}
		}
		if (host.includes('tiktok.com')) {
			parsed.searchParams.set('autoplay', '1');
		}
		return parsed.toString();
	} catch (_) {
		const hasQuery = rawSrc.includes('?');
		return `${rawSrc}${hasQuery ? '&' : '?'}autoplay=1&playsinline=1`;
	}
}

function cueYouTubeIframePlay(iframeEl) {
	if (!(iframeEl instanceof HTMLIFrameElement)) return;
	const send = () => {
		try {
			iframeEl.contentWindow?.postMessage(
				JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
				'*',
			);
		} catch (_) {
			// Ignore cross-origin postMessage failures.
		}
	};
	send();
	window.setTimeout(send, 120);
	window.setTimeout(send, 450);
}

function loadDeferredEmbed(iframe, { autoplay = false } = {}) {
	const src = iframe.getAttribute('data-embed-src');
	if (!src || iframe.getAttribute('src')) return;
	applyTikTokIframeReferrerPolicy(iframe);
	const loadSrc = autoplay ? getAutoplayEmbedUrl(src) : src;
	const info = parseDeferredEmbedUrl(src);
	if (autoplay && info?.provider === 'youtube') {
		iframe.addEventListener('load', () => cueYouTubeIframePlay(iframe), { once: true });
	}
	if (autoplay) {
		iframe.loading = 'eager';
	}
	iframe.setAttribute('src', loadSrc);
	iframe.removeAttribute('data-embed-src');
	const facade = iframe.closest('.embed-facade');
	if (facade) facade.classList.add('embed-facade--loaded');
}

function activateEmbedFacade(facade) {
	if (!(facade instanceof Element)) return;
	if (facade.classList.contains('embed-facade--loaded')) return;
	const iframe = facade.querySelector('iframe[data-embed-src]:not([src])');
	if (!iframe) return;
	const src = iframe.getAttribute('data-embed-src') || '';
	const autoplay = !/redditmedia\.com/i.test(src);
	loadDeferredEmbed(iframe, { autoplay });
}

function buildEmbedFacade(iframe) {
	if (!(iframe instanceof HTMLIFrameElement)) return;
	promoteIframeSrcToDeferred(iframe);
	const embedSrc = iframe.getAttribute('data-embed-src');
	if (!embedSrc || iframe.getAttribute('src')) return;

	const info = parseDeferredEmbedUrl(embedSrc);
	const facade = document.createElement('div');
	facade.className = 'embed-facade';
	if (info?.provider === 'youtube') facade.classList.add('embed-facade--youtube');
	if (info?.provider === 'tiktok') facade.classList.add('embed-facade--tiktok');
	if (info?.provider === 'twitter') facade.classList.add('embed-facade--twitter');
	if (info?.provider === 'reddit') facade.classList.add('embed-facade--reddit');

	const title = iframe.getAttribute('title') || 'Embedded video';
	const playBtn = document.createElement('button');
	playBtn.type = 'button';
	playBtn.className = 'embed-facade__play';
	playBtn.setAttribute('aria-label', `Play video: ${title}`);

	if (info?.provider === 'youtube' && info.id) {
		const poster = document.createElement('img');
		poster.className = 'embed-facade__poster';
		poster.alt = '';
		poster.decoding = 'async';
		poster.loading = 'lazy';
		const customPoster = iframe.getAttribute('data-embed-poster');
		const isShort = isShortFormIframeSrc(embedSrc, iframe);
		poster.src = customPoster || youtubePosterUrl(info.id, isShort ? 'oar' : 'max');
		if (!customPoster && !isShort) bindYoutubePosterFallback(poster, info.id);
		facade.appendChild(poster);
	}

	if (info?.provider === 'tiktok') {
		const posterSrc = iframe.getAttribute('data-embed-poster') || tiktokPosterUrl(info?.id);
		if (posterSrc) {
			const poster = document.createElement('img');
			poster.className = 'embed-facade__poster';
			poster.alt = '';
			poster.decoding = 'async';
			poster.loading = 'lazy';
			poster.src = posterSrc;
			facade.appendChild(poster);
		}
	}

	if (info?.provider === 'twitter') {
		const posterSrc = iframe.getAttribute('data-embed-poster') || '';
		if (posterSrc) {
			const poster = document.createElement('img');
			poster.className = 'embed-facade__poster';
			poster.alt = '';
			poster.decoding = 'async';
			poster.loading = 'lazy';
			poster.src = posterSrc;
			facade.appendChild(poster);
		}
	}

	if (info?.provider === 'reddit') {
		const posterSrc = iframe.getAttribute('data-embed-poster') || '';
		if (posterSrc) {
			const poster = document.createElement('img');
			poster.className = 'embed-facade__poster';
			poster.alt = '';
			poster.decoding = 'async';
			poster.loading = 'lazy';
			poster.src = posterSrc;
			facade.appendChild(poster);
		}
	}

	const parent = iframe.parentNode;
	if (!parent) return;
	parent.insertBefore(facade, iframe);
	facade.appendChild(iframe);
	facade.appendChild(playBtn);

	const onActivate = (e) => {
		e.preventDefault();
		e.stopPropagation();
		activateEmbedFacade(facade);
	};
	playBtn.addEventListener('click', onActivate);
	facade.addEventListener('click', (e) => {
		if (facade.classList.contains('embed-facade--loaded')) return;
		if (e.target === playBtn) return;
		onActivate(e);
	});
	playBtn.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') onActivate(e);
	});
}

function observeDeferredEmbed(iframe) {
	if (!(iframe instanceof HTMLIFrameElement)) return;
	if (iframe.getAttribute('src') || !iframe.hasAttribute('data-embed-src')) return;
	if (!('IntersectionObserver' in window)) {
		loadDeferredEmbed(iframe);
		return;
	}
	if (!deferredEmbedObserver) {
		deferredEmbedObserver = new IntersectionObserver(
			(entries, obs) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;
					loadDeferredEmbed(entry.target);
					obs.unobserve(entry.target);
				});
			},
			{ rootMargin: '240px 0px', threshold: 0.01 },
		);
	}
	deferredEmbedObserver.observe(iframe);
}

function initDeferredEmbeds(scope) {
	const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
	root
		.querySelectorAll(
			'.home-yt-tile__media iframe[src], .cs2-yt-card__embed iframe[src], .video-responsive iframe[src]',
		)
		.forEach(promoteIframeSrcToDeferred);
	root.querySelectorAll('iframe[data-embed-src]:not([src])').forEach((iframe) => {
		// A facade already handles this iframe (built on an earlier pass, or cloned by
		// a carousel). Leave it as click-to-play; do NOT route it to the near-viewport
		// observer, which would auto-load it without autoplay and kill the click target.
		if (iframe.closest('.embed-facade')) return;
		if (shouldUseEmbedFacade(iframe)) {
			buildEmbedFacade(iframe);
		} else {
			observeDeferredEmbed(iframe);
		}
	});
}

/**
 * Delegated activation for embed facades. Covers carousel clones, whose DOM is
 * duplicated with cloneNode() and therefore has no per-element click listeners.
 */
function bindEmbedFacadeDelegation() {
	if (bindEmbedFacadeDelegation._bound) return;
	bindEmbedFacadeDelegation._bound = true;
	document.addEventListener('click', (event) => {
		const target = event.target;
		if (!target || typeof target.closest !== 'function') return;
		const facade = target.closest('.embed-facade');
		if (!facade || facade.classList.contains('embed-facade--loaded')) return;
		if (facade.closest('.home-yt-carousel--dragging')) return;
		activateEmbedFacade(facade);
	});
}

function watchDeferredEmbeds() {
	if (watchDeferredEmbeds._bound) return;
	watchDeferredEmbeds._bound = true;
	const observer = new MutationObserver((records) => {
		records.forEach((record) => {
			record.addedNodes.forEach((node) => {
				if (!(node instanceof Element)) return;
				initDeferredEmbeds(node);
			});
		});
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });
}

/** Default lazy/async on content images; keep header logo eager + high priority for LCP. */
function initContentImageLoading(scope) {
	const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
	const skipSelector =
		'.site-shared-header, .site-logo-link, .site-logo, .site-logo--motion, .site-logo--still, [data-no-lazy-img], [data-home-explore-carousel] [data-explore-clone], [data-home-yt-carousel] [data-yt-clone]';

	root.querySelectorAll('img[src]').forEach((img) => {
		if (img.closest(skipSelector)) return;
		if (!img.hasAttribute('loading')) img.loading = 'lazy';
		if (!img.hasAttribute('decoding')) img.decoding = 'async';
	});

	root.querySelectorAll('.site-shared-header .site-logo--still[src]').forEach((img) => {
		img.loading = 'eager';
		if (!img.hasAttribute('decoding')) img.decoding = 'async';
		if (!img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'high');
	});
}

function initPerformanceMedia(scope) {
	initDeferredEmbeds(scope);
	initContentImageLoading(scope);
	if (!scope) {
		watchDeferredEmbeds();
		bindEmbedFacadeDelegation();
	}
}

window.owenminercsInitDeferredEmbeds = initDeferredEmbeds;

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initWordBackgroundGlow);
	document.addEventListener('DOMContentLoaded', initTemporaryInputLockdown);
	document.addEventListener('DOMContentLoaded', initShortFormLooping);
	document.addEventListener('DOMContentLoaded', initSiteSearch);
	document.addEventListener('DOMContentLoaded', initAffiliateLinkLabels);
	document.addEventListener('DOMContentLoaded', initPerformanceMedia);
	document.addEventListener('DOMContentLoaded', scheduleStarfieldBgClient);
	document.addEventListener('DOMContentLoaded', injectSiteQuickLinks);
	document.addEventListener('DOMContentLoaded', initCardGridPlaceholderSort);
	document.addEventListener('DOMContentLoaded', () => initKeepCardPrimaryLinks(document), {
		once: true,
	});
} else {
	initWordBackgroundGlow();
	initTemporaryInputLockdown();
	initShortFormLooping();
	initSiteSearch();
	initAffiliateLinkLabels();
	initPerformanceMedia();
	scheduleStarfieldBgClient();
	injectSiteQuickLinks();
	initCardGridPlaceholderSort();
	initKeepCardPrimaryLinks(document);
}

const SOCIAL_DOCK_POS_KEY = 'owenminercs-social-dock-pos';
const SOCIAL_DOCK_CUSTOMIZED_CLASS = 'site-support-dock--customized';
const SOCIAL_DOCK_DRAG_LOCK_CLASS = 'site-support-dock--drag-lock-horizontal';
/** Header-style row layout for a placed dock (survives after the first header→floating move). */
const SOCIAL_DOCK_LAYOUT_HORIZONTAL_CLASS = 'site-support-dock--layout-horizontal';

function setSocialDockLayoutHorizontal(wrap, enabled) {
	if (!(wrap instanceof Element)) return;
	wrap.classList.toggle(SOCIAL_DOCK_LAYOUT_HORIZONTAL_CLASS, Boolean(enabled));
}

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
/** After release, short “ice” coast, scales pointer speed (keeps glide slow). */
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
/** Distance from the pill edge (local layout bounds) that counts as an edge drag for rotate/resize */
const SOCIAL_DOCK_EDGE_ROTATE_PX = 14;

/** Read tilt/scale from inline style or computed `--site-social-*` on the spin wrapper. */
function getSpinTiltAndScale(spinEl) {
	let tiltDeg = 0;
	let scale = 1;
	if (!(spinEl instanceof Element)) return { tiltDeg, scale };
	const tv =
		spinEl.style.getPropertyValue('--site-social-tilt').trim() ||
		getComputedStyle(spinEl).getPropertyValue('--site-social-tilt').trim();
	const parsed = parseSocialDockTiltDeg(tv);
	if (parsed !== null) tiltDeg = parsed;
	const sv =
		spinEl.style.getPropertyValue('--site-social-scale').trim() ||
		getComputedStyle(spinEl).getPropertyValue('--site-social-scale').trim();
	if (sv) {
		const n = parseFloat(sv);
		if (Number.isFinite(n)) scale = clampSocialDockScale(n);
	}
	return { tiltDeg, scale };
}

/** Map a screen point into the spin element’s local (unrotated, unscaled) space. */
function screenPointToSpinLocal(clientX, clientY, pivot, tiltDeg, scale) {
	const dx = clientX - pivot.x;
	const dy = clientY - pivot.y;
	const rad = (-tiltDeg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return {
		x: (dx * cos - dy * sin) / scale,
		y: (dx * sin + dy * cos) / scale,
	};
}

/** Layout center of the pill relative to the spin pivot (untransformed local space). */
function getMainCenterInPivotLocal(mainEl, spinEl) {
	if (!(mainEl instanceof Element) || !(spinEl instanceof Element)) return null;
	const spinW = spinEl.offsetWidth;
	const spinH = spinEl.offsetHeight;
	if (spinW < 1 || spinH < 1) return null;
	let x = 0;
	let y = 0;
	let el = mainEl;
	while (el && el !== spinEl) {
		x += el.offsetLeft;
		y += el.offsetTop;
		el = el.parentElement;
	}
	if (el !== spinEl) return null;
	x += mainEl.offsetWidth / 2;
	y += mainEl.offsetHeight / 2;
	return { x: x - spinW / 2, y: y - spinH / 2 };
}

/**
 * True when the pointer lies inside the pill but within {@link SOCIAL_DOCK_EDGE_ROTATE_PX} of its rim.
 * Uses layout size/center (not axis-aligned screen bbox, icon counter-rotate skews that after spin).
 */
function isPointerOnSocialBarEdge(clientX, clientY, mainEl, pivotEl) {
	if (!(mainEl instanceof Element)) return false;
	const w = mainEl.offsetWidth;
	const h = mainEl.offsetHeight;
	if (w < 2 || h < 2) return false;

	const spin = mainEl.closest('.site-social-nav__spin');
	if (!(spin instanceof Element)) return false;
	const { tiltDeg, scale } = getSpinTiltAndScale(spin);
	const mark =
		pivotEl instanceof Element ? pivotEl : spin.querySelector('.site-social-nav__pivot-mark');
	const pivot = getPivotFromMark(mark);
	if (!pivot) {
		const r = mainEl.getBoundingClientRect();
		if (r.width < 2 || r.height < 2) return false;
		const inside =
			clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
		if (!inside) return false;
		return (
			Math.min(clientX - r.left, clientY - r.top, r.right - clientX, r.bottom - clientY) <=
			SOCIAL_DOCK_EDGE_ROTATE_PX
		);
	}

	const mainCenter = getMainCenterInPivotLocal(mainEl, spin);
	if (!mainCenter) return false;

	const ptr = screenPointToSpinLocal(clientX, clientY, pivot, tiltDeg, scale);
	const relX = ptr.x - mainCenter.x;
	const relY = ptr.y - mainCenter.y;
	const halfW = w / 2;
	const halfH = h / 2;
	if (Math.abs(relX) > halfW || Math.abs(relY) > halfH) return false;
	return Math.min(halfW - Math.abs(relX), halfH - Math.abs(relY)) <= SOCIAL_DOCK_EDGE_ROTATE_PX;
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

/** Integer coords for fixed positioning (no viewport clamp, users may drag partially off-screen). */
function socialDockCoordsRounded(x, y) {
	return { left: Math.round(x), top: Math.round(y) };
}

/**
 * Keeps the dock inside the viewport with a small margin. Use only for **default** anchor
 * placement (header fallback, resize when not customized). Do not use while dragging, the
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
	 * can be visually tall/narrow while the wrap stays wide, clamping on layout size
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
		setSocialDockLayoutHorizontal(wrap, pos.horizontal === true);
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
			if (wrap.classList.contains(SOCIAL_DOCK_LAYOUT_HORIZONTAL_CLASS)) {
				next.horizontal = true;
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
	wrap.classList.remove(
		'site-support-dock--placed',
		'site-support-dock--dragging',
		SOCIAL_DOCK_DRAG_LOCK_CLASS,
		SOCIAL_DOCK_LAYOUT_HORIZONTAL_CLASS
	);
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
		return getSpinTiltAndScale(spin).tiltDeg;
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
		if (!owenminercsPrefersLiteVisuals()) {
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
		currentDeg = readTiltDegFromSpin();
		currentScale = readScaleFromSpin();
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
		if (!isPointerOnSocialBarEdge(e.clientX, e.clientY, mainEl, mark)) return;
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
	nav.addEventListener('lostpointercapture', (e) => {
		if (!active || e.pointerId !== active.pointerId) return;
		endRotate(e, true);
	});
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

	/** End the temporary header drag lock; optionally keep header row layout after first placement. */
	function releaseHeaderDragLock(keepHorizontalLayout) {
		if (keepHorizontalLayout) {
			setSocialDockLayoutHorizontal(wrap, true);
		}
		setHeaderDragLock(false);
	}

	function socialDockPrefersIceCoast() {
		return !owenminercsPrefersLiteVisuals();
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
			if (wrap.classList.contains(SOCIAL_DOCK_CUSTOMIZED_CLASS)) {
				const mainEl = nav.querySelector('.site-social-nav__main');
				const mark = nav.querySelector('.site-social-nav__pivot-mark');
				if (isPointerOnSocialBarEdge(e.clientX, e.clientY, mainEl, mark)) return;
			}
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
		releaseHeaderDragLock(promotedFromHeader && wasActive);

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
		releaseHeaderDragLock(promotedFromHeader && wasActive);

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
	if (owenminercsPrefersLiteVisuals()) return;

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
	scheduleLazyDockInteractions(wrap);
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

/** Used by e.g. Donators, open the same in-page donation overlay as clicking a Ko-fi link, without a separate “open Ko-fi” step. */
window.owenminercsOpenKofiDonateOverlay = function () {
	if (typeof window.__owenKofiTryOpenOverlay === 'function') {
		return window.__owenKofiTryOpenOverlay();
	}
	return false;
};

function scheduleLazyDockInteractions(wrap) {
	const run = () => {
		initSiteSocialDragRotate(wrap);
		initSiteSupportDockDrag(wrap);
		import('./components-lazy-dock-easter-eggs.js')
			.then((mod) => {
				if (typeof mod.initSocialDockEasterEggs === 'function') {
					mod.initSocialDockEasterEggs(wrap);
				}
			})
			.catch(() => {
				initSocialDockEasterEggs(wrap);
			});
	};
	if (typeof window.requestIdleCallback === 'function') {
		window.requestIdleCallback(run, { timeout: 2200 });
	} else {
		window.setTimeout(run, 48);
	}
}

function scheduleLazyKofiModule() {
	const run = () => {
		import('./components-lazy-kofi.js').catch(() => {});
	};
	if (typeof window.requestIdleCallback === 'function') {
		window.requestIdleCallback(run, { timeout: 3500 });
	} else {
		window.setTimeout(run, 120);
	}
}

if (document.body) {
	scheduleLazyKofiModule();
} else {
	document.addEventListener('DOMContentLoaded', scheduleLazyKofiModule, { once: true });
}

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

initSiteScrollRestoration();

/**
 * Re-run DOM helpers under `root` after injecting fetched page HTML (moss-nocturne-site preview shell).
 * Does not re-bind global listeners from initWordBackgroundGlow / initWordGlowBookmark.
 */
window.owenminercsHydrateRoot = function (root) {
	if (!(root instanceof Element)) return;
	disableTextInputControls(root);
	enforceShortFormLooping(root);
	initPerformanceMedia(root);
	prepareKeepCardLineGlows();
	wrapAllEligibleLinksAsLineGlow(root);
	initLinkHoverHints(root);
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

/** Carousel placeholder filter, see scripts/carousel-placeholder-filter.js (keep in sync). */
(function initCarouselPlaceholderFilter() {
	if (window.owenminercsCarouselFilter) return;

	function normSrc(src) {
		return String(src || '')
			.trim()
			.toLowerCase();
	}

	function isCarouselPlaceholderSrc(src) {
		const lower = normSrc(src);
		if (!lower || /^data:/i.test(lower)) return true;
		if (lower.includes('coming-soon-card')) return true;
		if (lower.includes('owenminercs-logo')) return true;
		if (lower.includes('/images/logo/globes/') || lower.includes('logo/globes/globe-')) return true;
		if (/\/images\/logo\/(favicon|apple-touch)/.test(lower)) return true;
		if (lower.endsWith('.svg')) return true;
		return false;
	}

	function slideSrc(slide) {
		if (!slide) return '';
		if (typeof slide === 'string') return slide;
		if (typeof slide.src === 'string') return slide.src;
		if (slide.getAttribute) return slide.getAttribute('src') || '';
		return '';
	}

	function filterCarouselSlides(slides) {
		if (!slides || !slides.length) return slides || [];
		const real = [];
		const placeholders = [];
		for (let i = 0; i < slides.length; i++) {
			const slide = slides[i];
			if (isCarouselPlaceholderSrc(slideSrc(slide))) placeholders.push(slide);
			else real.push(slide);
		}
		if (real.length) return real;
		return placeholders.length ? placeholders : slides;
	}

	function pruneCarouselImageNodes(container) {
		if (!container || !container.querySelectorAll) return;
		const imgs = container.querySelectorAll('img[src]');
		if (!imgs.length) return;
		const real = [];
		const placeholders = [];
		for (let i = 0; i < imgs.length; i++) {
			const src = imgs[i].getAttribute('src');
			if (isCarouselPlaceholderSrc(src)) placeholders.push(imgs[i]);
			else real.push(imgs[i]);
		}
		if (!real.length || !placeholders.length) return;
		for (let j = 0; j < placeholders.length; j++) {
			placeholders[j].remove();
		}
	}

	const SORTABLE_CARD_SELECTOR =
		'.keep-card, .site-teaser-card, .home-explore-card, .garage-sale-card, .garage-sale-ebay-card';

	function isSortableCard(el) {
		return !!(el && el.matches && el.matches(SORTABLE_CARD_SELECTOR));
	}

	function isCardPlaceholderOnly(card) {
		if (!card) return false;
		if (card.getAttribute && card.getAttribute('data-card-sort-skip') === 'true') return false;
		if (card.querySelector('.keep-card__reddit-embed, .keep-card__video-thumb')) return false;
		if (card.querySelector('iframe[src]')) return false;
		if (card.querySelector('.keep-card__thumb--empty')) return true;

		const album = card.querySelector('.keep-card__album');
		if (album && !album.querySelector('img[src], iframe[src]')) return true;

		const imgs = card.querySelectorAll('img[src]');
		if (!imgs.length) {
			const thumb = card.querySelector('.keep-card__thumb');
			return !!(thumb && thumb.tagName !== 'IMG');
		}

		for (let i = 0; i < imgs.length; i++) {
			if (!isCarouselPlaceholderSrc(imgs[i].getAttribute('src'))) return false;
		}
		return true;
	}

	function cardVideoSlotText(card) {
		const slot = card && card.querySelector('.keep-card__video-slot');
		return slot ? String(slot.textContent || '').trim() : '';
	}

	function isCardSetupArchive(card) {
		if (!card) return false;
		if (card.getAttribute && card.getAttribute('data-card-setup-archive') === 'true') return true;
		if (card.getAttribute && card.getAttribute('data-card-setup-archive') === 'false') return false;
		return /^Archive$/i.test(cardVideoSlotText(card));
	}

	function isCardLegacyGear(card) {
		if (!card) return false;
		if (card.getAttribute && card.getAttribute('data-card-sort-skip') === 'true') return false;
		if (card.getAttribute && card.getAttribute('data-card-legacy') === 'false') return false;
		if (isCardSetupArchive(card)) return false;
		if (card.getAttribute && card.getAttribute('data-card-legacy') === 'true') return true;

		const slot = cardVideoSlotText(card);
		if (/^Legacy/i.test(slot)) return true;

		const href = (card.getAttribute && card.getAttribute('data-href')) || '';
		if (/-legacy(\.html|\/|$)/i.test(href)) return true;

		const cta = card.querySelector('.keep-card__cta');
		const ctaText = cta ? String(cta.textContent || '').trim() : '';
		if (/^Archive\s*→/i.test(ctaText)) return true;

		let blob = '';
		const label = card.querySelector('.keep-card__label');
		const aff = card.querySelector('.keep-card__affiliate');
		if (label) blob += label.textContent + ' ';
		if (aff) blob += aff.textContent + ' ';
		return /\bsold\b/i.test(blob);
	}

	function cardSortRank(card) {
		const placeholder = isCardPlaceholderOnly(card) ? 1 : 0;
		if (isCardLegacyGear(card)) return 2 + placeholder;
		return placeholder;
	}

	function stableSortCardRun(parent, run) {
		if (!parent || run.length < 2) return false;

		const indexed = run.map((card, idx) => ({
			card,
			rank: cardSortRank(card),
			idx,
		}));
		let minRank = indexed[0].rank;
		let maxRank = indexed[0].rank;
		for (let r = 1; r < indexed.length; r++) {
			if (indexed[r].rank < minRank) minRank = indexed[r].rank;
			if (indexed[r].rank > maxRank) maxRank = indexed[r].rank;
		}
		if (minRank === maxRank) return false;

		indexed.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.idx - b.idx));

		const anchor = run[run.length - 1].nextSibling;
		for (let j = 0; j < indexed.length; j++) {
			parent.insertBefore(indexed[j].card, anchor);
		}
		return true;
	}

	function sortSiblingCardRuns(parent) {
		if (!parent || !parent.children) return;
		const children = [...parent.children];
		let i = 0;
		while (i < children.length) {
			const child = children[i];
			if (isSortableCard(child)) {
				const run = [];
				while (i < children.length && isSortableCard(children[i])) {
					run.push(children[i]);
					i++;
				}
				stableSortCardRun(parent, run);
			} else {
				if (child.querySelector && child.querySelector(SORTABLE_CARD_SELECTOR)) {
					sortSiblingCardRuns(child);
				}
				i++;
			}
		}
	}

	const CARD_GRID_SELECTOR =
		'.keep-board, .site-teaser-grid, .garage-sale-grid, [data-garage-sale-grid], [data-card-sort-grid]';

	function sortAllCardGrids(root) {
		const scope = root && root.querySelectorAll ? root : document;
		const grids = scope.querySelectorAll(CARD_GRID_SELECTOR);
		for (let g = 0; g < grids.length; g++) {
			sortSiblingCardRuns(grids[g]);
		}
	}

	function slidesHaveRealMedia(slides) {
		if (!slides || !slides.length) return false;
		for (let i = 0; i < slides.length; i++) {
			if (!isCarouselPlaceholderSrc(slideSrc(slides[i]))) return true;
		}
		return false;
	}

	function sortConfigCardsPlaceholderLast(cards, imgKey) {
		const key = imgKey || 'img';
		if (!cards || !cards.length) return cards || [];
		return cards
			.map((card, idx) => {
				const src = typeof card === 'string' ? card : card && card[key];
				return {
					card,
					idx,
					rank: isCarouselPlaceholderSrc(src) ? 1 : 0,
				};
			})
			.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.idx - b.idx))
			.map((item) => item.card);
	}

	window.owenminercsCarouselFilter = {
		isCarouselPlaceholderSrc,
		filterCarouselSlides,
		pruneCarouselImageNodes,
		isCardPlaceholderOnly,
		isCardSetupArchive,
		isCardLegacyGear,
		cardSortRank,
		slidesHaveRealMedia,
		sortSiblingCardRuns,
		sortAllCardGrids,
		sortConfigCardsPlaceholderLast,
	};
})();

function initCardGridPlaceholderSort() {
	const api = window.owenminercsCarouselFilter;
	if (api && typeof api.sortAllCardGrids === 'function') {
		api.sortAllCardGrids(document);
	}
}

const KEEP_CARD_INTERACTIVE_TARGET =
	'a[href], button, iframe, .reddit-embed-bq, .keep-card__embed-skip-nav, .keep-card__reddit-embed, .keep-card__album-nav, .keep-card__photo-jump, .embed-facade, input, select, textarea';

function keepCardClickShouldNavigate(event) {
	if (event.defaultPrevented) return false;
	const interactive = event.target.closest(KEEP_CARD_INTERACTIVE_TARGET);
	if (!interactive) return true;
	return Boolean(event.target.closest('.keep-card__album-viewport'));
}

function initKeepCardPrimaryLinks(root) {
	const scope = root && root.querySelectorAll ? root : document;
	scope
		.querySelectorAll(
			'.keep-card[data-href]:not(.keep-card--affiliate-quick):not(.keep-card--static):not(.site-map-card)',
		)
		.forEach((card) => {
			if (card.querySelector(':scope > .keep-card__primary')) return;
			const href = card.getAttribute('data-href');
			if (!href) return;

			const link = document.createElement('a');
			link.className = 'keep-card__primary';
			link.href = href;
	link.style.position = 'absolute';
	link.style.inset = '0';
	link.style.zIndex = '0';
			const labelEl = card.querySelector('.keep-card__label');
			if (labelEl && labelEl.textContent) {
				link.setAttribute('aria-label', labelEl.textContent.trim());
			}
			card.insertBefore(link, card.firstChild);

			if (card.getAttribute('role') === 'link') {
				card.removeAttribute('tabindex');
			}

			card.addEventListener('click', (e) => {
				if (!keepCardClickShouldNavigate(e)) return;
				window.location.href = href;
			});
		});
}

window.owenminercsInitKeepCardPrimaryLinks = initKeepCardPrimaryLinks;
