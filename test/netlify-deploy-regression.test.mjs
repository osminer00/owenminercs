import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const netlifyIgnoreSource = readFileSync(new URL('../.netlifyignore', import.meta.url), 'utf8');
const contentCheckSource = readFileSync(
	new URL('../dev/public-content-regression-check.mjs', import.meta.url),
	'utf8'
);

function activeIgnoreLines(source) {
	return source
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#'));
}

test('Programs page remains included in Netlify deploy output', () => {
	const lines = activeIgnoreLines(netlifyIgnoreSource);
	const devWildcardIndex = lines.indexOf('dev/*');
	const programsExceptionIndex = lines.indexOf('!dev/dev-stack.html');

	assert.equal(lines.includes('dev/'), false, 'dev/ would ignore the public Programs page');
	assert.ok(devWildcardIndex >= 0, 'dev tooling should still be ignored by default');
	assert.ok(programsExceptionIndex > devWildcardIndex, 'Programs page exception should follow dev ignore');
	assert.match(
		contentCheckSource,
		/PUBLIC_INCLUDE_FILES = new Set\(\['dev\/dev-stack\.html'\]\);/,
		'public content checks should scan the deployed Programs page'
	);
});
