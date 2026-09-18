import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractClassMethod(source, methodName) {
	const needle = `\n\t${methodName}(`;
	const start = source.indexOf(needle);
	assert.notEqual(start, -1, `${methodName} should exist as a class method`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${methodName} should have parameters`);

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
	assert.notEqual(paramsEnd, -1, `${methodName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${methodName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				const signatureAndBody = source.slice(start + 1, i + 1).trimStart();
				return `function ${signatureAndBody}`;
			}
		}
	}

	assert.fail(`${methodName} body should close`);
}

function loadAffiliateHelpers() {
	const source = readWorkspaceFile('scripts/affiliate-links.js');
	const sandbox = {
		URL,
		String,
		encodeURIComponent,
		Boolean,
		window: { location: { origin: 'https://owenminercs.com' } },
	};

	const methodNames = [
		'normalizeProductLinks',
		'escapeHtml',
		'getSearchTerms',
		'encodeSearchTerms',
		'isSafeHttpUrl',
		'safeHttpUrl',
		'isAmazonDirectUrl',
		'isAliExpressDirectUrl',
		'buildAmazonDirectUrl',
		'buildAmazonSearchUrl',
		'buildAliExpressSearchUrl',
		'getDirectLink',
		'getPrimaryProductUrl',
		'syncAdjacentPrimaryLink',
	];

	vm.runInNewContext(
		[
			...methodNames.map((name) => extractClassMethod(source, name)),
			'const api = {};',
			...methodNames.map((name) => `api.${name} = ${name}.bind(api);`),
			'this.__helpers = api;',
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'affiliate helpers should load');
	return sandbox.__helpers;
}

function makeAnchor(href) {
	return {
		href,
		title: '',
		target: '',
		rel: '',
	};
}

function makeSibling(anchor) {
	return {
		querySelector(selector) {
			if (selector === 'a[href]' && anchor) return anchor;
			return null;
		},
		previousElementSibling: null,
	};
}

test('syncAdjacentPrimaryLink writes a safe direct URL onto the nearest previous product anchor', () => {
	const { syncAdjacentPrimaryLink } = loadAffiliateHelpers();
	const anchor = makeAnchor('https://example.com/old');
	const sibling = makeSibling(anchor);
	const container = { previousElementSibling: sibling };
	const product = {
		name: 'Wooting 60HE',
		links: { official: 'https://wooting.io/wooting-60he' },
	};

	syncAdjacentPrimaryLink(container, product);

	assert.equal(anchor.href, 'https://wooting.io/wooting-60he');
	assert.equal(anchor.title, 'Wooting 60HE direct link');
	assert.equal(anchor.target, '_blank');
	assert.equal(anchor.rel, 'noopener noreferrer');
});

test('syncAdjacentPrimaryLink skips siblings without anchors and never applies javascript: hrefs', () => {
	const { syncAdjacentPrimaryLink } = loadAffiliateHelpers();
	const skippedAnchor = makeAnchor('https://example.com/keep');
	const closerWithoutAnchor = makeSibling(null);
	const fartherWithAnchor = makeSibling(skippedAnchor);
	closerWithoutAnchor.previousElementSibling = fartherWithAnchor;

	const container = { previousElementSibling: closerWithoutAnchor };
	const blocked = {
		name: 'Govee Bar',
		links: {
			official: 'javascript:alert(1)',
			disable_marketplaces: true,
		},
	};

	syncAdjacentPrimaryLink(container, blocked);
	assert.equal(skippedAnchor.href, 'https://example.com/keep');
	assert.equal(skippedAnchor.target, '');

	const searchFallback = {
		name: 'ROG Swift',
		links: { official: 'javascript:alert(1)' },
	};
	syncAdjacentPrimaryLink(container, searchFallback);
	assert.equal(
		skippedAnchor.href,
		'https://www.amazon.com/s?k=ROG+Swift&tag=owenminercs-20'
	);
	assert.equal(skippedAnchor.title, 'Search Amazon for ROG Swift');
	assert.equal(skippedAnchor.target, '_blank');
	assert.equal(skippedAnchor.rel, 'noopener noreferrer');
	assert.equal(String(skippedAnchor.href).includes('javascript:'), false);
});

test('syncAdjacentPrimaryLink no-ops without a container, product, or resolvable URL', () => {
	const { syncAdjacentPrimaryLink } = loadAffiliateHelpers();
	const anchor = makeAnchor('https://example.com/old');
	const sibling = makeSibling(anchor);
	const container = { previousElementSibling: sibling };

	syncAdjacentPrimaryLink(null, { name: 'Lamp', links: { official: 'https://example.com' } });
	syncAdjacentPrimaryLink(container, null);
	syncAdjacentPrimaryLink(container, {
		name: '',
		links: { official: 'javascript:alert(1)', disable_marketplaces: true },
	});

	assert.equal(anchor.href, 'https://example.com/old');
	assert.equal(anchor.target, '');
	assert.equal(anchor.rel, '');
});
