/**
 * Dedicated search results page (`search.html`): reads `?q=`, loads static index, lists all matches.
 * Depends on `window.owenminercsSiteSearchApi` from `components.js`.
 */
(function initSearchResultsPage() {
	let pageResultsEl = null;
	let pageNavWired = false;

	function wirePageResultsKeyboard(resultsEl, api) {
		if (!resultsEl || pageNavWired) return;
		pageNavWired = true;
		pageResultsEl = resultsEl;
		api.wireResultsNavigation(resultsEl);
		document.addEventListener('keydown', (e) => {
			if (!pageResultsEl) return;
			const t = e.target;
			if (
				t instanceof HTMLInputElement ||
				t instanceof HTMLTextAreaElement ||
				t instanceof HTMLSelectElement ||
				(t instanceof HTMLElement && t.isContentEditable)
			) {
				return;
			}
			window.owenminercsSiteSearchApi.handleResultsKeyDown(pageResultsEl, e);
		});
	}

	function setSummary(summaryEl, queryRaw) {
		if (!summaryEl) return;
		const q = (queryRaw || '').trim();
		summaryEl.textContent = '';
		if (!q) {
			summaryEl.textContent =
				'Enter a search using the Search link in the navigation bar or the search section on the home page.';
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
		const resultsEl = document.getElementById('site-search-page-results');
		const summaryEl = document.getElementById('site-search-page-summary');
		if (!api || !resultsEl) return;

		const params = new URLSearchParams(window.location.search);
		const q = params.get('q') || '';

		setSummary(summaryEl, q);

		if (!q.trim()) {
			resultsEl.textContent = '';
			document.title = 'Search | Owen Miner';
			return;
		}

		document.title = `${q.trim()}: Search | Owen Miner`;

		fetch(api.indexUrl)
			.then((r) => {
				if (!r.ok) throw new Error('search index');
				return r.json();
			})
			.then((data) => {
				const entries = data && Array.isArray(data.entries) ? data.entries : [];
				const list = api.filterEntries(entries, q, Infinity);
				api.renderResults(resultsEl, list, q, 'fullPage');
				wirePageResultsKeyboard(resultsEl, api);
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
