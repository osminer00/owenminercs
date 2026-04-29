const { json, safeJsonParse, upstashCommand, upstashPipeline } = require('./_twitch-utils');

const EVENT_LIST_KEY = 'activity:twitch:events';
const TOTALS_HASH_KEY = 'activity:twitch:totals';
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 80;

function parsePositiveInt(value, fallback) {
	const parsed = Number.parseInt(String(value ?? ''), 10);
	if (!Number.isFinite(parsed) || parsed < 1) return fallback;
	return parsed;
}

exports.handler = async function handler(event) {
	if (event.httpMethod !== 'GET') {
		return json(405, { error: 'Method not allowed. Use GET.' });
	}

	const limit = Math.min(
		parsePositiveInt(event.queryStringParameters?.limit, DEFAULT_LIMIT),
		MAX_LIMIT
	);

	try {
		const [eventsRes, totalsRes] = await upstashPipeline([
			['LRANGE', EVENT_LIST_KEY, '0', String(limit - 1)],
			['HGETALL', TOTALS_HASH_KEY],
		]);

		const rawEvents = Array.isArray(eventsRes?.result) ? eventsRes.result : [];
		const events = rawEvents
			.map((item) => safeJsonParse(item, null))
			.filter(Boolean)
			.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

		const flatTotals = Array.isArray(totalsRes?.result) ? totalsRes.result : [];
		const totals = {
			events_total: 0,
			follows_total: 0,
			subs_total: 0,
			gift_events_total: 0,
			gift_subs_total: 0,
			bits_total: 0,
		};
		for (let i = 0; i < flatTotals.length; i += 2) {
			const key = flatTotals[i];
			const value = Number.parseInt(flatTotals[i + 1] || '0', 10);
			if (Object.prototype.hasOwnProperty.call(totals, key)) {
				totals[key] = Number.isFinite(value) ? value : 0;
			}
		}

		const lastUpdated = await upstashCommand(['GET', 'activity:twitch:last_updated']).catch(
			() => null
		);

		return json(200, {
			ok: true,
			events,
			totals,
			generatedAt: new Date().toISOString(),
			lastUpdated: lastUpdated || null,
		});
	} catch (error) {
		return json(500, {
			error: 'Failed to load Twitch feed.',
			detail: String(error.message || error),
		});
	}
};
