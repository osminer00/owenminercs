(function () {
	'use strict';

	if (window.__owenSiteFeedHoverInit) return;
	window.__owenSiteFeedHoverInit = true;

	const OFFSET_X = 18;
	const OFFSET_Y = 16;
	const VIEWPORT_PAD = 12;

	function clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
	}

	let tip = null;
	let activeCard = null;
	let rafId = 0;
	let pendingX = 0;
	let pendingY = 0;
	const boundCards = new WeakSet();

	function ensureTip() {
		if (tip) return tip;
		tip = document.createElement('div');
		tip.id = 'site-feed-preview';
		tip.className = 'site-feed-cursor-preview';
		tip.setAttribute('role', 'tooltip');
		tip.hidden = true;
		document.body.appendChild(tip);
		return tip;
	}

	function hideTip() {
		if (!tip) return;
		tip.hidden = true;
		tip.classList.remove('is-visible');
		tip.innerHTML = '';
		activeCard = null;
	}

	function positionAtPointer(clientX, clientY) {
		const rect = tip.getBoundingClientRect();
		const maxLeft = window.innerWidth - rect.width - VIEWPORT_PAD;
		const maxTop = window.innerHeight - rect.height - VIEWPORT_PAD;
		const left = clamp(clientX + OFFSET_X, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, maxLeft));
		const top = clamp(clientY + OFFSET_Y, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, maxTop));
		tip.style.left = `${left}px`;
		tip.style.top = `${top}px`;
	}

	function positionNearCard(card) {
		const cardRect = card.getBoundingClientRect();
		const rect = tip.getBoundingClientRect();
		const maxLeft = window.innerWidth - rect.width - VIEWPORT_PAD;
		const maxTop = window.innerHeight - rect.height - VIEWPORT_PAD;
		const left = clamp(cardRect.left + 12, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, maxLeft));
		const top = clamp(cardRect.bottom + 8, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, maxTop));
		tip.style.left = `${left}px`;
		tip.style.top = `${top}px`;
	}

	function fillTipFromCard(card) {
		const preview = card.querySelector('.site-feed-item__preview');
		if (!preview) return false;
		tip.innerHTML = '';
		if (preview instanceof HTMLTemplateElement) {
			tip.appendChild(preview.content.cloneNode(true));
		} else {
			tip.innerHTML = preview.innerHTML;
		}
		return tip.textContent.trim().length > 0;
	}

	function showTip(card, clientX, clientY) {
		ensureTip();
		if (!fillTipFromCard(card)) return;
		activeCard = card;
		tip.hidden = false;
		tip.classList.add('is-visible');
		if (typeof clientX === 'number' && typeof clientY === 'number') {
			positionAtPointer(clientX, clientY);
		} else {
			positionNearCard(card);
		}
	}

	function schedulePointerMove(clientX, clientY) {
		pendingX = clientX;
		pendingY = clientY;
		if (rafId) return;
		rafId = window.requestAnimationFrame(() => {
			rafId = 0;
			if (!activeCard || !tip || tip.hidden) return;
			positionAtPointer(pendingX, pendingY);
		});
	}

	function bindCard(card) {
		if (!(card instanceof Element) || boundCards.has(card)) return;
		boundCards.add(card);

		card.addEventListener('mouseenter', (event) => {
			showTip(card, event.clientX, event.clientY);
		});

		card.addEventListener('mousemove', (event) => {
			if (activeCard !== card) return;
			schedulePointerMove(event.clientX, event.clientY);
		});

		card.addEventListener('mouseleave', () => {
			if (activeCard === card) hideTip();
		});

		card.addEventListener('focus', () => {
			showTip(card);
		});

		card.addEventListener('blur', () => {
			if (activeCard === card) hideTip();
		});
	}

	function bindFeedCards(root) {
		const list = root || document.getElementById('site-feed-list');
		if (!list) return;
		list.querySelectorAll('.site-feed-item__card').forEach(bindCard);
	}

	window.__owenSiteFeedHoverBind = bindFeedCards;

	function initSiteFeedHover() {
		bindFeedCards();
		window.addEventListener(
			'scroll',
			() => {
				if (!activeCard || !tip || tip.hidden) return;
				if (document.activeElement === activeCard) {
					positionNearCard(activeCard);
				}
			},
			{ passive: true }
		);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initSiteFeedHover, { once: true });
	} else {
		initSiteFeedHover();
	}
})();
