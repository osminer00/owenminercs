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

function asNumberArray(value) {
	assert.ok(value, 'expected a numeric array');
	return Array.from(value, (channel) => Number(channel));
}

class Element {
	constructor(options = {}) {
		this.className = options.className || '';
		this.parentElement = options.parentElement || null;
		this.backgroundColor = options.backgroundColor || '';
		this.borderColor = options.borderColor || '';
		this.color = options.color || '';
		this.accent = options.accent || '';
	}

	closest(selector) {
		let cursor = this;
		while (cursor) {
			if (
				selector === '.smc-ambient-layer' &&
				String(cursor.className).includes('smc-ambient-layer')
			) {
				return cursor;
			}
			cursor = cursor.parentElement;
		}
		return null;
	}
}

function rect(left, top, right, bottom) {
	return {
		getBoundingClientRect() {
			return { left, top, right, bottom };
		},
	};
}

function loadSampleHelpers(options = {}) {
	const innerWidth = Number.isFinite(options.innerWidth) ? options.innerWidth : 1000;
	const innerHeight = Number.isFinite(options.innerHeight) ? options.innerHeight : 800;
	const cloud = new Element({ className: 'smc-cloud' });
	const sandbox = {
		String,
		Number,
		Math,
		Array,
		Boolean,
		Element,
		cloud,
		window: {
			innerWidth,
			innerHeight,
			getComputedStyle(node) {
				return {
					backgroundColor: node.backgroundColor || 'rgba(0, 0, 0, 0)',
					borderColor: node.borderColor || 'rgba(0, 0, 0, 0)',
					color: node.color || 'rgba(0, 0, 0, 0)',
					getPropertyValue(name) {
						if (name === '--smc-accent') return node.accent || '';
						return '';
					},
				};
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		let states = [];
		${extractFunction(socialCloudSource, 'clamp')}
		${extractFunction(socialCloudSource, 'parseCssColor')}
		${extractFunction(socialCloudSource, 'getColorSaturation')}
		${extractFunction(socialCloudSource, 'normalizeAngleDelta')}
		${extractFunction(socialCloudSource, 'isIgnoredSampleNode')}
		${extractFunction(socialCloudSource, 'getWeightedColorsFromElement')}
		${extractFunction(socialCloudSource, 'sampleVisibleCardAccents')}
		this.__helpers = {
			normalizeAngleDelta,
			isIgnoredSampleNode,
			getWeightedColorsFromElement,
			sampleVisibleCardAccents,
			setStates(next) {
				states = next;
			},
		};
		`,
		sandbox
	);

	return {
		helpers: sandbox.__helpers,
		cloud,
		Element,
	};
}

test('sampleVisibleCardAccents skips invalid cards and weights visible accent area', () => {
	const { helpers } = loadSampleHelpers();

	helpers.setStates([
		{ el: null, item: { accent: '#ff0000' } },
		{ el: rect(0, 0, 10, 10), item: null },
		{ el: rect(-40, 10, -10, 40), item: { accent: '#00ff00' } },
		{ el: rect(0, 0, 200, 180), item: { accent: 'not-a-color' } },
		{ el: rect(0, 0, 200, 180), item: { accent: '#ff0000' } },
		{ el: rect(-50, 0, 50, 100), item: { accent: '#00ff00' } },
		{ el: rect(0, 0, 400, 400), item: { accent: '#0000ff' } },
		{ el: rect(5, 5, 15, 15), item: { accent: '#ffffff' } },
	]);

	const weighted = helpers.sampleVisibleCardAccents();
	assert.equal(weighted.length, 4);

	assert.deepEqual(asNumberArray(weighted[0].color), [255, 0, 0]);
	assert.equal(weighted[0].weight, 0.9);

	assert.deepEqual(asNumberArray(weighted[1].color), [0, 255, 0]);
	assert.equal(weighted[1].weight, 0.9 * 0.18);

	assert.deepEqual(asNumberArray(weighted[2].color), [0, 0, 255]);
	assert.equal(weighted[2].weight, 0.9 * 2.2);

	assert.deepEqual(asNumberArray(weighted[3].color), [255, 255, 255]);
	assert.equal(weighted[3].weight, 0.9 * 0.18);
});

test('isIgnoredSampleNode skips non-elements, the cloud root, and ambient layer ancestors', () => {
	const { helpers, cloud } = loadSampleHelpers();
	const ambient = new Element({ className: 'smc-ambient-layer' });
	const child = new Element({ parentElement: ambient });
	const ordinary = new Element({ className: 'smc-card' });

	assert.equal(helpers.isIgnoredSampleNode(null), true);
	assert.equal(helpers.isIgnoredSampleNode({ className: 'smc-card' }), true);
	assert.equal(helpers.isIgnoredSampleNode(cloud), true);
	assert.equal(helpers.isIgnoredSampleNode(ambient), true);
	assert.equal(helpers.isIgnoredSampleNode(child), true);
	assert.equal(helpers.isIgnoredSampleNode(ordinary), false);
});

test('getWeightedColorsFromElement walks a short ancestor chain and drops near-zero weights', () => {
	const { helpers } = loadSampleHelpers();

	assert.equal(Array.from(helpers.getWeightedColorsFromElement(null)).length, 0);
	assert.equal(
		Array.from(helpers.getWeightedColorsFromElement({ backgroundColor: 'rgb(255, 0, 0)' })).length,
		0
	);

	const transparent = new Element({ backgroundColor: 'rgba(255, 0, 0, 0.01)' });
	assert.equal(Array.from(helpers.getWeightedColorsFromElement(transparent)).length, 0);

	const parent = new Element({
		backgroundColor: 'rgb(0, 0, 255)',
		accent: '#00ff00',
	});
	const child = new Element({
		parentElement: parent,
		backgroundColor: 'rgb(255, 0, 0)',
		borderColor: 'rgba(0, 0, 0, 0.02)',
		color: 'rgba(255, 255, 255, 0.1)',
		accent: '#ffffff',
	});

	const weighted = Array.from(helpers.getWeightedColorsFromElement(child));
	assert.ok(weighted.length >= 2);
	assert.deepEqual(asNumberArray(weighted[0].color), [255, 0, 0]);
	assert.equal(weighted[0].weight, 1.1 * (0.4 + 1.1));
	assert.deepEqual(asNumberArray(weighted[1].color), [255, 255, 255]);
	assert.equal(weighted[1].weight, 0.95);

	const parentColors = weighted.filter((entry) => {
		const [r, g, b] = asNumberArray(entry.color);
		return r === 0 && g === 0 && b === 255;
	});
	assert.equal(parentColors.length, 1);
	assert.equal(parentColors[0].weight, (1.1 - 0.16) * (0.4 + 1.1));
});

test('normalizeAngleDelta wraps rotation deltas into the (-180, 180] range', () => {
	const { helpers } = loadSampleHelpers();

	assert.equal(helpers.normalizeAngleDelta(0), 0);
	assert.equal(helpers.normalizeAngleDelta(180), 180);
	assert.equal(helpers.normalizeAngleDelta(-180), -180);
	assert.equal(helpers.normalizeAngleDelta(181), -179);
	assert.equal(helpers.normalizeAngleDelta(-181), 179);
	assert.equal(helpers.normalizeAngleDelta(540), 180);
	assert.equal(helpers.normalizeAngleDelta(-540), -180);
	assert.equal(helpers.normalizeAngleDelta(720), 0);
	assert.equal(helpers.normalizeAngleDelta(190), -170);
});
