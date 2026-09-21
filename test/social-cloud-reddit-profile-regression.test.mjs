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

function loadRedditProfileHelpers(document) {
	const source = readWorkspaceFile('Socials/scripts/social-cloud.js');
	const sandbox = { String, document };
	vm.runInNewContext(
		[
			extractFunction(source, 'parseRedditUsernameFromUrl'),
			extractFunction(source, 'getRedditProfileUrlFromPage'),
			'this.parseRedditUsernameFromUrl = parseRedditUsernameFromUrl;',
			'this.getRedditProfileUrlFromPage = getRedditProfileUrlFromPage;',
		].join('\n'),
		sandbox
	);
	return sandbox;
}

function makeDocument({ redditHref = '', jsonLd = [] } = {}) {
	const redditAnchor = redditHref
		? {
				getAttribute(name) {
					return name === 'href' ? redditHref : null;
				},
			}
		: null;

	return {
		querySelector(sel) {
			if (String(sel).includes('reddit.com')) return redditAnchor;
			return null;
		},
		querySelectorAll(sel) {
			if (String(sel).includes('application/ld+json')) return jsonLd;
			return [];
		},
	};
}

test('parseRedditUsernameFromUrl reads /user and /u paths and ignores query, hash, and non-profile URLs', () => {
	const { parseRedditUsernameFromUrl } = loadRedditProfileHelpers(makeDocument());

	assert.equal(parseRedditUsernameFromUrl('https://www.reddit.com/user/OwenMCS'), 'OwenMCS');
	assert.equal(parseRedditUsernameFromUrl('https://www.reddit.com/u/OwenMCS/'), 'OwenMCS');
	assert.equal(
		parseRedditUsernameFromUrl('https://old.reddit.com/user/OwenMCS?utm=1#about'),
		'OwenMCS'
	);
	assert.equal(parseRedditUsernameFromUrl('HTTPS://REDDIT.COM/USER/OwenMCS'), 'OwenMCS');
	assert.equal(parseRedditUsernameFromUrl('https://www.reddit.com/user/ OwenMCS '), 'OwenMCS');
	assert.equal(parseRedditUsernameFromUrl('https://www.reddit.com/r/cs2'), '');
	assert.equal(parseRedditUsernameFromUrl('https://example.com/user/OwenMCS'), '');
	assert.equal(parseRedditUsernameFromUrl('javascript:alert(1)'), '');
	assert.equal(parseRedditUsernameFromUrl(''), '');
	assert.equal(parseRedditUsernameFromUrl(null), '');
	assert.equal(parseRedditUsernameFromUrl(undefined), '');
});

test('getRedditProfileUrlFromPage prefers a DOM href, then JSON-LD, then the OwenMCS fallback', () => {
	const defaultUrl = 'https://www.reddit.com/user/OwenMCS';

	const fromDom = loadRedditProfileHelpers(
		makeDocument({ redditHref: 'https://www.reddit.com/u/FromNav' })
	);
	assert.equal(fromDom.getRedditProfileUrlFromPage(), 'https://www.reddit.com/u/FromNav');

	const blankDomHref = loadRedditProfileHelpers(
		makeDocument({
			redditHref: '   ',
			jsonLd: [
				{ textContent: '' },
				{
					textContent:
						'{"sameAs":["https://www.reddit.com/user/FromJsonLd","https://x.com/OwenMiner"]}',
				},
			],
		})
	);
	assert.equal(
		blankDomHref.getRedditProfileUrlFromPage(),
		'https://www.reddit.com/user/FromJsonLd'
	);

	const jsonLdHttp = loadRedditProfileHelpers(
		makeDocument({
			jsonLd: [{ textContent: 'See http://reddit.com/u/OldSchool in this blob' }],
		})
	);
	assert.equal(jsonLdHttp.getRedditProfileUrlFromPage(), 'http://reddit.com/u/OldSchool');

	const fallback = loadRedditProfileHelpers(
		makeDocument({
			jsonLd: [{ textContent: '{"sameAs":["https://x.com/OwenMiner"]}' }],
		})
	);
	assert.equal(fallback.getRedditProfileUrlFromPage(), defaultUrl);

	const missingDocumentNodes = loadRedditProfileHelpers({
		querySelector() {
			return null;
		},
		querySelectorAll() {
			return [];
		},
	});
	assert.equal(missingDocumentNodes.getRedditProfileUrlFromPage(), defaultUrl);
});
