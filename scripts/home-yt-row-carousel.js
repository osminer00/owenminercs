/**
 * Home page — per-row carousels for Latest videos & clips (manual nav + drag/swipe + autoplay).
 * Pattern mirrors home-explore-carousel.js.
 */
(function () {
	const HOLD_MS = 280;
	const DRAG_THRESHOLD = 6;
	const INITIAL_AUTO_MS = 1400;
	const AUTO_MS = 3800;

	function mod(n, m) {
		return ((n % m) + m) % m;
	}

	function disableNativeImageDrag(container) {
		if (!container) return;
		container.querySelectorAll('img').forEach((img) => {
			img.draggable = false;
		});
	}

	function getVisibleCount(row, viewportWidth) {
		const portrait = row.classList.contains('home-yt-row--portrait');
		if (portrait) {
			if (viewportWidth <= 640) return 2;
			if (viewportWidth <= 900) return 2;
			return 4;
		}
		if (viewportWidth <= 640) return 1;
		return 2;
	}

	function initRowCarousel(row) {
		const tiles = [...row.querySelectorAll(':scope > .home-yt-tile')];
		if (!tiles.length) return;

		const viewportWidth = row.clientWidth || window.innerWidth;
		const visible = getVisibleCount(row, viewportWidth);

		// Fewer tiles than visible slots: keep the CSS grid (no carousel transform).
		if (tiles.length <= visible) {
			if (typeof window.owenminercsInitDeferredEmbeds === 'function') {
				window.owenminercsInitDeferredEmbeds(row);
			}
			return;
		}

		const reducedMotion =
			window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		row.classList.add('home-yt-carousel');
		row.setAttribute('data-home-yt-carousel', '');
		if (row.classList.contains('home-yt-row--landscape')) {
			row.classList.add('home-yt-carousel--landscape');
		}

		const prevBtn = document.createElement('button');
		prevBtn.type = 'button';
		prevBtn.className = 'home-yt-carousel__nav home-yt-carousel__nav--prev';
		prevBtn.setAttribute('aria-label', 'Previous videos');
		prevBtn.innerHTML = '&lt;';

		const nextBtn = document.createElement('button');
		nextBtn.type = 'button';
		nextBtn.className = 'home-yt-carousel__nav home-yt-carousel__nav--next';
		nextBtn.setAttribute('aria-label', 'Next videos');
		nextBtn.innerHTML = '&gt;';

		const viewport = document.createElement('div');
		viewport.className = 'home-yt-carousel__viewport';

		const track = document.createElement('div');
		track.className = 'home-yt-carousel__track';
		track.setAttribute('role', 'list');

		row.setAttribute('role', 'presentation');
		row.innerHTML = '';
		row.append(prevBtn, viewport, nextBtn);
		viewport.appendChild(track);

		let cloneCount = 0;
		let originalCount = tiles.length;
		let slideIndex = 0;
		let autoTimer = null;
		let holdTimer = null;
		let pointerActive = false;
		let dragging = false;
		let didDrag = false;
		let dragStartX = 0;
		let dragOriginIndex = 0;
		let activePointerId = null;
		let hoverPaused = false;
		let focusPaused = false;
		let interactionPaused = false;

		function readGap() {
			const styles = getComputedStyle(track);
			return parseFloat(styles.columnGap || styles.gap) || 0;
		}

		function stepPx() {
			const tile = track.querySelector('.home-yt-tile:not([data-yt-clone])');
			if (!tile) return 0;
			return tile.getBoundingClientRect().width + readGap();
		}

		function setTranslatePx(px, animate) {
			if (reducedMotion || animate === false) track.style.transition = 'none';
			else track.style.transition = '';
			track.style.transform = `translate3d(${-px}px, 0, 0)`;
		}

		function normalizeSlideIndex(index) {
			if (index >= cloneCount + originalCount) return cloneCount;
			if (index <= 0) return originalCount;
			return index;
		}

		function syncNormalize() {
			if (slideIndex >= cloneCount + originalCount || slideIndex <= 0) {
				slideIndex = normalizeSlideIndex(slideIndex);
				setTranslatePx(slideIndex * stepPx(), false);
			}
		}

		function setSlideIndex(index, animate) {
			slideIndex = index;
			const shouldAnimate = animate !== false && !reducedMotion;
			setTranslatePx(slideIndex * stepPx(), shouldAnimate);
			if (!shouldAnimate) syncNormalize();
		}

		function normalizeLoopIndex(rawIndex) {
			return cloneCount + mod(rawIndex - cloneCount, originalCount);
		}

		function onTransitionEnd(event) {
			if (event.target !== track || event.propertyName !== 'transform') return;
			syncNormalize();
		}

		function markClone(clone) {
			clone.dataset.ytClone = '1';
			clone.setAttribute('aria-hidden', 'true');
			clone.querySelectorAll('button, iframe').forEach((el) => {
				if (el.tagName === 'IFRAME' && el.hasAttribute('src')) return;
				el.setAttribute('tabindex', '-1');
			});
			clone.querySelectorAll('.embed-facade__play').forEach((btn) => {
				btn.setAttribute('tabindex', '-1');
			});
		}

		function buildTrack() {
			const visible = getVisibleCount(row, viewport.clientWidth);
			originalCount = tiles.length;
			cloneCount =
				originalCount > visible ? Math.min(visible, originalCount) : 0;

			track.innerHTML = '';
			const tailStart = Math.max(0, originalCount - cloneCount);
			for (let i = tailStart; i < originalCount; i++) {
				const clone = tiles[i].cloneNode(true);
				markClone(clone);
				track.appendChild(clone);
			}
			tiles.forEach((tile) => track.appendChild(tile));
			for (let i = 0; i < cloneCount; i++) {
				const clone = tiles[i].cloneNode(true);
				markClone(clone);
				track.appendChild(clone);
			}

			slideIndex = cloneCount;
			setSlideIndex(slideIndex, false);
			disableNativeImageDrag(track);

			const canScroll = originalCount > visible;
			row.classList.toggle('home-yt-carousel--scrollable', canScroll);
			prevBtn.hidden = !canScroll;
			nextBtn.hidden = !canScroll;
			if (!canScroll) stopAuto();

			if (typeof window.owenminercsInitDeferredEmbeds === 'function') {
				window.owenminercsInitDeferredEmbeds(track);
			}
		}

		function stopAuto() {
			if (autoTimer !== null) {
				window.clearTimeout(autoTimer);
				window.clearInterval(autoTimer);
				autoTimer = null;
			}
		}

		function canAutoPlay() {
			return (
				!reducedMotion &&
				row.classList.contains('home-yt-carousel--scrollable') &&
				!dragging &&
				!holdTimer &&
				!pointerActive &&
				!interactionPaused &&
				!hoverPaused &&
				!focusPaused
			);
		}

		function tryResumeAuto() {
			if (canAutoPlay()) startAuto();
		}

		function startAuto() {
			stopAuto();
			if (!canAutoPlay()) return;
			autoTimer = window.setTimeout(function firstAutoStep() {
				go(1);
				autoTimer = window.setInterval(() => go(1), AUTO_MS);
			}, INITIAL_AUTO_MS);
		}

		function go(delta, animate) {
			setSlideIndex(slideIndex + delta, animate !== false);
		}

		function goInstant(delta) {
			let next = slideIndex + delta;
			if (next >= cloneCount + originalCount) next = cloneCount;
			else if (next <= 0) next = originalCount;
			setSlideIndex(next, false);
		}

		function stopHold() {
			if (holdTimer) {
				window.clearInterval(holdTimer);
				holdTimer = null;
			}
		}

		function bindHoldButton(btn, delta) {
			const startHold = (event) => {
				if (btn.hidden) return;
				event.preventDefault();
				stopAuto();
				stopHold();
				goInstant(delta);
				holdTimer = window.setInterval(() => goInstant(delta), HOLD_MS);
			};
			const stopHoldSafe = () => {
				stopHold();
				if (!dragging) tryResumeAuto();
			};

			btn.addEventListener('pointerdown', startHold);
			btn.addEventListener('pointerup', stopHoldSafe);
			btn.addEventListener('pointerleave', stopHoldSafe);
			btn.addEventListener('pointercancel', stopHoldSafe);
			btn.addEventListener('click', (event) => event.preventDefault());
		}

		function clearPointerListeners() {
			document.removeEventListener('pointermove', onPointerMove);
			document.removeEventListener('pointerup', onPointerEnd);
			document.removeEventListener('pointercancel', onPointerEnd);
		}

		function endDrag(event) {
			const step = stepPx();
			const dx = event.clientX - dragStartX;
			const currentPx = dragOriginIndex * step - dx;
			const rawIndex = step > 0 ? Math.round(currentPx / step) : slideIndex;
			const nextIndex = normalizeLoopIndex(rawIndex);
			setSlideIndex(nextIndex, !reducedMotion);
		}

		function onPointerMove(event) {
			if (!pointerActive || event.pointerId !== activePointerId) return;
			const dx = event.clientX - dragStartX;
			if (!dragging && Math.abs(dx) > DRAG_THRESHOLD) {
				dragging = true;
				didDrag = true;
				row.classList.add('home-yt-carousel--dragging');
				viewport.setPointerCapture(event.pointerId);
				track.style.transition = 'none';
			}
			if (!dragging) return;
			event.preventDefault();
			const px = dragOriginIndex * stepPx() - dx;
			setTranslatePx(px, false);
		}

		function onPointerEnd(event) {
			if (!pointerActive || event.pointerId !== activePointerId) return;
			clearPointerListeners();
			if (viewport.hasPointerCapture(event.pointerId)) {
				viewport.releasePointerCapture(event.pointerId);
			}
			if (dragging) endDrag(event);
			pointerActive = false;
			dragging = false;
			interactionPaused = false;
			activePointerId = null;
			row.classList.remove('home-yt-carousel--dragging');
			tryResumeAuto();
		}

		bindHoldButton(prevBtn, -1);
		bindHoldButton(nextBtn, 1);

		viewport.addEventListener('dragstart', (event) => event.preventDefault(), true);

		viewport.addEventListener('pointerdown', (event) => {
			if (event.button !== 0 || event.target.closest('.home-yt-carousel__nav')) return;
			// Loaded Reddit iframes are interactive; let clicks through without starting a drag.
			if (event.target.closest('.home-yt-tile__media--reddit iframe[src]')) return;
			if (!row.classList.contains('home-yt-carousel--scrollable')) return;
			pointerActive = true;
			dragging = false;
			didDrag = false;
			interactionPaused = true;
			activePointerId = event.pointerId;
			dragStartX = event.clientX;
			dragOriginIndex = slideIndex;
			stopAuto();
			stopHold();
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

		track.addEventListener('transitionend', onTransitionEnd);

		row.addEventListener('mouseenter', () => {
			hoverPaused = true;
			stopAuto();
		});
		row.addEventListener('mouseleave', () => {
			hoverPaused = false;
			stopHold();
			if (!dragging) tryResumeAuto();
		});
		row.addEventListener('focusin', () => {
			focusPaused = true;
			stopAuto();
		});
		row.addEventListener('focusout', (event) => {
			if (!row.contains(event.relatedTarget)) {
				focusPaused = false;
				tryResumeAuto();
			}
		});

		let resizeTimer = null;
		window.addEventListener('resize', () => {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(() => {
				const logical = mod(slideIndex - cloneCount, originalCount);
				buildTrack();
				setSlideIndex(cloneCount + logical, false);
				tryResumeAuto();
			}, 120);
		});

		buildTrack();
		tryResumeAuto();
	}

	document.addEventListener('DOMContentLoaded', () => {
		document
			.querySelectorAll('.home-yt-mosaic > .home-yt-row, .home-yt-mosaic .home-yt-row-group .home-yt-row')
			.forEach(initRowCarousel);
	});
})();
