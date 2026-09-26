import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const socialFeedSource = readFileSync(
	new URL('../functions/api/social-feed.js', import.meta.url),
	'utf8'
);

const FIRST_CHANNEL_ID = 'UCabcdefghijklmnopqrstuv';
const SECOND_CHANNEL_ID = 'UC1234567890123456789012';

function extractAsyncFunction(source, functionName) {
	const marker = `async function ${functionName}`;
	const start = source.indexOf(marker);
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

function loadResolver(fetchImpl) {
	const sandbox = {
		fetch: fetchImpl,
		String,
		Error,
		encodeURIComponent,
	};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractAsyncFunction(socialFeedSource, 'resolveChannelIdFromHandle')}
		this.resolveChannelIdFromHandle = resolveChannelIdFromHandle;
		`,
		sandbox
	);
	return sandbox.resolveChannelIdFromHandle;
}

function htmlResponse(html, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		async text() {
			return html;
		},
	};
}

test('YouTube handle lookup strips one leading @ and encodes the handle into the channel URL', async () => {
	const calls = [];
	const resolveChannelIdFromHandle = loadResolver(async (url, init) => {
		calls.push({ url: String(url), userAgent: init?.headers?.['user-agent'] });
		return htmlResponse(`<html>"${FIRST_CHANNEL_ID}"</html>`);
	});

	assert.equal(await resolveChannelIdFromHandle('@OwenMiner'), FIRST_CHANNEL_ID);
	assert.equal(await resolveChannelIdFromHandle('OwenMiner'), FIRST_CHANNEL_ID);
	assert.equal(
		await resolveChannelIdFromHandle('Owen/Miner?x=1'),
		FIRST_CHANNEL_ID
	);

	assert.deepEqual(
		calls.map((call) => call.url),
		[
			'https://www.youtube.com/@OwenMiner',
			'https://www.youtube.com/@OwenMiner',
			'https://www.youtube.com/@Owen%2FMiner%3Fx%3D1',
		]
	);
	assert.deepEqual(
		calls.map((call) => call.userAgent),
		['Mozilla/5.0', 'Mozilla/5.0', 'Mozilla/5.0']
	);
});

test('YouTube handle lookup ignores empty handles and does not fetch them', async () => {
	let fetches = 0;
	const resolveChannelIdFromHandle = loadResolver(async () => {
		fetches += 1;
		throw new Error('fetch should not run');
	});

	assert.equal(await resolveChannelIdFromHandle(''), '');
	assert.equal(await resolveChannelIdFromHandle('@'), '');
	assert.equal(await resolveChannelIdFromHandle('   '), '');
	assert.equal(await resolveChannelIdFromHandle(null), '');
	assert.equal(fetches, 0);
});

test('YouTube handle lookup returns the first long channel id and fails closed otherwise', async () => {
	const shortId = 'UC1234567890123456789';
	const resolveChannelIdFromHandle = loadResolver(async () =>
		htmlResponse(
			`<html>${shortId} ${FIRST_CHANNEL_ID}" then ${SECOND_CHANNEL_ID}</html>`
		)
	);
	assert.equal(await resolveChannelIdFromHandle('OwenMiner'), FIRST_CHANNEL_ID);

	const emptyHtml = loadResolver(async () => htmlResponse('<html>no channel here</html>'));
	assert.equal(await emptyHtml('OwenMiner'), '');

	let textReads = 0;
	const failing = loadResolver(async () => ({
		ok: false,
		status: 503,
		async text() {
			textReads += 1;
			return FIRST_CHANNEL_ID;
		},
	}));
	await assert.rejects(() => failing('@OwenMiner'), /HTTP 503/);
	assert.equal(textReads, 0);
});
