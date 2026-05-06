import { callbackUrl, json, requireEnv, safeJsonParse } from './_twitch-utils';

const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
const SUBSCRIPTION_TYPES = [
	{ type: 'channel.follow', version: '2' },
	{ type: 'channel.subscribe', version: '1' },
	{ type: 'channel.subscription.gift', version: '1' },
	{ type: 'channel.cheer', version: '1' },
];

function timingSafeEqual(a, b) {
	if (a.length !== b.length) return false;
	let out = 0;
	for (let i = 0; i < a.length; i += 1) {
		out |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return out === 0;
}

function isAuthorizedRequest(request, expectedSecret) {
	const headerSecret = request?.headers?.get(REGISTER_SECRET_HEADER) || '';
	const bearer = request?.headers?.get('authorization') || '';
	const bearerSecret = bearer.toLowerCase().startsWith('bearer ') ? bearer.slice(7).trim() : '';
	const providedSecret = headerSecret || bearerSecret;
	return Boolean(providedSecret && expectedSecret && timingSafeEqual(providedSecret, expectedSecret));
}

async function getAppAccessToken(clientId, clientSecret) {
	const response = await fetch('https://id.twitch.tv/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'client_credentials',
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to get app token: ${text}`);
	}

	const data = await response.json();
	if (!data.access_token) {
		throw new Error('Twitch app token response did not include access_token.');
	}
	return data.access_token;
}

async function twitchHelix(url, token, clientId, method = 'GET', body = null) {
	const response = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			'Client-Id': clientId,
			'Content-Type': 'application/json',
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await response.text();
	const data = safeJsonParse(text, {});
	return { ok: response.ok, status: response.status, data, raw: text };
}

export async function onRequestPost(context) {
	const { env, request } = context;
	const registerSecret = env?.TWITCH_REGISTER_SECRET || env?.TWITCH_EVENTSUB_SECRET;
	if (!registerSecret) {
		return json({ error: 'Twitch EventSub registration is not configured.' }, 503);
	}
	if (!isAuthorizedRequest(request, registerSecret)) {
		return json({ error: 'Forbidden.' }, 403);
	}

	let clientId;
	let clientSecret;
	let secret;
	let broadcasterId;
	let siteUrl;

	try {
		clientId = requireEnv(env, 'TWITCH_CLIENT_ID');
		clientSecret = requireEnv(env, 'TWITCH_CLIENT_SECRET');
		secret = requireEnv(env, 'TWITCH_EVENTSUB_SECRET');
		broadcasterId = requireEnv(env, 'TWITCH_BROADCASTER_ID');
		siteUrl = requireEnv(env, 'PUBLIC_SITE_URL');
	} catch (error) {
		return json({ error: String(error.message || error) }, 500);
	}

	try {
		const token = await getAppAccessToken(clientId, clientSecret);
		const cb = callbackUrl(siteUrl);

		const existing = await twitchHelix(
			'https://api.twitch.tv/helix/eventsub/subscriptions?status=enabled',
			token,
			clientId
		);
		const existingSubs = Array.isArray(existing.data?.data) ? existing.data.data : [];
		const results = [];

		for (const sub of SUBSCRIPTION_TYPES) {
			const alreadyExists = existingSubs.some((s) => {
				return (
					s.type === sub.type &&
					s.version === sub.version &&
					s.transport?.callback === cb &&
					s.condition?.broadcaster_user_id === broadcasterId
				);
			});

			if (alreadyExists) {
				results.push({ type: sub.type, status: 'already_exists' });
				continue;
			}

			const body = {
				type: sub.type,
				version: sub.version,
				condition: {
					broadcaster_user_id: broadcasterId,
					...(sub.type === 'channel.follow' ? { moderator_user_id: broadcasterId } : {}),
				},
				transport: {
					method: 'webhook',
					callback: cb,
					secret,
				},
			};

			const createRes = await twitchHelix(
				'https://api.twitch.tv/helix/eventsub/subscriptions',
				token,
				clientId,
				'POST',
				body
			);

			if (!createRes.ok) {
				results.push({
					type: sub.type,
					status: 'failed',
					detail: createRes.data?.message || createRes.raw || `HTTP ${createRes.status}`,
				});
			} else {
				results.push({ type: sub.type, status: 'created' });
			}
		}

		return json({
			ok: true,
			callback: cb,
			broadcasterId,
			results,
		});
	} catch (error) {
		return json(
			{
				error: 'Failed to register Twitch EventSub subscriptions.',
				detail: String(error.message || error),
			},
			500
		);
	}
}

export async function onRequest() {
	return json({ error: 'Method not allowed. Use POST.' }, 405);
}
