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
	upstashPipeline,
	verifyTwitchSignature,
} from './_twitch-utils';

const TWITCH_MESSAGE_TYPE = 'twitch-eventsub-message-type';
const TWITCH_MESSAGE_ID = 'twitch-eventsub-message-id';
const TWITCH_MESSAGE_TIMESTAMP = 'twitch-eventsub-message-timestamp';
const TWITCH_SIGNATURE = 'twitch-eventsub-message-signature';
const MAX_EVENTS = 100;
const MAX_AGE_MS = 10 * 60 * 1000;
const PROCESSING_MARKER = 'processing';
const PROCESSED_MARKER = 'processed';
const PROCESSING_TTL_SECONDS = 60;
const PROCESSED_TTL_SECONDS = 86400;

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

async function reserveMessageForProcessing(env, idempotencyKey) {
	const reserved = await upstashCommand(env, [
		'SET',
		idempotencyKey,
		PROCESSING_MARKER,
		'NX',
		'EX',
		String(PROCESSING_TTL_SECONDS),
	]);
	if (reserved === 'OK') return 'reserved';

	const marker = await upstashCommand(env, ['GET', idempotencyKey]);
	if (marker === PROCESSED_MARKER) return 'duplicate';
	return 'processing';
}

async function clearProcessingReservation(env, idempotencyKey) {
	try {
		await upstashCommand(env, ['DEL', idempotencyKey]);
	} catch (_error) {
		// The short processing TTL still allows Twitch retries to persist the event.
	}
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
		const reservation = await reserveMessageForProcessing(env, idempotencyKey);
		if (reservation === 'duplicate') return json({ ok: true, duplicate: true });
		if (reservation === 'processing') {
			return json({ error: 'Twitch event is already being processed.' }, 500);
		}

		const pipeline = [
			['LPUSH', EVENT_LIST_KEY, JSON.stringify(normalized)],
			['LTRIM', EVENT_LIST_KEY, '0', String(MAX_EVENTS - 1)],
			['SET', LAST_UPDATED_KEY, new Date().toISOString()],
			...statCommandsForEvent(normalized),
		];
		try {
			await upstashPipeline(env, pipeline);
		} catch (error) {
			await clearProcessingReservation(env, idempotencyKey);
			throw error;
		}

		await upstashCommand(env, [
			'SET',
			idempotencyKey,
			PROCESSED_MARKER,
			'EX',
			String(PROCESSED_TTL_SECONDS),
		]);
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
