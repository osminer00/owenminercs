/** Ko-fi overlay widget + draggable donate button (lazy-loaded from components.js). */
const KOFI_FLOAT_POS_KEY = 'owenminercs-kofi-floating-chat-pos';
const KOFI_FLOAT_DRAG_THRESHOLD_PX = 5;

function tryOpenKofiWidgetOverlayFromLink() {
	const host = document.querySelector('div[id^="kofi-widget-overlay-"]');
	if (!host) return false;
	const cssId = host.id;
	const iframeIds = ['kofi-wo-container' + cssId, 'kofi-wo-container-mobi' + cssId];
	for (let i = 0; i < iframeIds.length; i++) {
		const iframe = document.getElementById(iframeIds[i]);
		if (!iframe) continue;
		const rect = iframe.getBoundingClientRect();
		if (rect.width < 2 || rect.height < 2) continue;
		const doc = iframe.contentDocument;
		if (!doc) continue;
		const btn = doc.getElementById(cssId + '-donate-button');
		if (!btn) continue;
		if (btn.classList.contains('open')) return true;
		btn.click();
		return true;
	}
	for (let j = 0; j < iframeIds.length; j++) {
		const iframe2 = document.getElementById(iframeIds[j]);
		if (!iframe2) continue;
		const doc2 = iframe2.contentDocument;
		if (!doc2) continue;
		const btn2 = doc2.getElementById(cssId + '-donate-button');
		if (!btn2) continue;
		if (btn2.classList.contains('open')) return true;
		btn2.click();
		return true;
	}
	return false;
}

window.__owenKofiTryOpenOverlay = tryOpenKofiWidgetOverlayFromLink;

function clampKofiFloatingHostToViewport(host, left, top) {
	const margin = 2;
	const rect = host.getBoundingClientRect();
	const width = Math.max(1, Math.round(rect.width));
	const height = Math.max(1, Math.round(rect.height));
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const minLeft = margin;
	const minTop = margin;
	const maxLeft = Math.max(margin, vw - margin - width);
	const maxTop = Math.max(margin, vh - margin - height);
	return {
		left: Math.round(Math.min(maxLeft, Math.max(minLeft, left))),
		top: Math.round(Math.min(maxTop, Math.max(minTop, top))),
	};
}

function placeKofiFloatingHost(host, left, top) {
	const clamped = clampKofiFloatingHostToViewport(host, left, top);
	host.style.position = 'fixed';
	host.style.left = `${clamped.left}px`;
	host.style.top = `${clamped.top}px`;
	host.style.right = 'auto';
	host.style.bottom = 'auto';
	return clamped;
}

function applySavedKofiFloatingPosition(host) {
	if (!(host instanceof Element)) return;
	if (host.dataset.owenKofiPosApplied === '1') return;
	host.dataset.owenKofiPosApplied = '1';
	try {
		const raw = localStorage.getItem(KOFI_FLOAT_POS_KEY);
		if (!raw) return;
		const pos = JSON.parse(raw);
		if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') {
			localStorage.removeItem(KOFI_FLOAT_POS_KEY);
			return;
		}
		const clamped = placeKofiFloatingHost(host, pos.left, pos.top);
		host.dataset.owenKofiCustomized = '1';
		host.dataset.owenKofiLeft = String(clamped.left);
		host.dataset.owenKofiTop = String(clamped.top);
	} catch (_) {}
}

function persistKofiFloatingPosition(host) {
	if (!(host instanceof Element)) return;
	try {
		if (host.dataset.owenKofiCustomized !== '1') {
			localStorage.removeItem(KOFI_FLOAT_POS_KEY);
			return;
		}
		const left = parseFloat(host.style.left);
		const top = parseFloat(host.style.top);
		if (!Number.isFinite(left) || !Number.isFinite(top)) {
			localStorage.removeItem(KOFI_FLOAT_POS_KEY);
			return;
		}
		localStorage.setItem(
			KOFI_FLOAT_POS_KEY,
			JSON.stringify({
				left: Math.round(left),
				top: Math.round(top),
			}),
		);
	} catch (_) {}
}

