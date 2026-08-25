import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const liveStatusCloudflare = readFileSync(
	new URL('../functions/api/live-status.js', import.meta.url),
	'utf8'
);
const liveStatusNetlify = readFileSync(
	new URL('../netlify/functions/live-status.js', import.meta.url),
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

function loadLinkHelpers({ siteRoot, isLocal }) {
	const sandbox = { siteRoot, isLocal, String };
	vm.runInNewContext(
		`${extractFunction(componentsSource, 'getLink')}\nthis.__getLink = getLink;`,
		sandbox
	);
	assert.equal(typeof sandbox.__getLink, 'function');
	return sandbox.__getLink;
}

function loadFeedInjector({ siteRoot = 'https://www.owenminercs.com/', existingFeedScript = null, feedList = null } = {}) {
	const appended = [];
	const sandbox = {
		siteRoot,
		document: {
			querySelector(selector) {
				if (selector === 'script[data-owen-site-feed]') return existingFeedScript;
				return null;
			},
			getElementById(id) {
				if (id === 'site-feed-list') return feedList;
				return null;
			},
			createElement(tag) {
				return {
					tagName: String(tag).toUpperCase(),
					src: '',
					defer: false,
					attrs: new Map(),
					setAttribute(name, value) {
						this.attrs.set(name, String(value));
					},
				};
			},
			body: {
				appendChild(node) {
					appended.push(node);
					return node;
				},
			},
		},
	};

	vm.runInNewContext(
		`${extractFunction(componentsSource, 'injectSiteFeedClient')}\nthis.__inject = injectSiteFeedClient;`,
		sandbox
	);

	return {
		inject: sandbox.__inject,
		appended,
	};
}

test('getLink keeps hosted routes extensionless and adds .html only locally', () => {
	const hosted = loadLinkHelpers({
		siteRoot: 'https://www.owenminercs.com/',
		isLocal: false,
	});
	const local = loadLinkHelpers({ siteRoot: '/', isLocal: true });

	assert.equal(hosted(''), 'https://www.owenminercs.com/');
	assert.equal(hosted('Gaming/gaming'), 'https://www.owenminercs.com/Gaming/gaming');
	assert.equal(hosted('The%20Setup/the-setup'), 'https://www.owenminercs.com/The%20Setup/the-setup');
	assert.equal(hosted('dev/dev-stack'), 'https://www.owenminercs.com/dev/dev-stack');
	assert.equal(local(''), '/');
	assert.equal(local('QA/qa'), '/QA/qa.html');
	assert.equal(local('search'), '/search.html');
});

test('static homepage feed markup skips injecting a second site-feed script', () => {
	const alreadyLoaded = loadFeedInjector({
		existingFeedScript: { src: '/scripts/site-feed.js' },
	});
	alreadyLoaded.inject();
	assert.equal(alreadyLoaded.appended.length, 0);

	const staticFeed = loadFeedInjector({
		feedList: {
			hasAttribute(name) {
				return name === 'data-site-feed-static';
			},
		},
	});
	staticFeed.inject();
	assert.equal(staticFeed.appended.length, 0);

	const liveFeed = loadFeedInjector({
		siteRoot: 'https://www.owenminercs.com/',
		feedList: {
			hasAttribute() {
				return false;
			},
		},
	});
	liveFeed.inject();
	assert.equal(liveFeed.appended.length, 1);
	assert.equal(liveFeed.appended[0].src, 'https://www.owenminercs.com/scripts/site-feed.js');
	assert.equal(liveFeed.appended[0].defer, true);
	assert.equal(liveFeed.appended[0].attrs.get('data-owen-site-feed'), '1');
});

test('live-status follow URL stays on the canonical X handle', () => {
	for (const source of [liveStatusCloudflare, liveStatusNetlify]) {
		assert.match(source, /const FOLLOW_UPDATES_URL = 'https:\/\/x\.com\/OwenMiner';/);
		assert.doesNotMatch(source, /https:\/\/x\.com\/owenminercs/i);
		assert.doesNotMatch(source, /https:\/\/twitter\.com\/owenminercs/i);
	}
});
