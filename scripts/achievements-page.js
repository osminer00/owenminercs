/**
 * Achievement list graphics: inline SVG icons (site-authored, no external assets).
 * Styling + motion live in Achievements/achievements.html (tile frame, sheen, tilt).
 */
(function () {
	'use strict';

	const NS = 'http://www.w3.org/2000/svg';

	function svgEl(name, attrs) {
		const n = document.createElementNS(NS, name);
		if (attrs) {
			for (const k of Object.keys(attrs)) {
				n.setAttribute(k, attrs[k]);
			}
		}
		return n;
	}

	function svgIcon(rootAttrs, children) {
		const svg = svgEl('svg', {
			viewBox: '0 0 48 48',
			width: '40',
			height: '40',
			'aria-hidden': 'true',
			role: 'presentation',
			...rootAttrs,
		});
		svg.style.display = 'block';
		for (let i = 0; i < children.length; i += 1) {
			const ch = children[i];
			if (ch) svg.appendChild(ch);
		}
		return svg;
	}

	/** First steps — pedestal, cup, spark */
	function iconTrophyShelf() {
		return svgIcon({}, [
			svgEl('path', {
				d: 'M10 40 h28 v3 H10 z',
				fill: 'currentColor',
				opacity: '0.32',
			}),
			svgEl('path', {
				d: 'M19 40 V33 M29 40 V33',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
				'stroke-linecap': 'round',
				opacity: '0.45',
			}),
			svgEl('path', {
				d: 'M18 33 h12 v3 H18 z',
				fill: 'currentColor',
				opacity: '0.55',
			}),
			svgEl('path', {
				d: 'M18 33 V22 Q18 12 24 10 Q30 12 30 22 V33',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
				'stroke-linejoin': 'round',
			}),
			svgEl('circle', {
				cx: '24',
				cy: '11',
				r: '3.5',
				fill: 'currentColor',
				opacity: '0.9',
			}),
		]);
	}

	/** Bookmark — ribbon + dog-ear fold */
	function iconLexiconPin() {
		return svgIcon({}, [
			svgEl('path', {
				d: 'M12 8 h18 l6 6 v22 l-12 10 -12-10 V8 Z',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
				'stroke-linejoin': 'round',
			}),
			svgEl('path', {
				d: 'M30 8 v6 h6',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '1.75',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round',
				opacity: '0.5',
			}),
			svgEl('path', {
				d: 'M16 20 h10',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '1.5',
				'stroke-linecap': 'round',
				opacity: '0.32',
			}),
		]);
	}

	/** Classic tri-lobe fidget spinner (top view) */
	function iconFidgetSpinner() {
		return svgIcon({}, [
			svgEl('circle', {
				cx: '24',
				cy: '24',
				r: '5',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
			}),
			svgEl('circle', {
				cx: '24',
				cy: '11',
				r: '7',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
			}),
			svgEl('circle', {
				cx: '14.5',
				cy: '33',
				r: '7',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
			}),
			svgEl('circle', {
				cx: '33.5',
				cy: '33',
				r: '7',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
			}),
		]);
	}

	/** Move / reposition */
	function iconSocialDockMove() {
		return svgIcon({}, [
			svgEl('circle', {
				cx: '24',
				cy: '24',
				r: '3',
				fill: 'currentColor',
				opacity: '0.85',
			}),
			svgEl('path', {
				d:
					'M24 10 v5 M24 33 v5 M10 24 h5 M33 24 h5 M14 14 l3.5 3.5 M30.5 30.5 L34 34 M34 14 l-3.5 3.5 M14 34 l3.5-3.5',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
				'stroke-linecap': 'round',
			}),
		]);
	}

	/** Card + pushpin */
	function iconSocialCardPinAndMove() {
		return svgIcon({}, [
			svgEl('rect', {
				x: '8',
				y: '16',
				width: '20',
				height: '24',
				rx: '3',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
			}),
			svgEl('path', {
				d: 'M12 22 h10 M12 28 h8',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '1.5',
				'stroke-linecap': 'round',
				opacity: '0.4',
			}),
			svgEl('circle', {
				cx: '34',
				cy: '14',
				r: '4',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
			}),
			svgEl('path', {
				d: 'M34 18 L30 30',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
				'stroke-linecap': 'round',
			}),
		]);
	}

	/** Orbit of nodes — “every stop on the tour” */
	function iconSocialDockGrandTour() {
		return svgIcon({}, [
			svgEl('circle', {
				cx: '24',
				cy: '24',
				r: '14',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '1',
				opacity: '0.25',
			}),
			svgEl('path', {
				d: 'M16 16 L32 32 M32 16 L16 32',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '1',
				opacity: '0.2',
			}),
			svgEl('circle', { cx: '24', cy: '10', r: '2.5', fill: 'currentColor' }),
			svgEl('circle', { cx: '34', cy: '18', r: '2.5', fill: 'currentColor', opacity: '0.75' }),
			svgEl('circle', { cx: '34', cy: '30', r: '2.5', fill: 'currentColor', opacity: '0.75' }),
			svgEl('circle', { cx: '24', cy: '38', r: '2.5', fill: 'currentColor', opacity: '0.75' }),
			svgEl('circle', { cx: '14', cy: '30', r: '2.5', fill: 'currentColor', opacity: '0.75' }),
			svgEl('circle', { cx: '14', cy: '18', r: '2.5', fill: 'currentColor', opacity: '0.75' }),
		]);
	}

	/** Full grid — “visited everything” */
	function iconMainNavFullTour() {
		const g = svgEl('g', { opacity: '0.9' });
		for (let row = 0; row < 3; row += 1) {
			for (let col = 0; col < 3; col += 1) {
				const o = row + col === 0 ? '1' : '0.55';
				g.appendChild(
					svgEl('rect', {
						x: String(12 + col * 10),
						y: String(12 + row * 10),
						width: '6',
						height: '6',
						rx: '1',
						fill: 'currentColor',
						opacity: o,
					})
				);
			}
		}
		return svgIcon({}, [g]);
	}

	/** Dust II bug write-up — arrow meets critter */
	function iconBugEater() {
		return svgIcon({}, [
			svgEl('path', {
				d: 'M6 24 L22 24 M22 24 L16 18 M22 24 L16 30',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2.25',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round',
			}),
			svgEl('ellipse', {
				cx: '36',
				cy: '24',
				rx: '6',
				ry: '4',
				fill: 'currentColor',
			}),
			svgEl('path', {
				d: 'M32 21 L29 15 M40 21 L43 15',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '1.5',
				'stroke-linecap': 'round',
			}),
		]);
	}

	function iconFallback() {
		return svgIcon({}, [
			svgEl('path', {
				d: 'M24 8 l2.5 7.5 h8 l-6.5 5 2.5 7.5-6.5-4-6.5 4 2.5-7.5-6.5-5 h8z',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
				'stroke-linejoin': 'round',
			}),
		]);
	}

	const ICON_BUILDERS = {
		'trophy-shelf': iconTrophyShelf,
		'lexicon-pin': iconLexiconPin,
		'fidget-spinner': iconFidgetSpinner,
		'social-dock-move': iconSocialDockMove,
		'social-card-pin-and-move': iconSocialCardPinAndMove,
		'social-dock-grand-tour': iconSocialDockGrandTour,
		'main-nav-full-tour': iconMainNavFullTour,
		'bug-eater': iconBugEater,
	};

	function createAchievementIconSvg(id) {
		const fn = ICON_BUILDERS[id];
		try {
			return (fn || iconFallback)();
		} catch (_) {
			return iconFallback();
		}
	}

	function ensureAchievementGraphic(card, hint, id) {
		let graphic = card.querySelector('[data-achievement-graphic]');
		if (graphic) return graphic;
		graphic = document.createElement('button');
		graphic.type = 'button';
		graphic.className = 'achievement-card__graphic';
		graphic.setAttribute('data-achievement-graphic', '');
		graphic.setAttribute('aria-label', 'Show achievement description');

		const mark = document.createElement('span');
		mark.className = 'achievement-card__graphic-mark achievement-card__graphic-mark--tile';
		if (id) {
			mark.classList.add('achievement-card__graphic-mark--' + id.replace(/[^a-z0-9-]/gi, ''));
		}
		mark.appendChild(createAchievementIconSvg(id));

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
