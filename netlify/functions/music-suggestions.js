const crypto = require('crypto');
const { json, safeJsonParse, upstashCommand } = require('./_twitch-utils');

const SUGGESTION_LIST_KEY = 'music:suggestions:list';
const MAX_STORED_SUGGESTIONS = 250;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MIN_SUBMIT_SECONDS = 20;

function parsePositiveInt(value, fallback) {
	const parsed = Number.parseInt(String(value ?? ''), 10);
	if (!Number.isFinite(parsed) || parsed < 1) return fallback;
	return parsed;
}

function pickClientIp(headers = {}) {
	const direct = headers['x-nf-client-connection-ip'] || headers['X-Nf-Client-Connection-Ip'];
	if (direct) return String(direct);

	const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
	if (!forwarded) return 'unknown';
	return String(forwarded).split(',')[0].trim() || 'unknown';
}

function hashIp(ip) {
	return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24);
}

function cleanText(value, maxLen) {
	const text = String(value || '')
		.trim()
		.replace(/\s+/g, ' ');
	if (!text) return '';
	return text.slice(0, maxLen);
}

function validateSuggestion(input) {
	const songTitle = cleanText(input.songTitle, 120);
	const artistName = cleanText(input.artistName, 120);
	const viewerName = cleanText(input.viewerName, 60);
	const note = cleanText(input.note, 220);
	const honeypot = cleanText(input.website, 120);

	if (honeypot) {
		return { error: 'Invalid submission.' };
	}

	if (!songTitle || !artistName) {
		return { error: 'Song title and artist are required.' };
	}

	return {
		suggestion: {
			id: crypto.randomUUID(),
			songTitle,
			artistName,
			viewerName: viewerName || 'Anonymous',
			note,
			createdAt: new Date().toISOString(),
		},
	};
}

async function readSuggestions(limit) {
	const raw = await upstashCommand(['LRANGE', SUGGESTION_LIST_KEY, '0', String(limit - 1)]);
	const list = Array.isArray(raw) ? raw : [];

	return list
		.map((entry) => safeJsonParse(entry, null))
		.filter(Boolean)
		.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
}

exports.handler = async function handler(event) {
	if (event.httpMethod === 'OPTIONS') {
		return {
			statusCode: 204,
			headers: {
				'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
			},
			body: '',
		};
	}

	if (event.httpMethod === 'GET') {
		const limit = Math.min(
			parsePositiveInt(event.queryStringParameters?.limit, DEFAULT_LIMIT),
			MAX_LIMIT
		);
		try {
			const suggestions = await readSuggestions(limit);
			return json(200, { ok: true, suggestions, generatedAt: new Date().toISOString() });
		} catch (error) {
			return json(500, {
				error: 'Failed to load song suggestions.',
				detail: String(error.message || error),
			});
		}
	}

	if (event.httpMethod !== 'POST') {
		return json(405, { error: 'Method not allowed. Use GET or POST.' });
	}

	const payload = safeJsonParse(event.body || '{}', null);
	if (!payload) {
		return json(400, { error: 'Invalid JSON body.' });
	}

	const { error, suggestion } = validateSuggestion(payload);
	if (error) {
		return json(400, { error });
	}

	const ip = pickClientIp(event.headers || {});
	const rateKey = `music:suggestions:rate:${hashIp(ip)}`;

	try {
		const rateResult = await upstashCommand([
			'SET',
			rateKey,
			String(Date.now()),
			'NX',
			'EX',
			String(MIN_SUBMIT_SECONDS),
		]);
		if (rateResult !== 'OK') {
			return json(429, {
				error: `Please wait ${MIN_SUBMIT_SECONDS} seconds before sending another suggestion.`,
			});
		}

		await upstashCommand(['LPUSH', SUGGESTION_LIST_KEY, JSON.stringify(suggestion)]);
		await upstashCommand([
			'LTRIM',
			SUGGESTION_LIST_KEY,
			'0',
			String(MAX_STORED_SUGGESTIONS - 1),
		]);

		return json(200, { ok: true, suggestion });
	} catch (submitError) {
		return json(500, {
			error: 'Failed to save suggestion.',
			detail: String(submitError.message || submitError),
		});
	}
};
