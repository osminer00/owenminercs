(function () {
	const API_URL = '/api/steam-cs2-inventory?profile=putaWinfrontofsteamlilbro&limit=60&expensiveMin=90&featured=1';
	const OFFLINE_PRACTICE_STEPS = [
		'map de_mirage',
		'sv_cheats 1',
		'mp_freezetime 0; mp_roundtime_defuse 60; mp_buy_anywhere 1; mp_buytime 9999',
		'bot_kick',
	];

	function escapeHtml(value) {
		return String(value || '')
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	function createSpinState(card) {
		return {
			card,
			view: card.querySelector('[data-skin-spin-view]'),
			yaw: -14,
			pitch: 8,
			activePointer: null,
			lastX: 0,
			lastY: 0,
		};
	}

	function updateSpinTransform(state) {
		state.view.style.transform = `rotateX(${state.pitch}deg) rotateY(${state.yaw}deg)`;
	}

	function bindSpinCard(card) {
		const state = createSpinState(card);
		if (!state.view) return;
		updateSpinTransform(state);

		card.addEventListener('pointerdown', (event) => {
			const target = event.target;
			if (target instanceof Element && target.closest('a,button')) return;
			state.activePointer = event.pointerId;
			state.lastX = event.clientX;
			state.lastY = event.clientY;
			card.setPointerCapture(event.pointerId);
			card.classList.add('cs2-skin-card--spinning');
		});

		card.addEventListener('pointermove', (event) => {
			if (state.activePointer !== event.pointerId) return;
			const dx = event.clientX - state.lastX;
			const dy = event.clientY - state.lastY;
			state.lastX = event.clientX;
			state.lastY = event.clientY;
			state.yaw += dx * 0.35;
			state.pitch = Math.max(-35, Math.min(35, state.pitch - dy * 0.25));
			updateSpinTransform(state);
		});

		function stopPointer(event) {
			if (state.activePointer !== event.pointerId) return;
			state.activePointer = null;
			card.classList.remove('cs2-skin-card--spinning');
			try {
				card.releasePointerCapture(event.pointerId);
			} catch (_) {}
		}

		card.addEventListener('pointerup', stopPointer);
		card.addEventListener('pointercancel', stopPointer);
	}

	function buildOfflineCommand(item) {
		const lines = [...OFFLINE_PRACTICE_STEPS];
		const label = item.marketName || item.name || 'skin';
		lines.push(`echo Inspect this skin in CS2: ${label}`);
		if (item.inspectLink) {
			lines.push(`echo ${item.inspectLink}`);
		}
		return lines.join('\n');
	}

	function formatUsd(item) {
		const amount = item?.pricing?.lowestPriceUsd ?? item?.pricing?.medianPriceUsd ?? null;
		if (!Number.isFinite(amount)) return 'N/A';
		return `$${amount.toFixed(2)}`;
	}

	function makeCard(item) {
		const icon = item.iconUrl || '../images/coming-soon-card.svg';
		const rarity = item.rarity || 'Unspecified';
		const exterior = item.exterior || 'Unknown';
		const weapon = item.weapon || 'CS2 Item';
		const collection = item.collection || 'No collection';
		const inspectHref = item.inspectLink || '';
		const inspectDisabled = inspectHref ? '' : 'aria-disabled="true"';
		const price = formatUsd(item);

		return `<article class="cs2-skin-card keep-card">
			<div class="cs2-skin-card__visual" data-skin-spin-card>
				<div class="cs2-skin-card__spin-shell" data-skin-spin-view>
					<img class="cs2-skin-card__image" src="${escapeHtml(icon)}" alt="${escapeHtml(item.marketName || item.name || 'CS2 skin')}" loading="lazy" decoding="async" />
				</div>
			</div>
			<div class="cs2-skin-card__body">
				<h3 class="cs2-skin-card__title">${escapeHtml(item.marketName || item.name || 'Unknown item')}</h3>
				<p class="cs2-skin-card__meta">
					<span>${escapeHtml(weapon)}</span>
					<span>•</span>
					<span>${escapeHtml(exterior)}</span>
				</p>
				<p class="cs2-skin-card__meta">
					<span>${escapeHtml(rarity)}</span>
					<span>•</span>
					<span>${escapeHtml(collection)}</span>
				</p>
				<p class="cs2-skin-card__price">${escapeHtml(price)}</p>
				<div class="cs2-skin-card__actions">
					<a class="cs2-skin-card__action" href="${escapeHtml(inspectHref || '#')}" ${inspectDisabled}>Inspect in game</a>
					<button class="cs2-skin-card__action" type="button" data-copy-offline="${escapeHtml(
						buildOfflineCommand(item)
					)}">Copy offline inspect setup</button>
				</div>
			</div>
		</article>`;
	}

	function attachCopyButtons(scope) {
		scope.querySelectorAll('[data-copy-offline]').forEach((button) => {
			button.addEventListener('click', async function () {
				const content = this.getAttribute('data-copy-offline') || '';
				try {
					await navigator.clipboard.writeText(content);
					this.textContent = 'Copied';
					window.setTimeout(() => {
						this.textContent = 'Copy offline inspect setup';
					}, 1600);
				} catch (_) {
					this.textContent = 'Copy failed';
					window.setTimeout(() => {
						this.textContent = 'Copy offline inspect setup';
					}, 1600);
				}
			});
		});
	}

	function renderCaseStats(node, caseStats) {
		const total = Number(caseStats?.totalCases || 0);
		const byName = caseStats?.byName || {};
		const top = Object.entries(byName)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 6);
		const pills = top
			.map(([name, count]) => `<span class="cs2-case-pill">${escapeHtml(name)} x${Number(count)}</span>`)
			.join('');
		node.innerHTML = `<p><strong>Total cases/capsules:</strong> ${total}</p><div class="cs2-case-pills">${pills || '<span class="cs2-case-pill">No cases found</span>'}</div>`;
	}

	async function load() {
		const root = document.getElementById('cs2-skins-root');
		const status = document.getElementById('cs2-skins-status');
		const caseStatsNode = document.getElementById('cs2-case-stats');
		if (!root || !status || !caseStatsNode) return;

		try {
			const response = await fetch(API_URL, { headers: { accept: 'application/json' } });
			const payload = await response.json();
			if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Inventory request failed');
			const items = Array.isArray(payload.items) ? payload.items : [];
			root.innerHTML = items.map(makeCard).join('');
			status.textContent = `Showing ${items.length} expensive skins from public inventory`;
			renderCaseStats(caseStatsNode, payload.caseStats);
			root.querySelectorAll('[data-skin-spin-card]').forEach(bindSpinCard);
			attachCopyButtons(root);
		} catch (error) {
			status.textContent = 'Could not load skins right now.';
			root.innerHTML = `<p class="cs2-skins-error">${escapeHtml(String(error.message || error))}</p>`;
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', load, { once: true });
	} else {
		load();
	}
})();
