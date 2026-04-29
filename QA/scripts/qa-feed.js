(function () {
	function getSiteRoot() {
		const el = document.querySelector('script[src*="components.js"]');
		if (!el || !el.src) return '/';
		return el.src.replace(/scripts\/components\.js.*$/, '');
	}

	function isLocalHost() {
		return (
			window.location.hostname === '127.0.0.1' ||
			window.location.hostname === 'localhost' ||
			window.location.protocol === 'file:'
		);
	}

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function formatDate(iso) {
		if (!iso) return '';
		try {
			const d = new Date(iso);
			if (Number.isNaN(d.getTime())) return '';
			return d.toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			});
		} catch (_) {
			return '';
		}
	}

	async function fetchJson(url) {
		const response = await fetch(url, {
			headers: { Accept: 'application/json' },
			cache: 'no-store',
		});
		if (!response.ok) return null;
		return response.json().catch(() => null);
	}

	async function loadFeedPayload(siteRoot) {
		const out = { items: [], sources: [] };
		const apiUrl = `${siteRoot}api/discord-qa`;
		const staticUrl = `${siteRoot}QA/answered-qa.json`;

		if (!isLocalHost()) {
			const live = await fetchJson(apiUrl);
			if (live && Array.isArray(live.items) && live.items.length) {
				out.items.push(...live.items);
				out.sources.push(live.source || 'discord');
			}
		}

		const fallback = await fetchJson(staticUrl);
		if (fallback && Array.isArray(fallback.items)) {
			const seen = new Set(out.items.map((x) => String(x.id || x.question)));
			for (const row of fallback.items) {
				const key = String(row.id || row.question || '');
				if (key && seen.has(key)) continue;
				if (key) seen.add(key);
				out.items.push(row);
			}
			if (fallback.items.length) out.sources.push(fallback.source || 'static');
		}

		return out;
	}

	function render(container, payload) {
		const { items } = payload;
		if (!items.length) {
			container.innerHTML =
				'<p class="qa-feed-empty">No mirrored answers yet. Posts in <strong>#questions-and-answers</strong> can appear here when the bot env is set (see <code>functions/api/discord-qa.js</code>), or add entries to <code>QA/answered-qa.json</code>.</p>';
			return;
		}

		const blocks = items.map((row, i) => {
			const q = escapeHtml(row.question || 'Question');
			const a = escapeHtml(row.answer || '').replace(/\n/g, '<br>');
			const when = formatDate(row.answeredAt);
			const link =
				row.url && /^https:\/\//i.test(row.url)
					? `<p class="qa-feed__meta"><a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">Open in Discord</a>${when ? ` · ${escapeHtml(when)}` : ''}</p>`
					: when
						? `<p class="qa-feed__meta">${escapeHtml(when)}</p>`
						: '';

			return `<article class="qa-feed__item" aria-label="Answered question ${i + 1}"><h3 class="qa-feed__q">${q}</h3><div class="qa-feed__a">${a}</div>${link}</article>`;
		});

		container.innerHTML = blocks.join('');
	}

	document.addEventListener('DOMContentLoaded', async () => {
		const container = document.getElementById('discord-qa-feed');
		if (!container) return;

		const siteRoot = getSiteRoot();
		try {
			const payload = await loadFeedPayload(siteRoot);
			render(container, payload);
		} catch (_) {
			container.innerHTML =
				'<p class="qa-feed-empty">Could not load the Q&amp;A feed. Try again later or browse answered threads in Discord.</p>';
		}
	});
})();
