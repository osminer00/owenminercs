(function () {
	'use strict';

	if (window.__owenSiteFeedQueueInit) return;

	const DEFAULT_VISIBLE = 5;
	const SCROLL_TOLERANCE = 2;
	const DRAG_THRESHOLD_PX = 6;

	function hideFeedPreview() {
		const tip = document.getElementById('site-feed-preview');
		if (!tip) return;
		tip.hidden = true;
		tip.classList.remove('is-visible');
		tip.innerHTML = '';
	}

	/** Mouse drag on the feed viewport; touch keeps native vertical scroll. */
	function bindSiteFeedQueueDrag(root, viewport) {
		if (!root || !viewport || viewport.dataset.siteFeedQueueDragBound === '1') return;
		viewport.dataset.siteFeedQueueDragBound = '1';

		let pointerActive = false;
		let dragging = false;
		let didDrag = false;
		let dragStartY = 0;
		let dragOriginScroll = 0;
		let activePointerId = null;

		function clearPointerListeners() {
			document.removeEventListener('pointermove', onPointerMove);
			document.removeEventListener('pointerup', onPointerEnd);
			document.removeEventListener('pointercancel', onPointerEnd);
		}

		function onPointerMove(event) {
			if (!pointerActive || event.pointerId !== activePointerId) return;
			const dy = event.clientY - dragStartY;
			if (!dragging && Math.abs(dy) > DRAG_THRESHOLD_PX) {
				dragging = true;
				didDrag = true;
				hideFeedPreview();
				root.classList.add('site-feed-queue--dragging');
				viewport.setPointerCapture(event.pointerId);
			}
			if (!dragging) return;
			event.preventDefault();
			viewport.scrollTop = dragOriginScroll - dy;
		}

		function onPointerEnd(event) {
			if (!pointerActive || event.pointerId !== activePointerId) return;
			clearPointerListeners();
			if (viewport.hasPointerCapture(event.pointerId)) {
				viewport.releasePointerCapture(event.pointerId);
			}
			const wasDragging = dragging;
			pointerActive = false;
			dragging = false;
			activePointerId = null;
			root.classList.remove('site-feed-queue--dragging');
			if (!wasDragging) didDrag = false;
		}

		viewport.addEventListener('dragstart', (event) => event.preventDefault(), true);

		viewport.addEventListener('pointerdown', (event) => {
			if (event.pointerType !== 'mouse' || event.button !== 0) return;
			if (!root.classList.contains('site-feed-queue--scrollable')) return;
			pointerActive = true;
			dragging = false;
			didDrag = false;
			activePointerId = event.pointerId;
			dragStartY = event.clientY;
			dragOriginScroll = viewport.scrollTop;
			document.addEventListener('pointermove', onPointerMove);
			document.addEventListener('pointerup', onPointerEnd);
			document.addEventListener('pointercancel', onPointerEnd);
		});

		viewport.addEventListener(
			'click',
			(event) => {
				if (!didDrag) return;
				event.preventDefault();
				event.stopPropagation();
				didDrag = false;
			},
			true
		);
	}

	function initQueue(root) {
		if (!(root instanceof Element)) return;

		const viewport = root.querySelector('.site-feed-queue__viewport');
		const list = root.querySelector('#site-feed-list') || root.querySelector('.site-feed-list');
		const controls = root.querySelector('.site-feed-queue__controls');
		const prevBtn = root.querySelector('.site-feed-queue__nav--prev');
		const nextBtn = root.querySelector('.site-feed-queue__nav--next');
		if (!viewport || !list) return;

		const visibleCount =
			parseInt(root.getAttribute('data-visible-count') || String(DEFAULT_VISIBLE), 10) || DEFAULT_VISIBLE;

		function getItemStep() {
			const items = list.querySelectorAll('.site-feed-item:not(.site-feed-item--error)');
			if (!items.length) return 0;
			const first = items[0];
			const second = items[1];
			if (second) {
				return second.getBoundingClientRect().top - first.getBoundingClientRect().top;
			}
			const gap = parseFloat(getComputedStyle(list).gap) || 0;
			return first.getBoundingClientRect().height + gap;
		}

		function measure() {
			const items = list.querySelectorAll('.site-feed-item:not(.site-feed-item--error)');
			if (!items.length) {
				viewport.style.maxHeight = '';
				updateNav();
				return;
			}

			const itemStep = getItemStep();
			const gap = parseFloat(getComputedStyle(list).gap) || 0;
			const maxItems = Math.min(visibleCount, items.length);
			viewport.style.maxHeight = `${Math.max(0, itemStep * maxItems - gap)}px`;
			updateNav();
		}

		function updateNav() {
			const canScroll = viewport.scrollHeight > viewport.clientHeight + SCROLL_TOLERANCE;
			root.classList.toggle('site-feed-queue--scrollable', canScroll);
			if (controls) controls.hidden = !canScroll;
			if (!canScroll) {
				if (prevBtn) prevBtn.hidden = true;
				if (nextBtn) nextBtn.hidden = true;
				return;
			}
			const atTop = viewport.scrollTop <= SCROLL_TOLERANCE;
			const atBottom =
				viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - SCROLL_TOLERANCE;
			if (prevBtn) prevBtn.hidden = atTop;
			if (nextBtn) nextBtn.hidden = atBottom;
		}

		function scrollByItems(direction) {
			const itemStep = getItemStep();
			if (!itemStep) return;
			viewport.scrollBy({ top: direction * itemStep, behavior: 'smooth' });
		}

		prevBtn?.addEventListener('click', () => scrollByItems(-1));
		nextBtn?.addEventListener('click', () => scrollByItems(1));
		bindSiteFeedQueueDrag(root, viewport);
		viewport.addEventListener('scroll', updateNav, { passive: true });

		if (typeof ResizeObserver !== 'undefined') {
			const ro = new ResizeObserver(() => measure());
			ro.observe(list);
			ro.observe(viewport);
		} else {
			window.addEventListener('resize', measure, { passive: true });
		}

		measure();
	}

	function boot(root) {
		initQueue(root || document.querySelector('[data-site-feed-queue]'));
	}

	window.__owenSiteFeedQueueInit = boot;

	if (document.readyState === 'loading') {
		document.addEventListener(
			'DOMContentLoaded',
			() => {
				const root = document.querySelector('[data-site-feed-queue]');
				const list = document.getElementById('site-feed-list');
				if (root && list && list.children.length) boot(root);
			},
			{ once: true }
		);
	}
})();
