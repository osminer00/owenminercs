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

function loadDockPositionHelpers(options = {}) {
	const innerWidth = Number.isFinite(options.innerWidth) ? options.innerWidth : 1280;
	const innerHeight = Number.isFinite(options.innerHeight) ? options.innerHeight : 720;
	const headerSlot = options.headerSlot || null;
	const brandRow = options.brandRow || null;
	const sharedHeader = options.sharedHeader || null;

	class FakeElement {}

	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		Array,
		Element: FakeElement,
		window: { innerWidth, innerHeight },
		document: {
			querySelector(selector) {
				if (selector === '.site-header-brand-row') return brandRow;
				if (selector === '.site-shared-header') return sharedHeader;
				return null;
			},
		},
		__headerSlot: headerSlot,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_SCALE_MIN')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_SCALE_MAX')}
		function querySocialDockHeaderSlot() {
			return __headerSlot;
		}
		${extractFunction(componentsSource, 'clampSocialDockScale')}
		${extractFunction(componentsSource, 'parseSocialDockTiltDeg')}
		${extractFunction(componentsSource, 'socialDockCoordsRounded')}
		${extractFunction(componentsSource, 'getSocialDockDefaultViewportPosition')}
		this.__helpers = {
			SOCIAL_DOCK_SCALE_MIN,
			SOCIAL_DOCK_SCALE_MAX,
			clampSocialDockScale,
			parseSocialDockTiltDeg,
			socialDockCoordsRounded,
			getSocialDockDefaultViewportPosition,
			FakeElement: Element,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

function makeElementLike(proto, props) {
	const node = { ...props };
	Object.setPrototypeOf(node, proto.prototype);
	return node;
}

test('social dock scale and tilt parsing reject invalid values and clamp bounds', () => {
	const {
		SOCIAL_DOCK_SCALE_MIN,
		SOCIAL_DOCK_SCALE_MAX,
		clampSocialDockScale,
		parseSocialDockTiltDeg,
		socialDockCoordsRounded,
	} = loadDockPositionHelpers();

	assert.equal(SOCIAL_DOCK_SCALE_MIN, 0.5);
	assert.equal(SOCIAL_DOCK_SCALE_MAX, 2);
	assert.equal(clampSocialDockScale(1), 1);
	assert.equal(clampSocialDockScale(0.1), 0.5);
	assert.equal(clampSocialDockScale(5), 2);
	assert.equal(clampSocialDockScale(Number.NaN), 1);
	assert.equal(clampSocialDockScale(undefined), 1);

	assert.equal(parseSocialDockTiltDeg('12.5deg'), 12.5);
	assert.equal(parseSocialDockTiltDeg('-90DEG'), -90);
	assert.equal(parseSocialDockTiltDeg(''), null);
	assert.equal(parseSocialDockTiltDeg(null), null);
	assert.equal(parseSocialDockTiltDeg('spin'), null);

	const coords = socialDockCoordsRounded(10.4, 20.6);
	assert.equal(coords.left, 10);
	assert.equal(coords.top, 21);
});

test('social dock default viewport position falls back to 2px margin without header anchors', () => {
	const helpers = loadDockPositionHelpers();
	const { getSocialDockDefaultViewportPosition, FakeElement } = helpers;

	const withoutElement = getSocialDockDefaultViewportPosition(null);
	assert.equal(withoutElement.left, 2);
	assert.equal(withoutElement.top, 2);

	const fakeWrap = makeElementLike(FakeElement, {
		getBoundingClientRect() {
			return { width: 80, height: 40, left: 0, top: 0, right: 80, bottom: 40 };
		},
	});

	const noAnchor = getSocialDockDefaultViewportPosition(fakeWrap);
	assert.equal(noAnchor.left, 2);
	assert.equal(noAnchor.top, 2);
});

test('social dock default viewport position uses header slot geometry when dock is mounted there', () => {
	const slotHolder = { wrap: null };
	const slot = {
		contains(node) {
			return node === slotHolder.wrap;
		},
		getBoundingClientRect() {
			return { width: 120, height: 48, left: 1100, top: 4, right: 1220, bottom: 52 };
		},
	};

	const helpersWithSlot = loadDockPositionHelpers({
		headerSlot: slot,
		innerWidth: 1280,
		innerHeight: 720,
	});

	slotHolder.wrap = makeElementLike(helpersWithSlot.FakeElement, {
		getBoundingClientRect() {
			return { width: 100, height: 40, left: 1100, top: 8, right: 1200, bottom: 48 };
		},
	});

	const pos = helpersWithSlot.getSocialDockDefaultViewportPosition(slotHolder.wrap);
	// slot.right (1220) - dockW (100) = 1120; vertically centered in 48px slot → top 8
	assert.equal(pos.left, 1120);
	assert.equal(pos.top, 8);
});
