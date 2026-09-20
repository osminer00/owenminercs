import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractConst(source, name) {
	const start = source.indexOf(`const ${name} =`);
	assert.notEqual(start, -1, `${name} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${name} should end with a semicolon`);
	return source.slice(start, end + 1);
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
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

function loadInputLockdown() {
	const source = readWorkspaceFile('scripts/components.js');
	const sandbox = { String };
	vm.runInNewContext(
		[
			extractConst(source, 'TEXT_ENTRY_SELECTOR'),
			extractFunction(source, 'disableTextInputControls'),
			'this.disableTextInputControls = disableTextInputControls;',
			'this.TEXT_ENTRY_SELECTOR = TEXT_ENTRY_SELECTOR;',
		].join('\n'),
		sandbox
	);
	return sandbox;
}

function makeControl({
	inSearch = false,
	alreadyDisabled = false,
	placeholder = 'Name',
	includeReadOnly = true,
} = {}) {
	const el = {
		disabled: false,
		placeholder,
		dataset: alreadyDisabled ? { inputDisabledForNow: '1' } : {},
		attrs: {},
		closest(sel) {
			if (sel === '[data-owen-site-search]') return inSearch ? { searchRoot: true } : null;
			return null;
		},
		setAttribute(name, value) {
			this.attrs[name] = String(value);
		},
	};
	if (includeReadOnly) el.readOnly = false;
	return el;
}

function makeRoot({ inputs = [], editables = [] } = {}, selector) {
	return {
		querySelectorAll(sel) {
			if (sel === selector) return inputs;
			if (sel === '[contenteditable=""], [contenteditable="true"]') return editables;
			return [];
		},
	};
}

test('disableTextInputControls skips search fields and already-locked controls, and disables the rest', () => {
	const { disableTextInputControls, TEXT_ENTRY_SELECTOR } = loadInputLockdown();

	assert.doesNotThrow(() => disableTextInputControls(null));
	assert.doesNotThrow(() => disableTextInputControls({}));

	const searchInput = makeControl({ inSearch: true, placeholder: 'Search the site' });
	const alreadyLocked = makeControl({ alreadyDisabled: true, placeholder: 'Keep me' });
	alreadyLocked.disabled = false;
	const commentBox = makeControl({ placeholder: 'Leave a comment' });
	const fileInput = makeControl({ placeholder: '' });
	const noPlaceholder = makeControl();
	delete noPlaceholder.placeholder;

	const liveEditable = { attrs: {} };
	liveEditable.setAttribute = function setAttribute(name, value) {
		this.attrs[name] = String(value);
	};

	disableTextInputControls(
		makeRoot(
			{
				inputs: [searchInput, alreadyLocked, commentBox, fileInput, noPlaceholder],
				editables: [liveEditable],
			},
			TEXT_ENTRY_SELECTOR
		)
	);

	assert.equal(searchInput.disabled, false, 'site search inputs stay usable');
	assert.equal(searchInput.placeholder, 'Search the site');
	assert.equal(searchInput.attrs['aria-disabled'], undefined);

	assert.equal(alreadyLocked.disabled, false, 'already flagged controls are not rewritten');
	assert.equal(alreadyLocked.placeholder, 'Keep me');
	assert.equal(alreadyLocked.dataset.inputDisabledForNow, '1');

	assert.equal(commentBox.disabled, true);
	assert.equal(commentBox.readOnly, true);
	assert.equal(commentBox.placeholder, 'Temporarily disabled');
	assert.equal(commentBox.attrs['aria-disabled'], 'true');
	assert.equal(commentBox.dataset.inputDisabledForNow, '1');

	assert.equal(fileInput.disabled, true);
	assert.equal(fileInput.placeholder, 'Temporarily disabled');
	assert.equal(fileInput.dataset.inputDisabledForNow, '1');

	assert.equal(noPlaceholder.disabled, true);
	assert.equal(noPlaceholder.attrs['aria-disabled'], 'true');

	assert.equal(liveEditable.attrs.contenteditable, 'false');
	assert.equal(liveEditable.attrs['aria-disabled'], 'true');
});
