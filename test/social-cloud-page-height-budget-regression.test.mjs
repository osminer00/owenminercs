import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
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

function loadHeightBudget({ header, footer } = {}) {
	const source = readWorkspaceFile('Socials/scripts/social-cloud.js');
	const cssVars = {};
	const sandbox = {
		Math,
		document: {
			querySelector(selector) {
				if (selector === 'shared-header') return header || null;
				if (selector === 'shared-footer') return footer || null;
				return null;
			},
			body: {
				style: {
					setProperty(name, value) {
						cssVars[name] = value;
					},
				},
			},
		},
	};

	vm.runInNewContext(
		[
			'var pageHeaderHeight = 0;',
			'var pageFooterHeight = 0;',
			extractFunction(source, 'updatePageHeightBudget'),
			`this.__helpers = {
				updatePageHeightBudget,
				getBudget() {
					return { pageHeaderHeight, pageFooterHeight };
				},
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'page height budget helper should load');
	return { ...sandbox.__helpers, cssVars };
}

function rectEl(height) {
	return {
		getBoundingClientRect() {
			return { height };
		},
	};
}

test('updatePageHeightBudget writes rounded header and footer heights onto body CSS vars', () => {
	const { updatePageHeightBudget, getBudget, cssVars } = loadHeightBudget({
		header: rectEl(63.4),
		footer: rectEl(140.6),
	});

	updatePageHeightBudget();

	const budget = getBudget();
	assert.equal(budget.pageHeaderHeight, 63);
	assert.equal(budget.pageFooterHeight, 141);
	assert.equal(cssVars['--smc-header-h'], '63px');
	assert.equal(cssVars['--smc-footer-h'], '141px');
});

test('updatePageHeightBudget treats missing chrome as zero and overwrites a previous budget', () => {
	const header = rectEl(88);
	const footer = rectEl(72);
	const { updatePageHeightBudget, getBudget, cssVars } = loadHeightBudget({
		header,
		footer,
	});

	updatePageHeightBudget();
	assert.equal(getBudget().pageHeaderHeight, 88);
	assert.equal(cssVars['--smc-header-h'], '88px');

	header.getBoundingClientRect = () => ({ height: 12.2 });
	footer.getBoundingClientRect = () => ({ height: 9.8 });
	updatePageHeightBudget();
	assert.equal(getBudget().pageHeaderHeight, 12);
	assert.equal(getBudget().pageFooterHeight, 10);
	assert.equal(cssVars['--smc-header-h'], '12px');
	assert.equal(cssVars['--smc-footer-h'], '10px');

	const missing = loadHeightBudget({});
	missing.updatePageHeightBudget();
	assert.equal(missing.getBudget().pageHeaderHeight, 0);
	assert.equal(missing.getBudget().pageFooterHeight, 0);
	assert.equal(missing.cssVars['--smc-header-h'], '0px');
	assert.equal(missing.cssVars['--smc-footer-h'], '0px');
});
