(function () {
	'use strict';

	if (window.__owenSiteFeedInit) return;
	window.__owenSiteFeedInit = true;

	const KO_FI_TIP_URL = 'https://ko-fi.com/owenminer';
	const STREAMELEMENTS_TIP_URL = 'https://streamelements.com/owenminercs/tip';

	function escapeHtml(str) {
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	/** Turn visible "Ko-fi" / "StreamElements" in feed summaries into donate/tip links (matches donation-links.json defaults). */
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

	function renderFeed(entries) {
		const list = document.getElementById('site-feed-list');
		if (!list || !Array.isArray(entries)) return;

		list.innerHTML = '';
		list.setAttribute('aria-busy', 'false');
		entries.forEach((entry) => {
			const li = document.createElement('li');
			li.className = 'site-feed-item';

			const href = resolveHref(entry.path || entry.url || '/');
			const link = document.createElement('a');
			link.className = 'site-feed-item__link';
			link.href = href;

			const timeEl = document.createElement('time');
			timeEl.className = 'site-feed-item__date';
			timeEl.dateTime = entry.date || '';
			timeEl.textContent = formatDate(entry.date);

			const titleEl = document.createElement('span');
			titleEl.className = 'site-feed-item__title';
			titleEl.textContent = entry.title || 'Update';

			const row = document.createElement('div');
			row.className = 'site-feed-item__row';
			row.append(timeEl, titleEl);

			link.appendChild(row);

			if (entry.summary) {
				const sum = document.createElement('p');
				sum.className = 'site-feed-item__summary';
				sum.innerHTML = linkifyKoFiAndStreamElements(entry.summary);
				link.appendChild(sum);
			}

			li.appendChild(link);
			list.appendChild(li);
		});
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
