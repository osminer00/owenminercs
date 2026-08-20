import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const qaSource = readFileSync(new URL('../QA/scripts/qa-feed.js', import.meta.url), 'utf8');

function extractFunction(source, functionName) {
	const syncStart = source.indexOf(`function ${functionName}`);
	const asyncStart = source.indexOf(`async function ${functionName}`);
	const start =
		asyncStart !== -1 && (syncStart === -1 || asyncStart < syncStart) ? asyncStart : syncStart;
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

function loadQaHelpers(options = {}) {
	const fetches = [];
	const live = options.live;
	const fallback = options.fallback;
	const hostname = options.hostname == null ? 'owenminercs.com' : options.hostname;
	const protocol = options.protocol == null ? 'https:' : options.protocol;

	const sandbox = {
		String,
		Boolean,
		Array,
		Set,
		Date,
		JSON,
		Number,
		window: {
			location: { hostname, protocol },
		},
		async fetch(url) {
			fetches.push(String(url));
			if (String(url).includes('api/discord-qa')) {
				if (live === null) return { ok: false, json: async () => null };
				return {
					ok: true,
					json: async () => live,
				};
			}
			if (fallback === null) return { ok: false, json: async () => null };
			return {
				ok: true,
				json: async () => fallback,
			};
		},
		fetches,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(qaSource, 'isLocalHost')}
		${extractFunction(qaSource, 'escapeHtml')}
		${extractFunction(qaSource, 'formatDate')}
		${extractFunction(qaSource, 'fetchJson')}
		${extractFunction(qaSource, 'loadFeedPayload')}
		${extractFunction(qaSource, 'render')}
		this.__helpers = {
			isLocalHost,
			escapeHtml,
			formatDate,
			loadFeedPayload,
			render,
			fetches,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('QA feed escapes HTML and only links absolute https Discord URLs', () => {
	const helpers = loadQaHelpers();
	assert.equal(
		helpers.escapeHtml('<img src=x onerror="alert(1)"> & "q"'),
		'&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;q&quot;'
	);

	const container = { innerHTML: '' };
	helpers.render(container, {
		items: [
			{
				question: '<script>alert(1)</script>',
				answer: 'line1\nline2',
				answeredAt: 'not-a-date',
				url: 'javascript:alert(1)',
			},
			{
				question: 'Safe question',
				answer: 'Safe answer',
				answeredAt: '2024-07-04T12:00:00.000Z',
				url: 'http://evil.example/thread',
			},
			{
				question: 'Linked question',
				answer: 'Linked answer',
				url: 'https://discord.com/channels/1/2/"onclick',
			},
		],
	});

	assert.match(container.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
	assert.equal(container.innerHTML.includes('<script>'), false);
	assert.equal(container.innerHTML.includes('javascript:alert'), false);
	assert.equal(container.innerHTML.includes('http://evil.example'), false);
	assert.match(
		container.innerHTML,
		/href="https:\/\/discord.com\/channels\/1\/2\/&quot;onclick"/
	);
	assert.match(container.innerHTML, /Open in Discord/);
	assert.match(container.innerHTML, /<br>/);
});

test('loadFeedPayload skips live API on localhost and dedupes static rows', async () => {
	const local = loadQaHelpers({
		hostname: 'localhost',
		live: { items: [{ id: 'live-1', question: 'Should not load' }], source: 'discord' },
		fallback: {
			items: [{ id: 'static-1', question: 'Static only' }],
			source: 'static',
		},
	});
	assert.equal(local.isLocalHost(), true);
	const localPayload = await local.loadFeedPayload('/');
	assert.equal(
		local.fetches.some((url) => url.includes('api/discord-qa')),
		false
	);
	assert.equal(localPayload.items.length, 1);
	assert.equal(localPayload.items[0].id, 'static-1');
	assert.deepEqual(Array.from(localPayload.sources), ['static']);

	const remote = loadQaHelpers({
		hostname: 'owenminercs.com',
		live: {
			items: [{ id: 'q1', question: 'Live question' }, { question: 'No id live' }],
			source: 'discord',
		},
		fallback: {
			items: [
				{ id: 'q1', question: 'Duplicate static' },
				{ question: 'No id live' },
				{ id: 'q2', question: 'New static' },
				{ question: '' },
			],
			source: 'static',
		},
	});
	const remotePayload = await remote.loadFeedPayload('https://owenminercs.com/');
	assert.equal(
		remote.fetches.some((url) => url.includes('api/discord-qa')),
		true
	);
	assert.equal(remotePayload.items.length, 4);
	assert.equal(remotePayload.items[0].question, 'Live question');
	assert.equal(remotePayload.items[2].question, 'New static');
	assert.deepEqual(Array.from(remotePayload.sources), ['discord', 'static']);
});
