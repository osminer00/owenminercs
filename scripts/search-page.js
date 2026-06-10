/**
 * Dedicated search results page (`search.html`): reads `?q=`, loads the static index,
 * and lists all matches through the shared DOM-safe renderer in `components.js`.
 */
(function initSearchResultsPage() {
	function setSummary(summaryEl, queryRaw) {
		if (!summaryEl) return;
		const q = (queryRaw || '').trim();
		summaryEl.textContent = '';
		if (!q) {
			summaryEl.textContent =
				'Enter a search term to search page copy, titles, image captions, and paths.';
			return;
		}
		summaryEl.appendChild(document.createTextNode('Results for '));
		const span = document.createElement('span');
		span.className = 'site-search-page-query';
		span.textContent = q;
		summaryEl.appendChild(span);
		summaryEl.appendChild(document.createTextNode('.'));
	}

	function run() {
		const api = window.owenminercsSiteSearchApi;
		const form = document.querySelector('.site-search-page-form');
		const input = document.getElementById('site-search-page-input');
		const resultsEl = document.getElementById('site-search-page-results');
		const summaryEl = document.getElementById('site-search-page-summary');
		if (!api || !resultsEl) return;

		const params = new URLSearchParams(window.location.search);
		const q = params.get('q') || '';
		if (form instanceof HTMLFormElement && typeof api.getSearchPageUrl === 'function') {
			form.action = api.getSearchPageUrl();
		}
		if (input instanceof HTMLInputElement) {
			input.value = q;
		}

		setSummary(summaryEl, q);

		if (!q.trim()) {
			api.renderResults(resultsEl, [], q, 'fullPage');
			document.title = 'Search | Owen Miner';
			return;
		}

		document.title = `${q.trim()} - Search | Owen Miner`;

		fetch(api.indexUrl)
			.then((r) => {
				if (!r.ok) throw new Error('search index');
				return r.json();
			})
			.then((data) => {
				const entries = data && Array.isArray(data.entries) ? data.entries : [];
				const list = api.filterEntries(entries, q, Infinity);
				api.renderResults(resultsEl, list, q, 'fullPage');
			})
			.catch(() => {
				resultsEl.textContent = '';
				const p = document.createElement('p');
				p.className = 'site-search-results__empty';
				p.textContent = 'Could not load search index.';
				resultsEl.appendChild(p);
			});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run, { once: true });
	} else {
		run();
	}
})();
