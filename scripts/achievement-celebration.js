/**
 * When an achievement first unlocks: confetti, fireworks, and a toast.
 * Respects prefers-reduced-motion: toast only.
 */
(function () {
	'use strict';

	const TITLES = {
		'trophy-shelf': 'First steps',
		'lexicon-pin': 'Bookmark',
		'fidget-spinner': 'Fidget spinner',
		'social-dock-move': 'Twist it',
		'social-card-pin-and-move': 'Hands on',
		'social-dock-grand-tour': 'Grand tour',
		'main-nav-full-tour': 'Mega nerd',
	};

	const PALETTE = ['#00ff9a', '#4dffbd', '#ffd24a', '#ff6bb5', '#6ecbff', '#fff8e6', '#b388ff'];

	const DURATION_MS = 5200;

	function labelForId(id) {
		return TITLES[id] || id.replace(/-/g, ' ');
	}

	function pickColor() {
		return PALETTE[Math.floor(Math.random() * PALETTE.length)] || '#fff';
	}

	function prefersReducedMotion() {
		try {
			return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		} catch (_) {
			return false;
		}
	}

	function getToastStyleBlock() {
		return `
#owen-achievement-fx {
  position: fixed; inset: 0; z-index: 999999; pointer-events: none; width: 100%; height: 100%;
  display: block;
}
.owen-achievement-toast {
  position: fixed; z-index: 1000000; left: 50%; top: min(20vh, 180px);
  transform: translate3d(-50%, 0, 0) scale(0.9);
  max-width: min(92vw, 420px);
  pointer-events: none; opacity: 0;
  font-family: var(--font-body, "Raleway", sans-serif);
  color: #f2f2f2;
  transition: opacity 0.45s var(--ease-out, cubic-bezier(0.22,1,0.36,1)),
    transform 0.55s var(--ease-out, cubic-bezier(0.22,1,0.36,1));
  filter: drop-shadow(0 24px 64px rgba(0,0,0,0.55));
}
.owen-achievement-toast--in { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
.owen-achievement-toast--out { opacity: 0; transform: translate3d(-50%, 14px, 0) scale(0.95); }
.owen-achievement-toast--calm { transition: opacity 0.4s ease, transform 0.4s ease; }
.owen-achievement-toast__inner {
  background: linear-gradient(145deg, rgba(20, 28, 32, 0.96) 0%, rgba(5, 8, 10, 0.98) 100%);
  border: 1px solid rgba(0, 255, 150, 0.5);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 0 40px rgba(0, 255, 150, 0.28);
  border-radius: 16px; padding: 1.1rem 1.35rem 1.25rem; text-align: center;
}
.owen-achievement-toast__kicker {
  margin: 0 0 0.4em; font-size: 0.7rem; letter-spacing: 0.32em; text-transform: uppercase;
  color: rgba(0, 255, 180, 0.95);
  text-shadow: 0 0 18px rgba(0, 255, 150, 0.5);
}
.owen-achievement-toast--festival .owen-achievement-toast__kicker {
  animation: owen-ach-shimmer 0.7s ease-in-out infinite alternate;
}
@keyframes owen-ach-shimmer { from { opacity: 0.85; } to { opacity: 1; } }
.owen-achievement-toast__title {
  margin: 0;
  font-family: var(--font-display, "Raleway", sans-serif);
  font-weight: 800; font-size: clamp(1.2rem, 3.5vw, 1.7rem);
  line-height: 1.2; color: #fff;
}`;
	}

	function ensureStyles() {
		if (document.getElementById('owen-achievement-toast-style')) return;
		const s = document.createElement('style');
		s.id = 'owen-achievement-toast-style';
		s.textContent = getToastStyleBlock();
		document.head.appendChild(s);
	}

	/** @param {string} id */
	/** @param {boolean} calm */
	function mountToast(achievementId, festival) {
		ensureStyles();
		const title = labelForId(achievementId);
		const el = document.createElement('div');
		el.setAttribute('role', 'status');
		el.setAttribute('aria-live', 'assertive');
		el.className =
			'owen-achievement-toast' +
			(festival ? ' owen-achievement-toast--festival' : ' owen-achievement-toast--calm');
		el.innerHTML =
			'<div class="owen-achievement-toast__inner"><p class="owen-achievement-toast__kicker">' +
			(festival ? 'Achievement unlocked' : 'Achievement') +
			'</p><p class="owen-achievement-toast__title"></p></div>';
		const tNode = el.querySelector('.owen-achievement-toast__title');
		if (tNode) tNode.textContent = title;
		document.body.appendChild(el);
		requestAnimationFrame(function () {
			requestAnimationFrame(function () {
				el.classList.add('owen-achievement-toast--in');
			});
		});
		var hide = festival ? 4200 : 4000;
		window.setTimeout(function () {
			el.classList.remove('owen-achievement-toast--in');
			el.classList.add('owen-achievement-toast--out');
		}, hide);
		window.setTimeout(function () {
			try {
				el.remove();
			} catch (_) {}
		}, hide + 650);
	}

	/**
	 * @typedef {{ x: number, y: number, vx: number, vy: number, rot: number, vrot: number, c: string, s: number }} ConfPiece
	 */

	/**
	 * @param {ConfPiece[]} out
	 */
	function burstConfetti(out, count, cx, cy, widthRad, vMin, vMax) {
		for (var i = 0; i < count; i++) {
			var ang = (Math.random() - 0.5) * widthRad * Math.PI - Math.PI / 2;
			var sp = vMin + Math.random() * (vMax - vMin);
			out.push({
				x: cx,
				y: cy,
				vx: Math.cos(ang) * sp,
				vy: Math.sin(ang) * sp,
				rot: Math.random() * 6.28,
				vrot: (Math.random() - 0.5) * 0.45,
				c: pickColor(),
				s: 2.4 + Math.random() * 4.5,
			});
		}
	}

	/**
	 * @param {ConfPiece[]} out
	 */
	function ringConfetti(out, cx, cy, n, c) {
		for (var i = 0; i < n; i++) {
			var a = (i / n) * 6.283 + Math.random() * 0.1;
			var v = 3.2 + Math.random() * 3.5;
			out.push({
				x: cx,
				y: cy,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v,
				rot: 0,
				vrot: 0,
				c: c,
				s: 1.6 + Math.random() * 2.4,
			});
		}
	}

	/**
	 * @param {string} achievementId
	 */
	function runFestival(achievementId) {
		var W = window.innerWidth;
		var H = window.innerHeight;
		var old = document.getElementById('owen-achievement-fx');
		if (old) {
			try {
				old.remove();
			} catch (e) {
				/* */
			}
		}
		var cv = document.createElement('canvas');
		cv.id = 'owen-achievement-fx';
		cv.setAttribute('aria-hidden', 'true');
		cv.width = W;
		cv.height = H;
		document.body.appendChild(cv);
		var ctx = cv.getContext('2d');
		if (!ctx) {
			mountToast(achievementId, true);
			return;
		}

		/** @type {ConfPiece[]} */
		var p = [];
		/** @type {{ x: number, y: number, vy: number, tgt: number, col: string, off: number, dead: number }[]} */
		var rks = [];
		/** @type {number[]} */
		var extraBursts = [0, 900, 1800, 2700, 3500];
		/** @type {number} */
		var xCursor = 0.15;

		// big side + bottom confetti
		burstConfetti(p, 130, W * 0.15, H + 8, 1.05, 9, 18);
		burstConfetti(p, 130, W * 0.85, H + 8, 1.05, 9, 18);
		burstConfetti(p, 100, W * 0.5, -6, 1.35, 5, 11);

		for (var r = 0; r < 6; r++) {
			var rx = 0.1 * W + Math.random() * 0.8 * W;
			var tgt = 0.1 * H + Math.random() * 0.32 * H;
			var col = pickColor();
			rks.push({
				x: rx,
				y: H + 4,
				vy: -12 - Math.random() * 6,
				tgt: tgt,
				col: col,
				off: r * 0.2,
				dead: 0,
			});
		}

		mountToast(achievementId, true);

		var t0 = performance.now();
		var burstI = 0;
		var G = 0.22;

		function step(now) {
			if (!cv || !ctx || !document.body.contains(cv)) return;
			var elapsed = now - t0;
			if (elapsed > DURATION_MS) {
				try {
					cv.remove();
				} catch (e) {
					/* */
				}
				return;
			}
			// Staggered extra confetti waves
			while (burstI < extraBursts.length && elapsed > extraBursts[burstI]) {
				burstI++;
				xCursor = (xCursor + 0.19 + Math.random() * 0.1) % 0.7;
				burstConfetti(p, 64, (0.12 + xCursor) * W, -Math.random() * 40, 1.2, 4.5, 9.5);
			}
			// late sky bursts
			if (elapsed > 500 && elapsed < 510) {
				ringConfetti(p, 0.35 * W, 0.22 * H, 50, pickColor());
				ringConfetti(p, 0.68 * W, 0.28 * H, 50, pickColor());
			}
			if (elapsed > 1600 && elapsed < 1620) {
				burstConfetti(p, 50, 0.5 * W, 0.25 * H, 2, 2, 5);
			}

			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, W, H);

			var fd = 1;
			for (var j = 0; j < rks.length; j++) {
				var R = rks[j];
				if (R.dead) continue;
				R.y += R.vy * fd;
				R.x += (Math.random() * 0.1 - 0.05) * R.off;
				R.vy += 0.15 * fd;
				// Trailing spark
				ctx.beginPath();
				grd(ctx, R.x, R.y, R.col);
				// detonate the first time we pass through the target (still climbing)
				if (R.vy < 0 && R.y <= R.tgt) {
					ringConfetti(p, R.x, Math.max(0, R.y), (64 + Math.random() * 20) | 0, R.col);
					burstConfetti(p, 40, R.x, Math.max(0, R.y), 1.8, 1.4, 7.5);
					R.dead = 1;
				} else if (R.y < -30 || R.y > H + 50) {
					R.dead = 1;
				}
			}

			for (var k = p.length - 1; k >= 0; k--) {
				var a = p[k];
				if (!a) continue;
				a.vy += G * fd;
				a.x += a.vx * fd;
				a.y += a.vy * fd;
				a.vx *= 0.999;
				a.rot += a.vrot;
				a.s *= 0.9993;
				if (a.y > H + 80 || a.s < 0.35) {
					p.splice(k, 1);
					continue;
				}
				if (a.x < -30 || a.x > W + 30) {
					p.splice(k, 1);
					continue;
				}
				ctx.save();
				ctx.translate(a.x, a.y);
				ctx.rotate(a.rot);
				ctx.fillStyle = a.c;
				ctx.fillRect(-a.s / 2, -a.s, a.s, a.s * 1.5);
				ctx.restore();
			}
			requestAnimationFrame(step);
		}

		/** Faint line below the rocket to read as a spark trail. */
		function grd(CTX, x, y, col) {
			CTX.beginPath();
			CTX.moveTo(x, y + 14);
			CTX.lineTo(x, y);
			var g0 = CTX.createLinearGradient(x, y + 14, x, y);
			g0.addColorStop(0, 'rgba(255,255,255,0.02)');
			g0.addColorStop(0.35, 'rgba(255,255,255,0.35)');
			g0.addColorStop(0.6, col);
			g0.addColorStop(1, 'rgba(0,0,0,0)');
			CTX.strokeStyle = g0;
			CTX.lineWidth = 1.3;
			CTX.stroke();
		}

		requestAnimationFrame(step);
	}

	function handleUnlockedEvent(e) {
		var d = e && e.detail;
		if (!d || !d.id) return;
		if (prefersReducedMotion()) {
			ensureStyles();
			mountToast(d.id, false);
			return;
		}
		runFestival(d.id);
	}

	window.owenminercsOnAchievementUnlocked = handleUnlockedEvent;
	var q = window.owenminercsAchievementUnlockedQueue;
	if (q && q.length) {
		for (var i = 0; i < q.length; i++) {
			try {
				handleUnlockedEvent(q[i]);
			} catch (err) {
				/* */
			}
		}
		q.length = 0;
	}
})();
