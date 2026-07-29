/**
 * Keyboards hub: cards open collapsed build sections at the bottom of the page.
 * Multi-open; scrolling near the end of an open section expands the next.
 */
(function () {
	const ROOT_SEL = '[data-keyboard-hub-root]';
	const SECTION_SEL = '[data-keyboard-hub-section]';
	const CARD_SEL = '[data-keyboard-hub-target]';

	function sectionsInOrder(root) {
		return [...root.querySelectorAll(SECTION_SEL)];
	}

	function isExpanded(section) {
		return section.getAttribute('data-keyboard-hub-collapsed') === 'false';
	}

	function setExpanded(section, open) {
		const body = section.querySelector('[data-keyboard-hub-body]');
		const toggle = section.querySelector('[data-keyboard-hub-toggle]');
		if (!body || !toggle) return;

		section.setAttribute('data-keyboard-hub-collapsed', open ? 'false' : 'true');
		body.hidden = !open;
		toggle.setAttribute('aria-expanded', open ? 'true' : 'false');

		const id = section.id;
		document.querySelectorAll(`${CARD_SEL}[data-keyboard-hub-target="${id}"]`).forEach((card) => {
			card.classList.toggle('keep-card--hub-active', open);
			card.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
	}

	function expandSection(section, { scroll = false, updateHash = false } = {}) {
		if (!section) return;
		setExpanded(section, true);
		if (updateHash && section.id) {
			history.replaceState(null, '', `#${section.id}`);
		}
		if (scroll) {
			section.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function collapseSection(section) {
		if (!section) return;
		setExpanded(section, false);
	}

	function toggleSection(section, opts) {
		if (isExpanded(section)) collapseSection(section);
		else expandSection(section, opts);
	}

	function sectionFromHash(hash) {
		if (!hash || hash.charAt(0) !== '#') return null;
		const id = decodeURIComponent(hash.slice(1));
		const el = document.getElementById(id);
		if (el?.hasAttribute('data-keyboard-hub-section')) return el;
		// Part / inner ids: expand parent hub section
		const parent = el?.closest?.(SECTION_SEL);
		return parent || null;
	}

	function bindCards(root) {
		document.querySelectorAll(CARD_SEL).forEach((card) => {
			const targetId = card.getAttribute('data-keyboard-hub-target');
			if (!targetId) return;

			card.setAttribute('aria-controls', `${targetId}-body`);
			card.setAttribute('aria-expanded', 'false');
			if (!card.hasAttribute('tabindex')) card.tabIndex = 0;

			const activate = (event) => {
				if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
				if (event.target.closest('a[href], button, input, textarea, select')) return;
				event.preventDefault();
				const section = root.querySelector(`#${CSS.escape(targetId)}`);
				if (!section) return;
				expandSection(section, { scroll: true, updateHash: true });
			};

			card.addEventListener('click', activate);
			card.addEventListener('keydown', activate);
		});
	}

	function bindToggles(root) {
		root.querySelectorAll('[data-keyboard-hub-toggle]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const section = btn.closest(SECTION_SEL);
				if (!section) return;
				const opening = !isExpanded(section);
				toggleSection(section, { scroll: false, updateHash: opening });
				if (opening) history.replaceState(null, '', `#${section.id}`);
			});
		});
	}

	function bindScrollPreload(root) {
		const list = sectionsInOrder(root);
		if (!('IntersectionObserver' in window) || list.length < 2) return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const section = entry.target.closest(SECTION_SEL);
					if (!section || !isExpanded(section)) continue;
					const idx = list.indexOf(section);
					if (idx < 0 || idx >= list.length - 1) continue;
					const next = list[idx + 1];
					if (!isExpanded(next)) expandSection(next, { scroll: false, updateHash: false });
				}
			},
			{ root: null, rootMargin: '0px 0px -12% 0px', threshold: 0 },
		);

		list.forEach((section) => {
			const sentinel = section.querySelector('[data-keyboard-hub-sentinel]');
			if (sentinel) observer.observe(sentinel);
		});
	}

	function applyHash() {
		const section = sectionFromHash(window.location.hash);
		if (!section) return;
		expandSection(section, { scroll: true, updateHash: false });
		const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
		if (el && el !== section) {
			window.setTimeout(() => {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}, 80);
		}
	}

	function init() {
		const root = document.querySelector(ROOT_SEL);
		if (!root) return;

		sectionsInOrder(root).forEach((section) => setExpanded(section, false));
		bindCards(root);
		bindToggles(root);
		bindScrollPreload(root);
		applyHash();
		window.addEventListener('hashchange', applyHash);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
