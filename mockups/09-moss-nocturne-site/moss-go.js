(function () {
	'use strict';

	const GO_NAME = 'go.html';

	function getQueryPath() {
		let raw = new URLSearchParams(window.location.search).get('p') || 'index.html';
		try {
			raw = decodeURIComponent(raw);
		} catch (_) {}
		return normalizePath(raw);
	}

	function normalizePath(p) {
		let s = String(p || 'index.html').trim();
		if (!s) s = 'index.html';
		if (s.includes('..') || s.includes('\\')) return 'index.html';
		if (!/\.html?$/i.test(s)) s += '.html';
		return s.replace(/\\/g, '/');
	}

	function siteRootUrl() {
		return new URL('../../', window.location.href);
	}

	function pageFileUrl(pagePath) {
		return new URL('../../' + pagePath, window.location.href);
	}

	function stripScripts(root) {
		root.querySelectorAll('script').forEach(function (s) {
			s.remove();
		});
	}

	function rewriteUrls(root, pagePath) {
		const baseFile = pageFileUrl(pagePath);
		const pairs = [
			['img', 'src'],
			['source', 'src'],
			['video', 'poster'],
			['iframe', 'src'],
			['link', 'href'],
		];
		pairs.forEach(function (pair) {
			const sel = pair[0];
			const attr = pair[1];
			root.querySelectorAll(sel + '[' + attr + ']').forEach(function (node) {
				const v = node.getAttribute(attr);
				if (!v || /^(?:https?:|mailto:|tel:|data:)/i.test(v) || v.startsWith('#')) return;
				try {
					node.setAttribute(attr, new URL(v, baseFile).href);
				} catch (_) {}
			});
		});
		root.querySelectorAll('a[href]').forEach(function (a) {
			const v = a.getAttribute('href');
			if (!v || v.startsWith('#') || /^javascript:/i.test(v)) return;
			if (/^(?:https?:|mailto:|tel:)/i.test(v)) return;
			try {
				a.setAttribute('href', new URL(v, baseFile).href);
			} catch (_) {}
		});
	}

	function installNavCapture(outEl, pagePath) {
		const rootHref = siteRootUrl().href;
		outEl.addEventListener('click', function (e) {
			if (e.defaultPrevented || e.button !== 0) return;
			if (e.ctrlKey || e.metaKey || e.shiftKey) return;
			const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
			if (!(a instanceof HTMLAnchorElement) || !outEl.contains(a)) return;
			const href = a.getAttribute('href');
			if (!href || href.startsWith('#')) return;
			if (/^https?:/i.test(href)) return;
			if (/^mailto:/i.test(href) || /^tel:/i.test(href)) return;
			let resolved;
			try {
				resolved = new URL(href, pageFileUrl(pagePath));
			} catch (_) {
				return;
			}
			if (resolved.protocol === 'http:' || resolved.protocol === 'https:') return;
			if (!resolved.href.startsWith(rootHref)) return;
			var rel = decodeURIComponent(resolved.href.slice(rootHref.length)).replace(/^\/+/, '');
			rel = rel.split('?')[0].split('#')[0];
			if (!/\.html?$/i.test(rel)) return;
			e.preventDefault();
			window.location.assign(GO_NAME + '?p=' + encodeURIComponent(rel));
		});
	}

	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}

	function setProdLink(pagePath) {
		var el = document.getElementById('moss-prod-link');
		if (!el) return;
		try {
			el.setAttribute('href', pageFileUrl(pagePath).href);
		} catch (_) {
			el.setAttribute('href', '../../' + pagePath);
		}
	}

	async function load() {
		var p = getQueryPath();
		var out = document.getElementById('moss-out');
		var status = document.getElementById('moss-status');
		var crumb = document.getElementById('moss-crumb');
		if (!out) return;

		if (crumb) {
			crumb.innerHTML = '<code>' + escapeHtml(p) + '</code>';
		}
		if (status) {
			status.textContent = 'Loading…';
		}

		setProdLink(p);

		try {
			var fetchUrl = '../../' + p.split('/').map(encodeURIComponent).join('/');
			var res = await fetch(fetchUrl, { credentials: 'same-origin' });
			if (!res.ok) {
				throw new Error(String(res.status));
			}
			var html = await res.text();
			var doc = new DOMParser().parseFromString(html, 'text/html');
			var t = doc.querySelector('title');
			if (t && t.textContent) {
				document.title = t.textContent.trim() + ' · Moss preview';
			}
			var body = doc.body;
			if (!body) {
				throw new Error('No body');
			}
			stripScripts(body);
			out.replaceChildren();
			while (body.firstChild) {
				out.appendChild(body.firstChild);
			}
			rewriteUrls(out, p);
			installNavCapture(out, p);

			if (typeof window.owenminercsHydrateRoot === 'function') {
				window.owenminercsHydrateRoot(out);
			}

			if (p === 'index.html') {
				var existing = document.querySelector('script[data-moss-support-links]');
				if (!existing) {
					var s = document.createElement('script');
					s.src = '../../scripts/support-links.js';
					s.defer = true;
					s.dataset.mossSupportLinks = '1';
					document.body.appendChild(s);
				}
			}

			if (status) {
				status.textContent = '';
			}
		} catch (err) {
			out.innerHTML =
				'<p class="moss-error">Could not load <code>' +
				escapeHtml(p) +
				'</code>. Open the site through a local HTTP server (for example <code>npx serve</code> from the repo root) so this preview can fetch your pages — <code>file://</code> often blocks <code>fetch</code>.</p>';
			if (status) {
				status.textContent = 'Load failed';
			}
			console.error(err);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', load);
	} else {
		load();
	}
})();
