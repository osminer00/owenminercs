import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const photographySource = readFileSync(
	new URL('../Photography/scripts/photography.js', import.meta.url),
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

function loadPhotoHelpers(options = {}) {
	const sandbox = {
		String,
		Number,
		Date,
		RegExp,
		photoBase: options.photoBase == null ? '/photos/' : options.photoBase,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		var photoBase = this.photoBase;
		${extractFunction(photographySource, 'resolvePhotoPath')}
		${extractFunction(photographySource, 'formatDateTaken')}
		${extractFunction(photographySource, 'downloadBasename')}
		this.__helpers = {
			resolvePhotoPath,
			formatDateTaken,
			downloadBasename,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('resolvePhotoPath keeps absolute/data URLs and prefixes relative paths', () => {
	const helpers = loadPhotoHelpers({ photoBase: 'https://cdn.example/gallery/' });

	assert.equal(helpers.resolvePhotoPath(''), '');
	assert.equal(helpers.resolvePhotoPath(null), '');
	assert.equal(helpers.resolvePhotoPath('   '), 'https://cdn.example/gallery/');
	assert.equal(
		helpers.resolvePhotoPath('https://img.example/full.jpg'),
		'https://img.example/full.jpg'
	);
	assert.equal(
		helpers.resolvePhotoPath('http://img.example/full.jpg'),
		'http://img.example/full.jpg'
	);
	assert.equal(helpers.resolvePhotoPath('/images/photo.jpg'), '/images/photo.jpg');
	assert.equal(
		helpers.resolvePhotoPath('data:image/gif;base64,AAAA'),
		'data:image/gif;base64,AAAA'
	);
	assert.equal(
		helpers.resolvePhotoPath('thumbs/one.jpg'),
		'https://cdn.example/gallery/thumbs/one.jpg'
	);
	assert.equal(
		helpers.resolvePhotoPath('  thumbs/one.jpg  '),
		'https://cdn.example/gallery/thumbs/one.jpg'
	);
});

test('formatDateTaken and downloadBasename sanitize missing or hostile photo fields', () => {
	const helpers = loadPhotoHelpers();

	assert.equal(helpers.formatDateTaken(''), 'Date unknown');
	assert.equal(helpers.formatDateTaken(null), 'Date unknown');
	assert.equal(helpers.formatDateTaken('not-a-date'), 'not-a-date');

	const labeled = helpers.formatDateTaken('2024-07-04T15:00:00.000Z');
	assert.match(labeled, /2024/);
	assert.match(labeled, /July|Jul/i);

	assert.equal(
		helpers.downloadBasename({ downloadFilename: '  signed-print.jpg  ' }),
		'signed-print.jpg'
	);
	assert.equal(
		helpers.downloadBasename({
			title: 'Cabin Light <script>',
			full: 'folder/cabin light.png?token=1',
		}),
		'Cabin-Light-script.png'
	);
	assert.equal(
		helpers.downloadBasename({
			title: '../evil',
			full: 'no-extension',
		}),
		'evil.jpg'
	);
	assert.equal(helpers.downloadBasename({ title: '!!!', full: '' }), 'photo.jpg');
});
