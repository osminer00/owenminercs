const {
	json,
	normalizeTwitchEvent,
	requireEnv,
	safeJsonParse,
	upstashCommand,
	upstashPipeline,
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

function getHeader(headers, name) {
	if (!headers) return '';
	return headers[name] || headers[name.toLowerCase()] || '';
}

function messageIsFresh(timestamp) {
	const ts = Date.parse(timestamp);
	if (!Number.isFinite(ts)) return false;
	return Math.abs(Date.now() - ts) <= MAX_AGE_MS;
}

function statCommandsForEvent(event) {
	const commands = [['HINCRBY', TOTALS_HASH_KEY, 'events_total', '1']];
	if (event.type === 'follow') commands.push(['HINCRBY', TOTALS_HASH_KEY, 'follows_total', '1']);
	if (event.type === 'subscribe') commands.push(['HINCRBY', TOTALS_HASH_KEY, 'subs_total', '1']);
	if (event.type === 'gift_sub') {
		commands.push(['HINCRBY', TOTALS_HASH_KEY, 'gift_events_total', '1']);
		commands.push(['HINCRBY', TOTALS_HASH_KEY, 'gift_subs_total', String(event.total || 0)]);
	}
	if (event.type === 'bits')
		commands.push(['HINCRBY', TOTALS_HASH_KEY, 'bits_total', String(event.bits || 0)]);
	return commands;
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
	let idempotencyClaimed = false;

	try {
		const idempotentResult = await upstashCommand([
			'SET',
			idempotencyKey,
			'1',
			'NX',
			'EX',
			'86400',
		]);
		if (idempotentResult !== 'OK') {
			return json(200, { ok: true, duplicate: true });
		}
		idempotencyClaimed = true;

		const pipeline = [
			['LPUSH', EVENT_LIST_KEY, JSON.stringify(normalized)],
			['LTRIM', EVENT_LIST_KEY, '0', String(MAX_EVENTS - 1)],
			['SET', 'activity:twitch:last_updated', new Date().toISOString()],
			...statCommandsForEvent(normalized),
		];
		await upstashPipeline(pipeline);
	} catch (error) {
		if (idempotencyClaimed) {
			try {
				await upstashCommand(['DEL', idempotencyKey]);
			} catch (_) {}
		}
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
