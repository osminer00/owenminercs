import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/site-feed.js', import.meta.url), 'utf8');
const donationLinks = JSON.parse(
	readFileSync(new URL('../donation-links.json', import.meta.url), 'utf8')
);

function extractFunction(src, functionName) {
	const pattern = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`);
	const match = pattern.exec(src);
	assert.ok(match, `${functionName} should exist`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = src.indexOf('(', match.index); i < src.length; i += 1) {
		const char = src[i];
		if (char === '(') parenDepth += 1;
		if (char === ')') {
			parenDepth -= 1;
			if (parenDepth === 0) {
				paramsEnd = i;
				break;
			}
		}
	}
	assert.notEqual(paramsEnd, -1, `${functionName} parameters should close`);

	const braceStart = src.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < src.length; i += 1) {
		const char = src[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return src.slice(match.index, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function loadHelpers() {
	const context = {
		console,
		window: { location: { origin: 'https://www.owenminercs.com' } },
		document: {
			querySelector() {
				return null;
			},
		},
		Intl,
		Date,
		String,
		Number,
	};
	vm.createContext(context);
	vm.runInContext(
		`
		const KO_FI_TIP_URL = ${JSON.stringify(donationLinks.ko_fi)};
		const STREAMELEMENTS_TIP_URL = ${JSON.stringify(donationLinks.streamelements_tip)};
		${extractFunction(source, 'escapeHtml')}
		${extractFunction(source, 'linkifyKoFiAndStreamElements')}
		${extractFunction(source, 'getSiteRoot')}
		${extractFunction(source, 'feedUrl')}
		${extractFunction(source, 'formatDate')}
		${extractFunction(source, 'resolveHref')}
		this.escapeHtml = escapeHtml;
		this.linkifyKoFiAndStreamElements = linkifyKoFiAndStreamElements;
		this.getSiteRoot = getSiteRoot;
		this.feedUrl = feedUrl;
		this.formatDate = formatDate;
		this.resolveHref = resolveHref;
		`,
		context
	);
	return {
		escapeHtml: context.escapeHtml,
		linkifyKoFiAndStreamElements: context.linkifyKoFiAndStreamElements,
		getSiteRoot: context.getSiteRoot,
		feedUrl: context.feedUrl,
		formatDate: context.formatDate,
		resolveHref: context.resolveHref,
	};
}

test('resolveHref keeps absolute URLs and normalizes relative feed paths', () => {
	const { resolveHref } = loadHelpers();

	assert.equal(resolveHref('https://example.com/a'), 'https://example.com/a');
	assert.equal(resolveHref('http://example.com/b'), 'http://example.com/b');
	assert.equal(resolveHref('/Gaming/gaming'), '/Gaming/gaming');
	assert.equal(resolveHref('The Setup/the-setup'), '/The Setup/the-setup');
	assert.equal(resolveHref(''), '/');
	assert.equal(resolveHref(null), '/');
});

test('linkifyKoFiAndStreamElements escapes HTML then wraps tip brand names', () => {
	assert.match(source, new RegExp(donationLinks.ko_fi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
	assert.match(
		source,
		new RegExp(donationLinks.streamelements_tip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
	);

	const { linkifyKoFiAndStreamElements } = loadHelpers();

	assert.equal(linkifyKoFiAndStreamElements(null), '');
	assert.equal(linkifyKoFiAndStreamElements(12), '');

	const linked = linkifyKoFiAndStreamElements(
		'Support via Ko-fi or StreamElements <script>x</script>'
	);
	assert.match(
		linked,
		new RegExp(
			`<a href="${donationLinks.ko_fi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>Ko-fi</a>`
		)
	);
	assert.match(
		linked,
		new RegExp(
			`<a href="${donationLinks.streamelements_tip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>StreamElements</a>`
		)
	);
	assert.match(linked, /&lt;script&gt;x&lt;\/script&gt;/);
	assert.doesNotMatch(linked, /<script>/);
});

test('getSiteRoot and feedUrl derive JSON path from the script tag src', () => {
	const helpers = loadHelpers();
	assert.equal(helpers.getSiteRoot(), 'https://www.owenminercs.com/');
	assert.equal(helpers.feedUrl(), 'https://www.owenminercs.com/data/site-feed.json');

	const context = {
		console,
		window: { location: { origin: 'https://www.owenminercs.com' } },
		document: {
			querySelector(selector) {
				assert.equal(selector, 'script[data-owen-site-feed]');
				return { src: 'https://cdn.example/scripts/site-feed.js?v=2' };
			},
		},
	};
	vm.createContext(context);
	vm.runInContext(
		`
		${extractFunction(source, 'getSiteRoot')}
		${extractFunction(source, 'feedUrl')}
		this.getSiteRoot = getSiteRoot;
		this.feedUrl = feedUrl;
		`,
		context
	);
	assert.equal(context.getSiteRoot(), 'https://cdn.example/');
	assert.equal(context.feedUrl(), 'https://cdn.example/data/site-feed.json');
});

test('formatDate formats valid ISO dates and falls back for invalid values', () => {
	const { formatDate } = loadHelpers();

	assert.equal(formatDate(''), '');
	assert.equal(formatDate(null), '');
	assert.equal(formatDate(2024), '');

	const formatted = formatDate('2026-05-06');
	assert.match(formatted, /2026/);
	assert.match(formatted, /May|5/);

	assert.equal(formatDate('not-a-date'), 'not-a-date');
});
