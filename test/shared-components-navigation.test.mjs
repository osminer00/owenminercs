import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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

function extractArrayLiteral(source, constName) {
	const pattern = new RegExp(
		`const ${constName} = Object\\.freeze\\(\\[(?<body>[\\s\\S]*?)\\]\\);`,
		'm'
	);
	const match = source.match(pattern);
	assert.ok(match, `${constName} should be declared as an Object.freeze array`);
	return [...match.groups.body.matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

function extractHeaderNavDataValues() {
	const headerStart = componentsSource.indexOf('class SharedHeader extends HTMLElement');
	assert.notEqual(headerStart, -1, 'SharedHeader should exist');
	const footerStart = componentsSource.indexOf('class SharedFooter extends HTMLElement');
	assert.notEqual(footerStart, -1, 'SharedFooter should exist');
	const headerSource = componentsSource.slice(headerStart, footerStart);
	return [...headerSource.matchAll(/data-nav="([^"]+)"/g)].map((item) => item[1]);
}

function getMainNavTourSlot(pathname) {
	const source = extractFunction(componentsSource, 'getMainNavTourSlotFromLocation');
	return Function(
		'window',
		`${source}
		return getMainNavTourSlotFromLocation();`
	)({ location: { pathname } });
}

function resolveActiveDataNav(pathname) {
	const source = extractFunction(componentsSource, 'resolveActiveNavLink');
	const links = extractHeaderNavDataValues().map((dataNav) => ({
		dataNav,
		getAttribute(name) {
			return name === 'data-nav' ? dataNav : null;
		},
	}));
	const scope = {
		querySelectorAll(selector) {
			assert.equal(selector, 'nav a[data-nav]');
			return links;
		},
		querySelector(selector) {
			const match = selector.match(/^a\[data-nav="([^"]+)"\]$/);
			assert.ok(match, `unexpected selector: ${selector}`);
			return links.find((link) => link.dataNav === match[1]) || null;
		},
	};

	const activeLink = Function(
		'window',
		'scope',
		`${source}
		return resolveActiveNavLink(scope);`
	)({ location: { pathname } }, scope);

	return activeLink?.dataNav || null;
}

class FakeAnchor {}

function captureNavReturnState({ href, target = '', classContains = true }) {
	const functions = [
		extractFunction(componentsSource, 'writeJsonStorage'),
		extractFunction(componentsSource, 'normalizeUrlForMatch'),
		extractFunction(componentsSource, 'captureNavReturnState'),
	].join('\n');
	const storage = new Map();
	const anchor = new FakeAnchor();
	anchor.target = target;
	anchor.classList = {
		contains(className) {
			assert.equal(className, 'site-nav-link');
			return classContains;
		},
	};
	anchor.getAttribute = (name) => (name === 'href' ? href : null);

	Function(
		'HTMLAnchorElement',
		'window',
		'document',
		'localStorage',
		'anchor',
		`const NAV_RETURN_STATE_KEY = 'owenminercs-nav-return-state-v1';
		${functions}
		captureNavReturnState(anchor);`
	)(
		FakeAnchor,
		{
			location: {
				href: 'https://owen.example/Keyboard/60he.html?build=2025#switches',
				origin: 'https://owen.example',
			},
			scrollX: 12,
			scrollY: 345,
		},
		{ title: 'Keyboard Build' },
		{
			setItem(key, value) {
				storage.set(key, value);
			},
		},
		anchor
	);

	const raw = storage.get('owenminercs-nav-return-state-v1');
	return raw ? JSON.parse(raw) : null;
}

test('main nav tour slots stay in sync with header navigation entries', () => {
	const tourSlots = extractArrayLiteral(componentsSource, 'MAIN_NAV_TOUR_SLOTS');
	const headerNavSlots = extractHeaderNavDataValues();

	assert.deepEqual(
		tourSlots,
		headerNavSlots,
		'achievement tour slots should match header nav order'
	);
});

test('Programs and setup subpages map to the expected main navigation slots', () => {
	assert.equal(getMainNavTourSlot('/dev/dev-stack.html'), 'Dev');
	assert.equal(getMainNavTourSlot('/Keyboard/60he.html'), 'The Setup');
	assert.equal(getMainNavTourSlot('/Keyboard/60he-2025.html'), 'The Setup');
	assert.equal(getMainNavTourSlot('/PC/pc.html'), 'The Setup');
	assert.equal(getMainNavTourSlot('/Counter-Strike/counter-strike.html'), 'Gaming');
	assert.equal(getMainNavTourSlot('/Socials/socials.html'), 'Socials');
});

test('active navigation highlights lowercase Programs route and setup aliases', () => {
	assert.equal(resolveActiveDataNav('/dev/dev-stack.html'), 'Dev');
	assert.equal(resolveActiveDataNav('/Keyboard/60he.html'), 'The Setup');
	assert.equal(resolveActiveDataNav('/The%20Setup/the-setup.html'), 'The Setup');
	assert.equal(resolveActiveDataNav('/Counter-Strike/counter-strike.html'), 'Gaming');
});

test('nav return state is captured only for same-origin route changes', () => {
	const record = captureNavReturnState({ href: '/Gaming/gaming.html' });

	assert.deepEqual(
		{
			fromUrl: record.fromUrl,
			fromTitle: record.fromTitle,
			fromScrollX: record.fromScrollX,
			fromScrollY: record.fromScrollY,
			toUrl: record.toUrl,
			createdAtType: typeof record.createdAt,
		},
		{
			fromUrl: 'https://owen.example/Keyboard/60he.html?build=2025#switches',
			fromTitle: 'Keyboard Build',
			fromScrollX: 12,
			fromScrollY: 345,
			toUrl: 'https://owen.example/Gaming/gaming.html',
			createdAtType: 'number',
		}
	);

	assert.equal(
		captureNavReturnState({ href: 'https://external.example/Gaming/gaming.html' }),
		null
	);
	assert.equal(captureNavReturnState({ href: '#photos' }), null);
	assert.equal(captureNavReturnState({ href: '/Keyboard/60he.html?build=2025' }), null);
	assert.equal(captureNavReturnState({ href: '/Gaming/gaming.html', target: '_blank' }), null);
	assert.equal(
		captureNavReturnState({ href: '/Gaming/gaming.html', classContains: false }),
		null
	);
});
