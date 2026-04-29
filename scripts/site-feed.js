(function () {
	'use strict';

	if (window.__owenSiteFeedInit) return;
	window.__owenSiteFeedInit = true;

	const LS_NOTIFY = 'owenminercs-feed-notify-enabled';
	const LS_LAST_KNOWN = 'owenminercs-feed-lastKnownEntryId';
	const POLL_MS = 12 * 60 * 1000;
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

	function absoluteFromPath(path) {
		const p = resolveHref(path);
		if (/^https?:\/\//i.test(p)) return p;
		return new URL(p, window.location.origin).href;
	}

	function readNotifyEnabled() {
		try {
			return window.localStorage.getItem(LS_NOTIFY) === '1';
		} catch (_) {
			return false;
		}
	}

	function setNotifyEnabled(on) {
		try {
			if (on) window.localStorage.setItem(LS_NOTIFY, '1');
			else window.localStorage.removeItem(LS_NOTIFY);
		} catch (_) {}
	}

	function readLastKnown() {
		try {
			return window.localStorage.getItem(LS_LAST_KNOWN);
		} catch (_) {
			return null;
		}
	}

	function writeLastKnown(id) {
		try {
			if (id) window.localStorage.setItem(LS_LAST_KNOWN, id);
		} catch (_) {}
	}

	function notifyNewEntry(entry) {
		if (!entry || !('Notification' in window) || Notification.permission !== 'granted') return;
		const abs = absoluteFromPath(entry.path || entry.url || '/');
		const n = new Notification('New on owenminercs', {
			body: entry.title,
			tag: `owen-feed-${entry.id}`,
			icon: `${getSiteRoot()}images/owenminercs-logo.png`,
		});
		n.onclick = () => {
			window.focus();
			window.location.href = abs;
			n.close();
		};
	}

	function maybeAlertForNewTop(entries) {
		if (!Array.isArray(entries) || entries.length === 0) return;
		const top = entries[0];
		if (!top || !top.id) return;
		if (!readNotifyEnabled() || Notification.permission !== 'granted') return;

		const last = readLastKnown();
		if (last === null || last === undefined) {
			writeLastKnown(top.id);
			return;
		}
		if (last !== top.id) {
			notifyNewEntry(top);
			writeLastKnown(top.id);
		}
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

	function updateNotifyUi(btn, hint) {
		if (!btn) return;
		const insecure =
			typeof window.isSecureContext === 'boolean' && window.isSecureContext === false;
		const unsupported = !('Notification' in window) || insecure;
		const denied = !unsupported && Notification.permission === 'denied';
		const granted = !unsupported && Notification.permission === 'granted';
		const on = readNotifyEnabled();

		btn.disabled = unsupported || denied;
		btn.textContent = unsupported
			? insecure
				? 'Alerts need HTTPS'
				: 'Alerts not supported in this browser'
			: denied
				? 'Notifications blocked'
				: on && granted
					? 'Turn off update alerts'
					: 'Enable update alerts';

		if (hint) {
			if (insecure) {
				hint.textContent =
					'Notifications only work on a secure origin (HTTPS or localhost).';
			} else if (!('Notification' in window)) {
				hint.textContent =
					'Your browser does not expose the Notification API (common in some embedded views).';
			} else if (denied) {
				hint.textContent =
					'Unblock notifications for this site in your browser settings if you want alerts when the feed changes.';
			} else if (granted && on) {
				hint.textContent =
					'When you have a page on this site open, we recheck the feed periodically and notify you if a new entry appears at the top. This is not a push service when the tab is closed.';
			} else {
				hint.textContent =
					'Optional: get a desktop notification when a new item is added to the feed (requires the site open in a tab).';
			}
		}
	}

	let pollTimer = null;

	function clearPoll() {
		if (pollTimer) {
			window.clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	function schedulePoll(run) {
		clearPoll();
		if (!readNotifyEnabled() || Notification.permission !== 'granted') return;
		pollTimer = window.setInterval(run, POLL_MS);
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
		maybeAlertForNewTop(entries);
	}

	function wireNotifyButton(btn, hint) {
		if (!btn) return;

		btn.addEventListener('click', async () => {
			if (!('Notification' in window)) return;

			const granted = Notification.permission === 'granted';
			const on = readNotifyEnabled();

			if (granted && on) {
				setNotifyEnabled(false);
				clearPoll();
				updateNotifyUi(btn, hint);
				return;
			}

			if (Notification.permission === 'denied') {
				updateNotifyUi(btn, hint);
				return;
			}

			let perm = Notification.permission;
			if (perm === 'default') {
				perm = await Notification.requestPermission();
			}

			updateNotifyUi(btn, hint);

			if (perm !== 'granted') return;

			setNotifyEnabled(true);

			try {
				const res = await fetch(feedUrl(), { cache: 'no-store' });
				if (!res.ok) throw new Error('feed');
				const data = await res.json();
				const entries = Array.isArray(data.entries) ? data.entries : [];
				if (entries[0] && entries[0].id) {
					writeLastKnown(entries[0].id);
				}
			} catch (_) {
				/* baseline skipped if fetch fails */
			}

			updateNotifyUi(btn, hint);
			schedulePoll(run);
			void run();
		});
	}

	function boot() {
		const btn = document.getElementById('site-feed-notify-btn');
		const hint = document.getElementById('site-feed-notify-hint');
		updateNotifyUi(btn, hint);
		wireNotifyButton(btn, hint);

		void run();

		if (
			readNotifyEnabled() &&
			'Notification' in window &&
			Notification.permission === 'granted'
		) {
			schedulePoll(run);
		}

		document.addEventListener('visibilitychange', () => {
			if (
				document.visibilityState === 'visible' &&
				readNotifyEnabled() &&
				Notification.permission === 'granted'
			) {
				void run();
			}
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot, { once: true });
	} else {
		boot();
	}
})();
