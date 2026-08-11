import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const pageSource = readFileSync(new URL('../scripts/achievements-page.js', import.meta.url), 'utf8');

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${functionName} should have parameters`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = paramsStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '(') parenDepth += 1;
		if (char === ')') {
			parenDepth -= 1;
			if (parenDepth === 0) {
				paramsEnd = i;
				break;
			}
		}
	}
	assert.notEqual(paramsEnd, -1, `${functionName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function extractObjectLiteralAssignment(source, constName) {
	const start = source.indexOf(`const ${constName} = {`);
	assert.notEqual(start, -1, `${constName} should exist`);
	const braceStart = source.indexOf('{', start);
	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				const end = source.indexOf(';', i);
				assert.notEqual(end, -1, `${constName} assignment should end`);
				return source.slice(start, end + 1);
			}
		}
	}
	assert.fail(`${constName} object should close`);
}

function createElement(tagName) {
	const attrs = new Map();
	const children = [];
	const classSet = new Set();
	const el = {
		tagName: String(tagName).toUpperCase(),
		children,
		hidden: false,
		textContent: '',
		className: '',
		type: '',
		classList: {
			add(name) {
				classSet.add(name);
				el.className = [...classSet].join(' ');
			},
			remove(name) {
				classSet.delete(name);
				el.className = [...classSet].join(' ');
			},
			toggle(name, force) {
				if (force === true) classSet.add(name);
				else if (force === false) classSet.delete(name);
				else if (classSet.has(name)) classSet.delete(name);
				else classSet.add(name);
				el.className = [...classSet].join(' ');
				return classSet.has(name);
			},
			contains(name) {
				return classSet.has(name);
			},
		},
		setAttribute(name, value) {
			attrs.set(name, String(value));
		},
		getAttribute(name) {
			return attrs.has(name) ? attrs.get(name) : null;
		},
		querySelector(selector) {
			if (selector === '[data-achievement-graphic]') {
				return children.find((child) => child.getAttribute('data-achievement-graphic') !== null) || null;
			}
			if (selector === '[data-achievement-badge]') {
				return children.find((child) => child.getAttribute('data-achievement-badge') !== null) || null;
			}
			if (selector === '.achievement-card__hint') {
				return children.find((child) => child.classList.contains('achievement-card__hint')) || null;
			}
			return null;
		},
		appendChild(child) {
			children.push(child);
			return child;
		},
		insertAdjacentElement(position, node) {
			if (position !== 'beforebegin') {
				throw new Error(`unsupported position ${position}`);
			}
			const parent = el.__parent;
			assert.ok(parent, 'parent required for insertAdjacentElement');
			const idx = parent.children.indexOf(el);
			assert.ok(idx >= 0, 'element must be in parent children');
			parent.children.splice(idx, 0, node);
			node.__parent = parent;
			return node;
		},
	};
	return el;
}

