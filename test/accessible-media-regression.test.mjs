import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

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

function loadAccessibleMediaHelpers() {
	const source = readWorkspaceFile('scripts/accessible-media.js');
	const sandbox = { String, Math, Number, Array, Boolean, RegExp };

	vm.runInNewContext(
		[
			extractFunction(source, 'cleanText'),
			extractFunction(source, 'clipText'),
			extractFunction(source, 'pathToWords'),
			extractFunction(source, 'isWeakAlt'),
			extractFunction(source, 'buildAltText'),
			extractFunction(source, 'buildCaption'),
			`this.__helpers = {
				cleanText,
				clipText,
				pathToWords,
				isWeakAlt,
				buildAltText,
				buildCaption,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'accessible-media helpers should load');
	return sandbox.__helpers;
}

function loadMediaCheckHelpers() {
	const source = readWorkspaceFile('dev/media-accessibility-check.mjs');
	const sandbox = { String, Math, Number, Array, Boolean, RegExp };

	vm.runInNewContext(
		[
			extractFunction(source, 'cleanText'),
			extractFunction(source, 'clipText'),
			extractFunction(source, 'pathToWords'),
			extractFunction(source, 'isWeakAlt'),
			extractFunction(source, 'buildAltText'),
			extractFunction(source, 'buildCaption'),
			`this.__helpers = {
				isWeakAlt,
				buildAltText,
				buildCaption,
				pathToWords,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'media-accessibility-check helpers should load');
	return sandbox.__helpers;
}

test('accessible-media treats empty and generic alt text as weak', () => {
	const { isWeakAlt } = loadAccessibleMediaHelpers();

	assert.equal(isWeakAlt(''), true);
	assert.equal(isWeakAlt('   '), true);
	assert.equal(isWeakAlt('photo'), true);
	assert.equal(isWeakAlt('IMAGE'), true);
	assert.equal(isWeakAlt('setup'), true);
	assert.equal(isWeakAlt('short'), true);
	assert.equal(isWeakAlt('Desk setup with monitor and keyboard'), false);
});

test('accessible-media builds alt from title, context, and path when current alt is weak', () => {
	const { buildAltText, pathToWords } = loadAccessibleMediaHelpers();

	assert.equal(
		pathToWords('/images/setup/ultrawide_monitor_img.png?v=2'),
		'ultrawide monitor'
	);

	assert.equal(
		buildAltText({
			existingAlt: 'photo',
			title: 'Wooting 60HE',
			context: 'Owen Miner setup',
			src: '/images/keyboard.png',
		}),
		'Wooting 60HE in Owen Miner setup'
	);

	assert.equal(
		buildAltText({
			existingAlt: 'Detailed desk photo with ambient lighting',
			title: 'Ignored title',
			context: 'Ignored context',
			src: '/images/ignored.png',
		}),
		'Detailed desk photo with ambient lighting'
	);

	assert.equal(
		buildAltText({
			existingAlt: '',
			title: '',
			context: '',
			src: '',
		}),
		'setup photo'
	);
});

test('accessible-media caption prefers explicit caption then title then alt', () => {
	const { buildCaption } = loadAccessibleMediaHelpers();

	assert.equal(
		buildCaption({ caption: 'Signed print detail', title: 'Title', alt: 'Alt' }),
		'Signed print detail'
	);
	assert.equal(buildCaption({ caption: '', title: 'Main title', alt: 'Alt text' }), 'Main title');
	assert.equal(buildCaption({ caption: '', title: '', alt: 'Fallback alt' }), 'Fallback alt');
	assert.equal(buildCaption({}), 'Setup photo');
});

test('media accessibility CLI helpers stay aligned with runtime accessible-media rules', () => {
	const runtime = loadAccessibleMediaHelpers();
	const cli = loadMediaCheckHelpers();

	const cases = [
		{ existingAlt: 'img', title: 'Monitor arm', context: 'desk', src: '/a/b_c.png' },
		{ existingAlt: 'Enough descriptive alt text here', title: 'X', context: 'Y', src: '/z.png' },
		{ existingAlt: '', title: '', context: 'Owen Miner photo from 2024', src: '' },
	];

	for (const input of cases) {
		assert.equal(cli.isWeakAlt(input.existingAlt), runtime.isWeakAlt(input.existingAlt));
		assert.equal(cli.buildAltText(input), runtime.buildAltText(input));
		assert.equal(
			cli.buildCaption({ title: input.title, alt: cli.buildAltText(input) }),
			runtime.buildCaption({ title: input.title, alt: runtime.buildAltText(input) })
		);
	}
});
