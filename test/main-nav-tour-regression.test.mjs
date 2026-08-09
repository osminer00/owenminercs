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

function loadMainNavTourHelpers(options = {}) {
	const localStorage = createMemoryStorage();
	const unlockedCalls = [];
	const alreadyUnlocked = new Set(options.alreadyUnlocked || []);
	const pathname = options.pathname || '/';
	const dataset = { ...(options.dataset || {}) };

	const windowObj = {
		location: { pathname },
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
		document: {
			documentElement: { dataset },
		},
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
		${extractConstAssignment(componentsSource, 'MAIN_NAV_TOUR_PROGRESS_KEY')}
		${extractConstAssignment(componentsSource, 'ACH_MAIN_NAV_FULL_TOUR')}
		${extractConstAssignment(componentsSource, 'MAIN_NAV_TOUR_SLOTS')}
		${extractFunction(componentsSource, 'readMainNavTourVisited')}
		${extractFunction(componentsSource, 'writeMainNavTourVisited')}
		${extractFunction(componentsSource, 'getMainNavTourSlotFromLocation')}
		${extractFunction(componentsSource, 'recordMainNavTourPageVisit')}
		this.__helpers = {
			MAIN_NAV_TOUR_PROGRESS_KEY,
			ACH_MAIN_NAV_FULL_TOUR,
			MAIN_NAV_TOUR_SLOTS,
			readMainNavTourVisited,
			writeMainNavTourVisited,
			getMainNavTourSlotFromLocation,
			recordMainNavTourPageVisit,
		};
		`,
		sandbox
	);

	return {
		helpers: sandbox.__helpers,
		localStorage,
		unlockedCalls,
		dataset,
		setPathname(nextPath) {
			windowObj.location.pathname = nextPath;
		},
	};
}

test('main nav tour maps home and nested section URLs to the correct slots', () => {
	const cases = [
		['/', 'index.html'],
		['/index.html', 'index.html'],
		['/Gaming/gaming.html', 'Gaming'],
		['/Counter-Strike/cs2.html', 'Gaming'],
		['/nosmoking.html', 'Gaming'],
		['/The%20Setup/the-setup.html', 'The Setup'],
		['/Keyboard/60he.html', 'The Setup'],
		['/PC/pc.html', 'The Setup'],
		['/Upgrades/upgrades.html', 'The Setup'],
		['/Donators/donators.html', 'Donators'],
		['/Garage%20Sale/garage-sale.html', 'garage-sale'],
		['/Help%20Wanted/help-wanted.html', 'Help Wanted'],
		['/QA/qa.html', 'QA'],
		['/qa', 'QA'],
		['/Achievements/achievements.html', 'Achievements'],
		['/Socials/socials.html', 'Socials'],
		['/search.html', null],
		['/dev/dev-stack.html', null],
	];

	for (const [pathname, expected] of cases) {
		const { helpers } = loadMainNavTourHelpers({ pathname });
		assert.equal(
			helpers.getMainNavTourSlotFromLocation(),
			expected,
			`${pathname} should map to ${expected}`
		);
	}
});

test('main nav tour unlocks only after every required slot is visited once', () => {
	const { helpers, localStorage, unlockedCalls, dataset, setPathname } = loadMainNavTourHelpers({
		pathname: '/Gaming/gaming.html',
	});

	helpers.recordMainNavTourPageVisit();
	assert.equal(unlockedCalls.length, 0, 'one slot should not unlock the tour');
	assert.equal(dataset.owenMainNavTourRecorded, '1');

	// Same page should not record twice in one load.
	helpers.recordMainNavTourPageVisit();
	const afterFirst = JSON.parse(localStorage.getItem(helpers.MAIN_NAV_TOUR_PROGRESS_KEY));
	assert.deepEqual(Array.from(afterFirst), ['Gaming']);

	const remaining = helpers.MAIN_NAV_TOUR_SLOTS.filter((slot) => slot !== 'Gaming');
	const pathBySlot = {
		'index.html': '/',
		'The Setup': '/The%20Setup/the-setup.html',
		Donators: '/Donators/donators.html',
		'garage-sale': '/Garage%20Sale/garage-sale.html',
		'Help Wanted': '/Help%20Wanted/help-wanted.html',
		QA: '/QA/qa.html',
		Achievements: '/Achievements/achievements.html',
		Socials: '/Socials/socials.html',
	};

	for (const slot of remaining) {
		dataset.owenMainNavTourRecorded = '';
		setPathname(pathBySlot[slot]);
		helpers.recordMainNavTourPageVisit();
	}

	assert.equal(unlockedCalls.length, 1);
	assert.equal(unlockedCalls[0], helpers.ACH_MAIN_NAV_FULL_TOUR);

	const stored = JSON.parse(localStorage.getItem(helpers.MAIN_NAV_TOUR_PROGRESS_KEY));
	for (const slot of helpers.MAIN_NAV_TOUR_SLOTS) {
		assert.ok(stored.includes(slot), `${slot} should be persisted`);
	}
});

test('main nav tour skips recording when the achievement is already unlocked', () => {
	const { helpers, localStorage, unlockedCalls, dataset } = loadMainNavTourHelpers({
		pathname: '/Socials/socials.html',
		alreadyUnlocked: ['main-nav-full-tour'],
	});

	helpers.recordMainNavTourPageVisit();
	assert.equal(dataset.owenMainNavTourRecorded, '1');
	assert.equal(localStorage.getItem(helpers.MAIN_NAV_TOUR_PROGRESS_KEY), null);
	assert.equal(unlockedCalls.length, 0);
});
