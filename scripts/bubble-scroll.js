/**

 * Scroll-reactive bubble background video playback speed.

 * Works on any page with #bubble-bg-video (body.bubble-theme) or legacy #home-bubble-video.

 * Disabled when prefers-reduced-motion or lite visuals (data-low-effects).

 */

(function () {

	function boot() {

		const body = document.body;

		const video =

			document.getElementById('bubble-bg-video') || document.getElementById('home-bubble-video');

		if (!video) return;



		const isBubbleTheme =

			body.classList.contains('bubble-theme') || body.classList.contains('home-liquid-glass-test');

		if (!isBubbleTheme) return;



		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

		if (reducedMotion.matches || document.documentElement.hasAttribute('data-low-effects')) return;



		const BASE_RATE = 0.5;

		const MIN_RATE = 0.25;

		const MAX_RATE = 0.75;

		const VELOCITY_FACTOR = 0.00075;

		const VELOCITY_DECAY = 0.82;

		const RATE_SMOOTHING = 0.14;

		const IDLE_MS = 120;

		const RETURN_SMOOTHING = 0.08;



		let lastScrollY = window.scrollY;

		let lastScrollTime = performance.now();

		let scrollVelocity = 0;

		let targetRate = BASE_RATE;

		let currentRate = BASE_RATE;

		let rafId = 0;

		let ticking = false;



		function clamp(value, min, max) {

			return Math.min(max, Math.max(min, value));

		}



		function ensurePlaying() {

			if (video.paused) {

				video.play().catch(function () {});

			}

		}



		function onScroll() {

			if (!ticking) {

				ticking = true;

				requestAnimationFrame(updateFromScroll);

			}

		}



		function updateFromScroll() {

			ticking = false;

			const now = performance.now();

			const deltaY = window.scrollY - lastScrollY;

			const deltaMs = Math.max(now - lastScrollTime, 1);



			scrollVelocity = (deltaY / deltaMs) * 1000;

			lastScrollY = window.scrollY;

			lastScrollTime = now;



			targetRate = clamp(BASE_RATE + scrollVelocity * VELOCITY_FACTOR, MIN_RATE, MAX_RATE);

			scheduleTick();

		}



		function scheduleTick() {

			if (rafId) return;

			rafId = requestAnimationFrame(tick);

		}



		function tick(now) {

			rafId = 0;



			if (now - lastScrollTime > IDLE_MS) {

				scrollVelocity *= VELOCITY_DECAY;

				if (Math.abs(scrollVelocity) < 4) scrollVelocity = 0;

				targetRate = clamp(BASE_RATE + scrollVelocity * VELOCITY_FACTOR, MIN_RATE, MAX_RATE);

			}



			if (Math.abs(targetRate - BASE_RATE) < 0.01 && Math.abs(scrollVelocity) < 1) {

				targetRate = BASE_RATE;

			}



			const smoothing = Math.abs(targetRate - BASE_RATE) < 0.05 ? RETURN_SMOOTHING : RATE_SMOOTHING;

			currentRate += (targetRate - currentRate) * smoothing;



			if (Math.abs(currentRate - BASE_RATE) < 0.005 && Math.abs(targetRate - BASE_RATE) < 0.005) {

				currentRate = BASE_RATE;

				targetRate = BASE_RATE;

				video.playbackRate = BASE_RATE;

				return;

			}



			video.playbackRate = clamp(currentRate, MIN_RATE, MAX_RATE);

			scheduleTick();

		}



		function stopScrollReactive() {

			if (rafId) cancelAnimationFrame(rafId);

			rafId = 0;

			video.playbackRate = BASE_RATE;

			window.removeEventListener('scroll', onScroll, { passive: true });

		}



		function onReducedMotionChange(event) {

			if (event.matches) stopScrollReactive();

		}



		function onLowEffectsChange(event) {

			if (event.detail?.active) stopScrollReactive();

		}



		video.playbackRate = BASE_RATE;

		ensurePlaying();

		video.addEventListener('loadeddata', ensurePlaying, { once: true });



		window.addEventListener('scroll', onScroll, { passive: true });

		reducedMotion.addEventListener('change', onReducedMotionChange);

		document.addEventListener('owenminercs-low-effects-change', onLowEffectsChange);

	}



	if (window.owenminercsLowEffectsReady && typeof window.owenminercsLowEffectsReady.then === 'function') {

		window.owenminercsLowEffectsReady.then(boot);

	} else {

		boot();

	}

})();

