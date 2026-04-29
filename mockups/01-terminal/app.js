(function () {
	const out = document.getElementById('term-out');
	const form = document.getElementById('term-form');
	const input = document.getElementById('term-in');

	function line(text, cls) {
		const d = document.createElement('div');
		d.className = 'line' + (cls ? ' ' + cls : '');
		d.textContent = text;
		out.appendChild(d);
		out.scrollTop = out.scrollHeight;
	}

	function printHelp() {
		line('Commands:');
		line('  help          — this list');
		line('  clear         — clear console');
		line('  socials       — print social URLs');
		line('  theme green   — phosphor green (default)');
		line('  theme amber   — amber CRT');
		line('  goto about    — scroll to bio');
		line('  matrix        — 3s rain toy (light)');
		line('  whoami        — you know');
	}

	function socials() {
		line('https://x.com/OwenMinerCS');
		line('https://www.youtube.com/@OwenMinerCS');
		line('https://www.instagram.com/owenminercs/');
		line('https://www.reddit.com/user/OwenMCS');
		line('https://www.tiktok.com/@owenminercs');
	}

	let matrixTimer = null;
	function matrix() {
		if (matrixTimer) return line('matrix already running…', 'err');
		line('MATRIX_DROP_START (3s)…');
		const cols = Math.floor(window.innerWidth / 14);
		let t = 0;
		matrixTimer = setInterval(() => {
			let row = '';
			for (let i = 0; i < Math.min(cols, 48); i++) {
				row +=
					Math.random() > 0.92
						? String.fromCharCode(0x30a0 + Math.random() * 96)
						: ['0', '1'][Math.random() > 0.5 ? 0 : 1];
			}
			line(row);
			t++;
			if (t > 18) {
				clearInterval(matrixTimer);
				matrixTimer = null;
				line('MATRIX_DROP_END');
			}
		}, 160);
	}

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const raw = input.value.trim();
		if (!raw) return;
		line('guest@owenminercs:~$ ' + raw);
		const [cmd, ...rest] = raw.toLowerCase().split(/\s+/);
		const arg = rest.join(' ');

		switch (cmd) {
			case 'help':
				printHelp();
				break;
			case 'clear':
				out.innerHTML = '';
				break;
			case 'socials':
				socials();
				break;
			case 'theme':
				document.body.classList.remove('theme-amber');
				if (arg === 'amber') document.body.classList.add('theme-amber');
				else if (arg === 'green') {
					/* default */
				} else line('usage: theme green | theme amber', 'err');
				break;
			case 'goto':
				if (arg === 'about')
					document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
				else line('usage: goto about', 'err');
				break;
			case 'matrix':
				matrix();
				break;
			case 'whoami':
				line('visitor — welcome to the experiment');
				break;
			default:
				line('unknown command: ' + cmd + ' (type help)', 'err');
		}
		input.value = '';
	});

	line('OwenMinerCS console mockup loaded.');
	line('Type help for commands.');
	input.focus();
})();
