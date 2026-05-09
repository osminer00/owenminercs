const {
	json,
	normalizeTwitchEvent,
	requireEnv,
	safeJsonParse,
	upstashCommand,
	verifyTwitchSignature,
} = require('./_twitch-utils');

const TWITCH_MESSAGE_TYPE = 'twitch-eventsub-message-type';
const TWITCH_MESSAGE_ID = 'twitch-eventsub-message-id';
const TWITCH_MESSAGE_TIMESTAMP = 'twitch-eventsub-message-timestamp';
const TWITCH_SIGNATURE = 'twitch-eventsub-message-signature';
const EVENT_LIST_KEY = 'activity:twitch:events';
const TOTALS_HASH_KEY = 'activity:twitch:totals';
const SEEN_MESSAGE_PREFIX = 'activity:twitch:seen:';
const MAX_EVENTS = 100;
const MAX_AGE_MS = 10 * 60 * 1000;
const LAST_UPDATED_KEY = 'activity:twitch:last_updated';
const EVENT_IDEMPOTENCY_TTL_SECONDS = 86400;
const PERSIST_EVENT_SCRIPT = `
local claimed = redis.call('SET', KEYS[1], '1', 'NX', 'EX', tonumber(ARGV[1]) or 86400)
if not claimed then
	return 0
end

redis.call('LPUSH', KEYS[2], ARGV[2])
redis.call('LTRIM', KEYS[2], 0, tonumber(ARGV[3]) or 99)
redis.call('SET', KEYS[3], ARGV[4])

for i = 5, #ARGV, 2 do
	redis.call('HINCRBY', KEYS[4], ARGV[i], ARGV[i + 1])
end

return 1
`;

function getHeader(headers, name) {
	if (!headers) return '';
	return headers[name] || headers[name.toLowerCase()] || '';
}

function messageIsFresh(timestamp) {
	const ts = Date.parse(timestamp);
	if (!Number.isFinite(ts)) return false;
	return Math.abs(Date.now() - ts) <= MAX_AGE_MS;
}

function statIncrementsForEvent(event) {
	const increments = [['events_total', '1']];
	if (event.type === 'follow') increments.push(['follows_total', '1']);
	if (event.type === 'subscribe') increments.push(['subs_total', '1']);
	if (event.type === 'gift_sub') {
		increments.push(['gift_events_total', '1']);
		increments.push(['gift_subs_total', String(event.total || 0)]);
	}
	if (event.type === 'bits') increments.push(['bits_total', String(event.bits || 0)]);
	return increments;
}

function persistEventCommand(idempotencyKey, event, nowIso) {
	const args = [
		String(EVENT_IDEMPOTENCY_TTL_SECONDS),
		JSON.stringify(event),
		String(MAX_EVENTS - 1),
		nowIso,
	];
	for (const [field, amount] of statIncrementsForEvent(event)) {
		args.push(field, String(amount));
	}
	return [
		'EVAL',
		PERSIST_EVENT_SCRIPT,
		'4',
		idempotencyKey,
		EVENT_LIST_KEY,
		LAST_UPDATED_KEY,
		TOTALS_HASH_KEY,
		...args,
	];
}

exports.handler = async function handler(event) {
	if (event.httpMethod === 'OPTIONS') {
		return {
			statusCode: 204,
			headers: {
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
			},
			body: '',
		};
	}

	if (event.httpMethod !== 'POST') {
		return json(405, { error: 'Method not allowed. Use POST.' });
	}

	let secret;
	try {
		secret = requireEnv('TWITCH_EVENTSUB_SECRET');
	} catch (error) {
		return json(500, { error: String(error.message || error) });
	}

	const messageId = getHeader(event.headers, TWITCH_MESSAGE_ID);
	const messageTimestamp = getHeader(event.headers, TWITCH_MESSAGE_TIMESTAMP);
	const signature = getHeader(event.headers, TWITCH_SIGNATURE);
	const messageType = getHeader(event.headers, TWITCH_MESSAGE_TYPE);
	const rawBody = event.body || '';

	if (!messageIsFresh(messageTimestamp)) {
		return json(403, { error: 'Stale or invalid message timestamp.' });
	}

	const signatureIsValid = verifyTwitchSignature({
		secret,
		messageId,
		timestamp: messageTimestamp,
		rawBody,
		signature,
	});

	if (!signatureIsValid) {
		return json(403, { error: 'Invalid Twitch EventSub signature.' });
	}

	const payload = safeJsonParse(rawBody, null);
	if (!payload) {
		return json(400, { error: 'Invalid JSON payload.' });
	}

	if (messageType === 'webhook_callback_verification') {
		return {
			statusCode: 200,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			body: payload.challenge || '',
		};
	}

	if (messageType === 'revocation') {
		return json(200, { ok: true, revoked: payload.subscription?.type || 'unknown' });
	}

	if (messageType !== 'notification') {
		return json(200, { ok: true, ignored: true, messageType });
	}

	const subType = payload.subscription?.type || 'unknown';
	const eventData = payload.event || {};
	const normalized = normalizeTwitchEvent(subType, eventData);
	const idempotencyKey = `${SEEN_MESSAGE_PREFIX}${messageId}`;

	try {
		const persistResult = await upstashCommand(
			persistEventCommand(idempotencyKey, normalized, new Date().toISOString())
		);
		if (String(persistResult) !== '1') {
			return json(200, { ok: true, duplicate: true });
		}
	} catch (error) {
		return json(500, {
			error: 'Failed to persist Twitch event.',
			detail: String(error.message || error),
		});
	}

	return {
		statusCode: 204,
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
		body: '',
	};
};
