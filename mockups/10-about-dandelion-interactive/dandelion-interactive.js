(function () {
	'use strict';

	const canvas = document.getElementById('dandy');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const SEED_COUNT = 110;
	const REGROWTH_SEC = 28;
	const WIND_FRAMES = 72;
	const CLICK_PICK_R = 22;
	const HEAD_R_BASE = 38;

	let w = 0;
	let h = 0;
	let dpr = 1;
	let headX = 0;
	let headY = 0;
	let stemBaseX = 0;
	let time = 0;

	/** @type {{ ax:number, ay:number, ar:number, phase:number, attached:boolean, x:number, y:number, vx:number, vy:number, life:number }[]} */
	let seeds = [];
	let wind = 0;
	let regrowth = 1;
	let regrowing = false;

	function rnd(a, b) {
		return a + Math.random() * (b - a);
	}

	function rebuildSeeds() {
		seeds = [];
		for (let i = 0; i < SEED_COUNT; i++) {
			const u = Math.random();
			const v = Math.random();
			const theta = u * Math.PI * 2;
			const phi = Math.acos(2 * v - 1);
			const r = HEAD_R_BASE * (0.35 + Math.pow(Math.random(), 0.45) * 0.65);
			const ax = r * Math.sin(phi) * Math.cos(theta);
			const ay = r * Math.sin(phi) * Math.sin(theta) * 0.82;
			seeds.push({
				ax,
				ay,
				ar: rnd(0.55, 1.05),
				phase: rnd(0, Math.PI * 2),
				attached: true,
				x: 0,
				y: 0,
				vx: 0,
				vy: 0,
				life: 1,
			});
		}
	}

	function layout() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		w = window.innerWidth;
		h = window.innerHeight;
		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		canvas.style.width = w + 'px';
		canvas.style.height = h + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		headX = w * 0.72 + Math.sin(time * 0.001) * 6;
		headY = h * 0.36 + Math.cos(time * 0.0009) * 4;
		stemBaseX = w * 0.42;
	}

	function attachedCount() {
		return seeds.filter(function (s) {
			return s.attached;
		}).length;
	}

	function detachSeed(s, extraVx, extraVy) {
		if (!s.attached) return;
		s.attached = false;
		s.x = headX + s.ax;
		s.y = headY + s.ay;
		s.vx = extraVx + rnd(-0.8, 0.8);
		s.vy = extraVy + rnd(-2.2, 0.4);
		s.life = 1;
	}

	function blowWind() {
		wind = WIND_FRAMES;
		const gust = rnd(14, 20) * (Math.random() < 0.5 ? 1 : -1);
		seeds.forEach(function (s) {
			if (!s.attached) return;
			const lift = rnd(2, 7);
			detachSeed(s, gust + rnd(-4, 4), -lift);
		});
	}

	function tryPickSeed(clientX, clientY) {
		const rect = canvas.getBoundingClientRect();
		const px = clientX - rect.left;
		const py = clientY - rect.top;
		let best = null;
		let bestD = CLICK_PICK_R * CLICK_PICK_R;
		seeds.forEach(function (s) {
			if (!s.attached) return;
			const sx = headX + s.ax;
			const sy = headY + s.ay;
			const dx = px - sx;
			const dy = py - sy;
			const d2 = dx * dx + dy * dy;
			if (d2 < bestD) {
				bestD = d2;
				best = s;
			}
		});
		if (best) {
			detachSeed(best, rnd(-1.2, 1.2), rnd(0.5, 3.2));
		}
	}

	function maybeStartRegrowth() {
		if (regrowing) return;
		if (attachedCount() > 0) return;
		const loose = seeds.filter(function (s) {
			return !s.attached && s.life > 0.08;
		}).length;
		if (loose > 8) return;
		beginRegrowth();
	}

	function beginRegrowth() {
		regrowing = true;
		regrowth = 0;
		seeds.forEach(function (s) {
			s.attached = false;
			s.life = 0;
			s.vx = 0;
			s.vy = 0;
		});
	}

	function tickRegrowth(dt) {
		if (!regrowing) return;
		regrowth += dt / REGROWTH_SEC;
		if (regrowth >= 1) {
			regrowth = 1;
			regrowing = false;
			seeds.forEach(function (s) {
				s.attached = true;
				s.life = 1;
			});
			return;
		}
		const cap = easeSlow(regrowth) * SEED_COUNT;
		seeds.forEach(function (s, i) {
			if (i < cap) {
				s.attached = true;
				s.life = 1;
			}
		});
	}

	function easeSlow(t) {
		return 1 - Math.pow(1 - t, 2.4);
	}

	function drawBackground() {
		const g = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.5, h * 0.5, Math.max(w, h));
		g.addColorStop(0, 'rgba(30, 70, 45, 0.35)');
		g.addColorStop(0.45, '#040807');
		g.addColorStop(1, '#010302');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);

		ctx.save();
		ctx.globalAlpha = 0.12;
		for (let i = 0; i < 40; i++) {
			const gx = ((i * 997) % w) + Math.sin(time * 0.0004 + i) * 20;
			const gy = (i * 541) % h;
			ctx.fillStyle = i % 2 ? 'rgba(100, 255, 160, 0.15)' : 'rgba(60, 200, 120, 0.12)';
			ctx.beginPath();
			ctx.arc(gx, gy, 1.2 + (i % 3), 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}

	function drawStem() {
		const sway = Math.sin(time * 0.002) * 10 + (wind > 0 ? Math.sin(time * 0.08) * 14 : 0);
		ctx.strokeStyle = 'rgba(55, 120, 70, 0.95)';
		ctx.lineWidth = 5;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(stemBaseX + sway * 0.2, h + 20);
		ctx.quadraticCurveTo(stemBaseX + sway * 0.6, h * 0.62, headX, headY + 24);
		ctx.stroke();

		ctx.lineWidth = 1.5;
		ctx.strokeStyle = 'rgba(120, 220, 140, 0.22)';
		ctx.beginPath();
		ctx.moveTo(stemBaseX + sway * 0.2, h + 20);
		ctx.quadraticCurveTo(stemBaseX + sway * 0.6, h * 0.62, headX, headY + 24);
		ctx.stroke();
	}

	function drawReceptacle() {
		const fill =
			regrowth < 0.98 && attachedCount() === 0
				? 'rgba(90, 140, 70, 0.9)'
				: 'rgba(70, 120, 65, 0.75)';
		ctx.beginPath();
		ctx.arc(headX, headY + 8, 10 + (1 - regrowth) * 4, 0, Math.PI * 2);
		ctx.fillStyle = fill;
		ctx.fill();
	}

	function drawSeed(s) {
		const len = 14 * s.ar;
		const wob = Math.sin(time * 0.003 + s.phase) * 0.4;
		if (s.attached) {
			const sx = headX + s.ax;
			const sy = headY + s.ay;
			const ang = Math.atan2(s.ay, s.ax) + wob;
			ctx.strokeStyle = 'rgba(230, 255, 240, 0.88)';
			ctx.lineWidth = 0.9;
			ctx.beginPath();
			ctx.moveTo(sx, sy);
			const tx = sx + Math.cos(ang) * len;
			const ty = sy + Math.sin(ang) * len;
			ctx.lineTo(tx, ty);
			ctx.stroke();

			ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
			ctx.beginPath();
			ctx.arc(tx, ty, 2.1, 0, Math.PI * 2);
			ctx.fill();
			return;
		}

		if (s.life <= 0.01) return;
		ctx.globalAlpha = s.life;
		const ang = Math.atan2(s.vy, s.vx) + wob;
		ctx.strokeStyle = 'rgba(235, 255, 245, 0.9)';
		ctx.lineWidth = 0.85;
		ctx.beginPath();
		ctx.moveTo(s.x, s.y);
		ctx.lineTo(s.x + Math.cos(ang) * len, s.y + Math.sin(ang) * len);
		ctx.stroke();
		ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
		ctx.beginPath();
		ctx.arc(s.x + Math.cos(ang) * len, s.y + Math.sin(ang) * len, 2, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
	}

	function step(dt) {
		time += dt;
		headX = w * 0.72 + Math.sin(time * 0.001) * 6;
		headY = h * 0.36 + Math.cos(time * 0.0009) * 4;

		if (wind > 0) {
			wind -= 1;
		}

		const wx = wind > 0 ? (wind / WIND_FRAMES) * 26 * (Math.sin(time * 0.2) > 0 ? 1 : -1) : 0;

		seeds.forEach(function (s) {
			if (s.attached) return;
			s.vy += 0.06;
			s.vx *= 0.992;
			s.vy *= 0.996;
			s.vx += wx * 0.018 + rnd(-0.02, 0.02);
			s.x += s.vx;
			s.y += s.vy;
			s.life *= 0.9925;
			if (s.y > h + 40 || s.x < -80 || s.x > w + 80) {
				s.life *= 0.85;
			}
		});

		tickRegrowth(dt);
		maybeStartRegrowth();
	}

	function frame(now) {
		const dt = Math.min(32, now - (frame.prev || now));
		frame.prev = now;
		layout();
		drawBackground();
		drawStem();
		drawReceptacle();
		seeds.forEach(drawSeed);
		step(dt);
		requestAnimationFrame(frame);
	}

	window.addEventListener('resize', layout);

	canvas.addEventListener(
		'pointerdown',
		function (e) {
			if (e.button !== 0) return;
			tryPickSeed(e.clientX, e.clientY);
		},
		{ passive: true }
	);

	window.addEventListener(
		'keydown',
		function (e) {
			if (e.code !== 'Space') return;
			const t = e.target;
			if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))
				return;
			e.preventDefault();
			blowWind();
		},
		{ passive: false }
	);

	rebuildSeeds();
	layout();
	requestAnimationFrame(frame);
})();
