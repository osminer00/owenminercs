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
		_dump() {
			return Object.fromEntries(store.entries());
		},
	};
}

function loadAchievementHelpers(seed = {}) {
	const localStorage = createMemoryStorage();
	for (const [key, value] of Object.entries(seed)) {
		localStorage.setItem(key, value);
	}

	const events = [];
	const windowObj = {
		dispatchEvent(event) {
			events.push(event);
			return true;
		},
	};

	const sandbox = {
		localStorage,
		window: windowObj,
		CustomEvent: class CustomEvent {
			constructor(type, init = {}) {
				this.type = type;
				this.detail = init.detail;
			}
		},
		Event: class Event {
			constructor(type) {
				this.type = type;
			}
		},
		Set,
		Array,
		JSON,
		URL,
		Object,
		String,
		Boolean,
		console,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		const ACHIEVEMENT_STORAGE_KEY = 'owenminercs-achievements-v1';
		const SOCIAL_DOCK_TOUR_PROGRESS_KEY = 'owenminercs-social-dock-tour-v1';
		const MAIN_NAV_TOUR_PROGRESS_KEY = 'owenminercs-main-nav-tour-v1';
		${extractFunction(componentsSource, 'readUnlockedAchievementIds')}
		${extractFunction(componentsSource, 'writeUnlockedAchievementIds')}
		${extractFunction(componentsSource, 'owenminercsUnlockAchievement')}
		${extractFunction(componentsSource, 'owenminercsIsAchievementUnlocked')}
		${extractFunction(componentsSource, 'owenminercsClearAchievementProgress')}
		${extractFunction(componentsSource, 'socialDockTourSlotFromHref')}
		this.__helpers = {
			ACHIEVEMENT_STORAGE_KEY,
			SOCIAL_DOCK_TOUR_PROGRESS_KEY,
			MAIN_NAV_TOUR_PROGRESS_KEY,
			readUnlockedAchievementIds,
			writeUnlockedAchievementIds,
			owenminercsUnlockAchievement,
			owenminercsIsAchievementUnlocked,
			owenminercsClearAchievementProgress,
			socialDockTourSlotFromHref,
		};
		`,
		sandbox
	);

	return {
		helpers: sandbox.__helpers,
		localStorage,
		events,
	};
}

test('achievement unlock persists trimmed ids and is idempotent', () => {
	const { helpers, localStorage, events } = loadAchievementHelpers();

	assert.equal(helpers.owenminercsUnlockAchievement('  lexicon-pin  '), true);
	assert.equal(helpers.owenminercsIsAchievementUnlocked('lexicon-pin'), true);
	assert.equal(helpers.owenminercsUnlockAchievement('lexicon-pin'), false);
	assert.equal(helpers.owenminercsUnlockAchievement(''), false);
	assert.equal(helpers.owenminercsUnlockAchievement(null), false);
	assert.equal(helpers.owenminercsIsAchievementUnlocked(''), false);

	const stored = JSON.parse(localStorage.getItem(helpers.ACHIEVEMENT_STORAGE_KEY));
	assert.deepEqual(Array.from(stored), ['lexicon-pin']);
	assert.equal(events.length, 1);
	assert.equal(events[0].type, 'owenminercs-achievement-unlocked');
	assert.equal(events[0].detail.id, 'lexicon-pin');
});

test('achievement reader ignores corrupt storage and non-string entries', () => {
	const { helpers } = loadAchievementHelpers({
		'owenminercs-achievements-v1': '{"not":"an-array"}',
	});
	assert.equal(helpers.owenminercsIsAchievementUnlocked('lexicon-pin'), false);

	const { helpers: helpers2 } = loadAchievementHelpers({
		'owenminercs-achievements-v1': '["ok", 12, null, "keep-me"]',
	});
	assert.equal(helpers2.owenminercsIsAchievementUnlocked('ok'), true);
	assert.equal(helpers2.owenminercsIsAchievementUnlocked('keep-me'), true);
	assert.equal(helpers2.owenminercsIsAchievementUnlocked('12'), false);
});

test('clearing achievements removes all related localStorage keys and emits cleared event', () => {
	const { helpers, localStorage, events } = loadAchievementHelpers({
		'owenminercs-achievements-v1': '["trophy-shelf"]',
		'owenminercs-social-dock-tour-v1': '["x","twitch"]',
		'owenminercs-main-nav-tour-v1': '["Home"]',
	});

	helpers.owenminercsClearAchievementProgress();
	assert.equal(localStorage.getItem(helpers.ACHIEVEMENT_STORAGE_KEY), null);
	assert.equal(localStorage.getItem(helpers.SOCIAL_DOCK_TOUR_PROGRESS_KEY), null);
	assert.equal(localStorage.getItem(helpers.MAIN_NAV_TOUR_PROGRESS_KEY), null);
	assert.equal(helpers.owenminercsIsAchievementUnlocked('trophy-shelf'), false);
	assert.ok(events.some((event) => event.type === 'owenminercs-achievements-cleared'));
});

test('social dock tour slot mapper recognizes platform hostnames and rejects junk', () => {
	const { helpers } = loadAchievementHelpers();
	const map = helpers.socialDockTourSlotFromHref;

	assert.equal(map('https://x.com/owenminer'), 'x');
	assert.equal(map('https://www.twitter.com/owenminer'), 'x');
	assert.equal(map('https://www.reddit.com/user/owen'), 'reddit');
	assert.equal(map('https://old.reddit.com/r/cs2'), 'reddit');
	assert.equal(map('https://youtu.be/abc'), 'youtube');
	assert.equal(map('https://www.youtube.com/watch?v=abc'), 'youtube');
	assert.equal(map('https://www.twitch.tv/owenminer'), 'twitch');
	assert.equal(map('https://www.instagram.com/owenminer/'), 'instagram');
	assert.equal(map('https://m.facebook.com/owen'), 'facebook');
	assert.equal(map('https://www.tiktok.com/@owen'), 'tiktok');
	assert.equal(map('https://discord.gg/fA9GbxmAge'), 'discord');
	assert.equal(map('https://discord.com/invite/fA9GbxmAge'), 'discord');
	assert.equal(map('https://example.com'), null);
	assert.equal(map('not-a-url'), null);
	assert.equal(map(''), null);
	assert.equal(map(null), null);
});
