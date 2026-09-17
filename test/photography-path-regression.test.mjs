import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
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

function loadPhotographyHelpers(initialPhotoBase = '') {
	const source = readWorkspaceFile('Photography/scripts/photography.js');
	const sandbox = { String, Object, Number, RegExp };

	vm.runInNewContext(
		[
			`var photoBase = ${JSON.stringify(initialPhotoBase)};`,
			extractFunction(source, 'resolvePhotoPath'),
			extractFunction(source, 'downloadBasename'),
			`this.__helpers = {
				resolvePhotoPath,
				downloadBasename,
				setPhotoBase: function (next) {
					photoBase = next;
				},
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'photography helpers should load');
	return sandbox.__helpers;
}

test('resolvePhotoPath keeps absolute, data, and root paths, and prefixes relative files with photoBase', () => {
	const helpers = loadPhotographyHelpers('/Photography/');

	assert.equal(helpers.resolvePhotoPath('images/desk.webp'), '/Photography/images/desk.webp');
	assert.equal(helpers.resolvePhotoPath('  images/desk.webp  '), '/Photography/images/desk.webp');
	assert.equal(
		helpers.resolvePhotoPath('https://cdn.example/photo.jpg'),
		'https://cdn.example/photo.jpg'
	);
	assert.equal(
		helpers.resolvePhotoPath('HTTP://cdn.example/photo.jpg'),
		'HTTP://cdn.example/photo.jpg'
	);
	assert.equal(
		helpers.resolvePhotoPath('data:image/png;base64,abc'),
		'data:image/png;base64,abc'
	);
	assert.equal(helpers.resolvePhotoPath('/images/desk.webp'), '/images/desk.webp');
	assert.equal(
		helpers.resolvePhotoPath('//cdn.example/photo.jpg'),
		'//cdn.example/photo.jpg',
		'paths that start with / including protocol-relative URLs are not prefixed'
	);
	assert.equal(
		helpers.resolvePhotoPath('javascript:alert(1)'),
		'/Photography/javascript:alert(1)',
		'non-http schemes are treated as relative paths'
	);
	assert.equal(helpers.resolvePhotoPath(''), '');
	assert.equal(helpers.resolvePhotoPath(null), '');
	assert.equal(helpers.resolvePhotoPath(12), '');

	helpers.setPhotoBase('');
	assert.equal(helpers.resolvePhotoPath('images/desk.webp'), 'images/desk.webp');
});

test('downloadBasename prefers an explicit filename, else sanitizes the title plus the full-image extension', () => {
	const { downloadBasename } = loadPhotographyHelpers();

	assert.equal(
		downloadBasename({
			downloadFilename: '  custom-print.bin  ',
			title: 'Ignored',
			full: 'a.jpg',
		}),
		'custom-print.bin'
	);
	assert.equal(
		downloadBasename({ title: 'My Cool Photo!', full: 'images/shot.WEBP?x=1' }),
		'My-Cool-Photo.webp'
	);
	assert.equal(downloadBasename({ title: '', full: 'folder/pic.PNG' }), 'photo.png');
	assert.equal(downloadBasename({ title: 'untitled' }), 'untitled.jpg');
	assert.equal(
		downloadBasename({ title: '!!!', full: 'no-extension' }),
		'photo.jpg',
		'punctuation-only titles fall back to photo plus jpg'
	);
});
