import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const socialCloudSource = readFileSync(
	new URL('../Socials/scripts/social-cloud.js', import.meta.url),
	'utf8'
);

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

function loadPinMoveHelpers(options = {}) {
	const localStorage = createMemoryStorage();
	for (const [key, value] of Object.entries(options.seed || {})) {
		localStorage.setItem(key, value);
	}

	const unlocks = [];
	const windowObj = {
		owenminercsUnlockAchievement(id) {
			unlocks.push(id);
		},
	};
	if (options.unlockThrows) {
		windowObj.owenminercsUnlockAchievement = () => {
			throw new Error('unlock failed');
		};
	}
	if (options.noUnlockFn) {
		delete windowObj.owenminercsUnlockAchievement;
	}

	const sandbox = {
		Boolean,
		JSON,
		localStorage,
		window: windowObj,
		unlocks,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(socialCloudSource, 'ACH_SOCIAL_CARD_PIN_AND_MOVE')}
		${extractConstAssignment(socialCloudSource, 'SOCIAL_CARD_PIN_MOVE_PROGRESS_KEY')}
		${extractFunction(socialCloudSource, 'loadSocialCardPinMoveProgress')}
		var socialCardPinMoveProgress = loadSocialCardPinMoveProgress();
		${extractFunction(socialCloudSource, 'persistSocialCardPinMoveProgress')}
		${extractFunction(socialCloudSource, 'maybeUnlockSocialCardPinMoveAchievement')}
		${extractFunction(socialCloudSource, 'markSocialCardMoved')}
		${extractFunction(socialCloudSource, 'markSocialCardPinned')}
		this.__helpers = {
			ACH_SOCIAL_CARD_PIN_AND_MOVE,
			SOCIAL_CARD_PIN_MOVE_PROGRESS_KEY,
			loadSocialCardPinMoveProgress,
			getProgress() { return socialCardPinMoveProgress; },
			setProgress(next) {
				socialCardPinMoveProgress.moved = Boolean(next.moved);
				socialCardPinMoveProgress.pinned = Boolean(next.pinned);
			},
			persistSocialCardPinMoveProgress,
			maybeUnlockSocialCardPinMoveAchievement,
			markSocialCardMoved,
			markSocialCardPinned,
			localStorage,
			unlocks,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('loadSocialCardPinMoveProgress defaults safely and accepts partial saved state', () => {
	const empty = loadPinMoveHelpers();
	const loadedEmpty = empty.loadSocialCardPinMoveProgress();
	assert.equal(loadedEmpty.moved, false);
	assert.equal(loadedEmpty.pinned, false);

	const seeded = loadPinMoveHelpers({
		seed: {
			'smc-social-card-pin-move-progress-v1': JSON.stringify({ moved: 1, pinned: 0 }),
		},
	});
	const progress = seeded.getProgress();
	assert.equal(progress.moved, true);
	assert.equal(progress.pinned, false);

	const corrupt = loadPinMoveHelpers({
		seed: {
			'smc-social-card-pin-move-progress-v1': '{not-json',
		},
	});
	const recovered = corrupt.loadSocialCardPinMoveProgress();
	assert.equal(recovered.moved, false);
	assert.equal(recovered.pinned, false);
});

test('pin-and-move achievement unlocks only after both moved and pinned are recorded', () => {
	const helpers = loadPinMoveHelpers();
	const {
		markSocialCardMoved,
		markSocialCardPinned,
		getProgress,
		localStorage,
		SOCIAL_CARD_PIN_MOVE_PROGRESS_KEY,
		ACH_SOCIAL_CARD_PIN_AND_MOVE,
		unlocks,
	} = helpers;

	markSocialCardMoved();
	assert.equal(getProgress().moved, true);
	assert.equal(getProgress().pinned, false);
	assert.equal(unlocks.length, 0);
	assert.deepEqual(JSON.parse(localStorage.getItem(SOCIAL_CARD_PIN_MOVE_PROGRESS_KEY)), {
		moved: true,
		pinned: false,
	});

	markSocialCardPinned();
	assert.equal(getProgress().pinned, true);
	assert.deepEqual(Array.from(unlocks), [ACH_SOCIAL_CARD_PIN_AND_MOVE]);
	assert.equal(ACH_SOCIAL_CARD_PIN_AND_MOVE, 'social-card-pin-and-move');

	// Re-marks keep stored progress stable; unlock helper may be invoked again
	// (persistence layer is responsible for idempotent unlocks).
	const before = localStorage.getItem(SOCIAL_CARD_PIN_MOVE_PROGRESS_KEY);
	markSocialCardMoved();
	markSocialCardPinned();
	assert.equal(localStorage.getItem(SOCIAL_CARD_PIN_MOVE_PROGRESS_KEY), before);
	assert.ok(unlocks.length >= 1);
	assert.equal(unlocks[0], ACH_SOCIAL_CARD_PIN_AND_MOVE);
});

test('pin-and-move unlock is skipped without unlock helper and survives unlock exceptions', () => {
	const noFn = loadPinMoveHelpers({ noUnlockFn: true });
	noFn.setProgress({ moved: true, pinned: true });
	assert.doesNotThrow(() => noFn.maybeUnlockSocialCardPinMoveAchievement());

	const throwing = loadPinMoveHelpers({ unlockThrows: true });
	throwing.setProgress({ moved: true, pinned: true });
	assert.doesNotThrow(() => throwing.maybeUnlockSocialCardPinMoveAchievement());
});