function loadAchievementsPageHelpers(options = {}) {
	const unlocked = new Set(options.unlocked || []);
	const cards = options.cards || [];
	const progressEl = options.progressEl || null;

	const documentObj = {
		querySelectorAll(selector) {
			if (selector === '[data-achievement]') return cards;
			return [];
		},
		querySelector(selector) {
			if (selector === '[data-achievements-progress]') return progressEl;
			return null;
		},
		createElement(tagName) {
			return createElement(tagName);
		},
	};

	const sandbox = {
		document: documentObj,
		window: {
			owenminercsIsAchievementUnlocked(id) {
				return unlocked.has(id);
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractObjectLiteralAssignment(pageSource, 'GRAPHIC_LABELS')}
		${extractFunction(pageSource, 'ensureAchievementGraphic')}
		${extractFunction(pageSource, 'syncAchievementCards')}
		this.__helpers = {
			GRAPHIC_LABELS,
			ensureAchievementGraphic,
			syncAchievementCards,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('achievement graphic labels stay mapped for known achievement ids', () => {
	const { GRAPHIC_LABELS } = loadAchievementsPageHelpers();
	assert.equal(GRAPHIC_LABELS['trophy-shelf'], 'Score');
	assert.equal(GRAPHIC_LABELS['social-card-pin-and-move'], 'Hand');
	assert.equal(GRAPHIC_LABELS['social-dock-grand-tour'], 'Link');
	assert.equal(GRAPHIC_LABELS['main-nav-full-tour'], 'Tour');
	assert.equal(GRAPHIC_LABELS['lexicon-pin'], 'Mark');
});

test('ensureAchievementGraphic inserts a labeled button once and reuses it', () => {
	const { ensureAchievementGraphic } = loadAchievementsPageHelpers();
	const card = createElement('article');
	const hint = createElement('p');
	hint.classList.add('achievement-card__hint');
	card.appendChild(hint);
	hint.__parent = card;

	const first = ensureAchievementGraphic(card, hint, 'social-card-pin-and-move');
	assert.equal(first.tagName, 'BUTTON');
	assert.equal(first.type, 'button');
	assert.equal(first.getAttribute('data-achievement-graphic'), '');
	assert.equal(first.getAttribute('aria-label'), 'Show achievement description');
	assert.equal(first.children[0].textContent, 'Hand');
	assert.equal(card.children[0], first);
	assert.equal(card.children[1], hint);

	const second = ensureAchievementGraphic(card, hint, 'social-card-pin-and-move');
	assert.equal(second, first);
	assert.equal(card.children.length, 2);

	const unknown = createElement('article');
	const unknownHint = createElement('p');
	unknownHint.classList.add('achievement-card__hint');
	unknown.appendChild(unknownHint);
	unknownHint.__parent = unknown;
	const fallback = ensureAchievementGraphic(unknown, unknownHint, 'brand-new-id');
	assert.equal(fallback.children[0].textContent, 'Win');
});

test('syncAchievementCards toggles lock state, badge copy, and progress totals', () => {
	const lockedCard = createElement('article');
	lockedCard.setAttribute('data-achievement', 'lexicon-pin');
	const lockedBadge = createElement('span');
	lockedBadge.setAttribute('data-achievement-badge', '');
	const lockedHint = createElement('p');
	lockedHint.classList.add('achievement-card__hint');
	lockedHint.hidden = true;
	lockedCard.appendChild(lockedBadge);
	lockedCard.appendChild(lockedHint);
	lockedHint.__parent = lockedCard;

	const unlockedCard = createElement('article');
	unlockedCard.setAttribute('data-achievement', 'trophy-shelf');
	const unlockedBadge = createElement('span');
	unlockedBadge.setAttribute('data-achievement-badge', '');
	const unlockedHint = createElement('p');
	unlockedHint.classList.add('achievement-card__hint');
	unlockedCard.appendChild(unlockedBadge);
	unlockedCard.appendChild(unlockedHint);
	unlockedHint.__parent = unlockedCard;

	const progressEl = createElement('div');
	const { syncAchievementCards } = loadAchievementsPageHelpers({
		unlocked: ['trophy-shelf'],
		cards: [lockedCard, unlockedCard],
		progressEl,
	});

	syncAchievementCards();

	assert.equal(lockedCard.classList.contains('achievement-card--locked'), true);
	assert.equal(lockedCard.classList.contains('achievement-card--unlocked'), false);
	assert.equal(lockedBadge.textContent, 'Locked');
	assert.equal(lockedHint.hidden, false);
	assert.ok(lockedCard.querySelector('[data-achievement-graphic]'));

	assert.equal(unlockedCard.classList.contains('achievement-card--unlocked'), true);
	assert.equal(unlockedCard.classList.contains('achievement-card--locked'), false);
	assert.equal(unlockedBadge.textContent, 'Unlocked');
	assert.equal(progressEl.textContent, '1 / 2 unlocked');
});
