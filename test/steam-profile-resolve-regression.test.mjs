import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const HANDLERS = [
	'functions/api/steam-cs2-inventory.js',
	'netlify/functions/steam-cs2-inventory.js',
];

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractConst(source, name) {
	const match = source.match(new RegExp(`const ${name} = [^;]+;`));
	assert.ok(match, `${name} should exist`);
	return match[0];
}

function extractFunction(source, functionName) {
	const marker = `function ${functionName}(`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${functionName} should exist`);
	const declaredAt = source.slice(Math.max(0, start - 6), start) === 'async ' ? start - 6 : start;

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
			if (depth === 0) return source.slice(declaredAt, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function loadResolver(relativePath) {
	const source = readWorkspaceFile(relativePath);
	const calls = [];
	const state = { next: { ok: true, status: 200, text: '' } };
	const sandbox = {
		encodeURIComponent,
		String,
		Error,
		RegExp,
		fetch: async (url) => {
			calls.push(String(url));
			const spec = state.next;
			return {
				ok: spec.ok,
				status: spec.status,
				text: async () => spec.text,
			};
		},
	};

	vm.runInNewContext(
		[
			extractConst(source, 'DEFAULT_PROFILE'),
			extractConst(source, 'STEAM_COMMUNITY_BASE'),
			extractFunction(source, 'looksLikeSteamId64'),
			extractFunction(source, 'extractSteamIdFromXml'),
			extractFunction(source, 'fetchText'),
			extractFunction(source, 'resolveSteamId64'),
			'this.__helpers = { resolveSteamId64 };',
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, `resolver should load from ${relativePath}`);
	return { helpers: sandbox.__helpers, calls, state, source };
}

const loadedHandlers = HANDLERS.map((relativePath) => ({
	relativePath,
	...loadResolver(relativePath),
}));

test('Cloudflare and Netlify Steam resolvers share the public profile defaults', () => {
	const [cloudflare, netlify] = loadedHandlers;
	assert.match(cloudflare.source, /const DEFAULT_PROFILE = 'putaWinfrontofsteamlilbro';/);
	assert.match(netlify.source, /const DEFAULT_PROFILE = 'putaWinfrontofsteamlilbro';/);
	assert.match(cloudflare.source, /const STEAM_COMMUNITY_BASE = 'https:\/\/steamcommunity.com';/);
	assert.match(netlify.source, /const STEAM_COMMUNITY_BASE = 'https:\/\/steamcommunity.com';/);
});

test('a 17-digit SteamID64 is trimmed and returned without calling Steam', async () => {
	for (const loaded of loadedHandlers) {
		loaded.calls.length = 0;
		const id = await loaded.helpers.resolveSteamId64('\n76561198000000000\n');
		assert.equal(id, '76561198000000000');
		assert.deepEqual(loaded.calls, []);
	}
});

test('vanity profiles are percent-encoded into the community XML URL', async () => {
	for (const loaded of loadedHandlers) {
		loaded.calls.length = 0;
		loaded.state.next = {
			ok: true,
			status: 200,
			text: '<profile><steamID64>76561198000000001</steamID64></profile>',
		};
		const id = await loaded.helpers.resolveSteamId64('Owen Miner/CS?x');
		assert.equal(id, '76561198000000001');
		assert.deepEqual(loaded.calls, [
			'https://steamcommunity.com/id/Owen%20Miner%2FCS%3Fx/?xml=1',
		]);
	}
});

test('blank profiles fetch the default vanity, and a short id fails closed', async () => {
	for (const loaded of loadedHandlers) {
		loaded.calls.length = 0;
		loaded.state.next = {
			ok: true,
			status: 200,
			text: '<steamID64>76561198000000002</steamID64>',
		};
		assert.equal(await loaded.helpers.resolveSteamId64(''), '76561198000000002');
		assert.equal(await loaded.helpers.resolveSteamId64(undefined), '76561198000000002');
		assert.deepEqual(loaded.calls, [
			'https://steamcommunity.com/id/putaWinfrontofsteamlilbro/?xml=1',
			'https://steamcommunity.com/id/putaWinfrontofsteamlilbro/?xml=1',
		]);

		loaded.state.next = { ok: true, status: 200, text: '<steamID64>123</steamID64>' };
		await assert.rejects(
			() => loaded.helpers.resolveSteamId64('missing-name'),
			/Could not resolve Steam profile: missing-name/
		);
	}
});

test('a non-OK Steam profile response includes the status and requested URL', async () => {
	for (const loaded of loadedHandlers) {
		loaded.calls.length = 0;
		loaded.state.next = { ok: false, status: 403, text: 'denied' };
		await assert.rejects(
			() => loaded.helpers.resolveSteamId64('owen'),
			/Steam request failed \(403\) for https:\/\/steamcommunity.com\/id\/owen\/\?xml=1/
		);
		assert.deepEqual(loaded.calls, ['https://steamcommunity.com/id/owen/?xml=1']);
	}
});
