import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractConst(source, name) {
	const start = source.indexOf(`const ${name} =`);
	assert.notEqual(start, -1, `${name} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${name} should end with a semicolon`);
	return source.slice(start, end + 1);
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

function makeDocument(links = []) {
	return {
		querySelector(sel) {
			const match = String(sel).match(/href\*='([^']+)'/);
			const needle = match ? match[1] : '';
			const found = links.find((link) => String(link.href || '').includes(needle));
			if (!found) return null;
			return {
				getAttribute(name) {
					return name === 'href' ? found.href : null;
				},
			};
		},
	};
}

function loadProfileLinkHelpers(document) {
	const source = readWorkspaceFile('Socials/scripts/social-cloud.js');
	const sandbox = {
		String,
		URL,
		document,
		window: { location: { origin: 'https://owenminercs.com' } },
	};
	vm.runInNewContext(
		[
			extractConst(source, 'socialProfileFallbacks'),
			extractConst(source, 'socialProfileSelectors'),
			extractFunction(source, 'normalizePlatformKey'),
			extractFunction(source, 'isHttpUrl'),
			extractFunction(source, 'getSocialProfileLink'),
			extractFunction(source, 'normalizeVisitedUrl'),
			'this.getSocialProfileLink = getSocialProfileLink;',
			'this.normalizeVisitedUrl = normalizeVisitedUrl;',
			'this.socialProfileFallbacks = socialProfileFallbacks;',
			'this.isHttpUrl = isHttpUrl;',
		].join('\n'),
		sandbox
	);
	return sandbox;
}

test('getSocialProfileLink uses live http(s) nav hrefs and rejects javascript or empty hrefs', () => {
	const live = loadProfileLinkHelpers(
		makeDocument([
			{ href: 'https://x.com/OwenMiner' },
			{ href: 'javascript:alert(1)' },
			{ href: 'https://www.twitch.tv/owenminercs' },
		])
	);

	assert.equal(live.getSocialProfileLink('twitter'), 'https://x.com/OwenMiner');
	assert.equal(live.getSocialProfileLink('X'), 'https://x.com/OwenMiner');
	assert.equal(live.getSocialProfileLink('twitch'), 'https://www.twitch.tv/owenminercs');

	const unsafeReddit = loadProfileLinkHelpers(
		makeDocument([
			{ href: 'javascript:void(0)//reddit.com/u/hack' },
			{ href: 'https://x.com/OwenMiner' },
		])
	);
	assert.equal(
		unsafeReddit.getSocialProfileLink('reddit'),
		unsafeReddit.socialProfileFallbacks.reddit
	);

	const blankHref = loadProfileLinkHelpers(makeDocument([{ href: '   ' }]));
	assert.equal(
		blankHref.getSocialProfileLink('youtube'),
		blankHref.socialProfileFallbacks.youtube
	);

	const missingNav = loadProfileLinkHelpers(makeDocument([]));
	assert.equal(
		missingNav.getSocialProfileLink('tiktok'),
		missingNav.socialProfileFallbacks.tiktok
	);
	assert.equal(
		missingNav.getSocialProfileLink('discord'),
		missingNav.socialProfileFallbacks.discord
	);
	assert.equal(missingNav.getSocialProfileLink('bluesky'), '');
	assert.equal(missingNav.getSocialProfileLink(''), '');
	assert.equal(missingNav.getSocialProfileLink(null), '');
	assert.equal(missingNav.isHttpUrl('javascript:alert(1)'), false);
	assert.equal(missingNav.isHttpUrl('HTTPS://example.com'), true);
});

test('normalizeVisitedUrl keeps http(s) URLs, resolves relative paths, and drops javascript or invalid URLs', () => {
	const { normalizeVisitedUrl } = loadProfileLinkHelpers(makeDocument());

	assert.equal(
		normalizeVisitedUrl('https://www.reddit.com/user/OwenMCS'),
		'https://www.reddit.com/user/OwenMCS'
	);
	assert.equal(
		normalizeVisitedUrl('/Socials/socials.html'),
		'https://owenminercs.com/Socials/socials.html'
	);
	assert.equal(normalizeVisitedUrl('javascript:alert(1)'), '');
	assert.equal(normalizeVisitedUrl('mailto:owen@example.com'), '');
	assert.equal(normalizeVisitedUrl('http://'), '');
	assert.equal(
		normalizeVisitedUrl('not a url :::'),
		'https://owenminercs.com/not%20a%20url%20:::'
	);
});
