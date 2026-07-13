/**

 * Lite visuals mode for slow compositing (e.g. Chrome hardware acceleration off).

 * Sets html[data-low-effects], persists preference, optional frame-budget auto-detect.

 */

(function (global) {

	const STORAGE_KEY = 'owenminercs-low-effects';

	const SLOW_FRAME_MS = 32;

	const PROBE_FRAMES = 28;



	let resolveReady;

	const readyPromise = new Promise(function (resolve) {

		resolveReady = resolve;

	});



	function getPreference() {

		try {

			const value = localStorage.getItem(STORAGE_KEY);

			if (value === 'on' || value === 'off') return value;

		} catch (_) {}

		return 'auto';

	}



	function setPreference(mode) {

		try {

			if (mode === 'auto') localStorage.removeItem(STORAGE_KEY);

			else localStorage.setItem(STORAGE_KEY, mode);

		} catch (_) {}

		syncVisualsControls();

	}



	function isActive() {

		return document.documentElement.hasAttribute('data-low-effects');

	}



	function applyActive(active) {

		const next = Boolean(active);

		if (next === isActive()) return;

		if (next) document.documentElement.setAttribute('data-low-effects', '');

		else document.documentElement.removeAttribute('data-low-effects');

		if (next) teardownHeavyLayers();

		document.dispatchEvent(

			new CustomEvent('owenminercs-low-effects-change', { detail: { active: next } })

		);

		syncVisualsControls();

	}



	function teardownHeavyLayers() {

		document.querySelectorAll('.site-starfield-canvas, .site-shooting-star-layer').forEach(function (node) {

			node.remove();

		});

		document.querySelectorAll('#bubble-bg-video, #home-bubble-video').forEach(function (video) {

			try {

				video.pause();

			} catch (_) {}

		});

	}



	function bootstrapFromStorage() {

		if (getPreference() === 'on') applyActive(true);

	}



	function probeFrameBudget() {

		return new Promise(function (resolve) {

			const deltas = [];

			let last = performance.now();

			let count = 0;



			function frame(now) {

				if (count > 0) deltas.push(now - last);

				last = now;

				count += 1;

				if (count <= PROBE_FRAMES) requestAnimationFrame(frame);

				else {

					if (!deltas.length) {

						resolve(false);

						return;

					}

					const sorted = deltas.slice().sort(function (a, b) {

						return a - b;

					});

					const median = sorted[Math.floor(sorted.length / 2)];

					resolve(median >= SLOW_FRAME_MS);

				}

			}



			requestAnimationFrame(frame);

		});

	}



	async function runAutoDetect() {

		const slow = await probeFrameBudget();

		if (slow) {

			applyActive(true);

			setPreference('on');

		}

	}



	function finishReady() {

		if (typeof resolveReady === 'function') resolveReady();

		resolveReady = null;

	}



	async function init() {

		bootstrapFromStorage();

		const pref = getPreference();

		if (pref === 'off') {

			applyActive(false);

			finishReady();

			return;

		}

		if (pref === 'on') {

			applyActive(true);

			finishReady();

			return;

		}

		await runAutoDetect();

		finishReady();

	}



	function syncVisualsControls() {

		const pref = getPreference();

		document.querySelectorAll('[data-owen-low-effects-select]').forEach(function (select) {

			if (select.value !== pref) select.value = pref;

		});

	}



	function selectPreference(pref) {

		if (pref !== 'auto' && pref !== 'on' && pref !== 'off') return;

		if (pref === 'auto') {

			setPreference('auto');

			applyActive(false);

			runAutoDetect();

			return;

		}

		if (pref === 'on') {

			setPreference('on');

			applyActive(true);

			return;

		}

		setPreference('off');

		applyActive(false);

	}



	function initVisualsControls() {

		document.querySelectorAll('.site-visuals-control').forEach(function (control) {

			if (control.dataset.owenLowEffectsWired === '1') return;

			const select = control.querySelector('[data-owen-low-effects-select]');

			if (!select) return;

			control.dataset.owenLowEffectsWired = '1';

			select.addEventListener('change', function () {

				selectPreference(select.value);

			});

		});

		syncVisualsControls();

	}



	function whenDomReady(fn) {

		if (document.readyState === 'loading') {

			document.addEventListener('DOMContentLoaded', fn, { once: true });

		} else fn();

	}



	global.owenminercsLowEffectsReady = readyPromise;

	global.owenminercsLowEffects = {

		isActive,

		getPreference,

		setPreference,

		applyActive,

		selectPreference,

		syncVisualsControls,

		refreshVisualsControls: initVisualsControls,

		refreshToggleButtons: initVisualsControls,

		whenReady: function (fn) {

			readyPromise.then(fn);

		},

	};



	whenDomReady(function () {

		initVisualsControls();

	});



	init();

	global.__owenLowEffectsLoaded = true;

})(window);

