const crypto = require('crypto');

function json(statusCode, payload, extraHeaders = {}) {
	return {
		statusCode,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			...extraHeaders,
		},
		body: JSON.stringify(payload),
	};
}

function requireEnv(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function safeJsonParse(input, fallback = null) {
	try {
		return JSON.parse(input);
	} catch {
		return fallback;
	}
}

function twitchSignature(secret, message) {
	return `sha256=${crypto.createHmac('sha256', secret).update(message).digest('hex')}`;
}

function verifyTwitchSignature({ secret, messageId, timestamp, rawBody, signature }) {
	if (!secret || !messageId || !timestamp || !rawBody || !signature) {
		return false;
	}
	const message = `${messageId}${timestamp}${rawBody}`;
	const expected = twitchSignature(secret, message);
	try {
		return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
	} catch {
		return false;
	}
}

async function upstashCommand(command) {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) {
		throw new Error('Upstash Redis is not configured.');
	}

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
		const detail = data.error || text || 'Unknown Upstash error';
		throw new Error(`Upstash command failed: ${detail}`);
	}

	return data.result;
}

async function upstashPipeline(commands) {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) {
		throw new Error('Upstash Redis is not configured.');
	}

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
	const failedCommand = Array.isArray(data)
		? data.find((entry) => entry && typeof entry === 'object' && entry.error)
		: null;

	if (!response.ok || !Array.isArray(data) || failedCommand) {
		throw new Error(
			`Upstash pipeline failed: ${failedCommand?.error || text || 'Unknown pipeline error'}`
		);
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

module.exports = {
	json,
	normalizeTwitchEvent,
	requireEnv,
	safeJsonParse,
	upstashCommand,
	upstashPipeline,
	verifyTwitchSignature,
};
