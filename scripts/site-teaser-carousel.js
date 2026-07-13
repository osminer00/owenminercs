/**
 * Cross-link teaser cards: auto-crossfade images in `.site-teaser-card__carousel`.
 * Pauses on hover/focus, when off-screen, and when the tab is hidden; prefers-reduced-motion keeps first image only.
 */
(function () {
	var roots = document.querySelectorAll('[data-site-teaser-carousel]');
	if (!roots.length) return;

	var HOLD_MS = 2400;
	var FADE_MS = 420;
	var reduced =
		window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function initCarousel(root) {
		var api = window.owenminercsCarouselFilter;
		if (api && typeof api.pruneCarouselImageNodes === 'function') {
			api.pruneCarouselImageNodes(root);
		}
		var imgs = root.querySelectorAll('img');
		if (!imgs.length) return;
		if (imgs.length === 1 || reduced) {
			root.classList.add('site-teaser-card__carousel--static');
			return;
		}

		root.classList.add('site-teaser-card__carousel--active');
		var index = 0;
		var timer = null;
		var paused = false;
		var visible = true;

		for (var i = 0; i < imgs.length; i++) {
			imgs[i].style.setProperty('--teaser-fade-ms', FADE_MS + 'ms');
			if (i === 0) imgs[i].classList.add('site-teaser-card__slide--visible');
		}

		var counter = document.createElement('span');
		counter.className = 'site-teaser-card__counter';
		counter.setAttribute('aria-hidden', 'true');
		counter.textContent = '1 / ' + imgs.length;
		root.appendChild(counter);

		function show(next) {
			if (next === index) return;
			imgs[index].classList.remove('site-teaser-card__slide--visible');
			imgs[next].classList.add('site-teaser-card__slide--visible');
			index = next;
			counter.textContent = index + 1 + ' / ' + imgs.length;
		}

		function tick() {
			if (paused) return;
			show((index + 1) % imgs.length);
		}

		function start() {
			stop();
			if (paused || !visible || document.visibilityState === 'hidden') return;
			timer = window.setInterval(tick, HOLD_MS + FADE_MS);
		}

		function stop() {
			if (timer) {
				window.clearInterval(timer);
				timer = null;
			}
		}

		root.addEventListener('mouseenter', function () {
			paused = true;
			stop();
		});
		root.addEventListener('mouseleave', function () {
			paused = false;
			start();
		});
		root.addEventListener('focusin', function () {
			paused = true;
			stop();
		});
		root.addEventListener('focusout', function (e) {
			if (root.contains(e.relatedTarget)) return;
			paused = false;
			start();
		});

		document.addEventListener('visibilitychange', function () {
			if (document.visibilityState === 'hidden') stop();
			else start();
		});

		if ('IntersectionObserver' in window) {
			var observer = new IntersectionObserver(
				function (entries) {
					visible = entries[0] && entries[0].isIntersecting;
					if (visible && !paused) start();
					else stop();
				},
				{ root: null, threshold: 0.12 },
			);
			observer.observe(root);
		}

		start();
	}

	for (var r = 0; r < roots.length; r++) {
		initCarousel(roots[r]);
	}
})();
