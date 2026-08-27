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

function loadColorHelpers(options = {}) {
	const useLightMode = options.useLightMode === true;
	const sandbox = {
		String,
		Number,
		Math,
		Array,
		Boolean,
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
		${extractConstAssignment(socialCloudSource, 'DARK_GREEN_TARGET')}
		${extractFunction(socialCloudSource, 'clamp')}
		${extractFunction(socialCloudSource, 'parseCssColor')}
		${extractFunction(socialCloudSource, 'colorDistance')}
		${extractFunction(socialCloudSource, 'getColorSaturation')}
		${extractFunction(socialCloudSource, 'toCssRgbTriplet')}
		${extractFunction(socialCloudSource, 'selectAmbientPalette')}
		this.__helpers = {
			parseCssColor,
			colorDistance,
			getColorSaturation,
			toCssRgbTriplet,
			selectAmbientPalette,
			getCurrentAmbientColors() {
				return currentAmbientColors;
			},
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('parseCssColor accepts rgb/hex forms and rejects empty or invalid values', () => {
	const { parseCssColor } = loadColorHelpers();

	assert.equal(parseCssColor(''), null);
	assert.equal(parseCssColor('transparent'), null);
	assert.equal(parseCssColor('#ffff'), null);
	assert.equal(parseCssColor('#fffff'), null);
	assert.equal(parseCssColor('#fffffff'), null);
	assert.equal(parseCssColor('rgb(1, 2)'), null);

	assert.deepEqual(asNumberArray(parseCssColor('#abc')), [170, 187, 204, 1]);
	assert.deepEqual(asNumberArray(parseCssColor('#112233')), [17, 34, 51, 1]);
	assert.deepEqual(asNumberArray(parseCssColor('#11223380')), [17, 34, 51, 128 / 255]);
	assert.deepEqual(asNumberArray(parseCssColor('rgb(300, -20, 10)')), [255, 0, 10, 1]);
	assert.deepEqual(asNumberArray(parseCssColor('rgba(10, 20, 30, 2)')), [10, 20, 30, 1]);
});

test('color helpers measure saturation, distance, and CSS triplets without leaking out-of-range channels', () => {
	const { getColorSaturation, colorDistance, toCssRgbTriplet } = loadColorHelpers();

	assert.equal(getColorSaturation(null), 0);
	assert.equal(getColorSaturation([0, 0, 0]), 0);
	assert.equal(getColorSaturation([128, 128, 128]), 0);
	assert.equal(getColorSaturation([255, 0, 0]), 1);

	assert.equal(colorDistance([0, 0, 0], [0, 0, 0]), 0);
	assert.equal(colorDistance([0, 0, 0], [3, 4, 0]), 5);

	assert.equal(toCssRgbTriplet([10.4, 20.6, 30]), '10 21 30');
	assert.equal(toCssRgbTriplet([400, -5, 12.2]), '255 0 12');
});

test('selectAmbientPalette keeps the previous palette for empty input and always returns three clamped colors', () => {
	const helpers = loadColorHelpers({ useLightMode: false });
	const previous = helpers.getCurrentAmbientColors().map((row) => asNumberArray(row));

	const emptyPalette = helpers.selectAmbientPalette([]);
	assert.equal(emptyPalette.length, 3);
	assert.deepEqual(asNumberArray(emptyPalette[0]), previous[0]);
	assert.deepEqual(asNumberArray(emptyPalette[1]), previous[1]);
	assert.deepEqual(asNumberArray(emptyPalette[2]), previous[2]);

	const ignored = helpers.selectAmbientPalette([{ color: 'red', weight: 1 }]);
	assert.deepEqual(asNumberArray(ignored[0]), previous[0]);

	const palette = helpers.selectAmbientPalette([
		{ color: [220, 30, 30], weight: 3 },
		{ color: [30, 40, 210], weight: 2 },
		{ color: [20, 180, 40], weight: 1 },
	]);
	assert.equal(palette.length, 3);
	for (const color of palette) {
		const [r, g, b] = asNumberArray(color);
		assert.ok(r >= 10 && r <= 236, `red channel ${r} should stay in ambient clamp`);
		assert.ok(g >= 20 && g <= 236, `green channel ${g} should stay in ambient clamp`);
		assert.ok(b >= 10 && b <= 236, `blue channel ${b} should stay in ambient clamp`);
	}
});
