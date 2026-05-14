const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_BODY_BYTES = 100_000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1200;
const MAX_KNOWLEDGE_ENTRIES = 80;
const MAX_KNOWLEDGE_FIELD_CHARS = 1000;
const MAX_KNOWLEDGE_BLOB_CHARS = 20_000;
const ASSISTANT_ACCESS_TOKEN_HEADER = 'x-site-assistant-token';

function json(statusCode, payload) {
	return {
		statusCode,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify(payload),
	};
}

exports.handler = async function handler(event) {
	if (event.httpMethod === 'OPTIONS') {
		return {
			statusCode: 204,
			headers: {
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, X-Site-Assistant-Token',
			},
			body: '',
		};
	}

	if (event.httpMethod !== 'POST') {
		return json(405, { error: 'Method not allowed. Use POST.' });
	}

	if (Buffer.byteLength(event.body || '', 'utf8') > MAX_BODY_BYTES) {
		return json(413, { error: 'Request body is too large.' });
	}

	const accessCheck = validateAssistantAccess(
		event.headers,
		process.env.SITE_ASSISTANT_ACCESS_TOKEN
	);
	if (!accessCheck.ok) {
		return json(accessCheck.status, { error: accessCheck.error });
	}

	if (!process.env.OPENAI_API_KEY) {
		return json(500, {
			error: 'OPENAI_API_KEY is not configured in Netlify environment variables.',
		});
	}

	let parsedBody;
	try {
		parsedBody = JSON.parse(event.body || '{}');
	} catch (error) {
		return json(400, { error: 'Invalid JSON body.' });
	}

	const messages = normalizeMessages(parsedBody.messages);
	const knowledgeEntries = normalizeKnowledgeEntries(parsedBody.knowledgeEntries);

	if (!messages.length) {
		return json(400, { error: 'At least one message is required.' });
	}

	const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
	const knowledgeBlob = knowledgeEntries
		.map((entry, index) => {
			const title = entry.title || 'Untitled';
			const url = entry.url || '/';
			const summary = entry.summary || '';
			return `${index + 1}. ${title}\nURL: ${url}\nSummary: ${summary}`;
		})
		.join('\n\n')
		.slice(0, MAX_KNOWLEDGE_BLOB_CHARS);

	const systemPrompt = [
		'You are an assistant for owenminercs.com.',
		'Only answer based on the provided site knowledge.',
		'If the answer is not present in the knowledge, say you are not sure and suggest the closest relevant page.',
		'Keep replies concise and useful. Use plain text, no markdown tables.',
		'When relevant, include 1-3 page paths from the provided URLs.',
		'',
		'Site knowledge:',
		knowledgeBlob || 'No site knowledge was provided.',
	].join('\n');

	try {
		const completionResponse = await fetch(OPENAI_API_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model,
				temperature: 0.3,
				max_tokens: 500,
				messages: [{ role: 'system', content: systemPrompt }, ...messages],
			}),
		});

		if (!completionResponse.ok) {
			const errorText = await completionResponse.text();
			return json(502, {
				error: 'Upstream AI provider request failed.',
				detail: errorText.slice(0, 1000),
			});
		}

		const completionData = await completionResponse.json();
		const reply = completionData?.choices?.[0]?.message?.content?.trim();

		if (!reply) {
			return json(502, { error: 'AI provider returned an empty response.' });
		}

		return json(200, { reply });
	} catch (error) {
		return json(500, { error: 'Assistant request failed.', detail: String(error) });
	}
};

function cleanText(value, maxLength) {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength);
}

function validateAssistantAccess(headers, configuredToken) {
	const expectedToken = String(configuredToken || '').trim();
	if (!expectedToken) {
		return {
			ok: false,
			status: 503,
			error: 'Site assistant is disabled until SITE_ASSISTANT_ACCESS_TOKEN is configured.',
		};
	}

	const providedToken = String(getHeader(headers, ASSISTANT_ACCESS_TOKEN_HEADER) || '').trim();
	if (!timingSafeStringEqual(providedToken, expectedToken)) {
		return { ok: false, status: 401, error: 'Unauthorized assistant request.' };
	}

	return { ok: true };
}

function getHeader(headers, name) {
	if (!headers) return '';
	const headerName = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === headerName) return value;
	}
	return '';
}

function timingSafeStringEqual(left, right) {
	let diff = left.length ^ right.length;
	const length = Math.max(left.length, right.length);

	for (let index = 0; index < length; index += 1) {
		diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
	}

	return diff === 0;
}

function normalizeMessages(value) {
	if (!Array.isArray(value)) return [];
	return value
		.slice(-MAX_HISTORY_MESSAGES)
		.map((message) => {
			const role = message?.role === 'assistant' ? 'assistant' : 'user';
			const content = cleanText(message?.content, MAX_MESSAGE_CHARS);
			return content ? { role, content } : null;
		})
		.filter(Boolean);
}

function normalizeKnowledgeEntries(value) {
	if (!Array.isArray(value)) return [];
	return value
		.slice(0, MAX_KNOWLEDGE_ENTRIES)
		.map((entry) => ({
			title: cleanText(entry?.title, 180) || 'Untitled',
			url: cleanText(entry?.url, 300) || '/',
			summary: cleanText(entry?.summary, MAX_KNOWLEDGE_FIELD_CHARS),
		}))
		.filter((entry) => entry.summary || entry.title !== 'Untitled');
}
