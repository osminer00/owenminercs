(function () {
	if (document.documentElement.hasAttribute('data-low-effects')) return;
	if (document.body?.hasAttribute('data-no-starfield')) return;
	if (document.querySelector('.site-starfield-canvas')) return;

	const bubbleMount = document.querySelector('.bubble-bg, .home-bubble-bg');
	let mount = bubbleMount;
	if (!mount) {
		mount = document.createElement('div');
		mount.className = 'site-starfield-bg';
		mount.setAttribute('aria-hidden', 'true');
		document.body.insertBefore(mount, document.body.firstChild);
	}

	const canvas = document.createElement('canvas');
	canvas.setAttribute('aria-hidden', 'true');
	canvas.className = 'site-starfield-canvas';
	canvas.style.cssText =
		'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;';
	mount.appendChild(canvas);

	const ctx = canvas.getContext('2d');
	const reducedMotion =
		window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
		document.documentElement.hasAttribute('data-low-effects');

	const STAR_COUNT = 520;
	const PARALLAX = [0.005, 0.012, 0.022];

	let W = 0;
	let H = 0;
	let targetX = 0;
	let targetY = 0;
	let smoothX = 0;
	let smoothY = 0;
	function resize() {
		W = canvas.width = mount.offsetWidth || window.innerWidth;
		H = canvas.height = mount.offsetHeight || window.innerHeight;
	}

	window.addEventListener('resize', resize);
	resize();

	function pickStarColor(isBright) {
		if (isBright) {
			return {
				h: 210 + Math.random() * 24,
				s: 6 + Math.random() * 18,
				l: 88 + Math.random() * 10,
			};
		}
		const roll = Math.random();
		if (roll < 0.55) {
			return {
				h: 205 + Math.random() * 55,
				s: 12 + Math.random() * 38,
				l: 62 + Math.random() * 28,
			};
		}
		if (roll < 0.82) {
			return {
				h: 38 + Math.random() * 28,
				s: 18 + Math.random() * 45,
				l: 58 + Math.random() * 22,
			};
		}
		return {
			h: 285 + Math.random() * 40,
			s: 15 + Math.random() * 35,
			l: 68 + Math.random() * 22,
		};
	}

	const stars = Array.from({ length: STAR_COUNT }, function (_, i) {
		const layer = i % 3;
		const isBright = i < 22;
		const col = pickStarColor(isBright);
		return {
			x: Math.random(),
			y: Math.random(),
			r: isBright
				? 1.15 + Math.random() * 1.05
				: layer === 2
					? 0.65 + Math.random() * 0.75
					: layer === 1
						? 0.4 + Math.random() * 0.55
						: 0.22 + Math.random() * 0.38,
			baseAlpha: isBright ? 0.68 + Math.random() * 0.28 : 0.22 + Math.random() * 0.48,
			phase: Math.random() * Math.PI * 2,
			speed: isBright ? 0.35 + Math.random() * 0.85 : 0.45 + Math.random() * 2.1,
			amp: isBright ? 0.07 + Math.random() * 0.15 : 0.05 + Math.random() * 0.22,
			layer,
			h: col.h,
			s: col.s,
			l: col.l,
			twinkle: isBright ? 0.35 + Math.random() * 0.5 : 0.08 + Math.random() * 0.14,
		};
	});

	document.addEventListener('mousemove', function (e) {
		targetX = e.clientX / window.innerWidth - 0.5;
		targetY = e.clientY / window.innerHeight - 0.5;
	});

	document.addEventListener(
		'touchmove',
		function (e) {
			if (!e.touches.length) return;
			targetX = e.touches[0].clientX / window.innerWidth - 0.5;
			targetY = e.touches[0].clientY / window.innerHeight - 0.5;
		},
		{ passive: true }
	);

	const LERP = reducedMotion ? 1 : 0.048;

	function isBrightStar(s) {
		return s.r > 1.05;
	}

	function draw(time) {
		requestAnimationFrame(draw);

		smoothX += (targetX - smoothX) * LERP;
		smoothY += (targetY - smoothY) * LERP;

		ctx.clearRect(0, 0, W, H);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';

		const t = time / 1000;

		for (let i = 0; i < stars.length; i++) {
			const s = stars[i];
			let px = s.x * W;
			let py = s.y * H;

			if (!reducedMotion) {
				const ox = smoothX * PARALLAX[s.layer] * W;
				const oy = smoothY * PARALLAX[s.layer] * H;
				px = (((px + ox) % W) + W) % W;
				py = (((py + oy) % H) + H) % H;
			}

			const flicker = reducedMotion ? 0 : Math.sin(t * s.speed + s.phase);
			let alpha = Math.max(0.035, s.baseAlpha + flicker * s.amp);
			if (s.twinkle > 0 && !reducedMotion) {
				alpha = Math.min(1, alpha + Math.sin(t * 2.8 + s.phase * 2) * s.twinkle * 0.22);
			}

			const light = Math.min(100, s.l + (isBrightStar(s) ? flicker * 4 : 0));

			ctx.beginPath();
			ctx.arc(px, py, s.r, 0, 6.2832);
			ctx.fillStyle = `hsla(${s.h}, ${s.s}%, ${light}%, ${alpha.toFixed(3)})`;
			ctx.globalCompositeOperation = 'source-over';
			ctx.fill();

			if (s.r > 1.05 && alpha > 0.45) {
				ctx.beginPath();
				ctx.arc(px, py, s.r * 2.4, 0, 6.2832);
				const glow = ctx.createRadialGradient(px, py, 0, px, py, s.r * 2.4);
				glow.addColorStop(
					0,
					`hsla(${s.h}, ${s.s}%, ${light}%, ${(alpha * 0.35).toFixed(3)})`
				);
				glow.addColorStop(1, 'hsla(220, 80%, 70%, 0)');
				ctx.fillStyle = glow;
				ctx.globalCompositeOperation = 'screen';
				ctx.fill();
				ctx.globalCompositeOperation = 'source-over';
			}
		}
	}

	requestAnimationFrame(draw);

	initShootingStars();
})();

