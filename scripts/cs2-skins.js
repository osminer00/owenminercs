(function () {
	const grid = document.getElementById('cs2SkinsGrid');
	const caseStatsEl = document.getElementById('cs2SkinsCaseStats');
	const errorEl = document.getElementById('cs2SkinsError');
	const statusEl = document.getElementById('cs2SkinsStatus');
	if (!grid) return;

	const API = '/api/steam-cs2-inventory?featured=1&limit=48';

	function formatUsd(value) {
		if (value == null || !Number.isFinite(value)) return null;
		return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
	}

	function bindSpinCard(card) {
		const visual = card.querySelector('.cs2-skin-card__visual');
		const shell = card.querySelector('.cs2-skin-card__spin-shell');
		if (!visual || !shell) return;

		let dragging = false;
		let startX = 0;
		let rotationY = 0;
		let velocity = 0;
		let raf = 0;

		const tick = () => {
			if (!dragging) {
				velocity *= 0.92;
				if (Math.abs(velocity) < 0.05) {
					raf = 0;
					card.classList.remove('cs2-skin-card--spinning');
					return;
				}
				rotationY += velocity;
				shell.style.transform = `rotateY(${rotationY}deg)`;
				raf = requestAnimationFrame(tick);
			}
		};

		const onPointerDown = (event) => {
			dragging = true;
			card.classList.add('cs2-skin-card--spinning');
			startX = event.clientX;
			velocity = 0;
			visual.setPointerCapture(event.pointerId);
		};

		const onPointerMove = (event) => {
			if (!dragging) return;
			const delta = event.clientX - startX;
			startX = event.clientX;
			rotationY += delta * 0.6;
			velocity = delta * 0.35;
			shell.style.transform = `rotateY(${rotationY}deg)`;
		};

		const onPointerUp = (event) => {
			if (!dragging) return;
			dragging = false;
			try {
				visual.releasePointerCapture(event.pointerId);
			} catch (_) {
				/* ignore */
			}
			if (!raf) raf = requestAnimationFrame(tick);
		};

		visual.addEventListener('pointerdown', onPointerDown);
		visual.addEventListener('pointermove', onPointerMove);
		visual.addEventListener('pointerup', onPointerUp);
		visual.addEventListener('pointercancel', onPointerUp);
	}

	function renderCaseStats(caseStats) {
		if (!caseStatsEl || !caseStats) return;
		const names = Object.entries(caseStats.byName || {}).sort((a, b) => b[1] - a[1]);
		caseStatsEl.hidden = false;
		caseStatsEl.innerHTML = `
			<p><strong>Cases &amp; capsules in inventory:</strong> ${caseStats.totalCases || 0}</p>
			<div class="cs2-case-pills" aria-label="Case breakdown">
				${names
					.slice(0, 12)
					.map(
						([name, count]) =>
							`<span class="cs2-case-pill">${count}× ${name.replace(/</g, '&lt;')}</span>`,
					)
					.join('')}
			</div>`;
	}

	function renderItem(item) {
		const price =
			formatUsd(item?.pricing?.lowestPriceUsd) ||
			formatUsd(item?.pricing?.medianPriceUsd) ||
			item?.pricing?.lowestPrice ||
			'';
		const meta = [item.exterior, item.rarity].filter(Boolean).join(' · ');
		const card = document.createElement('article');
		card.className = 'cs2-skin-card';
		card.innerHTML = `
			<div class="cs2-skin-card__visual" title="Drag to spin">
				<div class="cs2-skin-card__spin-shell">
					<img class="cs2-skin-card__image" src="${item.iconUrl || ''}" alt="${(item.marketName || item.name || 'CS2 skin').replace(/"/g, '&quot;')}" loading="lazy" decoding="async" />
				</div>
			</div>
			<div class="cs2-skin-card__body">
				<h3 class="cs2-skin-card__title">${item.marketName || item.name || 'Unknown item'}</h3>
				${meta ? `<p class="cs2-skin-card__meta">${meta}</p>` : ''}
				${price ? `<p class="cs2-skin-card__price">${price}</p>` : ''}
				<div class="cs2-skin-card__actions">
					${
						item.inspectLink
							? `<a class="cs2-skin-card__action" href="${item.inspectLink}" target="_blank" rel="noopener noreferrer">Inspect in game</a>`
							: `<span class="cs2-skin-card__action" aria-disabled="true">No inspect link</span>`
					}
				</div>
			</div>`;
		bindSpinCard(card);
		return card;
	}

	async function loadInventory() {
		try {
			if (statusEl) statusEl.textContent = 'Loading Steam inventory…';
			const response = await fetch(API);
			const payload = await response.json();
			if (!payload?.ok) throw new Error(payload?.detail || payload?.error || 'Inventory request failed');

			renderCaseStats(payload.caseStats);
			const items = Array.isArray(payload.items) ? payload.items : [];
			grid.replaceChildren();
			if (!items.length) {
				grid.innerHTML = '<p>No featured skins returned. Inventory may be private or empty.</p>';
			} else {
				for (const item of items) grid.appendChild(renderItem(item));
			}
			if (statusEl) {
				statusEl.textContent = `Showing ${items.length} featured skin${items.length === 1 ? '' : 's'} from Steam (prices are estimates).`;
			}
			if (errorEl) errorEl.hidden = true;
		} catch (error) {
			if (errorEl) {
				errorEl.hidden = false;
				errorEl.textContent = `Could not load live inventory: ${error.message}. The Photoshop showcase above is still available.`;
			}
			if (statusEl) statusEl.textContent = '';
		}
	}

	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		if (statusEl) {
			statusEl.textContent =
				'Live inventory cards skip spin interaction when reduced motion is enabled.';
		}
	}

	loadInventory();
})();
