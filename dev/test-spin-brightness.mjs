/**
 * CDP slow-drag canvas brightness oscillation check for knife case viewer.
 * Run: node dev/test-spin-brightness.mjs
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
	const port = 9224;
	const proc = spawn(
		chrome,
		[
			`--remote-debugging-port=${port}`,
			`--user-data-dir=C:\\Users\\n3mog\\AppData\\Local\\Temp\\spin-bright-test-${Date.now()}`,
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

		ws.addEventListener('message', (ev) => {
			const msg = JSON.parse(ev.data);
			if (msg.id && pending.has(msg.id)) {
				const { resolve, reject } = pending.get(msg.id);
				pending.delete(msg.id);
				if (msg.error) reject(new Error(msg.error.message));
				else resolve(msg.result);
			}
		});

		await new Promise((r) => (ws.readyState === 1 ? r() : ws.addEventListener('open', r, { once: true })));

		const send = (method, params = {}) =>
			new Promise((resolve, reject) => {
				const msgId = ++id;
				pending.set(msgId, { resolve, reject });
				ws.send(JSON.stringify({ id: msgId, method, params }));
			});

		await send('Page.enable');
		await send('Runtime.enable');

		for (let i = 0; i < 40; i++) {
			await sleep(500);
			const ready = await send('Runtime.evaluate', {
				expression: "document.querySelectorAll('[data-spin-viewer]')[1]?.dataset.spinReady === '1'",
				returnByValue: true,
			});
			if (ready.result.value) break;
		}

		const rectEval = await send('Runtime.evaluate', {
			expression: `(() => {
				const k = [...document.querySelectorAll('[data-spin-viewer]')][1];
				k.scrollIntoView({ block: 'center' });
				const r = k.getBoundingClientRect();
				return { left: r.left, top: r.top, width: r.width, height: r.height };
			})()`,
			returnByValue: true,
		});
		const rect = rectEval.result.value;
		const y = rect.top + rect.height / 2;
		const startX = rect.left + rect.width * 0.2;
		const endX = rect.left + rect.width * 0.8;

		const brightness = [];
		await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y, button: 'left', clickCount: 1 });

		for (let step = 0; step <= 40; step++) {
			const x = startX + (endX - startX) * (step / 40);
			await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' });
			await sleep(40);
			const sample = await send('Runtime.evaluate', {
				expression: `(() => {
					const k = [...document.querySelectorAll('[data-spin-viewer]')][1];
					const c = k.querySelector('canvas');
					const ctx = c.getContext('2d');
					const w = Math.floor(c.width * 0.1);
					const h = Math.floor(c.height * 0.1);
					const d = ctx.getImageData(Math.floor(c.width * 0.45), Math.floor(c.height * 0.45), w, h).data;
					let s = 0, n = 0;
					for (let i = 0; i < d.length; i += 4) {
						s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
						n++;
					}
					return s / n;
				})()`,
				returnByValue: true,
			});
			brightness.push(sample.result.value);
		}

		await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y, button: 'left', clickCount: 1 });

		const deltas = brightness.slice(1).map((v, i) => Math.abs(v - brightness[i]));
		const maxDelta = Math.max(...deltas);
		const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
		const meanLum = brightness.reduce((a, b) => a + b, 0) / brightness.length;

		console.log(`Canvas brightness samples: ${brightness.length}`);
		console.log(`Mean luminance: ${meanLum.toFixed(2)}`);
		console.log(`Adjacent delta: max=${maxDelta.toFixed(2)} mean=${meanDelta.toFixed(2)}`);
		const pass = maxDelta < 12;
		console.log(pass ? 'PASS: no wild brightness oscillation during slow drag' : 'WARN: large brightness jumps');
		await send('Page.navigate', { url: 'about:blank' });
		process.exitCode = pass ? 0 : 1;
	} finally {
		proc.kill('SIGTERM');
	}
}

main().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
