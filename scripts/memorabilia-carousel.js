/**
 * Compact memorabilia box carousels: hero + thumb strip, prev/next, optional auto-advance.
 */
(function () {
	var roots = document.querySelectorAll('[data-memorabilia-carousel]');
	if (!roots.length) return;

	var HOLD_MS = 2800;
	var FADE_MS = 280;
	var reduced =
		window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function initCarousel(root) {
		var stage = root.querySelector('.memorabilia-box-carousel__stage');
		var hero = root.querySelector('.memorabilia-box-carousel__hero');
		var counter = root.querySelector('.memorabilia-box-carousel__counter');
		var thumbViewport = root.querySelector('.memorabilia-box-carousel__thumbs');
		var thumbs = root.querySelectorAll('.memorabilia-box-carousel__thumb');
		var prevBtn = root.querySelector('.memorabilia-box-carousel__nav--prev');
		var nextBtn = root.querySelector('.memorabilia-box-carousel__nav--next');
		if (!stage || !hero || !thumbs.length) return;

		var slides = [];
		for (var i = 0; i < thumbs.length; i++) {
			var img = thumbs[i].querySelector('img');
			if (!img) continue;
			slides.push({
				src: img.getAttribute('data-full') || img.src,
				alt: img.alt || '',
				thumb: thumbs[i],
			});
		}
		if (!slides.length) return;

		var index = 0;
		var timer = null;
		var paused = false;
		var visible = true;

		root.classList.add('memorabilia-box-carousel--ready');
		if (slides.length === 1) {
			root.classList.add('memorabilia-box-carousel--single');
		}

		function scrollThumbIntoView(i) {
			var thumb = slides[i].thumb;
			if (!thumb || !thumbViewport) return;
			var left = thumb.offsetLeft;
			var right = left + thumb.offsetWidth;
			var viewLeft = thumbViewport.scrollLeft;
			var viewRight = viewLeft + thumbViewport.clientWidth;
			if (left < viewLeft) thumbViewport.scrollLeft = left;
			else if (right > viewRight) thumbViewport.scrollLeft = right - thumbViewport.clientWidth;
		}

		function show(next, animate) {
			next = ((next % slides.length) + slides.length) % slides.length;
			if (next === index && animate !== false) return;
			index = next;
			var slide = slides[index];
			hero.style.setProperty('--mem-fade-ms', animate === false ? '0ms' : FADE_MS + 'ms');
			hero.classList.remove('memorabilia-box-carousel__hero--visible');
			void hero.offsetWidth;
			hero.src = slide.src;
			hero.alt = slide.alt;
			hero.classList.add('memorabilia-box-carousel__hero--visible');
			if (counter) counter.textContent = index + 1 + ' / ' + slides.length;
			for (var t = 0; t < slides.length; t++) {
				var active = t === index;
				slides[t].thumb.classList.toggle('memorabilia-box-carousel__thumb--active', active);
				slides[t].thumb.setAttribute('aria-selected', active ? 'true' : 'false');
			}
			scrollThumbIntoView(index);
		}

		function go(delta) {
			show(index + delta, true);
		}

		function tick() {
			if (paused || slides.length < 2) return;
			go(1);
		}

		function start() {
			stop();
			if (paused || !visible || reduced || slides.length < 2) return;
			if (document.visibilityState === 'hidden') return;
			timer = window.setInterval(tick, HOLD_MS + FADE_MS);
		}

		function stop() {
			if (timer) {
				window.clearInterval(timer);
				timer = null;
			}
		}

		if (prevBtn) {
			prevBtn.addEventListener('click', function () {
				go(-1);
				start();
			});
		}
		if (nextBtn) {
			nextBtn.addEventListener('click', function () {
				go(1);
				start();
			});
		}

		for (var s = 0; s < slides.length; s++) {
			(function (slideIndex) {
				slides[slideIndex].thumb.addEventListener('click', function () {
					show(slideIndex, true);
					start();
				});
			})(s);
		}

		hero.addEventListener('click', function () {
			window.open(hero.src, '_blank', 'noopener');
		});

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
				{ root: null, threshold: 0.15 },
			);
			observer.observe(root);
		}

		stage.addEventListener('keydown', function (e) {
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				go(-1);
				start();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				go(1);
				start();
			}
		});

		show(0, false);
		start();
	}

	for (var r = 0; r < roots.length; r++) {
		initCarousel(roots[r]);
	}
})();