function bindKofiFloatingDonateDragFromIframe(host, iframe) {
	if (!(host instanceof Element) || !(iframe instanceof HTMLIFrameElement)) return false;
	let doc;
	try {
		doc = iframe.contentDocument;
	} catch (_) {
		return false;
	}
	if (!doc) return false;
	const donateButton = doc.getElementById(host.id + '-donate-button');
	if (!(donateButton instanceof Element)) return false;
	if (donateButton.dataset.owenKofiDragBound === '1') return true;
	donateButton.dataset.owenKofiDragBound = '1';
	donateButton.style.cursor = 'grab';
	donateButton.style.touchAction = 'none';

	let dragging = false;
	let moved = false;
	let startPointerX = 0;
	let startPointerY = 0;
	let startLeft = 0;
	let startTop = 0;
	let suppressNextClick = false;

	const onPointerMove = (e) => {
		if (!dragging) return;
		const nextLeft = startLeft + (e.clientX - startPointerX);
		const nextTop = startTop + (e.clientY - startPointerY);
		const clamped = placeKofiFloatingHost(host, nextLeft, nextTop);
		host.dataset.owenKofiLeft = String(clamped.left);
		host.dataset.owenKofiTop = String(clamped.top);
		const dist = Math.hypot(e.clientX - startPointerX, e.clientY - startPointerY);
		if (dist >= KOFI_FLOAT_DRAG_THRESHOLD_PX) {
			moved = true;
		}
		e.preventDefault();
	};

	const finishDrag = () => {
		if (!dragging) return;
		dragging = false;
		donateButton.style.cursor = 'grab';
		if (moved) {
			host.dataset.owenKofiCustomized = '1';
			persistKofiFloatingPosition(host);
			suppressNextClick = true;
		}
	};

	donateButton.addEventListener(
		'pointerdown',
		(e) => {
			if (e.button !== 0) return;
			const hostRect = host.getBoundingClientRect();
			dragging = true;
			moved = false;
			startPointerX = e.clientX;
			startPointerY = e.clientY;
			startLeft = Math.round(hostRect.left);
			startTop = Math.round(hostRect.top);
			donateButton.style.cursor = 'grabbing';
			try {
				donateButton.setPointerCapture(e.pointerId);
			} catch (_) {}
			e.preventDefault();
		},
		true,
	);
	donateButton.addEventListener('pointermove', onPointerMove, true);
	donateButton.addEventListener(
		'pointerup',
		(e) => {
			try {
				donateButton.releasePointerCapture(e.pointerId);
			} catch (_) {}
			finishDrag();
		},
		true,
	);
	donateButton.addEventListener('pointercancel', finishDrag, true);
	donateButton.addEventListener(
		'click',
		(e) => {
			if (!suppressNextClick) return;
			suppressNextClick = false;
			e.preventDefault();
			e.stopPropagation();
		},
		true,
	);
	return true;
}

function bindKofiFloatingDonateDrag() {
	const host = document.querySelector('div[id^="kofi-widget-overlay-"]');
	if (!(host instanceof Element)) return false;
	applySavedKofiFloatingPosition(host);
	const iframeIds = ['kofi-wo-container' + host.id, 'kofi-wo-container-mobi' + host.id];
	let bound = false;
	for (let i = 0; i < iframeIds.length; i++) {
		const frame = document.getElementById(iframeIds[i]);
		if (!(frame instanceof HTMLIFrameElement)) continue;
		if (bindKofiFloatingDonateDragFromIframe(host, frame)) {
			bound = true;
		}
	}
	return bound;
}

function initKofiFloatingDonateDragBinding() {
	let tries = 0;
	const maxTries = 120;
	function runBindAttempt() {
		const bound = bindKofiFloatingDonateDrag();
		tries += 1;
		if (bound || tries >= maxTries) return;
		window.setTimeout(runBindAttempt, 250);
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', runBindAttempt, { once: true });
	} else {
		runBindAttempt();
	}
	window.addEventListener('resize', () => {
		const host = document.querySelector('div[id^="kofi-widget-overlay-"]');
		if (!(host instanceof Element)) return;
		if (host.dataset.owenKofiCustomized !== '1') return;
		const left = parseFloat(host.style.left);
		const top = parseFloat(host.style.top);
		if (!Number.isFinite(left) || !Number.isFinite(top)) return;
		placeKofiFloatingHost(host, left, top);
		persistKofiFloatingPosition(host);
	});
	window.addEventListener('pagehide', () => {
		const host = document.querySelector('div[id^="kofi-widget-overlay-"]');
		if (!(host instanceof Element)) return;
		persistKofiFloatingPosition(host);
	});
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'hidden') return;
		const host = document.querySelector('div[id^="kofi-widget-overlay-"]');
		if (!(host instanceof Element)) return;
		persistKofiFloatingPosition(host);
	});
}

function initKofiLinkOverlayBinding() {
	if (document.documentElement.dataset.kofiLinkOverlayBound) return;
	document.documentElement.dataset.kofiLinkOverlayBound = '1';
	document.addEventListener(
		'click',
		function (e) {
			const a = e.target.closest && e.target.closest('a[data-kofi-link]');
			if (!a) return;
			if (tryOpenKofiWidgetOverlayFromLink()) {
				e.preventDefault();
				e.stopPropagation();
			}
		},
		true,
	);
}

function loadKofiOverlayWidget() {
	if (document.querySelector('script[data-kofi-overlay]')) return;
	const el = document.createElement('script');
	el.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
	el.dataset.kofiOverlay = '1';
	el.onload = function () {
		if (typeof kofiWidgetOverlay === 'undefined') return;
		kofiWidgetOverlay.draw('owenminer', {
			type: 'floating-chat',
			'floating-chat.donateButton.text': 'Donate',
			'floating-chat.donateButton.background-color': '#323842',
			'floating-chat.donateButton.text-color': '#fff',
		});
		window.setTimeout(bindKofiFloatingDonateDrag, 0);
		window.setTimeout(bindKofiFloatingDonateDrag, 300);
	};
	document.body.appendChild(el);
}

initKofiLinkOverlayBinding();
initKofiFloatingDonateDragBinding();
loadKofiOverlayWidget();
