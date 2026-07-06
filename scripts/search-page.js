/**
 * Dedicated search results page (`search.html`): reads `?q=`, loads static index, lists all matches.
 * Depends on `window.owenminercsSiteSearchApi` from `components.js`.
 */
(function initSearchResultsPage() {
	function setSummary(summaryEl, queryRaw) {
		if (!summaryEl) return;
		const q = (queryRaw || '').trim();
		summaryEl.textContent = '';
		if (!q) {
			summaryEl.textContent = 'Enter a search term to search pages across OwenMinerCS.com.';
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
		const formEl = document.querySelector('.site-search-page-form');
		const inputEl = document.getElementById('site-search-page-input');
		if (!api || !resultsEl) return;

		const params = new URLSearchParams(window.location.search);
		const q = params.get('q') || '';
		if (inputEl) inputEl.value = q;
		if (formEl && inputEl) {
			formEl.addEventListener('submit', (event) => {
				event.preventDefault();
				const nextQuery = inputEl.value.trim();
				if (!nextQuery) {
					setSummary(summaryEl, '');
					resultsEl.textContent = '';
					inputEl.focus();
					return;
				}
				window.location.href = `${api.getSearchPageUrl()}?q=${encodeURIComponent(nextQuery)}`;
			});
		}

		setSummary(summaryEl, q);

		if (!q.trim()) {
			resultsEl.textContent = '';
			document.title = 'Search | Owen Miner';
			return;
		}

		document.title = `${q.trim()} — Search | Owen Miner`;

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
