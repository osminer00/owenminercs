import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const feedServerSource = readFileSync(
	new URL('../scripts/local-social-feed-server.mjs', import.meta.url),
	'utf8'
);

function countOccurrences(source, needle) {
	let count = 0;
	let index = 0;
	while (true) {
		const next = source.indexOf(needle, index);
		if (next === -1) return count;
		count += 1;
		index = next + needle.length;
	}
}

test('shared nav labels Gaming Setups for The Setup and keeps Programs on Dev', () => {
	assert.equal(
		countOccurrences(
			componentsSource,
			'data-nav="The Setup" title="Desk, camping gear, PC, keyboard, and upgrades">Gaming Setups</a>'
		),
		2,
		'header and footer should both label The Setup as Gaming Setups'
	);
	assert.equal(
		countOccurrences(componentsSource, '>Bigfoot\'s Jungle</a>'),
		0,
		'old Bigfoot Jungle nav label should stay retired'
	);
	assert.equal(
		countOccurrences(
			componentsSource,
			'data-nav="Dev" title="Programs for coding, creative work, and streaming">Programs</a>'
		),
		2,
		'header and footer should both keep Programs on the Dev route'
	);
	assert.match(
		componentsSource,
		/getLink\('The%20Setup\/the-setup'\)[\s\S]{0,120}Gaming Setups/
	);
	assert.match(componentsSource, /getLink\('dev\/dev-stack'\)[\s\S]{0,120}Programs/);
});

test('shared social dock points X profile at @OwenMiner handle', () => {
	assert.match(
		componentsSource,
		/data-social-brand="x"[^>]*href="https:\/\/x\.com\/OwenMiner"/
	);
	assert.match(componentsSource, /aria-label="X \(Twitter\): @OwenMiner"/);
	assert.doesNotMatch(
		componentsSource,
		/href="https:\/\/x\.com\/owenminercs"/i,
		'legacy X handle path should not remain in dock markup'
	);
});

test('local social feed server only exposes OPTIONS/GET /api/social-feed', () => {
	assert.match(feedServerSource, /Access-Control-Allow-Methods", "GET, OPTIONS"/);
	assert.match(
		feedServerSource,
		/if \(req\.method === "OPTIONS"\) \{\s*res\.writeHead\(204\);/
	);
	assert.match(
		feedServerSource,
		/if \(req\.method !== "GET" \|\| !req\.url \|\| !req\.url\.startsWith\("\/api\/social-feed"\)\)/
	);
	assert.match(
		feedServerSource,
		/res\.writeHead\(404, \{ "content-type": "application\/json; charset=utf-8" \}\);/
	);
	assert.match(
		feedServerSource,
		/res\.writeHead\(500, \{ "content-type": "application\/json; charset=utf-8" \}\);/
	);
	assert.match(feedServerSource, /onRequestGet\(\{\s*request: new Request\(requestUrl/);
	assert.doesNotMatch(
		feedServerSource,
		/listen\([^)]*0\.0\.0\.0/,
		'local feed server must stay bound to loopback'
	);
	assert.match(feedServerSource, /const host = "127\.0\.0\.1"/);
});
