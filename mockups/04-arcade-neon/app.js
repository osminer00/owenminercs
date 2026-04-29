(function () {
	const canvas = document.getElementById('game');
	const ctx = canvas.getContext('2d');
	const W = canvas.width;
	const H = canvas.height;

	let playerX = W / 2 - 20;
	const playerW = 40;
	const playerH = 10;
	let targets = [];
	let score = 0;
	let combo = 1;
	let lastCatch = 0;
	let running = true;
	let lastTs = 0;

	function spawn() {
		targets.push({
			x: Math.random() * (W - 24),
			y: -10,
			w: 24,
			h: 24,
			vy: 1.2 + Math.random() * 1.8,
			hue: Math.random() > 0.5 ? 'pink' : 'cyan',
			passed: false,
		});
	}

	function resetGame() {
		targets = [];
		score = 0;
		combo = 1;
		playerX = W / 2 - playerW / 2;
		running = true;
		updateHud();
	}

	function updateHud() {
		document.getElementById('score').textContent = 'Score: ' + score;
		document.getElementById('combo').textContent = 'Combo: x' + combo;
	}

	const keys = { ArrowLeft: false, ArrowRight: false };
	window.addEventListener('keydown', (e) => {
		if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
		if (e.code === 'ArrowRight') keys.ArrowRight = true;
		if (e.code === 'Space') {
			e.preventDefault();
			resetGame();
		}
	});
	window.addEventListener('keyup', (e) => {
		if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
		if (e.code === 'ArrowRight') keys.ArrowRight = false;
	});

	function tick(ts) {
		if (!lastTs) lastTs = ts;
		const dt = Math.min(32, ts - lastTs);
		lastTs = ts;

		if (running) {
			if (keys.ArrowLeft) playerX -= 0.35 * dt;
			if (keys.ArrowRight) playerX += 0.35 * dt;
			playerX = Math.max(0, Math.min(W - playerW, playerX));

			if (Math.random() < 0.03) spawn();

			ctx.fillStyle = '#030308';
			ctx.fillRect(0, 0, W, H);
			ctx.strokeStyle = 'rgba(5,217,232,0.15)';
			for (let x = 0; x < W; x += 20) {
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, H);
				ctx.stroke();
			}

			ctx.fillStyle = 'rgba(5,217,232,0.9)';
			ctx.fillRect(playerX, H - playerH - 6, playerW, playerH);

			for (let i = targets.length - 1; i >= 0; i--) {
				const t = targets[i];
				t.y += t.vy * (dt / 16);
				ctx.fillStyle = t.hue === 'pink' ? '#ff2a6d' : '#05d9e8';
				ctx.fillRect(t.x, t.y, t.w, t.h);

				const paddleY = H - playerH - 6;
				if (!t.passed && t.y + t.h >= paddleY) {
					t.passed = true;
					const hit = t.x + t.w > playerX && t.x < playerX + playerW;
					if (hit) {
						const now = performance.now();
						combo = now - lastCatch < 900 ? Math.min(combo + 1, 8) : 1;
						lastCatch = now;
						score += 10 * combo;
						targets.splice(i, 1);
						updateHud();
						continue;
					}
				}
				if (t.y > H) {
					targets.splice(i, 1);
					running = false;
					combo = 1;
					updateHud();
				}
			}

			if (!running) {
				ctx.fillStyle = 'rgba(0,0,0,0.65)';
				ctx.fillRect(0, 0, W, H);
				ctx.fillStyle = '#ff2a6d';
				ctx.font = 'bold 16px Orbitron, sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText('MISSED — SPACE TO RETAKE', W / 2, H / 2);
			}
		} else {
			ctx.fillStyle = '#030308';
			ctx.fillRect(0, 0, W, H);
			ctx.fillStyle = '#ff2a6d';
			ctx.font = '14px Orbitron, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText('SPACE — restart', W / 2, H / 2);
		}

		requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);

	const barsEl = document.getElementById('bars');
	const barEls = [];
	for (let i = 0; i < 12; i++) {
		const s = document.createElement('span');
		s.style.height = '8px';
		barsEl.appendChild(s);
		barEls.push(s);
	}
	let lastTap = 0;
	document.getElementById('tap-beat').addEventListener('click', () => {
		const now = performance.now();
		const interval = lastTap ? now - lastTap : 300;
		lastTap = now;
		const h = Math.min(44, 12 + 6000 / Math.max(interval, 80));
		barEls.forEach((el, i) => {
			const wave = Math.sin((now / 50 + i) * 0.8) * 0.5 + 0.5;
			el.style.height = 8 + wave * h * 0.6 + 'px';
		});
	});
})();
