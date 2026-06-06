import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const keyboard60heSource = readFileSync(new URL('../Keyboard/60he.html', import.meta.url), 'utf8');

test('shared header does not link to an unshipped search route', () => {
	const searchPageExists = existsSync(new URL('../search.html', import.meta.url));

	if (!searchPageExists) {
		assert.doesNotMatch(
			componentsSource,
			/href="\$\{getSearchPageUrl\(\)\}"/,
			'do not expose the global search nav item until search.html is shipped'
		);
	}
});

test('canonical Wooting 60HE page keeps the full public guide', () => {
	assert.match(
		keyboard60heSource,
		/Wooting 60HE build guide: parts, switches, keycaps &amp; mods/i
	);
	assert.match(keyboard60heSource, /2025 Build: Kilowatt Case/i);
	assert.match(keyboard60heSource, /Kilowatt Keyboard Photo Gallery \(2025\)/i);
	assert.match(keyboard60heSource, /2023 Build Breakdown: Crosshair Alpha/i);
	assert.match(keyboard60heSource, /Spring Swap and Lubrication/i);
	assert.match(keyboard60heSource, /Videos I Found Useful/i);
	assert.match(keyboard60heSource, /FAQ/i);
});
