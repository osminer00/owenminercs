import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const redirectsSource = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
const sitemapSource = readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
const keyboardHubSource = readFileSync(new URL('../Keyboard/60he.html', import.meta.url), 'utf8');

const MAIN_NAV_DATA_NAVS = [
	'index.html',
	'The Setup',
	'Gaming',
	'Donators',
	'garage-sale',
	'Help Wanted',
	'QA',
	'Dev',
	'Achievements',
	'Socials',
];

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

function extractFrozenStringArray(source, arrayName) {
	const pattern = new RegExp(
		`const ${arrayName} = Object\\.freeze\\(\\[(?<body>[\\s\\S]*?)\\]\\);`,
		'm'
	);
	const match = source.match(pattern);
	assert.ok(match, `${arrayName} should be a frozen array`);
	return [...match.groups.body.matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

function evaluateComponentFunction(functionName, context) {
	return vm.runInNewContext(`(${extractFunction(componentsSource, functionName)})`, context);
}

function makeNavScope() {
	const links = MAIN_NAV_DATA_NAVS.map((dataNav) => ({
		dataNav,
		getAttribute(name) {
			return name === 'data-nav' ? dataNav : null;
		},
	}));

	return {
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
}

test('Programs nav points at the canonical lowercase dev-stack route everywhere', () => {
	const programsLinkPattern =
		/<li><a href="\$\{getLink\('dev\/dev-stack'\)\}" class="site-nav-link" data-nav="Dev" title="Programs for coding, creative work, and streaming">Programs<\/a><\/li>/g;

	assert.equal(
		[...componentsSource.matchAll(programsLinkPattern)].length,
		2,
		'header and footer should both link Programs to dev/dev-stack'
	);
	assert.doesNotMatch(componentsSource, /getLink\('Dev\/dev-stack'\)/);

	assert.match(redirectsSource, /^\/Dev\/dev-stack\s+\/dev\/dev-stack\s+301!/m);
	assert.match(redirectsSource, /^\/Dev\/dev-stack\.html\s+\/dev\/dev-stack\s+301!/m);
	assert.match(sitemapSource, /https:\/\/www\.owenminercs\.com\/dev\/dev-stack/);
	assert.doesNotMatch(sitemapSource, /https:\/\/www\.owenminercs\.com\/Dev\/dev-stack/);
});

test('Programs participates in active nav highlighting and main-nav tour tracking', () => {
	assert.deepEqual(
		extractFrozenStringArray(componentsSource, 'MAIN_NAV_TOUR_SLOTS'),
		MAIN_NAV_DATA_NAVS,
		'tour slots should match visible main-nav order'
	);

	const context = { window: { location: { pathname: '/' } } };
	const resolveActiveNavLink = evaluateComponentFunction('resolveActiveNavLink', context);
	const getMainNavTourSlotFromLocation = evaluateComponentFunction(
		'getMainNavTourSlotFromLocation',
		context
	);
	const navScope = makeNavScope();

	for (const pathname of ['/dev/dev-stack', '/dev/dev-stack.html', '/Dev/dev-stack']) {
		context.window.location.pathname = pathname;
		assert.equal(
			resolveActiveNavLink(navScope)?.dataNav,
			'Dev',
			`${pathname} should highlight Programs`
		);
		assert.equal(
			getMainNavTourSlotFromLocation(),
			'Dev',
			`${pathname} should count toward the Programs nav tour slot`
		);
	}

	for (const pathname of ['/Keyboard/60he', '/Keyboard/60he-2025.html']) {
		context.window.location.pathname = pathname;
		assert.equal(
			resolveActiveNavLink(navScope)?.dataNav,
			'The Setup',
			`${pathname} should keep keyboard pages under Bigfoot's Jungle`
		);
		assert.equal(
			getMainNavTourSlotFromLocation(),
			'The Setup',
			`${pathname} should count keyboard pages toward the setup nav tour slot`
		);
	}
});

test('Wooting 60HE hub links to both split build pages that exist', () => {
	const expectedBuilds = [
		{
			label: '2025 Kilowatt build',
			href: './60he-2025.html',
			file: '../Keyboard/60he-2025.html',
			heading: /2025 Build: Kilowatt/,
		},
		{
			label: '2023 Crosshair Alpha and v1 build',
			href: './60he-2023.html',
			file: '../Keyboard/60he-2023.html',
			heading: /2023 Crosshair Alpha &amp; v1/,
		},
	];

	assert.match(
		keyboardHubSource,
		/role="navigation" aria-label="Wooting build guide pages"/,
		'keyboard hub should expose the split build choices as navigation'
	);

	for (const build of expectedBuilds) {
		assert.ok(
			existsSync(new URL(build.file, import.meta.url)),
			`${build.label} page should exist`
		);
		assert.match(keyboardHubSource, build.heading);
		assert.match(
			keyboardHubSource,
			new RegExp(`<a href="${build.href.replace('.', '\\.')}"><strong>Open `),
			`${build.label} should be linked from the hub`
		);
	}
});
