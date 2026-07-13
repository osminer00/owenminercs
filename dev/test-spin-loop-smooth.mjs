/**
 * Slow full-loop drag: detect sudden canvas hash jumps (visible pops).
 * Run: node dev/test-spin-loop-smooth.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PAGE = 'http://127.0.0.1:5501/Gaming/cs2-merch.html#nade-plushie-spin-test';

async function findChrome() {
	const candidates = [
		'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
		'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
		process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
	];
	for (const p of candidates) {
		try {
			const { access } = await import('node:fs/promises');
			await access(p);
			return p;
		} catch {
			/* next */
		}
	}
	throw new Error('Chrome not found');
}

async function main() {
	const chrome = await findChrome();
	const port = 9225;
	const proc = spawn(
		chrome,
		[
			`--remote-debugging-port=${port}`,
			`--user-data-dir=C:\\Users\\n3mog\\AppData\\Local\\Temp\\spin-loop-smooth-${Date.now()}`,
			'--headless=new',
			'--mute-audio',
			'--disable-gpu',
			'about:blank',
		],
		{ stdio: 'ignore' }
	);
	await sleep(1500);

	try {
		const tab = await (
			await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(PAGE)}`, { method: 'PUT' })
		).json();
		const ws = new WebSocket(tab.webSocketDebuggerUrl);
		let id = 0;
		const pending = new Map();
		const send = (method, params = {}) =>
			new Promise((resolve, reject) => {
				const msgId = ++id;
				pending.set(msgId, { resolve, reject });
				ws.send(JSON.stringify({ id: msgId, method, params }));
			});
		ws.addEventListener('message', (ev) => {
			const msg = JSON.parse(ev.data.toString());
			if (msg.id && pending.has(msg.id)) {
				const { resolve, reject } = pending.get(msg.id);
				pending.delete(msg.id);
				if (msg.error) reject(new Error(msg.error.message));
				else resolve(msg.result);
			}
		});
		await new Promise((r) => (ws.readyState === 1 ? r() : ws.addEventListener('open', r, { once: true })));
		await sleep(3000);

		for (let i = 0; i < 60; i++) {
			await sleep(400);
			const ev = await send('Runtime.evaluate', {
				expression: `(() => {
					const v = [...document.querySelectorAll('[data-spin-viewer]')][1];
					return v && v.dataset.spinReady === '1';
				})()`,
				returnByValue: true,
			});
			if (ev?.result?.value) break;
		}

		const rectEval = await send('Runtime.evaluate', {
			expression: `(() => {
				const s = [...document.querySelectorAll('[data-spin-viewer]')][1];
				s.scrollIntoView({ block: 'center' });
				const r = s.getBoundingClientRect();
				return { left: r.left, top: r.top, width: r.width, height: r.height };
			})()`,
			returnByValue: true,
		});
		const rect = rectEval.result.value;
		const y = rect.top + rect.height / 2;
		const steps = 100;
		const hashes = [];

		await send('Input.dispatchMouseEvent', {
			type: 'mousePressed',
			x: rect.left + 20,
			y,
			button: 'left',
			clickCount: 1,
		});

		for (let i = 0; i <= steps; i++) {
			const x = rect.left + 20 + (rect.width - 40) * (i / steps);
			await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' });
			await sleep(25);
			const px = await send('Runtime.evaluate', {
				expression: `(() => {
					const c = [...document.querySelectorAll('[data-spin-viewer]')][1].querySelector('canvas');
					const ctx = c.getContext('2d');
					const d = ctx.getImageData(0, 0, c.width, c.height).data;
					let s = 0;
					for (let j = 0; j < d.length; j += 97) s += d[j];
					return s;
				})()`,
				returnByValue: true,
			});
			hashes.push(px.result.value);
		}

		await send('Input.dispatchMouseEvent', {
			type: 'mouseReleased',
			x: rect.left + rect.width - 20,
			y,
			button: 'left',
			clickCount: 1,
		});

		let maxJump = 0;
		let worst = 0;
		const jumps = [];
		for (let i = 1; i < hashes.length; i++) {
			const d = Math.abs(hashes[i] - hashes[i - 1]);
			jumps.push(d);
			if (d > maxJump) {
				maxJump = d;
				worst = i;
			}
		}
		const median =
			jumps.length > 0
				? jumps.slice().sort((a, b) => a - b)[Math.floor(jumps.length / 2)]
				: 0;

		console.log(
			JSON.stringify(
				{
					steps: hashes.length,
					maxCanvasHashJump: maxJump,
					medianCanvasHashJump: median,
					worstStep: worst,
					worstRatio: median > 0 ? maxJump / median : null,
				},
				null,
				2
			)
		);

		await send('Page.navigate', { url: 'about:blank' });
		await sleep(200);

		// Pop if one step jumps >8x median (heuristic for seam vs motion)
		const pass = median === 0 || maxJump / median < 8;
		console.log(pass ? '\nPASS: no outlier pops during slow drag' : '\nFAIL: outlier pop detected');
		process.exitCode = pass ? 0 : 1;
	} finally {
		proc.kill('SIGTERM');
	}
}

main().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
