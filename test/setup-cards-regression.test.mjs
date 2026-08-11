import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const setupCardsSource = readFileSync(new URL('../scripts/setup-cards.js', import.meta.url), 'utf8');

function createMemoryLocation() {
	return { href: 'https://owenminercs.com/The%20Setup/the-setup' };
}

function loadSetupCards(cards) {
	const location = createMemoryLocation();
	const listenersByCard = new Map();

	for (const card of cards) {
		listenersByCard.set(card, []);
		card.addEventListener = (type, handler) => {
			listenersByCard.get(card).push({ type, handler });
		};
	}

	const sandbox = {
		document: {
			querySelectorAll(selector) {
				assert.equal(selector, '.keep-card[data-href]');
				return cards;
			},
		},
		window: { location },
	};

	vm.createContext(sandbox);
	vm.runInContext(setupCardsSource, sandbox);
	return { location, listenersByCard };
}

function makeCard(href, options = {}) {
	const attrs = new Map();
	if (href != null) attrs.set('data-href', href);
	return {
		getAttribute(name) {
			return attrs.has(name) ? attrs.get(name) : null;
		},
		closestTargetIsAnchor: Boolean(options.closestTargetIsAnchor),
	};
}

test('setup keep-cards navigate on click unless the event target is already a link', () => {
	const card = makeCard('/PC/pc');
	const { location, listenersByCard } = loadSetupCards([card]);
	const click = listenersByCard.get(card).find((entry) => entry.type === 'click');
	assert.ok(click, 'click listener should bind');

	click.handler({
		target: {
			closest(selector) {
				assert.equal(selector, 'a');
				return null;
			},
		},
	});
	assert.equal(location.href, '/PC/pc');

	location.href = 'unchanged';
	click.handler({
		target: {
			closest() {
				return { tagName: 'A' };
			},
		},
	});
	assert.equal(location.href, 'unchanged');
});

test('setup keep-cards activate on Enter/Space and ignore cards without data-href', () => {
	const withHref = makeCard('/Keyboard/60he');
	const withoutHref = makeCard(null);
	const { location, listenersByCard } = loadSetupCards([withHref, withoutHref]);

	assert.equal(listenersByCard.get(withoutHref).length, 0);

	const keydown = listenersByCard.get(withHref).find((entry) => entry.type === 'keydown');
	assert.ok(keydown, 'keydown listener should bind');

	let prevented = 0;
	keydown.handler({
		key: 'Enter',
		target: {
			closest() {
				return null;
			},
		},
		preventDefault() {
			prevented += 1;
		},
	});
	assert.equal(location.href, '/Keyboard/60he');
	assert.equal(prevented, 1);

	location.href = 'stay';
	keydown.handler({
		key: ' ',
		target: {
			closest() {
				return { tagName: 'A' };
			},
		},
		preventDefault() {
			prevented += 1;
		},
	});
	assert.equal(location.href, 'stay');
	assert.equal(prevented, 1);

	keydown.handler({
		key: 'Tab',
		target: {
			closest() {
				return null;
			},
		},
		preventDefault() {
			prevented += 1;
		},
	});
	assert.equal(location.href, 'stay');
	assert.equal(prevented, 1);
});
