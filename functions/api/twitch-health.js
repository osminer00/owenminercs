import { callbackUrl, json, requireEnv, safeJsonParse, upstashCommand } from './_twitch-utils';

const REQUIRED_ENV_VARS = [
	'TWITCH_CLIENT_ID',
	'TWITCH_CLIENT_SECRET',
	'TWITCH_EVENTSUB_SECRET',
	'TWITCH_BROADCASTER_ID',
	'PUBLIC_SITE_URL',
	'UPSTASH_REDIS_REST_URL',
	'UPSTASH_REDIS_REST_TOKEN',
];

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

export async function onRequestGet(context) {
	const { env } = context;

	const envState = {};
	const missing = [];
	for (const key of REQUIRED_ENV_VARS) {
		const isSet = Boolean(env?.[key]);
		envState[key] = isSet;
		if (!isSet) missing.push(key);
	}

	const response = {
		ok: false,
		env: envState,
		missing,
		checks: {
			upstash: { ok: false, skipped: true },
			twitchAuth: { ok: false, skipped: true },
		},
		callback: env?.PUBLIC_SITE_URL ? callbackUrl(env.PUBLIC_SITE_URL) : null,
		generatedAt: new Date().toISOString(),
	};

	if (!missing.length) {
		try {
			const upstash = await upstashCommand(env, ['PING']);
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
				...(await checkTwitchAuth(env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET)),
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

	return json(response);
}

export async function onRequest() {
	return json({ error: 'Method not allowed. Use GET.' }, 405);
}
