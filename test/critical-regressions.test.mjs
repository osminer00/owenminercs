import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const cloudflareEventsubSource = readFileSync(
	new URL('../functions/api/twitch-eventsub.js', import.meta.url),
	'utf8'
);
const netlifyEventsubSource = readFileSync(
	new URL('../netlify/functions/twitch-eventsub.js', import.meta.url),
	'utf8'
);
const searchHtmlSource = readFileSync(new URL('../search.html', import.meta.url), 'utf8');
const searchPageSource = readFileSync(
	new URL('../scripts/search-page.js', import.meta.url),
	'utf8'
);

function assertEventsubReleasesClaimedIdempotency(source, label) {
	assert.match(source, /let idempotencyClaimed = false;/, `${label} should track claimed keys`);
	assert.match(source, /idempotencyClaimed = true;/, `${label} should mark keys after SET NX`);
	assert.match(source, /if \(idempotencyClaimed\) \{[\s\S]*?\['DEL', idempotencyKey\]/);

	const claimIndex = source.indexOf('idempotencyClaimed = true;');
	const pipelineIndex = source.indexOf('await upstashPipeline');
	const cleanupIndex = source.indexOf("['DEL', idempotencyKey]");
	assert.ok(claimIndex > -1, `${label} should claim idempotency`);
	assert.ok(pipelineIndex > claimIndex, `${label} should persist after claiming idempotency`);
	assert.ok(cleanupIndex > pipelineIndex, `${label} should release key only after persist failures`);
}

test('Twitch EventSub retries are not suppressed after persistence failures', () => {
	assertEventsubReleasesClaimedIdempotency(cloudflareEventsubSource, 'Cloudflare handler');
	assertEventsubReleasesClaimedIdempotency(netlifyEventsubSource, 'Netlify handler');
});

test('search page keeps a working search entry point at /search and /search/', () => {
	assert.match(searchHtmlSource, /<form[\s\S]*role="search"[\s\S]*data-owen-site-search/);
	assert.match(searchHtmlSource, /action="\/search"/);
	assert.match(searchHtmlSource, /type="search"[\s\S]*name="q"/);
	assert.match(searchHtmlSource, /id="site-search-page-input"/);
	assert.match(searchHtmlSource, /href="\/css\/owenminercs\.css"/);
	assert.match(searchHtmlSource, /src="\/scripts\/components\.js"/);
	assert.match(searchHtmlSource, /src="\/scripts\/search-page\.js"/);
	assert.match(searchHtmlSource, /src="\/scripts\/support-links\.js"/);
	assert.match(
		searchPageSource,
		/const inputEl = document\.getElementById\('site-search-page-input'\);/
	);
	assert.match(searchPageSource, /if \(inputEl\) inputEl\.value = q;/);
	assert.doesNotMatch(searchPageSource, /search section on the home page/);
});
