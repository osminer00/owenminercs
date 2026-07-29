/**
 * Keyboards hub: Austin Major–style photo theater.
 * Clicking a sidebar thumb swaps the main stage image/title.
 * Marks portrait vs landscape so CSS can letterbox portraits only.
 */
(function () {
	'use strict';

	function applyOrientation(mainEl, mainImg) {
		if (!mainEl || !mainImg) return;

		const token = (mainEl._kbTheaterLoadToken = (mainEl._kbTheaterLoadToken || 0) + 1);

		const setFromNatural = () => {
			if (token !== mainEl._kbTheaterLoadToken) return;
			const w = mainImg.naturalWidth;
			const h = mainImg.naturalHeight;
			if (!w || !h) return;
			const portrait = h > w;
			mainEl.dataset.orientation = portrait ? 'portrait' : 'landscape';
			/* Size the stage to the photo so nothing is letterboxed (no black bars). */
			mainEl.style.aspectRatio = w + ' / ' + h;
			mainEl.style.width = 'min(100%, calc(min(72vh, 42rem) * ' + w + ' / ' + h + '))';
		};

		if (mainImg.complete && mainImg.naturalWidth) {
			setFromNatural();
			return;
		}

		mainImg.addEventListener('load', setFromNatural, { once: true });
	}

	function initKeyboardPhotoTheater(root) {
		const theater = root || document.getElementById('kilowatt2025PhotoTheater');
		if (!theater || theater.dataset.theaterReady === '1') return;

		const mainEl = theater.querySelector('.keyboard-photo-theater__main');
		const mainImg = theater.querySelector('.keyboard-photo-theater__main-img');
		const titleEl = theater.querySelector('.keyboard-photo-theater__title');
		const items = Array.from(theater.querySelectorAll('.keyboard-photo-theater__item'));
		if (!mainImg || !items.length) return;

		theater.dataset.theaterReady = '1';

		function setActive(item) {
			const src = item.getAttribute('data-src');
			const title = item.getAttribute('data-title') || '';
			if (!src) return;

			mainImg.src = src;
			mainImg.alt = title;
			if (titleEl) titleEl.textContent = title;
			applyOrientation(mainEl, mainImg);

			items.forEach((el) => {
				const isActive = el === item;
				el.classList.toggle('keyboard-photo-theater__item--active', isActive);
				const itemTitle = el.getAttribute('data-title') || '';
				if (isActive) {
					el.setAttribute('aria-current', 'true');
					el.setAttribute('aria-label', 'Now viewing: ' + itemTitle);
				} else {
					el.removeAttribute('aria-current');
					el.setAttribute('aria-label', 'View: ' + itemTitle);
				}
			});
		}

		theater.addEventListener('click', (event) => {
			const item = event.target.closest('.keyboard-photo-theater__item');
			if (!item || !theater.contains(item)) return;
			if (item.classList.contains('keyboard-photo-theater__item--active')) return;
			setActive(item);
		});

		theater.addEventListener('keydown', (event) => {
			const item = event.target.closest('.keyboard-photo-theater__item');
			if (!item || !theater.contains(item)) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			if (item.classList.contains('keyboard-photo-theater__item--active')) return;
			setActive(item);
		});

		applyOrientation(mainEl, mainImg);
	}

	function initAll() {
		document.querySelectorAll('.keyboard-photo-theater').forEach((el) => initKeyboardPhotoTheater(el));
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initAll);
	} else {
		initAll();
	}
})();
