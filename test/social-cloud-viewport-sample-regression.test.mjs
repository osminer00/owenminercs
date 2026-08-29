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
		this.rect = options.rect || null;
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

	getBoundingClientRect() {
		return this.rect || { left: 0, top: 0, right: 0, bottom: 0 };
	}
}

function loadViewportSampleHelpers(options = {}) {
	const innerWidth = Number.isFinite(options.innerWidth) ? options.innerWidth : 1000;
	const innerHeight = Number.isFinite(options.innerHeight) ? options.innerHeight : 800;
	const cloud = new Element({ className: 'smc-cloud' });
	const pointHits = options.pointHits || new Map();
	const pointCalls = [];

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
		document: {
			elementsFromPoint(x, y) {
				pointCalls.push({ x, y });
				const hit = pointHits.get(`${x},${y}`);
				return hit ? Array.from(hit) : [cloud];
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
		${extractFunction(socialCloudSource, 'isIgnoredSampleNode')}
		${extractFunction(socialCloudSource, 'getWeightedColorsFromElement')}
		${extractFunction(socialCloudSource, 'sampleVisibleCardAccents')}
		${extractFunction(socialCloudSource, 'sampleViewportColors')}
		this.__helpers = {
			sampleViewportColors,
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
		pointCalls,
		Element,
	};
}

test('sampleViewportColors probes a 7x4 inset grid and skips ignored stacks', () => {
	const ambient = new Element({ className: 'smc-ambient-layer' });
	const ambientChild = new Element({ parentElement: ambient });
	const sampledCard = new Element({ accent: '#ff0000' });
	const pointHits = new Map([
		['140,148', [ambientChild, sampledCard]],
		['860,652', [ambient]],
	]);
	const { helpers, pointCalls } = loadViewportSampleHelpers({ pointHits });

	helpers.setStates([]);
	const colors = Array.from(helpers.sampleViewportColors());

	assert.equal(pointCalls.length, 28);
	assert.deepEqual(pointCalls[0], { x: 140, y: 148 });
	assert.deepEqual(pointCalls[pointCalls.length - 1], { x: 860, y: 652 });

	for (const point of pointCalls) {
		assert.ok(point.x > 80 && point.x < 920, 'sample x should stay inside the 8% horizontal inset');
		assert.ok(point.y > 64 && point.y < 736, 'sample y should stay inside the 8% vertical inset');
	}

	assert.equal(colors.length, 1);
	assert.deepEqual(asNumberArray(colors[0].color), [255, 0, 0]);
	assert.equal(colors[0].weight, 0.95);
});

test('sampleViewportColors uses the first non-ignored stack node and appends visible card accents', () => {
	const ambient = new Element({ className: 'smc-ambient-layer' });
	const sampledCard = new Element({ accent: '#0000ff' });
	const pointHits = new Map([['140,148', [ambient, sampledCard]]]);
	const { helpers } = loadViewportSampleHelpers({ pointHits });

	helpers.setStates([
		{
			el: new Element({ rect: { left: 0, top: 0, right: 200, bottom: 180 } }),
			item: { accent: '#00ff00' },
		},
		{
			el: new Element({ rect: { left: -40, top: 10, right: -10, bottom: 40 } }),
			item: { accent: '#ff0000' },
		},
	]);

	const colors = Array.from(helpers.sampleViewportColors());
	assert.equal(colors.length, 2);
	assert.deepEqual(asNumberArray(colors[0].color), [0, 0, 255]);
	assert.equal(colors[0].weight, 0.95);
	assert.deepEqual(asNumberArray(colors[1].color), [0, 255, 0]);
	assert.equal(colors[1].weight, 0.9);
});

test('sampleViewportColors still returns card accents when every grid hit is ignored', () => {
	const { helpers } = loadViewportSampleHelpers();
	helpers.setStates([
		{
			el: new Element({ rect: { left: 0, top: 0, right: 400, bottom: 400 } }),
			item: { accent: '#ffffff' },
		},
	]);

	const colors = Array.from(helpers.sampleViewportColors());
	assert.equal(colors.length, 1);
	assert.deepEqual(asNumberArray(colors[0].color), [255, 255, 255]);
	assert.equal(colors[0].weight, 0.9 * 2.2);
});
