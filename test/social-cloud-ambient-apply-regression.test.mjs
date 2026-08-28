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

function asNumberArray(value) {
	assert.ok(value, 'expected a color array');
	return Array.from(value, (channel) => Number(channel));
}

class Element {}

class HTMLElement extends Element {
	constructor() {
		super();
		this.styleProps = {};
		this.style = {
			setProperty: (name, value) => {
				this.styleProps[name] = String(value);
			},
		};
	}
}

function loadAmbientHelpers(options = {}) {
	const useLightMode = options.useLightMode === true;
	const body = options.body === undefined ? new HTMLElement() : options.body;
	const sandbox = {
		String,
		Number,
		Math,
		Array,
		Boolean,
		Element,
		HTMLElement,
		document: { body },
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		let useLightMode = ${useLightMode ? 'true' : 'false'};
		let currentAmbientColors = [
			[34, 78, 58],
			[118, 76, 44],
			[28, 42, 74],
		];
		let currentAmbientGreen = [20, 72, 42];
		${extractConstAssignment(socialCloudSource, 'DARK_GREEN_TARGET')}
		${extractFunction(socialCloudSource, 'clamp')}
		${extractFunction(socialCloudSource, 'toCssRgbTriplet')}
		${extractFunction(socialCloudSource, 'applyAmbientPalette')}
		this.__helpers = {
			applyAmbientPalette,
			getCurrentAmbientColors() {
				return currentAmbientColors;
			},
			getCurrentAmbientGreen() {
				return currentAmbientGreen;
			},
		};
		`,
		sandbox
	);

	return {
		helpers: sandbox.__helpers,
		body,
	};
}

test('applyAmbientPalette no-ops unless document.body is an HTMLElement', () => {
	const styleProps = {};
	const { helpers } = loadAmbientHelpers({
		body: {
			style: {
				setProperty(name, value) {
					styleProps[name] = value;
				},
			},
		},
	});

	helpers.applyAmbientPalette([
		[200, 10, 10],
		[10, 200, 10],
		[10, 10, 200],
	]);

	assert.deepEqual(styleProps, {});
	assert.deepEqual(asNumberArray(helpers.getCurrentAmbientColors()[0]), [34, 78, 58]);
});

test('applyAmbientPalette eases toward the target palette and writes CSS custom properties', () => {
	const { helpers, body } = loadAmbientHelpers({ useLightMode: false });

	helpers.applyAmbientPalette([
		[200, 10, 10],
		[10, 200, 10],
		[10, 10, 200],
	]);

	assert.deepEqual(asNumberArray(helpers.getCurrentAmbientColors()[0]), [100.4, 50.8, 38.8]);
	assert.deepEqual(asNumberArray(helpers.getCurrentAmbientColors()[1]), [74.8, 125.6, 30.4]);
	assert.deepEqual(asNumberArray(helpers.getCurrentAmbientColors()[2]), [20.8, 29.2, 124.4]);

	assert.equal(body.styleProps['--smc-ambient-1'], '100 51 39');
	assert.equal(body.styleProps['--smc-ambient-2'], '75 126 30');
	assert.equal(body.styleProps['--smc-ambient-3'], '21 29 124');
	assert.equal(body.styleProps['--smc-ambient-strength'], '0.5');
	assert.ok(body.styleProps['--smc-ambient-green']);
	assert.match(body.styleProps['--smc-ambient-green'], /^\d+ \d+ \d+$/);
});

test('applyAmbientPalette keeps missing palette slots, uses light-mode strength, and continues easing green', () => {
	const { helpers, body } = loadAmbientHelpers({ useLightMode: true });
	const beforeGreen = asNumberArray(helpers.getCurrentAmbientGreen());

	helpers.applyAmbientPalette([[200, 10, 10]]);

	assert.deepEqual(asNumberArray(helpers.getCurrentAmbientColors()[0]), [83.8, 57.6, 43.6]);
	assert.deepEqual(asNumberArray(helpers.getCurrentAmbientColors()[1]), [118, 76, 44]);
	assert.deepEqual(asNumberArray(helpers.getCurrentAmbientColors()[2]), [28, 42, 74]);
	assert.equal(body.styleProps['--smc-ambient-2'], '118 76 44');
	assert.equal(body.styleProps['--smc-ambient-strength'], '0.34');

	const afterFirstGreen = asNumberArray(helpers.getCurrentAmbientGreen());
	helpers.applyAmbientPalette([[200, 10, 10]]);
	const afterSecondGreen = asNumberArray(helpers.getCurrentAmbientGreen());

	assert.notDeepEqual(afterFirstGreen, beforeGreen);
	assert.notDeepEqual(afterSecondGreen, afterFirstGreen);
});
