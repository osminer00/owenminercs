/**
 * Keyboard parts: primary overlay links + 2025 breakdown hover/pin popovers.
 * Hover a breakdown link → show that parts-list card beside the link.
 * Click the link → pin/unpin so the card stays without hover.
 */
(function () {
	const PAGE_SELECTOR = '.keyboard-60he-2025-page, .keyboard-hub-section.keyboard-60he-2025-page';
	const HIGHLIGHT_CLASS = 'pc-build-part--highlight';
	const HIGHLIGHT_MS = 3600;
	const HIDE_DELAY_MS = 180;
	const POPOVER_CLASS = 'kb-breakdown-part-popover';

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

	function partFromLink(link) {
		const href = link.getAttribute('href') || '';
		if (!href.startsWith('#')) return null;
		const el = document.getElementById(decodeURIComponent(href.slice(1)));
		return el?.classList.contains('pc-build-part') ? el : null;
	}

	function initBreakdownPartPopovers(page) {
		const breakdown = page.querySelector('#kilowatt-breakdown-heading')?.closest('section');
		if (!breakdown) return;

		const links = Array.from(breakdown.querySelectorAll('a.keyboard-breakdown-part-link[href^="#"]'));
		if (!links.length) return;

		const popover = document.createElement('div');
		popover.className = POPOVER_CLASS;
		popover.hidden = true;
		popover.setAttribute('role', 'dialog');
		popover.setAttribute('aria-label', 'Parts list item');
		document.body.appendChild(popover);

		let activeLink = null;
		let pinnedLink = null;
		let hideTimer = 0;
		let openRaf = 0;

		function clearHideTimer() {
			if (!hideTimer) return;
			window.clearTimeout(hideTimer);
			hideTimer = 0;
		}

		function positionPopover(link) {
			const rect = link.getBoundingClientRect();
			const pad = 10;
			const gap = 8;
			popover.style.visibility = 'hidden';
			popover.hidden = false;
			const popRect = popover.getBoundingClientRect();
			popover.style.visibility = '';

			let left = rect.right + gap;
			let top = rect.top + rect.height / 2 - popRect.height / 2;

			if (left + popRect.width > window.innerWidth - pad) {
				left = Math.max(pad, rect.left - popRect.width - gap);
			}
			if (top < pad) top = pad;
			if (top + popRect.height > window.innerHeight - pad) {
				top = Math.max(pad, window.innerHeight - popRect.height - pad);
			}

			popover.style.left = `${Math.round(left)}px`;
			popover.style.top = `${Math.round(top)}px`;
		}

		function fillPopover(partEl) {
			popover.replaceChildren();
			const clone = partEl.cloneNode(true);
			clone.removeAttribute('id');
			clone.classList.remove(HIGHLIGHT_CLASS);
			clone.classList.add(`${POPOVER_CLASS}__card`);
			popover.appendChild(clone);

			const primary = clone.querySelector('.pc-build-part__primary');
			if (primary) {
				primary.addEventListener('click', (event) => {
					event.stopPropagation();
				});
			}
		}

		function showForLink(link) {
			const partEl = partFromLink(link);
			if (!partEl) return;

			clearHideTimer();
			if (openRaf) cancelAnimationFrame(openRaf);

			activeLink = link;
			links.forEach((el) => el.classList.toggle('keyboard-breakdown-part-link--preview', el === link));
			fillPopover(partEl);
			popover.hidden = false;
			popover.dataset.partId = partEl.id || '';

			openRaf = requestAnimationFrame(() => {
				positionPopover(link);
				openRaf = 0;
			});
		}

		function hidePopover({ force = false } = {}) {
			if (!force && pinnedLink) return;
			clearHideTimer();
			activeLink = null;
			links.forEach((el) => el.classList.remove('keyboard-breakdown-part-link--preview'));
			popover.hidden = true;
			popover.replaceChildren();
			delete popover.dataset.partId;
		}

		function scheduleHide() {
			if (pinnedLink) return;
			clearHideTimer();
			hideTimer = window.setTimeout(() => {
				hideTimer = 0;
				hidePopover();
			}, HIDE_DELAY_MS);
		}

		function setPinned(link) {
			if (pinnedLink === link) {
				pinnedLink = null;
				link.classList.remove('keyboard-breakdown-part-link--pinned');
				links.forEach((el) => el.classList.remove('keyboard-breakdown-part-link--pinned'));
				hidePopover({ force: true });
				return;
			}

			links.forEach((el) => el.classList.toggle('keyboard-breakdown-part-link--pinned', el === link));
			pinnedLink = link;
			showForLink(link);
		}

		links.forEach((link) => {
			link.addEventListener('mouseenter', () => {
				if (pinnedLink && pinnedLink !== link) return;
				showForLink(link);
			});
			link.addEventListener('mouseleave', () => {
				if (pinnedLink) return;
				scheduleHide();
			});
			link.addEventListener('focus', () => {
				if (pinnedLink && pinnedLink !== link) return;
				showForLink(link);
			});
			link.addEventListener('blur', () => {
				if (pinnedLink) return;
				scheduleHide();
			});
		});

		popover.addEventListener('mouseenter', () => {
			clearHideTimer();
		});
		popover.addEventListener('mouseleave', () => {
			if (pinnedLink) return;
			scheduleHide();
		});

		breakdown.addEventListener('click', (event) => {
			const link = event.target.closest('a.keyboard-breakdown-part-link[href^="#"]');
			if (!link || !breakdown.contains(link)) return;

			const partEl = partFromLink(link);
			if (!partEl) return;

			event.preventDefault();
			history.pushState(null, '', link.getAttribute('href'));
			setPinned(link);
			highlightPart(partEl);
		});

		window.addEventListener(
			'scroll',
			() => {
				if (popover.hidden || !activeLink) return;
				positionPopover(activeLink);
			},
			{ passive: true },
		);
		window.addEventListener('resize', () => {
			if (popover.hidden || !activeLink) return;
			positionPopover(activeLink);
		});

		document.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			if (popover.hidden && !pinnedLink) return;
			if (pinnedLink) pinnedLink.classList.remove('keyboard-breakdown-part-link--pinned');
			pinnedLink = null;
			hidePopover({ force: true });
		});
	}

	function initBreakdownHighlight() {
		const page = document.querySelector(PAGE_SELECTOR);
		if (!page) return;

		initBreakdownPartPopovers(page);

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
