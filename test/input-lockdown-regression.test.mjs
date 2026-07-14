import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const braceStart = source.indexOf('{', start);
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

function extractTextEntrySelector() {
	const match = componentsSource.match(
		/const TEXT_ENTRY_SELECTOR\s*=\s*'(?<selector>[^']+)';/
	);
	assert.ok(match, 'TEXT_ENTRY_SELECTOR should exist');
	return match.groups.selector;
}

function makeControl({ insideSearch = false, processed = false } = {}) {
	const attributes = new Map();
	return {
		attributes,
		dataset: processed ? { inputDisabledForNow: '1' } : {},
		disabled: false,
		readOnly: false,
		placeholder: 'Type here',
		closest(selector) {
			assert.equal(selector, '[data-owen-site-search]');
			return insideSearch ? {} : null;
		},
		setAttribute(name, value) {
			attributes.set(name, value);
		},
	};
}

function runInputLockdown(controls, editableNodes = []) {
	const selector = extractTextEntrySelector();
	const disableTextInputControls = vm.runInNewContext(
		`(${extractFunction(componentsSource, 'disableTextInputControls')})`,
		{ TEXT_ENTRY_SELECTOR: selector }
	);
	const root = {
		querySelectorAll(query) {
			if (query === selector) return controls;
			if (query === '[contenteditable=""], [contenteditable="true"]') return editableNodes;
			assert.fail(`unexpected selector: ${query}`);
		},
	};

	disableTextInputControls(root);
}

test('temporary input lockdown disables ordinary text and editable controls', () => {
	const control = makeControl();
	const editableAttributes = new Map();
	const editable = {
		setAttribute(name, value) {
			editableAttributes.set(name, value);
		},
	};

	runInputLockdown([control], [editable]);

	assert.equal(control.disabled, true);
	assert.equal(control.readOnly, true);
	assert.equal(control.placeholder, 'Temporarily disabled');
	assert.equal(control.attributes.get('aria-disabled'), 'true');
	assert.equal(control.dataset.inputDisabledForNow, '1');
	assert.equal(editableAttributes.get('contenteditable'), 'false');
	assert.equal(editableAttributes.get('aria-disabled'), 'true');
});

test('temporary input lockdown preserves search and previously processed controls', () => {
	const searchControl = makeControl({ insideSearch: true });
	const processedControl = makeControl({ processed: true });

	runInputLockdown([searchControl, processedControl]);

	for (const control of [searchControl, processedControl]) {
		assert.equal(control.disabled, false);
		assert.equal(control.readOnly, false);
		assert.equal(control.placeholder, 'Type here');
		assert.equal(control.attributes.size, 0);
	}
	assert.equal(searchControl.dataset.inputDisabledForNow, undefined);
	assert.equal(processedControl.dataset.inputDisabledForNow, '1');
});
