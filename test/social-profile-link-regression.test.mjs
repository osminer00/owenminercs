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

function loadProfileLinkHelpers(options = {}) {
	const hrefBySelector = options.hrefBySelector || {};
	const jsonLdScripts = Array.isArray(options.jsonLdScripts) ? options.jsonLdScripts : [];

	const sandbox = {
		String,
		document: {
			querySelector(selector) {
				if (!Object.prototype.hasOwnProperty.call(hrefBySelector, selector)) return null;
				const href = hrefBySelector[selector];
				if (href == null) return null;
				return {
					getAttribute() {
						return href;
					},
				};
			},
			querySelectorAll(selector) {
				if (selector !== 'script[type="application/ld+json"]') return [];
				return jsonLdScripts.map((textContent) => ({ textContent }));
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(socialCloudSource, 'socialProfileFallbacks')}
		${extractConstAssignment(socialCloudSource, 'socialProfileSelectors')}
		${extractFunction(socialCloudSource, 'normalizePlatformKey')}
		${extractFunction(socialCloudSource, 'isHttpUrl')}
		${extractFunction(socialCloudSource, 'getSocialProfileLink')}
		${extractFunction(socialCloudSource, 'getRedditProfileUrlFromPage')}
		this.__helpers = {
			socialProfileFallbacks,
			getSocialProfileLink,
			getRedditProfileUrlFromPage,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('getSocialProfileLink ignores untrusted dock hrefs and maps twitter to the X fallback', () => {
	const xSelector = ".site-social-nav__link[href*='x.com/']";
	const youtubeSelector = ".site-social-nav__link[href*='youtube.com/']";
	const helpers = loadProfileLinkHelpers({
		hrefBySelector: {
			[xSelector]: 'javascript:alert(1)',
			[youtubeSelector]: 'https://www.youtube.com/@OwenMinerCS',
		},
	});
	const fallbacks = helpers.socialProfileFallbacks;

	assert.equal(helpers.getSocialProfileLink('twitter'), fallbacks.x);
	assert.equal(helpers.getSocialProfileLink('X'), fallbacks.x);
	assert.equal(helpers.getSocialProfileLink('youtube'), 'https://www.youtube.com/@OwenMinerCS');
	assert.equal(helpers.getSocialProfileLink('unknown-platform'), '');
	assert.equal(fallbacks.x, 'https://x.com/OwenMiner');
	assert.equal(fallbacks.discord, 'https://discord.gg/fA9GbxmAge');
});

test('getSocialProfileLink rejects mailto, relative, and empty dock hrefs', () => {
	const twitchSelector = ".site-social-nav__link[href*='twitch.tv/']";
	const instagramSelector = ".site-social-nav__link[href*='instagram.com/']";
	const tiktokSelector = ".site-social-nav__link[href*='tiktok.com/']";
	const helpers = loadProfileLinkHelpers({
		hrefBySelector: {
			[twitchSelector]: 'mailto:owen@example.com',
			[instagramSelector]: '/Socials/socials.html',
			[tiktokSelector]: '   ',
		},
	});
	const fallbacks = helpers.socialProfileFallbacks;

	assert.equal(helpers.getSocialProfileLink('twitch'), fallbacks.twitch);
	assert.equal(helpers.getSocialProfileLink('instagram'), fallbacks.instagram);
	assert.equal(helpers.getSocialProfileLink('tiktok'), fallbacks.tiktok);
});

test('getRedditProfileUrlFromPage prefers a page href, then JSON-LD, then the OwenMCS fallback', () => {
	const emptyDom = loadProfileLinkHelpers();
	assert.equal(emptyDom.getRedditProfileUrlFromPage(), 'https://www.reddit.com/user/OwenMCS');

	const fromDom = loadProfileLinkHelpers({
		hrefBySelector: {
			'a[href*="reddit.com/user/"], a[href*="reddit.com/u/"]':
				'https://www.reddit.com/user/OwenMCS',
		},
	});
	assert.equal(fromDom.getRedditProfileUrlFromPage(), 'https://www.reddit.com/user/OwenMCS');

	const fromJsonLd = loadProfileLinkHelpers({
		hrefBySelector: {
			'a[href*="reddit.com/user/"], a[href*="reddit.com/u/"]': '',
		},
		jsonLdScripts: [
			'{"sameAs":["https://www.reddit.com/user/OwenMCS","https://x.com/OwenMiner"]}',
		],
	});
	assert.equal(fromJsonLd.getRedditProfileUrlFromPage(), 'https://www.reddit.com/user/OwenMCS');
});
