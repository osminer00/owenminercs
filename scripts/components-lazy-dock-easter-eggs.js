/**
 * Idle-only micro-animations on the floating social dock (lazy-loaded from components.js).
 */
export function initSocialDockEasterEggs(wrap) {
	const nav = wrap.querySelector('.site-social-nav--dock');
	if (!nav) return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const EE_HOP = 'site-social-nav__link--ee-hop';
	const EE_MARBLE = 'site-social-nav__link--ee-marble';
	const EE_BUMP_L = 'site-social-nav__link--ee-bump-left';
	const EE_BUMP_R = 'site-social-nav__link--ee-bump-right';
	const EE_RAIN = 'site-social-nav__links-level--ee-rainbow';
	const EE_PLINKO = 'site-social-nav__link--ee-plinko';
	const EE_RACK = 'site-social-nav__link--ee-rack789';
	const EE_PLINKO_SHELL = 'site-social-nav--ee-plinko-mode';

	const IDLE_MS = 36000;
	const ROLL_WHEN_IDLE = 0.23;

	let lastActivity = Date.now();
	let quirkBusy = false;
	let timerId = 0;

	function links() {
		return Array.from(nav.querySelectorAll('a.site-social-nav__link'));
	}

	function bumpActivity() {
		lastActivity = Date.now();
	}

	function delay(ms) {
		return new Promise((r) => setTimeout(r, ms));
	}

	function shuffleInPlace(arr) {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}

	function pickRandomDistinct(arr, n) {
		const c = arr.slice();
		shuffleInPlace(c);
		return c.slice(0, Math.min(n, c.length));
	}

	async function dogHop() {
		const L = links();
		if (L.length < 2) return;
		const picks = pickRandomDistinct(L, 2);
		picks[0].classList.add(EE_HOP);
		picks[1].classList.add(EE_HOP);
		picks[1].style.animationDelay = '0.14s';
		await delay(1500);
		picks[0].classList.remove(EE_HOP);
		picks[1].classList.remove(EE_HOP);
		picks[1].style.animationDelay = '';
	}

	async function marbleRoll() {
		const L = links();
		const n = Math.min(L.length, 2 + (Math.random() < 0.55 ? 1 : 0));
		const picks = pickRandomDistinct(L, n);
		picks.forEach((el, i) => {
			el.classList.add(EE_MARBLE);
			el.style.animationDelay = `${i * 0.16}s`;
		});
		await delay(1680 + n * 160);
		picks.forEach((el) => {
			el.classList.remove(EE_MARBLE);
			el.style.animationDelay = '';
		});
	}

	async function billiardBump() {
		const L = links();
		if (L.length < 2) return;
		const i = Math.floor(Math.random() * (L.length - 1));
		const a = L[i];
		const b = L[i + 1];
		a.classList.add(EE_BUMP_L);
		b.classList.add(EE_BUMP_R);
		await delay(650);
		a.classList.remove(EE_BUMP_L);
		b.classList.remove(EE_BUMP_R);
	}

	async function rainbowFlash() {
		const row = nav.querySelector('.site-social-nav__links-level');
		if (!row) return;
		row.classList.add(EE_RAIN);
		await delay(2500);
		row.classList.remove(EE_RAIN);
	}

	async function plinkoDrop() {
		const L = links();
		if (!L.length) return;
		nav.classList.add(EE_PLINKO_SHELL);
		L.forEach((el, i) => {
			el.classList.add(EE_PLINKO);
			el.style.animationDelay = `${i * 0.08}s`;
		});
		await delay(3300);
		L.forEach((el) => {
			el.classList.remove(EE_PLINKO);
			el.style.animationDelay = '';
		});
		nav.classList.remove(EE_PLINKO_SHELL);
	}

	async function rackTrio() {
		const L = links();
		if (L.length < 3) return;
		const start = Math.floor(Math.random() * (L.length - 2));
		const trio = L.slice(start, start + 3);
		trio.forEach((el, i) => {
			el.classList.add(EE_RACK);
			el.style.animationDelay = `${i * 0.08}s`;
		});
		await delay(900);
		trio.forEach((el) => {
			el.classList.remove(EE_RACK);
			el.style.animationDelay = '';
		});
	}

	const quirks = [dogHop, marbleRoll, billiardBump, rainbowFlash, plinkoDrop, rackTrio];

	function schedulePeek() {
		if (timerId) window.clearTimeout(timerId);
		const wait = 26000 + Math.random() * 54000;
		timerId = window.setTimeout(runMaybeQuirk, wait);
	}

	function runMaybeQuirk() {
		schedulePeek();
		if (document.hidden || quirkBusy) return;
		if (Date.now() - lastActivity < IDLE_MS) return;
		if (Math.random() > ROLL_WHEN_IDLE) return;
		quirkBusy = true;
		const run = quirks[Math.floor(Math.random() * quirks.length)];
		Promise.resolve(run())
			.catch(() => {})
			.finally(() => {
				quirkBusy = false;
			});
	}

	const capOpt = { capture: true, passive: true };
	let lastScrollBump = 0;
	function bumpActivityScroll() {
		const n = Date.now();
		if (n - lastScrollBump < 500) return;
		lastScrollBump = n;
		bumpActivity();
	}
	document.addEventListener('pointerdown', bumpActivity, capOpt);
	document.addEventListener('keydown', bumpActivity, capOpt);
	window.addEventListener('scroll', bumpActivityScroll, { passive: true });
	nav.addEventListener('pointerdown', bumpActivity, capOpt);

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			if (timerId) window.clearTimeout(timerId);
			timerId = 0;
		} else {
			schedulePeek();
		}
	});

	schedulePeek();
}
