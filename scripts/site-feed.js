(function () {
	'use strict';

	if (window.__owenSiteFeedInit) return;
	window.__owenSiteFeedInit = true;

	const KO_FI_TIP_URL = 'https://ko-fi.com/owenminer';
	const STREAMELEMENTS_TIP_URL = 'https://streamelements.com/owenminercs/tip';

	function isInternalPath(path) {
		const p = String(path || '').trim();
		return p.length > 0 && !/^https?:\/\//i.test(p);
	}

	function inferTag(path) {
		const p = String(path || '')
			.replace(/^\//, '')
			.toLowerCase();
		if (p.startsWith('gaming/')) return 'Gaming';
		if (p.startsWith('counter-strike/')) return 'Gaming';
		if (p.startsWith('the setup/') || p.startsWith('keyboard/') || p.startsWith('pc/') || p.startsWith('upgrades/')) {
			return 'Gear';
		}
		if (p.startsWith('socials/')) return 'Socials';
		return 'Site';
	}

	function escapeHtml(str) {
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function linkifyKoFiAndStreamElements(text) {
		if (!text || typeof text !== 'string') return '';
		let t = escapeHtml(text);
		t = t.replace(
			/\bKo-fi\b/g,
			`<a href="${KO_FI_TIP_URL}" data-kofi-link class="site-feed-inline-tip" target="_blank" rel="noopener noreferrer">Ko-fi</a>`
		);
		t = t.replace(
			/\bStreamElements\b/g,
			`<a href="${STREAMELEMENTS_TIP_URL}" data-streamelements-tip-link class="site-feed-inline-tip" target="_blank" rel="noopener noreferrer">StreamElements</a>`
		);
		return t;
	}

	function getSiteRoot() {
		const el = document.querySelector('script[data-owen-site-feed]');
		if (!el || !el.src) return `${window.location.origin}/`;
		const root = el.src.replace(/scripts\/site-feed\.js(\?.*)?$/i, '');
		return root || `${window.location.origin}/`;
	}

	function feedUrl() {
		return `${getSiteRoot()}data/site-feed.json`;
	}

	function formatDate(iso) {
		if (!iso || typeof iso !== 'string') return '';
		const d = new Date(`${iso}T12:00:00`);
		if (Number.isNaN(d.getTime())) return iso;
		try {
			return new Intl.DateTimeFormat(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			}).format(d);
		} catch (_) {
			return iso;
		}
	}

	function resolveHref(path) {
		const p = path || '/';
		if (/^https?:\/\//i.test(p)) return p;
		return p.startsWith('/') ? p : `/${p}`;
	}

	function applyFeedLinkAttrs(link, href) {
		link.href = href;
		link.removeAttribute('target');
		link.removeAttribute('rel');
	}

	function previewLabel(tag) {
		return tag ? `${tag} page` : 'Site page';
	}

	function previewDest(href) {
		if (/^https?:\/\//i.test(href)) {
			try {
				const u = new URL(href);
				return `${u.host.replace(/^www\./, '')}${u.pathname}${u.search}`.replace(/\/$/, '') || u.host;
			} catch (_) {
				return href;
			}
		}
		return String(href || '').replace(/^\//, '');
	}

	const pageThumbCache = new Map();

	function resolveFirstImageFromPage(href) {
		const key = String(href || '');
		if (pageThumbCache.has(key)) return pageThumbCache.get(key);

		const task = (async () => {
			try {
				const res = await fetch(key, { credentials: 'same-origin' });
				if (!res.ok) return null;
				const html = await res.text();
				const doc = new DOMParser().parseFromString(html, 'text/html');
				const img = doc.querySelector('img[src]');
				if (!img) return null;
				const raw = img.getAttribute('src')?.trim();
				if (!raw || raw.startsWith('data:')) return null;
				return new URL(raw, new URL(key, window.location.origin)).href;
			} catch (_) {
				return null;
			}
		})();

		pageThumbCache.set(key, task);
		return task;
	}

	function insertFeedThumb(aside, tagEl, href) {
		void resolveFirstImageFromPage(href).then((src) => {
			if (!src || !aside.isConnected) return;

			const thumb = document.createElement('span');
			thumb.className = 'site-feed-item__thumb';
			thumb.setAttribute('aria-hidden', 'true');

			const img = document.createElement('img');
			img.src = src;
			img.alt = '';
			img.loading = 'lazy';
			img.decoding = 'async';
			thumb.appendChild(img);

			aside.insertBefore(thumb, tagEl);

			if (typeof window.__owenSiteFeedQueueInit === 'function') {
				window.__owenSiteFeedQueueInit();
			}
		});
	}

	function renderFeed(entries) {
		const list = document.getElementById('site-feed-list');
		if (!list || !Array.isArray(entries)) return;

		list.innerHTML = '';
		list.setAttribute('aria-busy', 'false');
		const internalEntries = entries.filter((entry) => isInternalPath(entry.path || entry.url || ''));

		internalEntries.forEach((entry) => {
			const href = resolveHref(entry.path || entry.url || '/');
			const tag = entry.tag || inferTag(entry.path || entry.url || href);

			const li = document.createElement('li');
			li.className = 'site-feed-item';

			const card = document.createElement('a');
			card.className = 'site-feed-item__link site-feed-item__card';
			applyFeedLinkAttrs(card, href);
			card.setAttribute('aria-describedby', 'site-feed-preview');

			const layout = document.createElement('span');
			layout.className = 'site-feed-item__layout';

			const content = document.createElement('span');
			content.className = 'site-feed-item__content';

			const timeEl = document.createElement('time');
			timeEl.className = 'site-feed-item__date';
			timeEl.dateTime = entry.date || '';
			timeEl.textContent = formatDate(entry.date);

			const titleEl = document.createElement('span');
			titleEl.className = 'site-feed-item__title';
			titleEl.textContent = entry.title || 'Update';

			const row = document.createElement('span');
			row.className = 'site-feed-item__row';
			row.append(timeEl, titleEl);
			content.appendChild(row);

			if (entry.summary) {
				const sum = document.createElement('p');
				sum.className = 'site-feed-item__summary';
				sum.innerHTML = linkifyKoFiAndStreamElements(entry.summary);
				content.appendChild(sum);
			}

			layout.appendChild(content);

			if (tag) {
				const aside = document.createElement('span');
				aside.className = 'site-feed-item__aside';

				const tagEl = document.createElement('span');
				tagEl.className = 'site-feed-item__tag';
				tagEl.textContent = tag;
				aside.appendChild(tagEl);

				layout.appendChild(aside);
				insertFeedThumb(aside, tagEl, href);
			}

			card.appendChild(layout);

			const preview = document.createElement('template');
			preview.className = 'site-feed-item__preview';
			preview.innerHTML = `<span class="site-feed-cursor-preview__kind">${escapeHtml(
				previewLabel(tag)
			)}</span><span class="site-feed-cursor-preview__dest">${escapeHtml(previewDest(href))}</span>`;
			card.appendChild(preview);

			li.appendChild(card);
			list.appendChild(li);
		});

		if (typeof window.__owenSiteFeedHoverBind === 'function') {
			window.__owenSiteFeedHoverBind(list);
		}

		if (typeof window.__owenSiteFeedQueueInit === 'function') {
			window.__owenSiteFeedQueueInit();
		}
	}

	async function run() {
		const list = document.getElementById('site-feed-list');
		const errEl = document.getElementById('site-feed-error');
		let data;
		try {
			const res = await fetch(feedUrl(), { cache: 'no-store' });
			if (!res.ok) throw new Error(String(res.status));
			data = await res.json();
		} catch (_) {
			if (list) list.setAttribute('aria-busy', 'false');
			if (errEl) {
				errEl.hidden = false;
				errEl.textContent = 'Could not load the site feed. Try refreshing the page.';
			}
			if (list && !list.children.length) {
				list.innerHTML = '';
				const li = document.createElement('li');
				li.className = 'site-feed-item site-feed-item--error';
				li.textContent = 'Feed unavailable.';
				list.appendChild(li);
			}
			return;
		}

		if (errEl) errEl.hidden = true;
		const entries = Array.isArray(data.entries) ? data.entries : [];
		renderFeed(entries);
	}

	function boot() {
		void run();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot, { once: true });
	} else {
		boot();
	}
})();
