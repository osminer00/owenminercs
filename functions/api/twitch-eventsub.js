import {
	EVENT_LIST_KEY,
	LAST_UPDATED_KEY,
	SEEN_MESSAGE_PREFIX,
	TOTALS_HASH_KEY,
	json,
	normalizeTwitchEvent,
	requireEnv,
	safeJsonParse,
	text,
	upstashCommand,
	verifyTwitchSignature,
} from './_twitch-utils';

const TWITCH_MESSAGE_TYPE = 'twitch-eventsub-message-type';
const TWITCH_MESSAGE_ID = 'twitch-eventsub-message-id';
const TWITCH_MESSAGE_TIMESTAMP = 'twitch-eventsub-message-timestamp';
const TWITCH_SIGNATURE = 'twitch-eventsub-message-signature';
const MAX_EVENTS = 100;
const MAX_AGE_MS = 10 * 60 * 1000;
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

export async function onRequestPost(context) {
	const { request, env } = context;

	let secret;
	try {
		secret = requireEnv(env, 'TWITCH_EVENTSUB_SECRET');
	} catch (error) {
		return json({ error: String(error.message || error) }, 500);
	}

	const messageId = request.headers.get(TWITCH_MESSAGE_ID) || '';
	const messageTimestamp = request.headers.get(TWITCH_MESSAGE_TIMESTAMP) || '';
	const signature = request.headers.get(TWITCH_SIGNATURE) || '';
	const messageType = request.headers.get(TWITCH_MESSAGE_TYPE) || '';
	const rawBody = await request.text();

	if (!messageIsFresh(messageTimestamp)) {
		return json({ error: 'Stale or invalid message timestamp.' }, 403);
	}

	const signatureIsValid = await verifyTwitchSignature({
		secret,
		messageId,
		timestamp: messageTimestamp,
		rawBody,
		signature,
	});
	if (!signatureIsValid) {
		return json({ error: 'Invalid Twitch EventSub signature.' }, 403);
	}

	const payload = safeJsonParse(rawBody, null);
	if (!payload) return json({ error: 'Invalid JSON payload.' }, 400);

	if (messageType === 'webhook_callback_verification') {
		return text(payload.challenge || '');
	}

	if (messageType === 'revocation') {
		return json({ ok: true, revoked: payload.subscription?.type || 'unknown' });
	}

	if (messageType !== 'notification') {
		return json({ ok: true, ignored: true, messageType });
	}

	const subType = payload.subscription?.type || 'unknown';
	const eventData = payload.event || {};
	const normalized = normalizeTwitchEvent(subType, eventData);
	const idempotencyKey = `${SEEN_MESSAGE_PREFIX}${messageId}`;

	try {
		const persistResult = await upstashCommand(
			env,
			persistEventCommand(idempotencyKey, normalized, new Date().toISOString())
		);
		if (String(persistResult) !== '1') return json({ ok: true, duplicate: true });
	} catch (error) {
		return json(
			{ error: 'Failed to persist Twitch event.', detail: String(error.message || error) },
			500
		);
	}

	return new Response('', { status: 204 });
}

export async function onRequestOptions() {
	return new Response('', {
		status: 204,
		headers: {
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}

export async function onRequest() {
	return json({ error: 'Method not allowed. Use POST.' }, 405);
}
