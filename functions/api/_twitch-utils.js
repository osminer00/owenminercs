const EVENT_LIST_KEY = 'activity:twitch:events';
const TOTALS_HASH_KEY = 'activity:twitch:totals';
const LAST_UPDATED_KEY = 'activity:twitch:last_updated';
const SEEN_MESSAGE_PREFIX = 'activity:twitch:seen:';

function json(payload, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			...extraHeaders,
		},
	});
}

function text(body, status = 200, extraHeaders = {}) {
	return new Response(body, {
		status,
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			...extraHeaders,
		},
	});
}

function requireEnv(env, name) {
	const value = env?.[name];
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

function safeJsonParse(input, fallback = null) {
	try {
		return JSON.parse(input);
	} catch {
		return fallback;
	}
}

async function upstashCommand(env, command) {
	const url = requireEnv(env, 'UPSTASH_REDIS_REST_URL');
	const token = requireEnv(env, 'UPSTASH_REDIS_REST_TOKEN');

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(command),
	});

	const text = await response.text();
	const data = safeJsonParse(text, {});
	if (!response.ok || data.error) {
		throw new Error(`Upstash command failed: ${data.error || text || 'Unknown error'}`);
	}
	return data.result;
}

async function upstashPipeline(env, commands) {
	const url = requireEnv(env, 'UPSTASH_REDIS_REST_URL');
	const token = requireEnv(env, 'UPSTASH_REDIS_REST_TOKEN');

	const response = await fetch(`${url}/pipeline`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(commands),
	});

	const text = await response.text();
	const data = safeJsonParse(text, []);
	if (!response.ok || !Array.isArray(data)) {
		throw new Error(`Upstash pipeline failed: ${text || 'Unknown pipeline error'}`);
	}
	return data;
}

function eventTypeToLabel(type) {
	switch (type) {
		case 'channel.follow':
			return 'follow';
		case 'channel.subscribe':
			return 'subscribe';
		case 'channel.subscription.gift':
			return 'gift_sub';
		case 'channel.cheer':
			return 'bits';
		default:
			return 'other';
	}
}

function normalizeTwitchEvent(subscriptionType, event) {
	const base = {
		id: crypto.randomUUID(),
		subscriptionType,
		type: eventTypeToLabel(subscriptionType),
		createdAt: event.followed_at || event.started_at || new Date().toISOString(),
		userName: event.user_name || event.user_login || 'Unknown',
		displayText: '',
		raw: event,
	};

	if (subscriptionType === 'channel.follow') {
		return {
			...base,
			createdAt: event.followed_at || new Date().toISOString(),
			displayText: `${event.user_name || 'Someone'} followed`,
		};
	}

	if (subscriptionType === 'channel.subscribe') {
		const tier = event.tier || '1000';
		const months = Number(event.cumulative_months || 1);
		return {
			...base,
			createdAt: event.started_at || new Date().toISOString(),
			tier,
			months,
			displayText: `${event.user_name || 'Someone'} subscribed (Tier ${tier})`,
		};
	}

	if (subscriptionType === 'channel.subscription.gift') {
		const tier = event.tier || '1000';
		const total = Number(event.total || 1);
		return {
			...base,
			createdAt: event.started_at || new Date().toISOString(),
			tier,
			total,
			displayText: `${event.user_name || 'Someone'} gifted ${total} sub${total === 1 ? '' : 's'}`,
		};
	}

	if (subscriptionType === 'channel.cheer') {
		const bits = Number(event.bits || 0);
		return {
			...base,
			createdAt: event.started_at || new Date().toISOString(),
			bits,
			displayText: `${event.user_name || 'Someone'} cheered ${bits} bits`,
		};
	}

	return {
		...base,
		createdAt: new Date().toISOString(),
		displayText: 'New Twitch activity',
	};
}

function callbackUrl(siteUrl) {
	const trimmed = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
	return `${trimmed}/api/twitch-eventsub`;
}

function toHex(buffer) {
	const bytes = new Uint8Array(buffer);
	let out = '';
	for (const b of bytes) out += b.toString(16).padStart(2, '0');
	return out;
}

function timingSafeEqual(a, b) {
	if (a.length !== b.length) return false;
	let out = 0;
	for (let i = 0; i < a.length; i += 1) {
		out |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return out === 0;
}

async function verifyTwitchSignature({ secret, messageId, timestamp, rawBody, signature }) {
	if (!secret || !messageId || !timestamp || !rawBody || !signature) return false;
	const enc = new TextEncoder();
	const message = `${messageId}${timestamp}${rawBody}`;
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signed = await crypto.subtle.sign('HMAC', key, enc.encode(message));
	const expected = `sha256=${toHex(signed)}`;
	return timingSafeEqual(expected, signature);
}

export {
	EVENT_LIST_KEY,
	TOTALS_HASH_KEY,
	LAST_UPDATED_KEY,
	SEEN_MESSAGE_PREFIX,
	callbackUrl,
	json,
	normalizeTwitchEvent,
	requireEnv,
	safeJsonParse,
	text,
	upstashCommand,
	upstashPipeline,
	verifyTwitchSignature,
};
