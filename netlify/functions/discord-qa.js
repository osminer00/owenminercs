/**
 * Netlify mirror of /api/discord-qa (Cloudflare Pages `functions/api/discord-qa.js`).
 * Env: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, optional DISCORD_QA_TEXT_CHANNEL_ID,
 * DISCORD_QA_FORUM_CHANNEL_ID, DISCORD_QA_TEXT_CHANNEL_NAME (defaults to questions-and-answers).
 */

const DISCORD_API = 'https://discord.com/api/v10';
const DEFAULT_QA_TEXT_CHANNEL_NAME = 'questions-and-answers';

function json(statusCode, payload) {
	return {
		statusCode,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'public, max-age=45, s-maxage=120',
		},
		body: JSON.stringify(payload),
	};
}

function parseMarkdownQA(content) {
	if (!content || typeof content !== 'string') return null;
	const m = content.match(/\*\*Q\*\*:\s*([\s\S]+?)\n+\*\*A\*\*:\s*([\s\S]+)/i);
	if (!m) return null;
	return { question: m[1].trim(), answer: m[2].trim() };
}

function parseEmbedQA(embeds) {
	if (!Array.isArray(embeds) || !embeds.length) return null;
	const e = embeds[0];
	const title = (e?.title || '').trim();
	const description = (e?.description || '').trim();
	if (!description) return null;
	const q = title.replace(/^\s*Q:\s*/i, '').trim() || 'Question';
	return { question: q, answer: description };
}

async function discordGet(path, token) {
	const response = await fetch(`${DISCORD_API}${path}`, {
		headers: {
			Authorization: `Bot ${token}`,
			'User-Agent': 'owenminercs-discord-qa (Netlify)',
		},
	});
	if (!response.ok) {
		const text = await response.text().catch(() => '');
		throw new Error(`Discord API ${response.status}: ${text.slice(0, 200)}`);
	}
	return response.json();
}

function normalizeChannelName(value) {
	if (!value || typeof value !== 'string') return '';
	return value.trim().toLowerCase().replace(/^#/, '');
}

async function resolveTextChannelId(token) {
	const explicit = process.env.DISCORD_QA_TEXT_CHANNEL_ID;
	if (explicit) return explicit;

	const guildId = process.env.DISCORD_GUILD_ID;
	const nameRaw = process.env.DISCORD_QA_TEXT_CHANNEL_NAME || DEFAULT_QA_TEXT_CHANNEL_NAME;
	const targetName = normalizeChannelName(nameRaw);
	if (!guildId || !targetName) return null;

	const list = await discordGet(`/guilds/${encodeURIComponent(guildId)}/channels`, token);
	if (!Array.isArray(list)) return null;

	const found = list.find((c) => c.type === 0 && normalizeChannelName(c.name) === targetName);
	return found?.id || null;
}

async function loadForumAnswered(token) {
	const guildId = process.env.DISCORD_GUILD_ID;
	const forumChannelId = process.env.DISCORD_QA_FORUM_CHANNEL_ID;
	if (!guildId || !forumChannelId) return [];

	const headers = {
		Authorization: `Bot ${token}`,
		'User-Agent': 'owenminercs-discord-qa (Netlify)',
	};

	const threadById = new Map();

	const activeRes = await fetch(
		`${DISCORD_API}/guilds/${encodeURIComponent(guildId)}/threads/active`,
		{
			headers,
		}
	);
	if (activeRes.ok) {
		const data = await activeRes.json().catch(() => ({}));
		for (const t of data.threads || []) {
			if (t.parent_id === forumChannelId && Number(t.message_count || 0) > 1) {
				threadById.set(t.id, t);
			}
		}
	}

	const archRes = await fetch(
		`${DISCORD_API}/channels/${encodeURIComponent(forumChannelId)}/threads/archived/public?limit=25`,
		{ headers }
	);
	if (archRes.ok) {
		const data = await archRes.json().catch(() => ({}));
		for (const t of data.threads || []) {
			if (Number(t.message_count || 0) > 1) {
				threadById.set(t.id, t);
			}
		}
	}

	const items = [];
	const threads = [...threadById.values()].slice(0, 20);

	for (const thread of threads) {
		const msgs = await discordGet(
			`/channels/${encodeURIComponent(thread.id)}/messages?limit=100`,
			token
		);
		if (!Array.isArray(msgs) || msgs.length < 2) continue;

		msgs.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
		const starter = msgs[0];
		const firstReply = msgs[1];
		const question = ((starter.content || '').trim() || thread.name || 'Question').trim();
		const answer = msgs
			.slice(1)
			.map((m) => (m.content || '').trim())
			.filter(Boolean)
			.join('\n\n')
			.trim();

		if (!answer) continue;

		items.push({
			id: thread.id,
			question,
			answer,
			answeredAt: firstReply.timestamp || starter.timestamp,
			url: `https://discord.com/channels/${guildId}/${thread.id}/${firstReply.id}`,
		});
	}

	items.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
	return items;
}

async function loadTextChannelQA(token) {
	const channelId = await resolveTextChannelId(token);
	if (!channelId) return [];

	const guildId = process.env.DISCORD_GUILD_ID || '';
	const data = await discordGet(
		`/channels/${encodeURIComponent(channelId)}/messages?limit=30`,
		token
	);
	if (!Array.isArray(data)) return [];

	const items = [];
	for (const msg of data) {
		let parsed = parseMarkdownQA(msg.content);
		if (!parsed) parsed = parseEmbedQA(msg.embeds);
		if (!parsed) continue;

		items.push({
			id: msg.id,
			question: parsed.question,
			answer: parsed.answer,
			answeredAt: msg.timestamp,
			url:
				guildId && channelId
					? `https://discord.com/channels/${guildId}/${channelId}/${msg.id}`
					: null,
		});
	}
	return items;
}

exports.handler = async () => {
	const token = process.env.DISCORD_BOT_TOKEN;

	if (!token) {
		return json(200, {
			source: 'unconfigured',
			updated: new Date().toISOString(),
			items: [],
			hint: 'Set DISCORD_BOT_TOKEN and forum or text channel env vars (see functions/api/discord-qa.js).',
		});
	}

	try {
		let items = [];
		if (process.env.DISCORD_QA_FORUM_CHANNEL_ID && process.env.DISCORD_GUILD_ID) {
			items = await loadForumAnswered(token);
		}
		if (
			!items.length &&
			(process.env.DISCORD_QA_TEXT_CHANNEL_ID || process.env.DISCORD_GUILD_ID)
		) {
			items = await loadTextChannelQA(token);
		}

		return json(200, {
			source: 'discord',
			updated: new Date().toISOString(),
			items,
		});
	} catch (error) {
		return json(500, {
			source: 'error',
			updated: new Date().toISOString(),
			items: [],
			error: String(error?.message || error),
		});
	}
};
