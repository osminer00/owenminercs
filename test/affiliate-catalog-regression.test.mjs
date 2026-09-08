import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractClassMethod(source, methodName) {
	const needle = `\n\t${methodName}(`;
	const start = source.indexOf(needle);
	assert.notEqual(start, -1, `${methodName} should exist as a class method`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${methodName} should have parameters`);

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
	assert.notEqual(paramsEnd, -1, `${methodName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${methodName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				const signatureAndBody = source.slice(start + 1, i + 1).trimStart();
				return `function ${signatureAndBody}`;
			}
		}
	}

	assert.fail(`${methodName} body should close`);
}

function loadAffiliateCatalogHelpers({ products = {}, disclosure = {} } = {}) {
	const source = readWorkspaceFile('scripts/affiliate-links.js');
	const sandbox = {
		String,
		Object,
		Array,
		products,
		disclosure,
		window: { location: { origin: 'https://owenminercs.com' } },
	};

	const methodNames = [
		'getProductsForPage',
		'searchProducts',
		'getDisclosure',
		'generateDisclosureBox',
		'getCategory',
	];

	vm.runInNewContext(
		[
			...methodNames.map((name) => extractClassMethod(source, name)),
			'const api = {};',
			...methodNames.map((name) => `api.${name} = ${name}.bind(api);`),
			'api.products = this.products;',
			'api.disclosure = this.disclosure;',
			'this.__helpers = api;',
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'affiliate catalog helpers should load');
	return sandbox.__helpers;
}

const catalog = {
	pc_components: {
		monitor: {
			name: 'ROG Swift OLED',
			specs: '480Hz 27 inch 1440p',
			pages: ['/PC/pc.html', '/The Setup/the-setup.html'],
		},
		keyboard: {
			name: 'Wooting 60HE',
			specs: 'Hall effect 60 percent',
			pages: ['/Keyboard/keyboard.html'],
		},
	},
	lighting: {
		govee: {
			name: 'Govee Floor Lamp',
			pages: ['/The Setup/the-setup.html'],
		},
		skipped: {
			name: 'Unlisted accessory',
			specs: 'no page mapping',
		},
	},
};

test('getProductsForPage only returns products whose pages list includes the exact path', () => {
	const api = loadAffiliateCatalogHelpers({ products: catalog });

	const setup = api.getProductsForPage('/The Setup/the-setup.html');
	assert.deepEqual(
		Array.from(setup, (row) => String(row.key)),
		['pc_components.monitor', 'lighting.govee']
	);
	assert.equal(setup[0].name, 'ROG Swift OLED');

	const keyboard = api.getProductsForPage('/Keyboard/keyboard.html');
	assert.deepEqual(
		Array.from(keyboard, (row) => String(row.key)),
		['pc_components.keyboard']
	);

	assert.deepEqual(Array.from(api.getProductsForPage('/missing.html')), []);
	assert.deepEqual(Array.from(api.getProductsForPage('/PC/pc.html/')), []);
});

test('searchProducts matches name or specs case-insensitively and ignores unmapped fields', () => {
	const api = loadAffiliateCatalogHelpers({ products: catalog });

	const byName = api.searchProducts('wooting');
	assert.deepEqual(
		Array.from(byName, (row) => String(row.key)),
		['pc_components.keyboard']
	);

	const bySpecs = api.searchProducts('480HZ');
	assert.deepEqual(
		Array.from(bySpecs, (row) => String(row.key)),
		['pc_components.monitor']
	);

	assert.deepEqual(Array.from(api.searchProducts('no such product')), []);
	assert.equal(api.searchProducts('').length, 4);
});

test('getCategory returns the nested group or an empty object for unknown keys', () => {
	const api = loadAffiliateCatalogHelpers({ products: catalog });
	assert.equal(api.getCategory('lighting').govee.name, 'Govee Floor Lamp');
	assert.equal(Object.keys(api.getCategory('missing')).length, 0);
	assert.equal(Object.keys(api.getCategory('')).length, 0);
});

test('getDisclosure falls back to English then empty, and generateDisclosureBox skips blank copy', () => {
	const api = loadAffiliateCatalogHelpers({
		disclosure: {
			en: 'I may earn a commission from qualifying purchases.',
			es: 'Puedo ganar una comisión.',
		},
	});

	assert.equal(api.getDisclosure(), 'I may earn a commission from qualifying purchases.');
	assert.equal(api.getDisclosure('es'), 'Puedo ganar una comisión.');
	assert.equal(api.getDisclosure('fr'), 'I may earn a commission from qualifying purchases.');

	const box = api.generateDisclosureBox();
	assert.match(box, /class="affiliate-disclosure"/);
	assert.match(
		box,
		/<strong>Disclosure:<\/strong> I may earn a commission from qualifying purchases\./
	);

	api.disclosure = {};
	assert.equal(api.getDisclosure('en'), '');
	assert.equal(api.generateDisclosureBox(), '');
});
