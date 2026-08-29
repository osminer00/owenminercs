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

class Element {
	constructor(options = {}) {
		this.tagName = String(options.tagName || 'DIV').toUpperCase();
		this.className = options.className || '';
		this.parentElement = options.parentElement || null;
	}

	closest(selector) {
		const parts = String(selector)
			.split(',')
			.map((part) => part.trim());
		let cursor = this;
		while (cursor) {
			for (const part of parts) {
				if (part.startsWith('.')) {
					const className = part.slice(1);
					if (
						String(cursor.className)
							.split(/\s+/)
							.includes(className)
					) {
						return cursor;
					}
				} else if (part.toUpperCase() === cursor.tagName) {
					return cursor;
				}
			}
			cursor = cursor.parentElement;
		}
		return null;
	}
}

function loadRotateAndBlockHelpers(options = {}) {
	const cloudRect = options.cloudRect || { left: 10, top: 20, right: 1010, bottom: 820 };
	const sandbox = {
		String,
		Math,
		Object,
		Element,
		cloud: {
			getBoundingClientRect() {
				return cloudRect;
			},
		},
		state: options.state || { x: 50, y: 50 },
		card: options.card || { offsetWidth: 100, offsetHeight: 100 },
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'getPointerAngle')}
		${extractFunction(socialCloudSource, 'isInteractiveCardTarget')}
		${extractFunction(socialCloudSource, 'isBlockedSocialContentItem')}
		this.__helpers = {
			getPointerAngle,
			isInteractiveCardTarget,
			isBlockedSocialContentItem,
			setPose(nextState, nextCard) {
				if (nextState) Object.assign(state, nextState);
				if (nextCard) Object.assign(card, nextCard);
			},
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('getPointerAngle measures pointer offset from the card center in cloud coordinates', () => {
	const helpers = loadRotateAndBlockHelpers();

	assert.equal(helpers.getPointerAngle({ clientX: 110, clientY: 120 }), 0);
	assert.equal(helpers.getPointerAngle({ clientX: 160, clientY: 120 }), 0);
	assert.equal(helpers.getPointerAngle({ clientX: 110, clientY: 70 }), -90);
	assert.equal(helpers.getPointerAngle({ clientX: 60, clientY: 120 }), 180);
	assert.equal(helpers.getPointerAngle({ clientX: 110, clientY: 170 }), 90);
	assert.equal(helpers.getPointerAngle({ clientX: 160, clientY: 170 }), 45);

	helpers.setPose({ x: 200, y: 80 }, { offsetWidth: 40, offsetHeight: 20 });
	assert.equal(helpers.getPointerAngle({ clientX: 230, clientY: 110 }), 0);
	assert.equal(helpers.getPointerAngle({ clientX: 230, clientY: 90 }), -90);
});

test('isInteractiveCardTarget treats chrome, iframes, and form controls as non-drag targets', () => {
	const helpers = loadRotateAndBlockHelpers();
	const card = new Element({ tagName: 'article', className: 'smc-card' });
	const resize = new Element({ className: 'smc-resize-handle', parentElement: card });
	const desc = new Element({ className: 'smc-desc-toggle', parentElement: card });
	const iframe = new Element({ tagName: 'iframe', parentElement: card });
	const iframeChild = new Element({ tagName: 'div', parentElement: iframe });
	const inlineLink = new Element({
		tagName: 'span',
		className: 'smc-inline-link',
		parentElement: card,
	});
	const anchor = new Element({ tagName: 'a', parentElement: card });
	const button = new Element({ tagName: 'button', parentElement: card });
	const input = new Element({ tagName: 'input', parentElement: card });
	const textarea = new Element({ tagName: 'textarea', parentElement: card });
	const select = new Element({ tagName: 'select', parentElement: card });

	assert.equal(helpers.isInteractiveCardTarget(null), false);
	assert.equal(helpers.isInteractiveCardTarget({ tagName: 'A' }), false);
	assert.equal(helpers.isInteractiveCardTarget(card), false);
	assert.equal(helpers.isInteractiveCardTarget(resize), true);
	assert.equal(helpers.isInteractiveCardTarget(desc), true);
	assert.equal(helpers.isInteractiveCardTarget(iframe), true);
	assert.equal(helpers.isInteractiveCardTarget(iframeChild), true);
	assert.equal(helpers.isInteractiveCardTarget(inlineLink), true);
	assert.equal(helpers.isInteractiveCardTarget(anchor), true);
	assert.equal(helpers.isInteractiveCardTarget(button), true);
	assert.equal(helpers.isInteractiveCardTarget(input), true);
	assert.equal(helpers.isInteractiveCardTarget(textarea), true);
	assert.equal(helpers.isInteractiveCardTarget(select), true);
});

test('isBlockedSocialContentItem matches Harman Kardon and Go + Play 3 variants across fields', () => {
	const helpers = loadRotateAndBlockHelpers();

	assert.equal(helpers.isBlockedSocialContentItem({ title: 'Desk tour' }), false);
	assert.equal(helpers.isBlockedSocialContentItem({ title: 'HARMAN KARDON glow' }), true);
	assert.equal(helpers.isBlockedSocialContentItem({ blurb: 'harmon kardon speaker' }), true);
	assert.equal(helpers.isBlockedSocialContentItem({ caption: 'harman/kardon' }), true);
	assert.equal(helpers.isBlockedSocialContentItem({ url: 'https://example.com/harmon/kardon' }), true);
	assert.equal(
		helpers.isBlockedSocialContentItem({ thumbnail: 'https://cdn.example/harman-kardon.jpg' }),
		true
	);
	assert.equal(
		helpers.isBlockedSocialContentItem({ embedUrl: 'https://cdn.example/harmon-kardon.mp4' }),
		true
	);
	assert.equal(helpers.isBlockedSocialContentItem({ title: 'Go + Play 3 unboxing' }), true);
	assert.equal(helpers.isBlockedSocialContentItem({ caption: 'GO+PLAY 3' }), true);
	assert.equal(helpers.isBlockedSocialContentItem({ title: 'play 3 playlist' }), false);
});