/** Rare clickable shooting star — unlocks achievement `catch-shooting-star`. */
function initShootingStars() {
	const ACH_ID = 'catch-shooting-star';
	const reducedMotion =
		window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
		document.documentElement.hasAttribute('data-low-effects');
	if (reducedMotion) return;

	let layer = document.querySelector('.site-shooting-star-layer');
	if (!layer) {
		layer = document.createElement('div');
		layer.className = 'site-shooting-star-layer';
		layer.setAttribute('aria-hidden', 'true');
		document.body.appendChild(layer);
	}

	let active = null;
	let scheduleTimer = 0;

	function isUnlocked() {
		return (
			typeof window.owenminercsIsAchievementUnlocked === 'function' &&
			window.owenminercsIsAchievementUnlocked(ACH_ID)
		);
	}

	function rand(min, max) {
		return min + Math.random() * (max - min);
	}

	function pickTrajectory() {
		const rolls = [
			{ x: -6, y: rand(4, 28), dx: 112, dy: rand(52, 78), angle: 32 },
			{ x: rand(8, 42), y: -8, dx: rand(48, 88), dy: 96, angle: 48 },
			{ x: 104, y: rand(0, 22), dx: -108, dy: rand(58, 82), angle: -38 },
			{ x: rand(52, 92), y: -8, dx: rand(-72, -28), dy: 98, angle: -52 },
		];
		return rolls[Math.floor(Math.random() * rolls.length)];
	}

	function clearActive() {
		if (!active) return;
		try {
			active.remove();
		} catch (_) {}
		active = null;
	}

	function scheduleNext() {
		if (scheduleTimer) window.clearTimeout(scheduleTimer);
		if (isUnlocked()) return;
		const delay = rand(90000, 240000);
		scheduleTimer = window.setTimeout(trySpawn, delay);
	}

	function trySpawn() {
		scheduleTimer = 0;
		if (isUnlocked() || active || document.hidden) {
			scheduleNext();
			return;
		}
		spawnShootingStar();
	}

	function onCaught(btn) {
		if (btn !== active) return;
		clearActive();
		if (typeof window.owenminercsUnlockAchievement === 'function') {
			window.owenminercsUnlockAchievement(ACH_ID);
		}
		scheduleNext();
	}

	function spawnShootingStar() {
		if (active || isUnlocked()) return null;
		const traj = pickTrajectory();
		const durationMs = Math.round(rand(1400, 2200));
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'site-shooting-star';
		btn.setAttribute('aria-label', 'Catch a shooting star');
		btn.innerHTML =
			'<span class="site-shooting-star__streak" aria-hidden="true"></span>' +
			'<span class="site-shooting-star__head" aria-hidden="true"></span>';
		btn.style.setProperty('--ss-x', `${traj.x}vw`);
		btn.style.setProperty('--ss-y', `${traj.y}vh`);
		btn.style.setProperty('--ss-dx', `${traj.dx}vw`);
		btn.style.setProperty('--ss-dy', `${traj.dy}vh`);
		btn.style.setProperty('--ss-angle', `${traj.angle}deg`);
		btn.style.setProperty('--ss-duration', `${durationMs}ms`);

		btn.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			onCaught(btn);
		});
		btn.addEventListener('animationend', function () {
			if (btn === active) {
				clearActive();
				scheduleNext();
			}
		});

		layer.appendChild(btn);
		active = btn;
		return btn;
	}

	window.owenminercsSpawnShootingStar = function owenminercsSpawnShootingStar() {
		clearActive();
		return spawnShootingStar();
	};

	document.addEventListener('visibilitychange', function () {
		if (!document.hidden && !isUnlocked() && !active && !scheduleTimer) {
			scheduleNext();
		}
	});

	scheduleTimer = window.setTimeout(trySpawn, rand(55000, 110000));
}
