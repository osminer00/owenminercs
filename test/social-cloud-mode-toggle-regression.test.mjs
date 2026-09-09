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

function loadModeConfigHelpers({ useLightMode = false, config } = {}) {
	const sandbox = {
		useLightMode,
		config: config || {
			cardCountDesktop: 20,
			cardCountMobile: 12,
			baseSpeed: 99,
			enabledNoteTypes: ['video', 'social'],
			useInlineVideoByDefault: true,
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'applyModeConfig')}
		${extractFunction(socialCloudSource, 'getModeToggleLabel')}
		this.__helpers = {
			applyModeConfig,
			getModeToggleLabel,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'mode config helpers should load');
	return { helpers: sandbox.__helpers, sandbox };
}

function loadClampHelpers({
	innerWidth = 1000,
	innerHeight = 800,
	rect = { width: 120, height: 40 },
} = {}) {
	const sandbox = {
		Math,
		DRAG_MARGIN: 8,
		window: { innerWidth, innerHeight },
		modeButton: {
			getBoundingClientRect() {
				return rect;
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'clamp')}
		${extractFunction(socialCloudSource, 'clampModeButtonPosition')}
		this.__helpers = {
			clamp,
			clampModeButtonPosition,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'mode toggle clamp helpers should load');
	return sandbox.__helpers;
}

test('applyModeConfig lowers card counts and disables inline video in lightweight mode', () => {
	const full = loadModeConfigHelpers({ useLightMode: false });
	full.helpers.applyModeConfig();
	assert.equal(full.sandbox.config.cardCountDesktop, 16);
	assert.equal(full.sandbox.config.cardCountMobile, 10);
	assert.equal(full.sandbox.config.baseSpeed, 28);
	assert.equal(full.sandbox.config.useInlineVideoByDefault, true);
	assert.deepEqual(Array.from(full.sandbox.config.enabledNoteTypes, String), [
		'video',
		'social',
	]);

	const light = loadModeConfigHelpers({ useLightMode: true });
	light.helpers.applyModeConfig();
	assert.equal(light.sandbox.config.cardCountDesktop, 8);
	assert.equal(light.sandbox.config.cardCountMobile, 6);
	assert.equal(light.sandbox.config.baseSpeed, 20);
	assert.equal(light.sandbox.config.useInlineVideoByDefault, false);
	assert.deepEqual(Array.from(light.sandbox.config.enabledNoteTypes, String), [
		'video',
		'social',
	]);
});

test('getModeToggleLabel reflects the current lightweight mode flag', () => {
	const full = loadModeConfigHelpers({ useLightMode: false });
	assert.equal(full.helpers.getModeToggleLabel(), 'Lightweight: Off');

	const light = loadModeConfigHelpers({ useLightMode: true });
	assert.equal(light.helpers.getModeToggleLabel(), 'Lightweight: On');
});

test('clampModeButtonPosition keeps the toggle inside an 8px viewport margin', () => {
	const helpers = loadClampHelpers({
		innerWidth: 1000,
		innerHeight: 800,
		rect: { width: 120, height: 40 },
	});

	const maxLeft = 1000 - 120 - 8;
	const maxTop = 800 - 40 - 8;

	const inside = helpers.clampModeButtonPosition(100, 200);
	assert.equal(inside.left, 100);
	assert.equal(inside.top, 200);

	const west = helpers.clampModeButtonPosition(-40, 50);
	assert.equal(west.left, 8);
	assert.equal(west.top, 50);

	const southEast = helpers.clampModeButtonPosition(9999, 9999);
	assert.equal(southEast.left, maxLeft);
	assert.equal(southEast.top, maxTop);

	const onMargin = helpers.clampModeButtonPosition(8, 8);
	assert.equal(onMargin.left, 8);
	assert.equal(onMargin.top, 8);
});

test('clampModeButtonPosition pins to the margin when the button cannot fit', () => {
	const helpers = loadClampHelpers({
		innerWidth: 50,
		innerHeight: 30,
		rect: { width: 200, height: 80 },
	});

	const overflow = helpers.clampModeButtonPosition(0, 0);
	assert.equal(overflow.left, 8);
	assert.equal(overflow.top, 8);

	const far = helpers.clampModeButtonPosition(400, -20);
	assert.equal(far.left, 8);
	assert.equal(far.top, 8);
});
