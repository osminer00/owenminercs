/**
 * Site map page (`site-map.html`): grouped keep-cards for every public page.
 */
(function initSiteMapPage() {
	const ORDER_URL = 'data/site-map-order.json';
	const INDEX_URL = 'data/site-search-index.json';
	const LOGO_THUMB = '/images/owenminercs-logo.png';
	const VISITED_KEY = 'owenminercs-site-map-visited-v1';
	const TODO_KEY = 'owenminercs-site-map-todo-v1';

	function readPathSet(storageKey) {
		try {
			const raw = localStorage.getItem(storageKey);
			const parsed = raw ? JSON.parse(raw) : [];
			return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
		} catch {
			return new Set();
		}
	}

	function writePathSet(storageKey, set) {
		try {
			localStorage.setItem(storageKey, JSON.stringify([...set]));
		} catch (_) {}
	}

	function readVisited() {
		return readPathSet(VISITED_KEY);
	}

	function writeVisited(set) {
		writePathSet(VISITED_KEY, set);
	}

	function readTodo() {
		return readPathSet(TODO_KEY);
	}

	function writeTodo(set) {
		writePathSet(TODO_KEY, set);
	}

	function isVisited(pathKey) {
		return readVisited().has(normalizePathKey(pathKey));
	}

	function isTodo(pathKey) {
		return readTodo().has(normalizePathKey(pathKey));
	}

	function markVisited(pathKey) {
		const key = normalizePathKey(pathKey);
		if (!key) return;
		const set = readVisited();
		if (set.has(key)) return;
		set.add(key);
		writeVisited(set);
	}

	function toggleVisited(pathKey) {
		const key = normalizePathKey(pathKey);
		if (!key) return false;
		const set = readVisited();
		if (set.has(key)) set.delete(key);
		else set.add(key);
		writeVisited(set);
		return set.has(key);
	}

	function toggleTodo(pathKey) {
		const key = normalizePathKey(pathKey);
		if (!key) return false;
		const set = readTodo();
		if (set.has(key)) set.delete(key);
		else set.add(key);
		writeTodo(set);
		return set.has(key);
	}

	function decodePath(p) {
		try {
			return decodeURIComponent(p);
		} catch {
			return p;
		}
	}

	function normalizePathKey(p) {
		return decodePath(p).replace(/\\/g, '/').replace(/\.html$/i, '').toLowerCase();
	}

	function pageHref(sitePath) {
		const resolve = window.owenminercsSiteSearchApi?.resolveHref;
		if (typeof resolve === 'function') {
			return resolve(!sitePath || sitePath === 'index' ? '' : sitePath);
		}
		const isLocal =
			window.location.hostname === '127.0.0.1' ||
			window.location.hostname === 'localhost' ||
			window.location.protocol === 'file:';
		if (!sitePath || sitePath === 'index') return './';
		const segments = sitePath.split('/').map((seg) => encodeURIComponent(decodeURIComponent(seg)));
		return `./${segments.join('/')}${isLocal ? '.html' : ''}`;
	}

	function posterFallbackForPath(sitePath) {
		const key = normalizePathKey(sitePath);
		if (
			key.startsWith('the setup/') ||
			key.startsWith('keyboard/') ||
			key.startsWith('pc/') ||
			key.startsWith('desk setup/') ||
			key.startsWith('upgrades/')
		) {
			return '/images/bubble-themes/socials/poster.jpg';
		}
		if (key.startsWith('gaming/') || key.startsWith('counter-strike/')) {
			return '/images/bubble-themes/gaming/poster.jpg';
		}
		if (
			key.startsWith('socials/') ||
			key.startsWith('photography/') ||
			key.startsWith('posts/') ||
			key.startsWith('music/')
		) {
			return '/images/bubble-themes/socials/poster.jpg';
		}
		if (key.startsWith('donators/')) return '/images/bubble-themes/donators/poster.jpg';
		if (key.startsWith('garage sale/')) return '/images/bubble-themes/garage-sale/poster.jpg';
		if (key.startsWith('help wanted/')) return '/images/bubble-themes/help-wanted/poster.jpg';
		if (key.startsWith('qa/')) return '/images/bubble-themes/qa/poster.jpg';
		if (key.startsWith('dev/')) return '/images/bubble-themes/dev/poster.jpg';
		if (key.startsWith('achievements/')) return '/images/bubble-themes/achievements/poster.jpg';
		if (key.startsWith('services/')) return '/About/Images/owenProfile.webp';
		if (key === 'index') return '/About/Images/owenProfile.webp';
		return null;
	}

	function thumbSrc(thumbs, sitePath) {
		const raw = thumbs?.[normalizePathKey(sitePath)];
		if (raw) {
			if (/^https?:\/\//i.test(raw)) return raw;
			return raw.startsWith('/') ? raw : `/${raw}`;
		}
		return posterFallbackForPath(sitePath) || LOGO_THUMB;
	}

	function thumbAlt(thumbAlts, sitePath, title) {
		const custom = thumbAlts?.[normalizePathKey(sitePath)];
		return (typeof custom === 'string' && custom.trim()) || title;
	}

	function cardTitle(titleOverrides, sitePath, entryTitle) {
		const custom = titleOverrides?.[normalizePathKey(sitePath)];
		if (typeof custom === 'string' && custom.trim()) return custom.trim();
		return cleanTitle(entryTitle);
	}

	function cleanTitle(raw) {
		let t = (raw || '').trim();
		t = t.replace(/\s*\|\s*Owen Miner\s*$/i, '');
		t = t.replace(/\s*\|\s*OwenMinerCS\s*$/i, '');
		t = t.replace(/\s*\|\s*Easter eggs\s*/i, ' | ');
		t = t.replace(/\s*\|\s*$/g, '').trim();
		return t || 'Page';
	}

	function truncate(text, max = 96) {
		const s = (text || '').replace(/\s+/g, ' ').trim();
		if (s.length <= max) return s;
		return `${s.slice(0, max - 1).trim()}…`;
	}

	function buildEntryMap(entries) {
		const map = new Map();
		for (const entry of entries) {
			if (!entry?.path) continue;
			map.set(normalizePathKey(entry.path), entry);
		}
		return map;
	}

	function renderCard(entry, sitePath, thumbs, thumbAlts, titleOverrides) {
		const title = cardTitle(titleOverrides, sitePath, entry?.title);
		const snippet = truncate(entry?.snippet || '');
		const href = pageHref(sitePath);
		const card = document.createElement('div');
		card.className = 'keep-card site-map-card';
		card.setAttribute('role', 'link');
		card.setAttribute('tabindex', '0');
		card.setAttribute('data-card-sort-skip', 'true');
		card.dataset.href = href;
		card.dataset.sitePath = sitePath;

		const inner = document.createElement('div');
		inner.className = 'keep-card__inner';
		const img = document.createElement('img');
		img.className = 'keep-card__thumb';
		img.src = thumbSrc(thumbs, sitePath);
		img.alt = thumbAlt(thumbAlts, sitePath, title);
		img.loading = 'lazy';
		img.decoding = 'async';
		const scalable = document.createElement('div');
		scalable.className = 'keep-card__scalable';
		const body = document.createElement('div');
		body.className = 'keep-card__body';
		const label = document.createElement('p');
		label.className = 'keep-card__label';
		label.textContent = title;
		if (snippet) {
			const blurb = document.createElement('div');
			blurb.className = 'keep-card__affiliate';
			blurb.textContent = snippet;
			body.append(label, blurb);
		} else {
			body.appendChild(label);
		}
		scalable.appendChild(body);
		inner.append(img, scalable);
		card.appendChild(inner);
		return card;
	}

	function renderSection(section, entryMap, thumbs, thumbAlts, titleOverrides) {
		const sectionEl = document.createElement('section');
		sectionEl.className = 'site-map-section';
		sectionEl.id = `site-map-${section.id}`;
		sectionEl.setAttribute('aria-labelledby', `site-map-heading-${section.id}`);

		const head = document.createElement('div');
		head.className = 'site-map-section__head';

		const title = document.createElement('h2');
		title.className = 'site-map-section__title';
		title.id = `site-map-heading-${section.id}`;
		if (section.hubPath) {
			const hubLink = document.createElement('a');
			hubLink.href = pageHref(section.hubPath);
			hubLink.textContent = section.label;
			title.appendChild(hubLink);
		} else {
			title.textContent = section.label;
		}

		const count = document.createElement('span');
		count.className = 'site-map-section__count';
		count.textContent = `${section.paths.length}`;

		head.append(title, count);

		const grid = document.createElement('div');
		grid.className = 'keep-board keep-board--hub site-map-section__grid';

		for (const sitePath of section.paths) {
			const entry = entryMap.get(normalizePathKey(sitePath));
			grid.appendChild(renderCard(entry, sitePath, thumbs, thumbAlts, titleOverrides));
		}

		sectionEl.append(head, grid);
		return sectionEl;
	}

	function renderJumpNav(sections) {
		const nav = document.createElement('nav');
		nav.className = 'home-pillars site-map-jump';
		nav.setAttribute('aria-label', 'Site map sections');
		const items = sections.map((section, index) => {
			const a = document.createElement('a');
			a.href = `#site-map-${section.id}`;
			a.className = 'home-pillars__link site-map-jump__link';
			a.textContent = section.label;
			return a;
		});
		items.forEach((link, index) => {
			nav.appendChild(link);
			if (index < items.length - 1) {
				const sep = document.createElement('span');
				sep.className = 'home-pillars__sep';
				sep.setAttribute('aria-hidden', 'true');
				sep.textContent = '\u00b7';
				nav.appendChild(sep);
			}
		});
		return nav;
	}

	function syncCardMarkers(card) {
		const key = normalizePathKey(card.dataset.sitePath || '');
		card.classList.toggle('site-map-card--visited', isVisited(key));
		card.classList.toggle('site-map-card--todo', isTodo(key));
	}

	function wireKeepCards(scope) {
		scope.querySelectorAll('.keep-card[data-href]:not(.keep-card--affiliate-quick)').forEach((card) => {
			const href = card.getAttribute('data-href');
			if (!href) return;
			syncCardMarkers(card);
			card.addEventListener('click', (e) => {
				if (e.target.closest('a')) return;
				const key = normalizePathKey(card.dataset.sitePath || '');
				if (e.ctrlKey) {
					e.preventDefault();
					const todo = toggleTodo(key);
					card.classList.toggle('site-map-card--todo', todo);
					return;
				}
				if (e.shiftKey) {
					e.preventDefault();
					const visited = toggleVisited(key);
					card.classList.toggle('site-map-card--visited', visited);
					return;
				}
				if (key) {
					markVisited(key);
					card.classList.add('site-map-card--visited');
				}
				window.location.href = href;
			});
			card.addEventListener('keydown', (e) => {
				if (e.key !== 'Enter' && e.key !== ' ') return;
				if (e.target.closest?.('a')) return;
				e.preventDefault();
				window.location.href = href;
			});
		});
	}

	function run() {
		const root = document.getElementById('site-map-page-root');
		const summary = document.getElementById('site-map-page-summary');
		if (!root) return;

		Promise.all([
			fetch(ORDER_URL).then((r) => {
				if (!r.ok) throw new Error('order');
				return r.json();
			}),
			fetch(INDEX_URL).then((r) => {
				if (!r.ok) throw new Error('index');
				return r.json();
			}),
		])
			.then(([order, indexData]) => {
				const sections = order?.sections || [];
				const thumbs = order?.thumbs || {};
				const thumbAlts = order?.thumbAlts || {};
				const titleOverrides = order?.titleOverrides || {};
				const entryMap = buildEntryMap(indexData?.entries || []);

				const total = sections.reduce((n, s) => n + (s.paths?.length || 0), 0);
				if (summary) {
					summary.textContent = `${total} pages across ${sections.length} sections.`;
				}

				const jumpHost = document.getElementById('site-map-jump-host');
				if (jumpHost) {
					jumpHost.replaceChildren(renderJumpNav(sections));
				}

				root.replaceChildren();
				for (const section of sections) {
					root.appendChild(renderSection(section, entryMap, thumbs, thumbAlts, titleOverrides));
				}
				wireKeepCards(root);
				root.setAttribute('aria-busy', 'false');
			})
			.catch(() => {
				root.textContent = '';
				root.setAttribute('aria-busy', 'false');
				const p = document.createElement('p');
				p.className = 'site-map-page__error';
				p.textContent = 'Could not load site map data.';
				root.appendChild(p);
			});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run);
	} else {
		run();
	}
})();
