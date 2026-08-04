import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

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

function extractConstArray(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);

	const arrayStart = source.indexOf('[', start);
	assert.notEqual(arrayStart, -1, `${constName} should have an array body`);

	let depth = 0;
	for (let i = arrayStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '[') depth += 1;
		if (char === ']') {
			depth -= 1;
			if (depth === 0) {
				let end = i + 1;
				if (source[end] === ';') end += 1;
				return source.slice(start, end);
			}
		}
	}

	assert.fail(`${constName} array should close`);
}

function loadCs2SkinHelpers() {
	const source = readWorkspaceFile('scripts/cs2-skins.js');
	const sandbox = {
		String,
		Number,
		Math,
		Array,
	};

	vm.runInNewContext(
		[
			extractConstArray(source, 'OFFLINE_PRACTICE_STEPS'),
			extractFunction(source, 'escapeHtml'),
			extractFunction(source, 'buildOfflineCommand'),
			extractFunction(source, 'formatUsd'),
			extractFunction(source, 'makeCard'),
			`this.__helpers = {
				OFFLINE_PRACTICE_STEPS,
				escapeHtml,
				buildOfflineCommand,
				formatUsd,
				makeCard,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'cs2-skins helpers should load');
	return sandbox.__helpers;
}

const helpers = loadCs2SkinHelpers();

test('cs2-skins escapeHtml neutralizes markup and attribute breakouts', () => {
	const { escapeHtml } = helpers;

	assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
	assert.equal(escapeHtml(`"'>&`), '&quot;&#39;&gt;&amp;');
	assert.equal(escapeHtml(null), '');
	assert.equal(escapeHtml(undefined), '');
});

test('cs2-skins formatUsd prefers lowest price and tolerates missing numbers', () => {
	const { formatUsd } = helpers;

	assert.equal(formatUsd({ pricing: { lowestPriceUsd: 12.5, medianPriceUsd: 20 } }), '$12.50');
	assert.equal(formatUsd({ pricing: { medianPriceUsd: 9 } }), '$9.00');
	assert.equal(formatUsd({ pricing: { lowestPriceUsd: Number.NaN } }), 'N/A');
	assert.equal(formatUsd({}), 'N/A');
	assert.equal(formatUsd(null), 'N/A');
});

test('cs2-skins buildOfflineCommand includes practice steps, label, and inspect link', () => {
	const { buildOfflineCommand, OFFLINE_PRACTICE_STEPS } = helpers;

	const command = buildOfflineCommand({
		marketName: 'AK-47 | Redline',
		inspectLink: 'steam://rungame/730//+csgo_econ_action_preview%20S1',
	});
	const lines = command.split('\n');

	assert.deepEqual(Array.from(lines.slice(0, OFFLINE_PRACTICE_STEPS.length)), Array.from(OFFLINE_PRACTICE_STEPS));
	assert.equal(lines[OFFLINE_PRACTICE_STEPS.length], 'echo Inspect this skin in CS2: AK-47 | Redline');
	assert.equal(
		lines[OFFLINE_PRACTICE_STEPS.length + 1],
		'echo steam://rungame/730//+csgo_econ_action_preview%20S1'
	);

	const fallback = buildOfflineCommand({ name: 'Fallback Skin' });
	assert.match(fallback, /echo Inspect this skin in CS2: Fallback Skin/);
	assert.equal(fallback.split('\n').length, OFFLINE_PRACTICE_STEPS.length + 1);
});

test('cs2-skins makeCard HTML-escapes untrusted inventory fields in attributes and body', () => {
	const { makeCard } = helpers;
	const payload = {
		iconUrl: 'https://example.com/"onerror="alert(1)',
		marketName: '<script>alert(1)</script>',
		weapon: 'AK"><img src=x>',
		exterior: "Factory New'",
		rarity: 'Covert&Classified',
		collection: '<b>Bad</b>',
		inspectLink: 'steam://rungame/730//+csgo_econ_action_preview%20S\"onclick=x',
		pricing: { lowestPriceUsd: 100 },
	};

	const html = makeCard(payload);

	assert.doesNotMatch(html, /<script>/i);
	assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
	assert.match(html, /src="https:\/\/example\.com\/&quot;onerror=&quot;alert\(1\)"/);
	assert.match(html, /href="steam:\/\/rungame\/730\/\/\+csgo_econ_action_preview%20S&quot;onclick=x"/);
	assert.match(html, /\$100\.00/);
	assert.match(html, /data-copy-offline="/);
	assert.match(html, /echo Inspect this skin in CS2: &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
