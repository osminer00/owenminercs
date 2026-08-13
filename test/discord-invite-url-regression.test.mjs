import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const socialsHtml = readFileSync(new URL('../Socials/socials.html', import.meta.url), 'utf8');
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

function countOccurrences(source, needle) {
	let count = 0;
	let index = 0;
	while (true) {
		const next = source.indexOf(needle, index);
		if (next === -1) return count;
		count += 1;
		index = next + needle.length;
	}
}

const EXPECTED_INVITE = 'https://discord.gg/fA9GbxmAge';

test('shared chrome keeps a single Discord invite constant used by dock, footer, and notice', () => {
	assert.match(
		componentsSource,
		new RegExp(`const DISCORD_INVITE_URL = '${EXPECTED_INVITE.replace(/\./g, '\\.')}';`)
	);
	assert.equal(
		countOccurrences(componentsSource, `const DISCORD_INVITE_URL = '${EXPECTED_INVITE}';`),
		1,
		'invite URL should be defined once so dock/footer/notice cannot drift'
	);

	const navMarkup = extractFunction(componentsSource, 'socialNavMarkup');
	assert.match(
		navMarkup,
		/data-social-brand="discord"[^>]*href="\$\{DISCORD_INVITE_URL\}"/
	);
	assert.match(navMarkup, /aria-label="Discord: Owen M community"/);
	assert.doesNotMatch(
		navMarkup,
		/href="https:\/\/discord\.gg\//,
		'dock Discord href must stay on the shared constant instead of a second hardcoded invite'
	);

	assert.match(
		componentsSource,
		/report bugs in the <a href="\$\{DISCORD_INVITE_URL\}"/
	);
	assert.match(
		componentsSource,
		/Reach out on <a href="\$\{DISCORD_INVITE_URL\}"/
	);
	assert.match(
		componentsSource,
		/DISCORD_INVITE_URL,\s*'" target="_blank" rel="noopener noreferrer" class="site-construction-dialog__discord-link"/
	);
});

test('Socials hub Discord links stay on the same community invite as shared chrome', () => {
	assert.match(
		socialsHtml,
		new RegExp(`href="${EXPECTED_INVITE.replace(/\./g, '\\.')}"`)
	);
	assert.match(
		socialCloudSource,
		new RegExp(`discord: '${EXPECTED_INVITE.replace(/\./g, '\\.')}'`)
	);
	assert.doesNotMatch(
		socialsHtml,
		/href="https:\/\/discord\.gg\/(?!fA9GbxmAge)[^"]+"/
	);
});
