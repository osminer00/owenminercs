(function () {
	const PAGE_SELECTOR = '.keyboard-60he-2025-page';
	const HIGHLIGHT_CLASS = 'pc-build-part--highlight';
	const HIGHLIGHT_MS = 3600;

	function initPcBuildPartPrimaryLinks() {
		document.querySelectorAll('.keyboard-build-parts-column .pc-build-part').forEach((part) => {
			if (part.querySelector(':scope > .pc-build-part__primary')) return;

			const primaryAnchor = part.querySelector('.pc-part-name-link[href]');
			if (!primaryAnchor) return;

			const href = primaryAnchor.getAttribute('href');
			if (!href) return;

			const link = document.createElement('a');
			link.className = 'pc-build-part__primary';
			link.href = href;
			if (primaryAnchor.target) link.target = primaryAnchor.target;
			if (primaryAnchor.rel) link.rel = primaryAnchor.rel;

			const label = primaryAnchor.querySelector('.item-desc')?.textContent?.trim();
			if (label) link.setAttribute('aria-label', label);

			part.insertBefore(link, part.firstChild);
		});
	}

	function highlightPart(partEl) {
		if (!partEl) return;

		document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
			el.classList.remove(HIGHLIGHT_CLASS);
		});

		partEl.classList.add(HIGHLIGHT_CLASS);
		window.setTimeout(() => {
			partEl.classList.remove(HIGHLIGHT_CLASS);
		}, HIGHLIGHT_MS);
	}

	function scrollToPart(partEl) {
		partEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function partFromHash(hash) {
		if (!hash || hash.charAt(0) !== '#') return null;

		const id = decodeURIComponent(hash.slice(1));
		const el = document.getElementById(id);
		return el?.classList.contains('pc-build-part') ? el : null;
	}

	function initBreakdownHighlight() {
		const page = document.querySelector(PAGE_SELECTOR);
		if (!page) return;

		const breakdown = page.querySelector('#kilowatt-breakdown-heading')?.closest('section');
		if (!breakdown) return;

		breakdown.addEventListener('click', (event) => {
			const link = event.target.closest('a.keyboard-breakdown-part-link[href^="#part-"]');
			if (!link) return;

			const targetId = link.getAttribute('href').slice(1);
			const partEl = document.getElementById(targetId);
			if (!partEl) return;

			event.preventDefault();
			history.pushState(null, '', `#${targetId}`);
			scrollToPart(partEl);
			highlightPart(partEl);
		});

		const initial = partFromHash(window.location.hash);
		if (initial) {
			window.setTimeout(() => {
				scrollToPart(initial);
				highlightPart(initial);
			}, 100);
		}
	}

	function init() {
		initPcBuildPartPrimaryLinks();
		initBreakdownHighlight();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
