/**
 * Photo carousels (drag + arrow nav). Pattern mirrors scripts/home-yt-row-carousel.js.
 * Used on gaming memorabilia and keyboard build galleries (auto-upgrades .photogallery grids).
 */
(function () {
	const HOLD_MS = 400;
	const DRAG_THRESHOLD = 6;
	const INITIAL_AUTO_MS = 1400;
	const AUTO_MS = 3800;
	const USER_INTERACTION_PAUSE_MS = 300000;

	function mod(n, m) {
		return ((n % m) + m) % m;
	}

	function disableNativeImageDrag(container) {
		if (!container) return;
		container.querySelectorAll('img').forEach((img) => {
			img.draggable = false;
		});
	}

	function getVisibleCount(viewportWidth) {
		if (viewportWidth <= 900) return 2;
		return 4;
	}

	function initPhotoCarousel(root) {
		const row = root.querySelector('.memorabilia-photo-carousel__row');
		if (!row) return;

		const slides = [...row.querySelectorAll(':scope > .memorabilia-photo-slide')];
		if (!slides.length) return;

		const counter = root.querySelector('.memorabilia-photo-carousel__counter');
		const reducedMotion =
			window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		root.classList.add('memorabilia-photo-carousel--ready');
		row.classList.add('memorabilia-photo-carousel__carousel');

		const prevBtn = document.createElement('button');
		prevBtn.type = 'button';
		prevBtn.className = 'memorabilia-photo-carousel__nav memorabilia-photo-carousel__nav--prev';
		prevBtn.setAttribute('aria-label', 'Previous photo');
		prevBtn.innerHTML = '&lt;';

		const nextBtn = document.createElement('button');
		nextBtn.type = 'button';
		nextBtn.className = 'memorabilia-photo-carousel__nav memorabilia-photo-carousel__nav--next';
		nextBtn.setAttribute('aria-label', 'Next photo');
		nextBtn.innerHTML = '&gt;';

		const viewport = document.createElement('div');
		viewport.className = 'memorabilia-photo-carousel__viewport';

		const track = document.createElement('div');
		track.className = 'memorabilia-photo-carousel__track';
		track.setAttribute('role', 'list');

		row.setAttribute('role', 'presentation');
		row.innerHTML = '';
		row.append(prevBtn, viewport, nextBtn);
		viewport.appendChild(track);

		let cloneCount = 0;
		let originalCount = slides.length;
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
		let userPauseUntil = 0;
		let userPauseTimer = null;

		function updateCounter() {
			if (!counter || !originalCount) return;
			const logical = mod(slideIndex - cloneCount, originalCount);
			counter.textContent = logical + 1 + ' / ' + originalCount;
		}

		function readGap() {
			const styles = getComputedStyle(track);
			return parseFloat(styles.columnGap || styles.gap) || 0;
		}

		function stepPx() {
			const slide = track.querySelector('.memorabilia-photo-slide:not([data-photo-clone])');
			if (!slide) return 0;
			return slide.getBoundingClientRect().width + readGap();
		}

		function setTranslatePx(px, animate) {
			if (reducedMotion || animate === false) track.style.transition = 'none';
			else track.style.transition = '';
			track.style.transform = 'translate3d(' + -px + 'px, 0, 0)';
		}

		function normalizeSlideIndex(index) {
			if (!cloneCount) {
				if (index < 0) return 0;
				if (index >= originalCount) return Math.max(0, originalCount - 1);
				return index;
			}
			if (index >= cloneCount + originalCount) return cloneCount;
			if (index <= 0) return originalCount;
			return index;
		}

		function syncNormalize() {
			if (!cloneCount) return;
			if (slideIndex >= cloneCount + originalCount || slideIndex <= 0) {
				slideIndex = normalizeSlideIndex(slideIndex);
				setTranslatePx(slideIndex * stepPx(), false);
				updateCounter();
			}
		}

		function setSlideIndex(index, animate) {
			slideIndex = index;
			const shouldAnimate = animate !== false && !reducedMotion;
			setTranslatePx(slideIndex * stepPx(), shouldAnimate);
			if (!shouldAnimate) syncNormalize();
			updateCounter();
		}

		function onTransitionEnd(event) {
			if (event.target !== track || event.propertyName !== 'transform') return;
			syncNormalize();
		}

		function markClone(clone) {
			clone.dataset.photoClone = '1';
			clone.setAttribute('aria-hidden', 'true');
		}

		function buildTrack() {
			const visible = getVisibleCount(viewport.clientWidth);
			originalCount = slides.length;
			cloneCount = originalCount > visible ? Math.min(visible, originalCount) : 0;

			track.innerHTML = '';
			const tailStart = Math.max(0, originalCount - cloneCount);
			for (let i = tailStart; i < originalCount; i++) {
				const clone = slides[i].cloneNode(true);
				markClone(clone);
				track.appendChild(clone);
			}
			slides.forEach((slide) => track.appendChild(slide));
			for (let i = 0; i < cloneCount; i++) {
				const clone = slides[i].cloneNode(true);
				markClone(clone);
				track.appendChild(clone);
			}

			slideIndex = cloneCount;
			setSlideIndex(slideIndex, false);
			disableNativeImageDrag(track);

			const canScroll = originalCount > visible;
			root.classList.toggle('memorabilia-photo-carousel--scrollable', canScroll);
			prevBtn.hidden = !canScroll;
			nextBtn.hidden = !canScroll;
			if (!canScroll) stopAuto();
		}

		function stopAuto() {
			if (autoTimer !== null) {
				window.clearTimeout(autoTimer);
				window.clearInterval(autoTimer);
				autoTimer = null;
			}
		}

		function isUserInteractionPaused() {
			return Date.now() < userPauseUntil;
		}

		function pauseAutoForUserInteraction() {
			userPauseUntil = Date.now() + USER_INTERACTION_PAUSE_MS;
			stopAuto();
			if (userPauseTimer !== null) {
				window.clearTimeout(userPauseTimer);
			}
			userPauseTimer = window.setTimeout(function () {
				userPauseTimer = null;
				tryResumeAuto();
			}, USER_INTERACTION_PAUSE_MS);
		}

		function canAutoPlay() {
			return (
				!reducedMotion &&
				root.classList.contains('memorabilia-photo-carousel--scrollable') &&
				!dragging &&
				!holdTimer &&
				!pointerActive &&
				!isUserInteractionPaused() &&
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
				autoTimer = window.setInterval(function () {
					go(1);
				}, AUTO_MS);
			}, INITIAL_AUTO_MS);
		}

		function go(delta, animate) {
			const shouldAnimate = animate !== false && !reducedMotion;
			if (shouldAnimate && (slideIndex >= cloneCount + originalCount || slideIndex <= 0)) {
				syncNormalize();
				track.getBoundingClientRect();
			}
			setSlideIndex(slideIndex + delta, animate !== false);
		}

		function stopHold() {
			if (holdTimer) {
				window.clearInterval(holdTimer);
				holdTimer = null;
			}
		}

		function bindHoldButton(btn, delta) {
			const startHold = function (event) {
				if (btn.hidden) return;
				event.preventDefault();
				pauseAutoForUserInteraction();
				stopHold();
				go(delta);
				holdTimer = window.setInterval(function () {
					go(delta);
				}, HOLD_MS);
			};
			const stopHoldSafe = function () {
				stopHold();
				if (!dragging) tryResumeAuto();
			};

			btn.addEventListener('pointerdown', startHold);
			btn.addEventListener('pointerup', stopHoldSafe);
			btn.addEventListener('pointerleave', stopHoldSafe);
			btn.addEventListener('pointercancel', stopHoldSafe);
			btn.addEventListener('click', function (event) {
				event.preventDefault();
			});
		}

		function clearPointerListeners() {
			document.removeEventListener('pointermove', onPointerMove);
			document.removeEventListener('pointerup', onPointerEnd);
			document.removeEventListener('pointercancel', onPointerEnd);
		}

		function readDragPx(clientX, step) {
			const dx = clientX - dragStartX;
			let currentPx = dragOriginIndex * step - dx;
			if (!cloneCount) return currentPx;

			const loopWidth = originalCount * step;
			const loopEnd = (cloneCount + originalCount) * step;

			if (loopWidth <= 0) return currentPx;
			while (currentPx >= loopEnd) {
				dragOriginIndex -= originalCount;
				currentPx -= loopWidth;
			}
			while (currentPx <= 0) {
				dragOriginIndex += originalCount;
				currentPx += loopWidth;
			}
			return currentPx;
		}

		function endDrag(event) {
			const step = stepPx();
			const currentPx = readDragPx(event.clientX, step);
			const rawIndex = step > 0 ? Math.round(currentPx / step) : slideIndex;
			const nextIndex = Math.max(0, Math.min(cloneCount + originalCount, rawIndex));
			setSlideIndex(nextIndex, !reducedMotion);
		}

		function onPointerMove(event) {
			if (!pointerActive || event.pointerId !== activePointerId) return;
			const dx = event.clientX - dragStartX;
			if (!dragging && Math.abs(dx) > DRAG_THRESHOLD) {
				dragging = true;
				didDrag = true;
				pauseAutoForUserInteraction();
				root.classList.add('memorabilia-photo-carousel--dragging');
				viewport.setPointerCapture(event.pointerId);
				track.style.transition = 'none';
			}
			if (!dragging) return;
			event.preventDefault();
			const step = stepPx();
			const px = readDragPx(event.clientX, step);
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
			activePointerId = null;
			root.classList.remove('memorabilia-photo-carousel--dragging');
			tryResumeAuto();
		}

		bindHoldButton(prevBtn, -1);
		bindHoldButton(nextBtn, 1);

		viewport.addEventListener(
			'dragstart',
			function (event) {
				event.preventDefault();
			},
			true
		);

		viewport.addEventListener('pointerdown', function (event) {
			if (event.button !== 0 || event.target.closest('.memorabilia-photo-carousel__nav'))
				return;
			if (!root.classList.contains('memorabilia-photo-carousel--scrollable')) return;
			pointerActive = true;
			dragging = false;
			didDrag = false;
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
			function (event) {
				if (didDrag) {
					event.preventDefault();
					event.stopPropagation();
					didDrag = false;
					return;
				}
				var img = event.target.closest('.memorabilia-photo-slide__media img');
				if (img && img.src) {
					window.open(img.src, '_blank', 'noopener');
				}
			},
			true
		);

		track.addEventListener('transitionend', onTransitionEnd);

		root.addEventListener('mouseenter', function () {
			hoverPaused = true;
			stopAuto();
		});
		root.addEventListener('mouseleave', function () {
			hoverPaused = false;
			stopHold();
			if (!dragging) tryResumeAuto();
		});
		root.addEventListener('focusin', function () {
			focusPaused = true;
			stopAuto();
		});
		root.addEventListener('focusout', function (event) {
			if (!root.contains(event.relatedTarget)) {
				focusPaused = false;
				tryResumeAuto();
			}
		});

		viewport.addEventListener('keydown', function (event) {
			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				go(-1);
				tryResumeAuto();
			} else if (event.key === 'ArrowRight') {
				event.preventDefault();
				go(1);
				tryResumeAuto();
			}
		});
		viewport.setAttribute('tabindex', '0');

		var resizeTimer = null;
		window.addEventListener('resize', function () {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(function () {
				var logical = mod(slideIndex - cloneCount, originalCount);
				buildTrack();
				setSlideIndex(cloneCount + logical, false);
				tryResumeAuto();
			}, 120);
		});

		buildTrack();
		tryResumeAuto();
	}

	function upgradePhotogallery(gallery) {
		if (gallery.dataset.photogalleryCarouselReady === '1') return;

		const imgs = [...gallery.querySelectorAll('.photogallery-img[src]')];
		if (!imgs.length) return;

		const carousel = document.createElement('div');
		carousel.className = 'memorabilia-photo-carousel';
		carousel.setAttribute('data-memorabilia-photo-carousel', '');

		const row = document.createElement('div');
		row.className = 'memorabilia-photo-carousel__row';
		row.setAttribute('role', 'list');

		imgs.forEach(function (img) {
			const slide = document.createElement('figure');
			slide.className = 'memorabilia-photo-slide';
			slide.setAttribute('role', 'listitem');

			const media = document.createElement('div');
			media.className = 'memorabilia-photo-slide__media';

			const newImg = document.createElement('img');
			newImg.src = img.getAttribute('src');
			if (img.getAttribute('alt')) newImg.alt = img.getAttribute('alt');
			if (img.getAttribute('loading')) newImg.loading = img.getAttribute('loading');
			if (img.getAttribute('decoding')) newImg.decoding = img.getAttribute('decoding');
			if (img.getAttribute('width')) newImg.width = img.getAttribute('width');
			if (img.getAttribute('height')) newImg.height = img.getAttribute('height');

			media.appendChild(newImg);
			slide.appendChild(media);
			row.appendChild(slide);
		});

		const counter = document.createElement('span');
		counter.className = 'memorabilia-photo-carousel__counter';
		counter.setAttribute('aria-live', 'polite');
		counter.textContent = '1 / ' + imgs.length;

		carousel.appendChild(row);
		carousel.appendChild(counter);

		gallery.innerHTML = '';
		gallery.classList.add('photogallery--carousel');
		gallery.dataset.photogalleryCarouselReady = '1';
		gallery.appendChild(carousel);

		initPhotoCarousel(carousel);
	}

	window.owenminercsInitPhotoCarousel = initPhotoCarousel;
	window.owenminercsUpgradePhotogallery = upgradePhotogallery;

	document.addEventListener('DOMContentLoaded', function () {
		document.querySelectorAll('[data-memorabilia-photo-carousel]').forEach(initPhotoCarousel);
		document.querySelectorAll('[data-photogallery-carousel]').forEach(upgradePhotogallery);
		document
			.querySelectorAll(
				'body.keyboard-60he-2023-page .keyboard-build-sheet .photogallery.subpage-gallery--dense, body.keyboard-60he-2025-page .kilowatt-gallery-carousel.photogallery.subpage-gallery--dense'
			)
			.forEach(function (gallery) {
				if (gallery.dataset.photogalleryCarouselReady !== '1') upgradePhotogallery(gallery);
			});
	});
})();
