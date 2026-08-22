import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const calcPageSource = readFileSync(
	new URL('../Gaming/cs2-price-calc.html', import.meta.url),
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

function makeEl(initial = {}) {
	return {
		value: initial.value == null ? '' : initial.value,
		style: { display: initial.display == null ? '' : initial.display },
		className: initial.className || '',
		textContent: initial.textContent || '',
	};
}

function loadPriceCalcHelpers(options = {}) {
	const elements = {
		csfloatPrice: makeEl({ value: options.csfloat }),
		steamPrice: makeEl({ value: options.steam }),
		priceResults: makeEl({ display: 'none' }),
		savingsCard: makeEl(),
		savingsValue: makeEl(),
		savingsDetail: makeEl(),
		steamNetValue: makeEl(),
		steamNetDetail: makeEl(),
		verdictValue: makeEl(),
		verdictDetail: makeEl(),
		verdictCard: makeEl(),
		baseSkinPrice: makeEl({ value: options.baseSkin }),
		askingPrice: makeEl({ value: options.asking }),
		stickerResults: makeEl({ display: 'none' }),
		totalStickerValue: makeEl(),
		stickerPremium: makeEl(),
		craftPercent: makeEl(),
		craftCard: makeEl(),
		craftValue: makeEl(),
		craftDetail: makeEl(),
		stickerVerdictCard: makeEl(),
		stickerVerdictValue: makeEl(),
		stickerVerdictDetail: makeEl(),
	};
	const stickerInputs = Array.isArray(options.stickerValues)
		? options.stickerValues.map((value) => ({ value: String(value) }))
		: [];

	const sandbox = {
		String,
		Number,
		Math,
		parseFloat,
		isFinite,
		document: {
			getElementById(id) {
				return elements[id] || null;
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		const STEAM_FEE = 0.15;
		const csfloatEl = document.getElementById('csfloatPrice');
		const steamEl = document.getElementById('steamPrice');
		const priceResults = document.getElementById('priceResults');
		const baseSkinEl = document.getElementById('baseSkinPrice');
		const askingEl = document.getElementById('askingPrice');
		const stickerResults = document.getElementById('stickerResults');
		const stickerList = {
			querySelectorAll() {
				return this.__inputs;
			},
			__inputs: [],
		};
		${extractFunction(calcPageSource, 'calcPrices')}
		${extractFunction(calcPageSource, 'calcStickers')}
		this.__helpers = {
			STEAM_FEE,
			calcPrices,
			calcStickers,
			stickerList,
		};
		`,
		sandbox
	);

	const helpers = sandbox.__helpers;
	helpers.stickerList.__inputs = stickerInputs;
	helpers.elements = elements;
	helpers.stickerInputs = stickerInputs;
	return helpers;
}

test('CS2 price calc hides results for missing, negative, or non-numeric prices', () => {
	assert.match(calcPageSource, /const STEAM_FEE = 0\.15;/);

	for (const pair of [
		{ csfloat: '', steam: '10' },
		{ csfloat: 'abc', steam: '10' },
		{ csfloat: '-1', steam: '10' },
		{ csfloat: '10', steam: '-0.01' },
	]) {
		const { calcPrices, elements } = loadPriceCalcHelpers(pair);
		calcPrices();
		assert.equal(elements.priceResults.style.display, 'none');
	}
});

test('CS2 price calc applies the Steam 15% fee and picks a CSFloat/Steam verdict', () => {
	const cheaper = loadPriceCalcHelpers({ csfloat: '80', steam: '100' });
	cheaper.calcPrices();
	assert.equal(cheaper.elements.priceResults.style.display, '');
	assert.equal(cheaper.elements.savingsValue.textContent, '$20.00');
	assert.match(cheaper.elements.savingsDetail.textContent, /20\.0% cheaper on CSFloat/);
	assert.equal(cheaper.elements.steamNetValue.textContent, '$85.00');
	assert.equal(cheaper.elements.verdictValue.textContent, '✓ Buy on CSFloat');
	assert.match(cheaper.elements.verdictCard.className, /positive/);

	const close = loadPriceCalcHelpers({ csfloat: '90', steam: '100' });
	close.calcPrices();
	assert.equal(close.elements.verdictValue.textContent, '≈ Close — Compare Float & Pattern');
	assert.match(close.elements.verdictCard.className, /neutral/);
	assert.equal(close.elements.steamNetValue.textContent, '$85.00');

	const steamWins = loadPriceCalcHelpers({ csfloat: '110', steam: '100' });
	steamWins.calcPrices();
	assert.equal(steamWins.elements.verdictValue.textContent, '✗ Buy on Steam');
	assert.equal(steamWins.elements.savingsValue.textContent, '+$10.00');
	assert.match(steamWins.elements.verdictCard.className, /negative/);

	const same = loadPriceCalcHelpers({ csfloat: '50', steam: '50' });
	same.calcPrices();
	assert.equal(same.elements.savingsValue.textContent, '$0.00');
	assert.equal(same.elements.savingsDetail.textContent, 'Same price on both');
	assert.equal(same.elements.verdictValue.textContent, '≈ Close — Compare Float & Pattern');
});

test('CS2 sticker calc reports craft percent bands and withholds a verdict until inputs exist', () => {
	const missing = loadPriceCalcHelpers({
		baseSkin: '',
		asking: '',
		stickerValues: [10],
	});
	missing.calcStickers();
	assert.equal(missing.elements.stickerResults.style.display, '');
	assert.equal(missing.elements.stickerVerdictValue.textContent, '—');
	assert.match(missing.elements.stickerVerdictDetail.textContent, /Enter all values/);

	const great = loadPriceCalcHelpers({
		baseSkin: '100',
		asking: '120',
		stickerValues: [200],
	});
	great.calcStickers();
	assert.equal(great.elements.stickerPremium.textContent, '$20.00');
	assert.equal(great.elements.craftPercent.textContent, '10.0%');
	assert.equal(great.elements.stickerVerdictValue.textContent, '✓ Great Deal');
	assert.match(great.elements.craftDetail.textContent, /Low craft/);

	const fair = loadPriceCalcHelpers({
		baseSkin: '100',
		asking: '150',
		stickerValues: [100, 100],
	});
	fair.calcStickers();
	assert.equal(fair.elements.craftPercent.textContent, '25.0%');
	assert.equal(fair.elements.stickerVerdictValue.textContent, '≈ Fair Price');

	const overpay = loadPriceCalcHelpers({
		baseSkin: '100',
		asking: '180',
		stickerValues: ['200', 'not-a-number'],
	});
	overpay.calcStickers();
	assert.equal(overpay.elements.totalStickerValue.textContent, '$200.00');
	assert.equal(overpay.elements.craftPercent.textContent, '40.0%');
	assert.equal(overpay.elements.stickerVerdictValue.textContent, '✗ Overpaying');
	assert.match(overpay.elements.craftDetail.textContent, /High craft/);
});
