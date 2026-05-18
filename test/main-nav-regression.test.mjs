import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

const EXPECTED_MAIN_NAV = [
	{ dataNav: 'index.html', label: 'Home', href: 'siteRoot' },
	{ dataNav: 'The Setup', label: "Bigfoot's Jungle", href: "getLink('The%20Setup/the-setup')" },
	{ dataNav: 'Gaming', label: 'Gaming', href: "getLink('Gaming/gaming')" },
	{ dataNav: 'Donators', label: 'Donators', href: "getLink('Donators/donators')" },
	{ dataNav: 'garage-sale', label: 'For sale', href: "getLink('Garage%20Sale/garage-sale')" },
	{ dataNav: 'Help Wanted', label: 'Help Wanted', href: "getLink('Help%20Wanted/help-wanted')" },
	{ dataNav: 'QA', label: 'Q&amp;A', href: "getLink('QA/qa')" },
	{ dataNav: 'Dev', label: 'Programs', href: "getLink('dev/dev-stack')" },
	{ dataNav: 'Achievements', label: 'Achievements', href: "getLink('Achievements/achievements')" },
	{ dataNav: 'Socials', label: 'Content', href: "getLink('Socials/socials')" },
];

function extractMainNavAnchors() {
	const pattern =
		/<li><a href="\$\{(?<href>[^}]+)\}" class="site-nav-link" data-nav="(?<dataNav>[^"]+)" title="[^"]+">(?<label>.*?)<\/a><\/li>/g;
	return [...componentsSource.matchAll(pattern)].map((match) => ({
		dataNav: match.groups.dataNav,
		label: match.groups.label,
		href: match.groups.href,
	}));
}

function extractMainNavTourSlots() {
	const match = componentsSource.match(
		/const MAIN_NAV_TOUR_SLOTS = Object\.freeze\(\[(?<body>[\s\S]*?)\]\);/
	);
	assert.ok(match, 'MAIN_NAV_TOUR_SLOTS should be declared as an Object.freeze array');
	return [...match.groups.body.matchAll(/'([^']+)'/g)].map((slot) => slot[1]);
}

test('shared header and footer expose the same ordered main navigation', () => {
	const anchors = extractMainNavAnchors();
	assert.equal(
		anchors.length,
		EXPECTED_MAIN_NAV.length * 2,
		'shared header and footer should each render one copy of every main nav item'
	);

	const headerNav = anchors.slice(0, EXPECTED_MAIN_NAV.length);
	const footerNav = anchors.slice(EXPECTED_MAIN_NAV.length);

	assert.deepEqual(headerNav, EXPECTED_MAIN_NAV);
	assert.deepEqual(footerNav, EXPECTED_MAIN_NAV);
});

test('main nav tour achievement tracks every rendered nav slot', () => {
	assert.deepEqual(
		extractMainNavTourSlots(),
		EXPECTED_MAIN_NAV.map((item) => item.dataNav)
	);
});

test('Programs nav route participates in active-link and tour matching', () => {
	const tourSlotFunction = componentsSource.match(
		/function getMainNavTourSlotFromLocation\(\) \{(?<body>[\s\S]*?)\n\}/
	);
	assert.ok(tourSlotFunction, 'getMainNavTourSlotFromLocation should exist');
	assert.match(tourSlotFunction.groups.body, /lc\.includes\('\/dev\/'\)/);
	assert.match(tourSlotFunction.groups.body, /return 'Dev';/);

	const activeLinkFunction = componentsSource.match(
		/function resolveActiveNavLink\(scope\) \{(?<body>[\s\S]*?)\n\}/
	);
	assert.ok(activeLinkFunction, 'resolveActiveNavLink should exist');
	assert.match(activeLinkFunction.groups.body, /currentPathLower = currentPath\.toLowerCase\(\);/);
	assert.match(activeLinkFunction.groups.body, /querySelector\('a\[data-nav="Dev"\]'\)/);
});
