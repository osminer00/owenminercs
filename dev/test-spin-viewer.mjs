/**

 * Headless spin viewer test for cs2-merch.html spin grid.

 * Run: node dev/test-spin-viewer.mjs

 */

import http from 'node:http';

import { spawn } from 'node:child_process';

import { setTimeout as sleep } from 'node:timers/promises';



const PAGE = 'http://127.0.0.1:5501/Gaming/cs2-merch.html#nade-plushie-spin-test';



function httpGet(url) {

	return new Promise((resolve, reject) => {

		http

			.get(url, (res) => {

				let data = '';

				res.on('data', (c) => (data += c));

				res.on('end', () => resolve({ status: res.statusCode, data }));

			})

			.on('error', reject);

	});

}



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



async function runCdpTest() {

	const chrome = await findChrome();

	const port = 9223;

	const userData = `C:\\Users\\n3mog\\AppData\\Local\\Temp\\spin-test-cdp-${Date.now()}`;



	const proc = spawn(

		chrome,

		[

			`--remote-debugging-port=${port}`,

			`--user-data-dir=${userData}`,

			'--headless=new',

			'--mute-audio',

			'--disable-gpu',

			'--no-first-run',

			'--no-default-browser-check',

			'about:blank',

		],

		{ stdio: 'ignore' }

	);



	await sleep(1500);



	try {

		const newTabRes = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(PAGE)}`, { method: 'PUT' });

		const tab = await newTabRes.json();

		const wsUrl = tab.webSocketDebuggerUrl;

		if (!wsUrl) throw new Error('No CDP tab');



		const ws = new WebSocket(wsUrl);

		let id = 0;

		const pending = new Map();



		const send = (method, params = {}) =>

			new Promise((resolve, reject) => {

				const msgId = ++id;

				pending.set(msgId, { resolve, reject });

				ws.send(JSON.stringify({ id: msgId, method, params }));

			});



		const logs = [];

		ws.addEventListener('message', (ev) => {

			const msg = JSON.parse(ev.data.toString());

			if (msg.method === 'Runtime.consoleAPICalled') {

				logs.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));

			}

			if (msg.method === 'Runtime.exceptionThrown') {

				logs.push('EXCEPTION: ' + JSON.stringify(msg.params));

			}

			if (msg.id && pending.has(msg.id)) {

				const { resolve, reject } = pending.get(msg.id);

				pending.delete(msg.id);

				if (msg.error) reject(new Error(msg.error.message));

				else resolve(msg.result);

			}

		});



		await new Promise((r) => (ws.readyState === 1 ? r() : ws.addEventListener('open', r, { once: true })));



		await sleep(3000);



		await send('Page.enable');

		await send('Runtime.enable');

		await send('Log.enable');

		await send('Emulation.setDeviceMetricsOverride', {

			width: 1280,

			height: 900,

			deviceScaleFactor: 1,

			mobile: false,

		});



		let result = null;

		for (let attempt = 0; attempt < 40; attempt++) {

			await sleep(500);

			const evalResult = await send('Runtime.evaluate', {

				expression: `(() => {

					const viewers = [...document.querySelectorAll('[data-spin-viewer]')];

					const nade = viewers[0];

					const agentK = viewers[1];

					const nadeVideo = nade?.querySelector('video');

					const agentKVideo = agentK?.querySelector('video');

					const nadeReady = nadeVideo && nadeVideo.readyState >= 1 && nadeVideo.duration > 5;

					const agentKReady = agentKVideo && agentKVideo.readyState >= 1 && agentKVideo.duration > 5;

					const err = agentK?.classList.contains('merch-spin-viewer--error');

					return {

						ready: nadeReady && agentKReady,

						err,

						nadeDur: nadeVideo?.duration || 0,

						agentKDur: agentKVideo?.duration || 0,

						agentKMode: agentKVideo ? 'video' : (agentK?.querySelector('canvas') ? 'canvas' : 'unknown'),

						viewers: viewers.length,

					};

				})()`,

				returnByValue: true,

			});

			const status = evalResult?.result?.value ?? evalResult?.value ?? evalResult;

			if (attempt === 0) console.log('First eval:', JSON.stringify(evalResult));

			if (status?.ready) {

				result = status;

				break;

			}

			if (status?.err) {

				result = status;

				break;

			}

		}

		if (!result?.ready) {

			const diag = await send('Runtime.evaluate', {

				expression: `({ title: document.title, url: location.href, viewers: document.querySelectorAll('[data-spin-viewer]').length, errEls: document.querySelectorAll('.merch-spin-viewer--error').length, bodyClass: document.body.className })`,

				returnByValue: true,

			});

			console.log('CDP preload status:', JSON.stringify(result, null, 2));

			console.log('Page diag:', JSON.stringify(diag?.result?.value, null, 2));

			console.log('Console logs:', logs.slice(-10));

			throw new Error('viewers not ready after metadata wait');

		}



		const rectEval = await send('Runtime.evaluate', {

			expression: `(() => {

				const agentK = [...document.querySelectorAll('[data-spin-viewer]')][1];

				agentK.scrollIntoView({ block: 'center' });

				const r = agentK.getBoundingClientRect();

				return { left: r.left, top: r.top, width: r.width, height: r.height };

			})()`,

			returnByValue: true,

		});

		const rect = rectEval?.result?.value;

		const startX = rect.left + rect.width * 0.1;

		const endX = rect.left + rect.width * 0.9;

		const y = rect.top + rect.height / 2;



		const beforeShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });



		await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y, button: 'left', clickCount: 1 });

		for (let i = 1; i <= 24; i++) {

			const x = startX + (endX - startX) * (i / 24);

			await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' });

		}

		await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y, button: 'left', clickCount: 1 });



		const afterShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });



		const dragEval = await send('Runtime.evaluate', {

			expression: `(() => {

				const viewers = [...document.querySelectorAll('[data-spin-viewer]')];

				const nade = viewers[0];

				const agentK = viewers[1];

				const nadeVideo = nade?.querySelector('video');

				const agentKVideo = agentK?.querySelector('video');

				return {

					ariaNow: Number(agentK?.getAttribute('aria-valuenow') || 0),

					ariaMax: Number(agentK?.getAttribute('aria-valuemax') || 0),

					nadeDur: nadeVideo?.duration || 0,

					agentKDur: agentKVideo?.duration || 0,

					agentKTime: agentKVideo?.currentTime || 0,

					dragging: agentK?.classList.contains('is-dragging'),

				};

			})()`,

			returnByValue: true,

		});



		const dragResult = dragEval?.result?.value;

		const pixelsChanged = beforeShot?.data !== afterShot?.data;

		console.log('CDP test result:', JSON.stringify({ ...result, ...dragResult, pixelsChanged }, null, 2));



		await send('Page.navigate', { url: 'about:blank' });

		await sleep(300);



		const pass =

			result?.ready &&

			result?.agentKMode === 'video' &&

			dragResult &&

			dragResult.ariaNow > 100 &&

			dragResult.nadeDur > 5 &&

			dragResult.agentKDur > 5 &&

			pixelsChanged;



		console.log(pass ? '\nPASS: both video viewers load and respond to drag' : '\nFAIL: viewer test did not pass');

		process.exitCode = pass ? 0 : 1;

	} finally {

		proc.kill('SIGTERM');

	}

}



async function main() {

	const mp4 = await httpGet('http://127.0.0.1:5501/images/cs2-merch/agent-k-inferno-bookend-case-spin/agent-k-inferno-bookend-case-spin.mp4');

	const poster = await httpGet('http://127.0.0.1:5501/images/cs2-merch/agent-k-inferno-bookend-case-spin/poster.webp');

	const nadeMp4 = await httpGet('http://127.0.0.1:5501/images/cs2-merch/nade-plushie-spin/nade-plushie-spin.mp4');

	console.log(`Agent K mp4: ${mp4.status}, poster: ${poster.status}, nade mp4: ${nadeMp4.status}`);

	if (mp4.status !== 200 || poster.status !== 200 || nadeMp4.status !== 200) {

		throw new Error('spin assets not served');

	}



	await runCdpTest();

}



main().catch((e) => {

	console.error(e);

	process.exitCode = 1;

});


