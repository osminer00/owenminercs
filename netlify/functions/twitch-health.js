const { json, safeJsonParse, upstashCommand } = require('./_twitch-utils');

const REQUIRED_ENV_VARS = [
	'TWITCH_CLIENT_ID',
	'TWITCH_CLIENT_SECRET',
	'TWITCH_EVENTSUB_SECRET',
	'TWITCH_BROADCASTER_ID',
	'PUBLIC_SITE_URL',
	'UPSTASH_REDIS_REST_URL',
	'UPSTASH_REDIS_REST_TOKEN',
];

function callbackUrl(siteUrl) {
	const trimmed = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
	return `${trimmed}/.netlify/functions/twitch-eventsub`;
}

async function checkTwitchAuth(clientId, clientSecret) {
	const response = await fetch('https://id.twitch.tv/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'client_credentials',
		}),
	});
	const text = await response.text();
	const data = safeJsonParse(text, {});

	if (!response.ok || !data.access_token) {
		return {
			ok: false,
			status: response.status,
			detail: data?.message || text || 'Could not get app token',
		};
	}

	return { ok: true, status: response.status };
}

exports.handler = async function handler(event) {
	if (event.httpMethod !== 'GET') {
		return json(405, { error: 'Method not allowed. Use GET.' });
	}

	const env = {};
	const missing = [];
	for (const key of REQUIRED_ENV_VARS) {
		const isSet = Boolean(process.env[key]);
		env[key] = isSet;
		if (!isSet) missing.push(key);
	}

	const response = {
		ok: false,
		env,
		missing,
		checks: {
			upstash: { ok: false, skipped: true },
			twitchAuth: { ok: false, skipped: true },
		},
		callback: process.env.PUBLIC_SITE_URL ? callbackUrl(process.env.PUBLIC_SITE_URL) : null,
		generatedAt: new Date().toISOString(),
	};

	if (!missing.length) {
		try {
			const upstash = await upstashCommand(['PING']);
			response.checks.upstash = {
				ok: String(upstash).toUpperCase() === 'PONG',
				skipped: false,
			};
		} catch (error) {
			response.checks.upstash = {
				ok: false,
				skipped: false,
				detail: String(error.message || error),
			};
		}

		try {
			response.checks.twitchAuth = {
				...(await checkTwitchAuth(
					process.env.TWITCH_CLIENT_ID,
					process.env.TWITCH_CLIENT_SECRET
				)),
				skipped: false,
			};
		} catch (error) {
			response.checks.twitchAuth = {
				ok: false,
				skipped: false,
				detail: String(error.message || error),
			};
		}
	}

	response.ok =
		!missing.length &&
		Boolean(response.checks.upstash?.ok) &&
		Boolean(response.checks.twitchAuth?.ok);

	return json(200, response);
};
