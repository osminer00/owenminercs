import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

async function importCloudflareSiteAssistant() {
	const source = readFileSync(
		new URL('../functions/api/site-assistant.js', import.meta.url),
		'utf8'
	);
	const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
	return import(moduleUrl);
}

test('Cloudflare site assistant rejects oversized bodies without a content-length header', async () => {
	const { onRequestPost } = await importCloudflareSiteAssistant();
	const oversizedBody = JSON.stringify({
		messages: [{ role: 'user', content: 'x'.repeat(100_001) }],
	});
	const request = new Request('https://example.com/api/site-assistant', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: oversizedBody,
	});

	assert.equal(request.headers.get('content-length'), null);

	const response = await onRequestPost({ request, env: {} });
	const payload = await response.json();

	assert.equal(response.status, 413);
	assert.equal(payload.error, 'Request body is too large.');
});
