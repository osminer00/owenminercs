(function () {
	const STORAGE_PREFIX = 'affiliate-board-notes:';
	const ASSIGN_STORAGE = 'affiliate-board-page-assignments';
	const ASSIGN_PAGE_OPTIONS = [
		{ path: 'index.html', label: 'About (home)' },
		{ path: 'PC/pc.html', label: 'PC build' },
		{ path: 'Desk Setup/setup.html', label: "Bigfoot's Jungle" },
		{ path: 'Keyboard/60he.html', label: 'Wooting 60HE' },
		{ path: 'Counter-Strike/CS.html', label: 'CS2' },
		{ path: 'Counter-Strike/nosmoking.html', label: 'No Smoking wallpapers' },
		{ path: 'Posts/post-builder.html', label: 'Post builder' },
		{ path: 'Garage Sale/garage-sale.html', label: 'Shop' },
		{ path: 'Socials/socials.html', label: 'Socials' },
	];

	function $(sel, root) {
		return (root || document).querySelector(sel);
	}

	function getAssignments() {
		try {
			const raw = localStorage.getItem(ASSIGN_STORAGE);
			return raw ? JSON.parse(raw) : {};
		} catch (_) {
			return {};
		}
	}

	function saveAssignments(data) {
		localStorage.setItem(ASSIGN_STORAGE, JSON.stringify(data));
	}

	function addToPageAssignment(pagePath, entry) {
		const data = getAssignments();
		if (!data[pagePath]) data[pagePath] = [];
		const exists = data[pagePath].some(function (x) {
			return x.type === entry.type && x.id === entry.id;
		});
		if (exists) return false;
		data[pagePath].push({
			type: entry.type,
			id: entry.id,
			title: entry.title || entry.id,
			ts: Date.now(),
		});
		saveAssignments(data);
		return true;
	}

	let notifyAssignQueueUpdate = function () {};

	function renderAssignRow(kind, id, title) {
		const wrap = document.createElement('div');
		wrap.className = 'card-assign-row';
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'btn-assign';
		btn.textContent = 'Add to selected page';
		btn.addEventListener('click', function () {
			const sel = $('#assign-page-target');
			if (!sel || !sel.value) {
				window.alert('Choose a target page in the toolbar above.');
				return;
			}
			const ok = addToPageAssignment(sel.value, { type: kind, id: id, title: title || id });
			var prev = btn.textContent;
			btn.textContent = ok ? 'Queued for page' : 'Already on list';
			btn.disabled = true;
			window.setTimeout(function () {
				btn.textContent = prev;
				btn.disabled = false;
			}, 1800);
			notifyAssignQueueUpdate();
		});
		wrap.appendChild(btn);
		return wrap;
	}

	function attachScrub(el, onProgress) {
		let active = false;
		const setFromClientX = (clientX) => {
			const r = el.getBoundingClientRect();
			if (r.width <= 0) return;
			let p = (clientX - r.left) / r.width;
			p = Math.min(1, Math.max(0, p));
			onProgress(p);
		};
		el.addEventListener('pointerdown', (e) => {
			active = true;
			try {
				el.setPointerCapture(e.pointerId);
			} catch (_) {}
			setFromClientX(e.clientX);
		});
		el.addEventListener('pointermove', (e) => {
			if (!active) return;
			setFromClientX(e.clientX);
		});
		const end = () => {
			active = false;
		};
		el.addEventListener('pointerup', end);
		el.addEventListener('pointercancel', end);
	}

	function renderMedia(item) {
		const wrap = document.createElement('div');
		wrap.className = 'card-media';
		const m = item.media || { type: 'none' };

		if (m.type === 'none' || !m.type) {
			wrap.classList.add('placeholder');
			wrap.innerHTML =
				'<span>Add <code>media</code> in <code>items.json</code>: ' +
				'<code>image</code>, <code>gallery</code>, <code>youtube</code>, ' +
				'<code>video</code>, <code>scrubVideo</code>, or <code>scrubGallery</code>.</span>';
			return wrap;
		}

		if (m.type === 'image' && m.src) {
			const img = document.createElement('img');
			img.src = m.src;
			img.alt = item.title || '';
			wrap.appendChild(img);
			return wrap;
		}

		if (m.type === 'youtube' && m.videoId) {
			const iframe = document.createElement('iframe');
			iframe.src =
				'https://www.youtube-nocookie.com/embed/' +
				encodeURIComponent(m.videoId) +
				'?rel=0';
			iframe.title = item.title || 'YouTube';
			iframe.loading = 'lazy';
			iframe.allowFullscreen = true;
			iframe.allow =
				'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
			wrap.appendChild(iframe);
			return wrap;
		}

		if (m.type === 'video' && m.src) {
			const v = document.createElement('video');
			v.src = m.src;
			v.controls = true;
			v.playsInline = true;
			wrap.appendChild(v);
			return wrap;
		}

		if (m.type === 'scrubVideo' && m.src) {
			wrap.classList.add('scrub-area');
			const v = document.createElement('video');
			v.src = m.src;
			v.muted = true;
			v.playsInline = true;
			v.preload = 'metadata';
			wrap.appendChild(v);
			const hint = document.createElement('div');
			hint.className = 'scrub-hint';
			hint.textContent = 'Drag horizontally to scrub';
			wrap.appendChild(hint);
			attachScrub(wrap, (p) => {
				if (!v.duration || !isFinite(v.duration)) return;
				v.currentTime = p * v.duration;
			});
			return wrap;
		}

		if (m.type === 'gallery' && Array.isArray(m.images) && m.images.length) {
			const img = document.createElement('img');
			img.alt = item.title || '';
			let idx = 0;
			const show = (i) => {
				idx = ((i % m.images.length) + m.images.length) % m.images.length;
				img.src = m.images[idx];
			};
			show(0);
			wrap.appendChild(img);

			if (m.images.length > 1) {
				const dots = document.createElement('div');
				dots.className = 'gallery-dots';
				m.images.forEach((_, i) => {
					const d = document.createElement('span');
					if (i === 0) d.classList.add('on');
					dots.appendChild(d);
				});
				wrap.appendChild(dots);
				const refreshDots = () => {
					dots.querySelectorAll('span').forEach((d, i) => {
						d.classList.toggle('on', i === idx);
					});
				};
				if (m.scrub !== false) {
					wrap.classList.add('scrub-area');
					const hint = document.createElement('div');
					hint.className = 'scrub-hint';
					hint.textContent = 'Drag horizontally to change photo';
					wrap.appendChild(hint);
					attachScrub(wrap, (p) => {
						const next = Math.round(p * (m.images.length - 1));
						show(next);
						refreshDots();
					});
				}
			}
			return wrap;
		}

		if (m.type === 'scrubGallery' && Array.isArray(m.images) && m.images.length) {
			wrap.classList.add('scrub-area');
			const img = document.createElement('img');
			img.alt = item.title || '';
			wrap.appendChild(img);
			const hint = document.createElement('div');
			hint.className = 'scrub-hint';
			hint.textContent = 'Drag horizontally to spin / step frames';
			wrap.appendChild(hint);
			attachScrub(wrap, (p) => {
				const i = Math.round(p * (m.images.length - 1));
				img.src = m.images[i];
			});
			img.src = m.images[0];
			return wrap;
		}

		wrap.classList.add('placeholder');
		wrap.textContent = 'Unknown media.type: ' + (m.type || '?');
		return wrap;
	}

	function linkLabel(key) {
		const map = {
			amazon: 'Amazon (tag)',
			amazonSearch: 'Amazon search',
			aliexpress: 'AliExpress',
			bestbuy: 'Best Buy',
			bestbuySearch: 'Best Buy search',
			newegg: 'Newegg',
			govee: 'Govee',
		};
		return map[key] || key;
	}

	function renderAffiliateLinks(hints) {
		const row = document.createElement('div');
		row.className = 'link-row';
		if (!hints || typeof hints !== 'object') return row;
		for (const [k, v] of Object.entries(hints)) {
			if (k === 'note' || v == null || v === '') continue;
			if (typeof v !== 'string' || !v.startsWith('http')) continue;
			const a = document.createElement('a');
			a.className = 'btn-link';
			a.href = v;
			a.target = '_blank';
			a.rel = 'noopener noreferrer';
			a.textContent = linkLabel(k);
			row.appendChild(a);
		}
		if (hints.note) {
			const p = document.createElement('p');
			p.className = 'hint-note';
			p.textContent = hints.note;
			row.appendChild(p);
		}
		return row;
	}

	function renderCard(item, allById) {
		const card = document.createElement('article');
		card.className = 'card';
		card.dataset.id = item.id;

		card.appendChild(renderMedia(item));

		const body = document.createElement('div');
		body.className = 'card-body';

		const cat = document.createElement('div');
		cat.className = 'card-cat';
		cat.textContent = item.category || 'misc';
		body.appendChild(cat);

		const h = document.createElement('h2');
		h.className = 'card-title';
		h.textContent = item.title || item.id;
		body.appendChild(h);

		if (item.brand) {
			const b = document.createElement('p');
			b.className = 'card-brand';
			b.textContent = item.brand;
			body.appendChild(b);
		}

		if (item.specs && item.specs.length) {
			const ul = document.createElement('ul');
			ul.className = 'card-specs';
			item.specs.forEach((s) => {
				const li = document.createElement('li');
				li.textContent = s;
				ul.appendChild(li);
			});
			body.appendChild(ul);
		}

		body.appendChild(renderAffiliateLinks(item.affiliateHints));

		if (item.sourceUrls && item.sourceUrls.length) {
			const su = document.createElement('div');
			su.className = 'source-urls';
			su.innerHTML =
				'<strong>Source</strong> · ' +
				item.sourceUrls
					.map(
						(u) =>
							'<a href="' +
							u.replace(/"/g, '&quot;') +
							'" target="_blank" rel="noopener">' +
							u +
							'</a>'
					)
					.join('<br>');
			body.appendChild(su);
		}

		if (item.relatedIds && item.relatedIds.length) {
			const rel = document.createElement('div');
			rel.className = 'related';
			rel.textContent =
				'Goes with: ' +
				item.relatedIds
					.map((rid) => {
						const o = allById[rid];
						return o ? o.title || rid : rid;
					})
					.join(' · ');
			body.appendChild(rel);
		}

		const nl = document.createElement('label');
		nl.className = 'notes-label';
		nl.textContent = 'Your notes / review draft';
		body.appendChild(nl);

		const ta = document.createElement('textarea');
		ta.className = 'notes-area';
		ta.placeholder = item.notesPlaceholder || 'Thoughts, pros/cons, where you use it…';
		ta.value = localStorage.getItem(STORAGE_PREFIX + item.id) || '';
		ta.addEventListener('input', () => {
			localStorage.setItem(STORAGE_PREFIX + item.id, ta.value);
		});
		body.appendChild(ta);

		body.appendChild(renderAssignRow('item', item.id, item.title || item.id));

		card.appendChild(body);
		return card;
	}

	function filterItems(items, q, cat) {
		const ql = (q || '').trim().toLowerCase();
		return items.filter((it) => {
			if (cat && it.category !== cat) return false;
			if (!ql) return true;
			const blob = [it.title, it.brand, it.id, ...(it.specs || [])]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return blob.includes(ql);
		});
	}

	const SUGGEST_DONE_PREFIX = 'affiliate-board-suggest-done:';
	const SITE_ORIGIN = 'https://www.owenminercs.com';

	function sitePageHref(sourcePage) {
		if (!sourcePage || sourcePage === 'affiliate-links.json') return null;
		const path = sourcePage.replace(/^\/+/, '');
		return SITE_ORIGIN + '/' + path.split('/').map(encodeURIComponent).join('/');
	}

	function amazonSearchUrl(query, tag) {
		return (
			'https://www.amazon.com/s?k=' +
			encodeURIComponent(query) +
			'&tag=' +
			encodeURIComponent(tag || 'owenminercs-20')
		);
	}

	function filterSuggestions(rows, q, src, cat, hideDone) {
		const ql = (q || '').trim().toLowerCase();
		return rows.filter((s) => {
			if (hideDone && localStorage.getItem(SUGGEST_DONE_PREFIX + s.id) === '1') return false;
			if (src && s.sourcePage !== src) return false;
			if (cat && s.category !== cat) return false;
			if (!ql) return true;
			const blob = [s.title, s.why, s.id, s.category, s.sourcePage, ...(s.tips || [])]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return blob.includes(ql);
		});
	}

	function renderSuggestionCard(s, amazonTag, onDoneChange) {
		const card = document.createElement('article');
		card.className = 'card suggestion-card';

		const media = document.createElement('div');
		media.className = 'card-media placeholder';
		media.innerHTML =
			'<span>Suggestion — add to <code>items.json</code> or <code>generate-items.mjs</code> when ready.</span>';
		card.appendChild(media);

		const body = document.createElement('div');
		body.className = 'card-body';

		const cat = document.createElement('div');
		cat.className = 'card-cat';
		cat.textContent = (s.category || 'suggestion') + ' · from site';
		body.appendChild(cat);

		const h = document.createElement('h2');
		h.className = 'card-title';
		h.textContent = s.title || s.id;
		body.appendChild(h);

		const why = document.createElement('p');
		why.className = 'card-brand';
		why.style.marginTop = '0.25rem';
		why.textContent = s.why || '';
		body.appendChild(why);

		if (s.tips && s.tips.length) {
			const ul = document.createElement('ul');
			ul.className = 'card-specs';
			s.tips.forEach((t) => {
				const li = document.createElement('li');
				li.textContent = t;
				ul.appendChild(li);
			});
			body.appendChild(ul);
		}

		const row = document.createElement('div');
		row.className = 'link-row';
		const amz = document.createElement('a');
		amz.className = 'btn-link';
		amz.href = amazonSearchUrl(s.title, amazonTag);
		amz.target = '_blank';
		amz.rel = 'noopener noreferrer';
		amz.textContent = 'Amazon search';
		row.appendChild(amz);
		body.appendChild(row);

		const href = sitePageHref(s.sourcePage);
		if (href) {
			const sp = document.createElement('div');
			sp.className = 'source-page-link';
			sp.innerHTML =
				'<strong>Seen on</strong> · <a href="' +
				href.replace(/"/g, '&quot;') +
				'" target="_blank" rel="noopener">' +
				s.sourcePage +
				'</a>';
			body.appendChild(sp);
		} else if (s.sourcePage) {
			const sp = document.createElement('div');
			sp.className = 'source-page-link';
			sp.innerHTML = '<strong>Source</strong> · <code>' + s.sourcePage + '</code>';
			body.appendChild(sp);
		}

		body.appendChild(renderAssignRow('suggestion', s.id, s.title || s.id));

		const doneLabel = document.createElement('label');
		doneLabel.className = 'suggestion-done';
		const cb = document.createElement('input');
		cb.type = 'checkbox';
		cb.checked = localStorage.getItem(SUGGEST_DONE_PREFIX + s.id) === '1';
		cb.addEventListener('change', () => {
			if (cb.checked) localStorage.setItem(SUGGEST_DONE_PREFIX + s.id, '1');
			else localStorage.removeItem(SUGGEST_DONE_PREFIX + s.id);
			if (onDoneChange) onDoneChange();
		});
		doneLabel.appendChild(cb);
		doneLabel.appendChild(document.createTextNode(' Added to board / skipped'));
		body.appendChild(doneLabel);

		card.appendChild(body);
		return card;
	}

	function setupTabs() {
		const tabCat = $('#tab-catalog');
		const tabSug = $('#tab-suggestions');
		const panelCat = $('#panel-catalog');
		const panelSug = $('#panel-suggestions');
		if (!tabCat || !tabSug || !panelCat || !panelSug) return;

		const showCatalog = (on) => {
			tabCat.setAttribute('aria-selected', on ? 'true' : 'false');
			tabSug.setAttribute('aria-selected', on ? 'false' : 'true');
			panelCat.classList.toggle('panel-hidden', !on);
			panelSug.classList.toggle('panel-hidden', on);
		};

		tabCat.addEventListener('click', () => showCatalog(true));
		tabSug.addEventListener('click', () => showCatalog(false));
	}

	async function main() {
		const board = $('#board');
		const search = $('#filter-search');
		const catSel = $('#filter-category');
		const stat = $('#board-stats');
		const disclosure = $('#disclosure-text');

		setupTabs();

		const assignSel = $('#assign-page-target');
		if (assignSel) {
			ASSIGN_PAGE_OPTIONS.forEach(function (p) {
				const opt = document.createElement('option');
				opt.value = p.path;
				opt.textContent = p.label;
				assignSel.appendChild(opt);
			});
		}

		function refreshQueuePre() {
			const pre = $('#assign-queue-pre');
			if (!pre) return;
			try {
				const o = getAssignments();
				pre.textContent = JSON.stringify(o, null, 2);
			} catch (_) {
				pre.textContent = '{}';
			}
		}
		notifyAssignQueueUpdate = refreshQueuePre;
		refreshQueuePre();

		const copyBtn = $('#assign-copy-json');
		if (copyBtn) {
			copyBtn.addEventListener('click', function () {
				const t = localStorage.getItem(ASSIGN_STORAGE) || '{}';
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(t).then(
						function () {
							copyBtn.textContent = 'Copied';
							window.setTimeout(function () {
								copyBtn.textContent = 'Copy queue JSON';
							}, 1500);
						},
						function () {
							window.alert(
								'Clipboard copy failed and manual text input is currently disabled.'
							);
						}
					);
				} else {
					window.alert(
						'Clipboard API unavailable and manual text input is currently disabled.'
					);
				}
			});
		}

		const queueDetails = $('#assign-queue-wrap');
		if (queueDetails) {
			queueDetails.addEventListener('toggle', function () {
				if (queueDetails.open) refreshQueuePre();
			});
		}

		const [itemsRes, suggestRes] = await Promise.all([
			fetch('items.json', { cache: 'no-store' }),
			fetch('suggestions.json', { cache: 'no-store' }),
		]);

		let data = { items: [], config: {} };
		try {
			if (itemsRes.ok) data = await itemsRes.json();
			else throw new Error(String(itemsRes.status));
		} catch (e) {
			board.innerHTML =
				'<p class="placeholder">Could not load items.json. Serve this folder over HTTP (e.g. <code>npx serve dev</code>) or open via a local server.</p>';
		}

		if (disclosure && data.config && data.config.disclosure) {
			disclosure.textContent = data.config.disclosure;
		}

		const items = data.items || [];
		const allById = Object.fromEntries(items.map((it) => [it.id, it]));

		const cats = [...new Set(items.map((i) => i.category).filter(Boolean))].sort();
		cats.forEach((c) => {
			const opt = document.createElement('option');
			opt.value = c;
			opt.textContent = c;
			catSel.appendChild(opt);
		});

		function redraw() {
			const q = search.value;
			const cat = catSel.value;
			const list = filterItems(items, q, cat);
			board.innerHTML = '';
			list.forEach((it) => board.appendChild(renderCard(it, allById)));
			stat.textContent = list.length + ' of ' + items.length + ' cards';
		}

		search.addEventListener('input', redraw);
		catSel.addEventListener('change', redraw);
		redraw();

		const introEl = $('#suggestions-intro');
		const sugBoard = $('#suggestions-board');
		const sugSearch = $('#suggest-search');
		const sugSource = $('#suggest-source');
		const sugCat = $('#suggest-category');
		const sugStat = $('#suggest-stats');
		const sugHide = $('#suggest-hide-done');

		let suggestData = { suggestions: [], amazonTag: 'owenminercs-20', intro: '' };
		try {
			if (suggestRes.ok) suggestData = await suggestRes.json();
		} catch (_) {}

		if (introEl) introEl.textContent = suggestData.intro || '';

		const rows = suggestData.suggestions || [];
		const tag = suggestData.amazonTag || data.config?.amazonAssociatesTag || 'owenminercs-20';

		if (sugSource && sugCat && sugBoard && sugStat) {
			const sources = [...new Set(rows.map((r) => r.sourcePage).filter(Boolean))].sort();
			sources.forEach((p) => {
				const opt = document.createElement('option');
				opt.value = p;
				opt.textContent = p;
				sugSource.appendChild(opt);
			});

			const sugCats = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
			sugCats.forEach((c) => {
				const opt = document.createElement('option');
				opt.value = c;
				opt.textContent = c;
				sugCat.appendChild(opt);
			});

			function redrawSuggestions() {
				const list = filterSuggestions(
					rows,
					sugSearch.value,
					sugSource.value,
					sugCat.value,
					sugHide && sugHide.checked
				);
				sugBoard.innerHTML = '';
				list.forEach((s) =>
					sugBoard.appendChild(renderSuggestionCard(s, tag, redrawSuggestions))
				);
				const hidden =
					sugHide && sugHide.checked
						? rows.filter(
								(r) => localStorage.getItem(SUGGEST_DONE_PREFIX + r.id) === '1'
							).length
						: 0;
				sugStat.textContent =
					list.length +
					' suggestions' +
					(hidden ? ' (' + hidden + ' hidden)' : '') +
					' · ' +
					rows.length +
					' total';
			}

			if (sugSearch) sugSearch.addEventListener('input', redrawSuggestions);
			if (sugSource) sugSource.addEventListener('change', redrawSuggestions);
			if (sugCat) sugCat.addEventListener('change', redrawSuggestions);
			if (sugHide) sugHide.addEventListener('change', redrawSuggestions);
			redrawSuggestions();
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', main);
	} else {
		main();
	}
})();
