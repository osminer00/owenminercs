import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const marker = `function ${functionName}(`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = source.indexOf('(', start);
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
	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return { text: source.slice(start, i + 1), end: i + 1 };
		}
	}

	assert.fail(`${functionName} body should close`);
}

class FakeNode {
	constructor() {
		this.className = '';
		this.textContent = '';
		this.innerHTML = '';
		this.children = [];
	}

	append(...nodes) {
		this.children.push(...nodes);
	}

	appendChild(node) {
		this.children.push(node);
		return node;
	}
}

function loadExplainer() {
	const source = readWorkspaceFile('scripts/cs2-config-explainer.js');
	const start = source.indexOf('const KNOWN_COMMANDS');
	assert.notEqual(start, -1, 'KNOWN_COMMANDS should exist');
	const createResultRow = extractFunction(source, 'createResultRow');
	assert.ok(createResultRow.end > start, 'createResultRow should follow KNOWN_COMMANDS');
	const body = source.slice(start, createResultRow.end);
	const sandbox = {
		document: {
			createElement() {
				return new FakeNode();
			},
		},
	};
	vm.runInNewContext(`${body}\nthis.__helpers = { analyzeLine, createResultRow };`, sandbox);
	assert.equal(typeof sandbox.__helpers.analyzeLine, 'function');
	return sandbox.__helpers;
}

const { analyzeLine, createResultRow } = loadExplainer();

test('CS2 config lines drop comments and blanks, and keep quoted bind arguments', () => {
	assert.equal(analyzeLine('   ', 1), null);
	assert.equal(analyzeLine('   // note only', 2), null);

	const sensitivity = analyzeLine('  SENSITIVITY 1.2 // my sens  ', 3);
	assert.equal(sensitivity.lineNumber, 3);
	assert.equal(sensitivity.command, 'sensitivity');
	assert.equal(sensitivity.value, '1.2');
	assert.equal(sensitivity.rawLine, 'SENSITIVITY 1.2');
	assert.equal(sensitivity.warning, '');
	assert.match(sensitivity.explanation, /mouse sensitivity/i);

	const bind = analyzeLine('bind "mouse1" "+attack; say hi" // fire', 4);
	assert.equal(bind.command, 'bind');
	assert.equal(bind.value, 'mouse1 +attack; say hi');
	assert.equal(bind.rawLine, 'bind "mouse1" "+attack; say hi"');
	assert.equal(bind.warning, '');

	const exec = analyzeLine('exec autoexec.cfg', 5);
	assert.equal(exec.command, 'exec');
	assert.equal(exec.value, 'autoexec.cfg');
	assert.equal(exec.warning, '');
});

test('CS2 config warnings cover ranges, enums, cheats, and unknown commands', () => {
	assert.equal(analyzeLine('sensitivity 0.4', 1).warning, '');
	assert.equal(analyzeLine('sensitivity 3', 1).warning, '');
	assert.match(analyzeLine('sensitivity 8', 1).warning, /0\.4 to 3\.0/);
	assert.equal(analyzeLine('sensitivity abc', 1).warning, 'Expected a numeric value.');
	assert.match(analyzeLine('sensitivity', 1).warning, /0\.4 to 3\.0/);

	assert.equal(analyzeLine('fps_max 240', 2).warning, '');
	assert.match(analyzeLine('fps_max 60', 2).warning, /120 to 1000/);
	assert.equal(analyzeLine('volume 0', 3).warning, '');
	assert.equal(analyzeLine('volume 1', 3).warning, '');
	assert.match(analyzeLine('volume 1.01', 3).warning, /0 and 1/);
	assert.equal(analyzeLine('cl_crosshairgap -8', 4).warning, '');
	assert.match(analyzeLine('cl_crosshairgap -8.1', 4).warning, /-8 to 8/);

	assert.equal(analyzeLine('m_rawinput 1', 5).warning, '');
	assert.equal(analyzeLine('m_rawinput 0', 5).warning, '');
	assert.equal(analyzeLine('developer 2', 6).warning, 'Expected 0 or 1.');
	assert.equal(analyzeLine('snd_headphone_eq 2', 7).warning, '');
	assert.equal(analyzeLine('snd_headphone_eq 3', 7).warning, 'Expected 0, 1, or 2.');

	assert.equal(analyzeLine('sv_cheats 0', 8).warning, '');
	assert.match(analyzeLine('sv_cheats 1', 8).warning, /VAC secured matchmaking/);
	assert.match(analyzeLine('unbindall', 9).warning, /clears all key binds/);
	assert.match(analyzeLine('cl_interp 0', 10).warning, /legacy\/limited in CS2/);

	const custom = analyzeLine('my_alias_cmd 1', 11);
	assert.equal(custom.command, 'my_alias_cmd');
	assert.equal(custom.warning, '');
	assert.match(custom.explanation, /Custom or less common command/);
});

test('CS2 config result rows put command text in text nodes', () => {
	const parsed = analyzeLine('sensitivity <svg/onload=alert(1)>', 4);
	const row = createResultRow(parsed);

	assert.equal(row.className, 'cs2-config-item cs2-config-item--warn');
	assert.equal(row.innerHTML, '');
	assert.equal(row.children[0].textContent, 'Line 4: sensitivity');
	assert.equal(row.children[0].innerHTML, '');
	assert.equal(row.children[1].textContent, 'sensitivity <svg/onload=alert(1)>');
	assert.equal(row.children[1].innerHTML, '');
	assert.match(row.children[3].textContent, /^Flag: /);
	assert.equal(row.children[3].innerHTML, '');

	const safe = createResultRow(analyzeLine('volume 0.5', 1));
	assert.equal(safe.className, 'cs2-config-item cs2-config-item--info');
	assert.equal(safe.children.length, 3);
});
