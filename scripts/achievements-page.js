(function () {
	'use strict';

	const GRAPHIC_LABELS = {
		'trophy-shelf': 'Score',
		'green-thumb': 'Grow',
		canopy: 'Max',
		'lexicon-pin': 'Word',
		'fidget-spinner': 'Spin',
		'social-dock-move': 'Move',
		'social-dock-grand-tour': 'Link',
		'main-nav-full-tour': 'Tour',
	};

	function ensureAchievementGraphic(card, hint, id) {
		let graphic = card.querySelector('[data-achievement-graphic]');
		if (graphic) return graphic;
		graphic = document.createElement('button');
		graphic.type = 'button';
		graphic.className = 'achievement-card__graphic';
		graphic.setAttribute('data-achievement-graphic', '');
		graphic.setAttribute('aria-label', 'Show achievement description');

		const mark = document.createElement('span');
		mark.className = 'achievement-card__graphic-mark';
		mark.textContent = GRAPHIC_LABELS[id] || 'Win';

		graphic.appendChild(mark);
		hint.insertAdjacentElement('beforebegin', graphic);
		return graphic;
	}

	function syncAchievementCards() {
		const cards = document.querySelectorAll('[data-achievement]');
		let unlocked = 0;
		cards.forEach((card) => {
			const id = card.getAttribute('data-achievement');
			if (!id) return;
			const isOn =
				typeof window.owenminercsIsAchievementUnlocked === 'function' &&
				window.owenminercsIsAchievementUnlocked(id);
			card.classList.toggle('achievement-card--unlocked', isOn);
			card.classList.toggle('achievement-card--locked', !isOn);
			const badge = card.querySelector('[data-achievement-badge]');
			if (badge) badge.textContent = isOn ? 'Unlocked' : 'Locked';
			const hint = card.querySelector('.achievement-card__hint');
			if (hint) {
				ensureAchievementGraphic(card, hint, id);
				hint.hidden = false;
			}
			if (isOn) unlocked += 1;
		});
		const total = cards.length;
		const el = document.querySelector('[data-achievements-progress]');
		if (el) {
			el.textContent = `${unlocked} / ${total} unlocked`;
		}
	}

	function init() {
		if (typeof window.owenminercsUnlockAchievement === 'function') {
			window.owenminercsUnlockAchievement('trophy-shelf');
		}
		syncAchievementCards();

		window.addEventListener('owenminercs-achievement-unlocked', syncAchievementCards);
		window.addEventListener('owenminercs-achievements-cleared', syncAchievementCards);

		const resetBtn = document.querySelector('[data-achievements-reset]');
		if (resetBtn) {
			resetBtn.addEventListener('click', () => {
				if (
					!window.confirm(
						'Clear all achievement progress in this browser? This cannot be undone.'
					)
				) {
					return;
				}
				if (typeof window.owenminercsClearAchievementProgress === 'function') {
					window.owenminercsClearAchievementProgress();
				}
				if (typeof window.owenminercsUnlockAchievement === 'function') {
					window.owenminercsUnlockAchievement('trophy-shelf');
				}
				syncAchievementCards();
			});
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
