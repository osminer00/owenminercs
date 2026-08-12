import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

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

function extractConstAssignment(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${constName} assignment should end`);
	return source.slice(start, end + 1);
}

function createMemoryStorage() {
	const store = new Map();
	return {
		getItem(key) {
			return store.has(key) ? store.get(key) : null;
		},
		setItem(key, value) {
			store.set(String(key), String(value));
		},
		removeItem(key) {
			store.delete(key);
		},
	};
}

function loadSocialDockTourHelpers(options = {}) {
	const localStorage = createMemoryStorage();
	const unlockedCalls = [];
	const alreadyUnlocked = new Set(options.alreadyUnlocked || []);

	class HTMLAnchorElement {
		constructor({ href = '', className = 'site-social-nav__link' } = {}) {
			this.href = href;
			this.className = className;
		}
		getAttribute(name) {
			if (name === 'href') return this.href;
			return null;
		}
		classList = {
			contains: (token) =>
				String(this.className)
					.split(/\s+/)
					.filter(Boolean)
					.includes(token),
		};
	}

	const windowObj = {
		owenminercsIsAchievementUnlocked(id) {
			return alreadyUnlocked.has(id);
		},
		owenminercsUnlockAchievement(id) {
			unlockedCalls.push(id);
			alreadyUnlocked.add(id);
		},
	};

	const sandbox = {
		localStorage,
		window: windowObj,
		HTMLAnchorElement,
		URL,
		Set,
		Array,
		JSON,
		Object,
		String,
		Boolean,
		console,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_TOUR_PROGRESS_KEY')}
		${extractConstAssignment(componentsSource, 'ACH_SOCIAL_DOCK_GRAND_TOUR')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_TOUR_SLOTS')}
		${extractFunction(componentsSource, 'readSocialDockTourVisited')}
		${extractFunction(componentsSource, 'writeSocialDockTourVisited')}
		${extractFunction(componentsSource, 'socialDockTourSlotFromHref')}
		${extractFunction(componentsSource, 'recordSocialDockTourClick')}
		this.__helpers = {
			SOCIAL_DOCK_TOUR_PROGRESS_KEY,
			ACH_SOCIAL_DOCK_GRAND_TOUR,
			SOCIAL_DOCK_TOUR_SLOTS,
			readSocialDockTourVisited,
			writeSocialDockTourVisited,
			socialDockTourSlotFromHref,
			recordSocialDockTourClick,
			HTMLAnchorElement,
		};
		`,
		sandbox
	);

	return {
		helpers: sandbox.__helpers,
		localStorage,
		unlockedCalls,
		makeAnchor(href, className) {
			return new HTMLAnchorElement({ href, className });
		},
	};
}

test('social dock tour maps profile hosts to stable slot ids', () => {
	const { helpers } = loadSocialDockTourHelpers();
	const cases = [
		['https://x.com/OwenMiner', 'x'],
		['https://twitter.com/OwenMiner', 'x'],
		['https://www.reddit.com/user/OwenMCS', 'reddit'],
		['https://old.reddit.com/user/OwenMCS', 'reddit'],
		['https://www.youtube.com/@OwenMinerCS', 'youtube'],
		['https://youtu.be/abc', 'youtube'],
		['https://www.twitch.tv/owenminercs', 'twitch'],
		['https://www.instagram.com/owenminercs/', 'instagram'],
		['https://www.facebook.com/profile.php?id=1', 'facebook'],
		['https://m.facebook.com/profile.php?id=1', 'facebook'],
		['https://www.tiktok.com/@owenminercs', 'tiktok'],
		['https://discord.gg/invite', 'discord'],
		['https://discord.com/invite/abc', 'discord'],
		['https://example.com/nope', null],
		['not a url', null],
		['', null],
	];

	for (const [href, expected] of cases) {
		assert.equal(
			helpers.socialDockTourSlotFromHref(href),
			expected,
			`${href} should map to ${expected}`
		);
	}
});

test('social dock grand tour unlocks only after every required slot is clicked', () => {
	const { helpers, localStorage, unlockedCalls, makeAnchor } = loadSocialDockTourHelpers();

	const hrefBySlot = {
		x: 'https://x.com/OwenMiner',
		reddit: 'https://www.reddit.com/user/OwenMCS',
		youtube: 'https://www.youtube.com/@OwenMinerCS',
		twitch: 'https://www.twitch.tv/owenminercs',
		instagram: 'https://www.instagram.com/owenminercs/',
		facebook: 'https://www.facebook.com/profile.php?id=1',
		tiktok: 'https://www.tiktok.com/@owenminercs',
		discord: 'https://discord.gg/invite',
	};

	helpers.recordSocialDockTourClick(makeAnchor(hrefBySlot.x));
	assert.equal(unlockedCalls.length, 0, 'one slot should not unlock');

	const afterOne = JSON.parse(localStorage.getItem(helpers.SOCIAL_DOCK_TOUR_PROGRESS_KEY));
	assert.deepEqual(Array.from(afterOne), ['x']);

	helpers.recordSocialDockTourClick(makeAnchor('https://example.com', 'site-social-nav__link'));
	helpers.recordSocialDockTourClick(makeAnchor(hrefBySlot.x, 'other-link'));
	helpers.recordSocialDockTourClick({ href: hrefBySlot.youtube });
	assert.deepEqual(
		Array.from(JSON.parse(localStorage.getItem(helpers.SOCIAL_DOCK_TOUR_PROGRESS_KEY))),
		['x'],
		'non-matching anchors must not advance progress'
	);

	for (const slot of helpers.SOCIAL_DOCK_TOUR_SLOTS.slice(1)) {
		helpers.recordSocialDockTourClick(makeAnchor(hrefBySlot[slot]));
	}

	assert.equal(unlockedCalls.length, 1);
	assert.equal(unlockedCalls[0], helpers.ACH_SOCIAL_DOCK_GRAND_TOUR);

	const stored = JSON.parse(localStorage.getItem(helpers.SOCIAL_DOCK_TOUR_PROGRESS_KEY));
	for (const slot of helpers.SOCIAL_DOCK_TOUR_SLOTS) {
		assert.ok(stored.includes(slot), `${slot} should be persisted`);
	}
});

test('social dock grand tour skips when already unlocked and recovers from corrupt storage', () => {
	const already = loadSocialDockTourHelpers({
		alreadyUnlocked: ['social-dock-grand-tour'],
	});
	already.helpers.recordSocialDockTourClick(
		already.makeAnchor('https://x.com/OwenMiner')
	);
	assert.equal(already.localStorage.getItem(already.helpers.SOCIAL_DOCK_TOUR_PROGRESS_KEY), null);
	assert.equal(already.unlockedCalls.length, 0);

	const corrupt = loadSocialDockTourHelpers();
	corrupt.localStorage.setItem(corrupt.helpers.SOCIAL_DOCK_TOUR_PROGRESS_KEY, '{not-json');
	assert.equal(corrupt.helpers.readSocialDockTourVisited().size, 0);

	corrupt.localStorage.setItem(
		corrupt.helpers.SOCIAL_DOCK_TOUR_PROGRESS_KEY,
		JSON.stringify(['x', 12, null, 'youtube'])
	);
	const visited = [...corrupt.helpers.readSocialDockTourVisited()];
	assert.deepEqual(visited.sort(), ['x', 'youtube'].sort());
});
