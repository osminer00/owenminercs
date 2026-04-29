const FOLLOW_UPDATES_URL = 'https://x.com/OwenMinerCS';

function json(statusCode, payload, extraHeaders = {}) {
	return {
		statusCode,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
			...extraHeaders,
		},
		body: JSON.stringify(payload),
	};
}

async function getTwitchAppAccessToken(clientId, clientSecret) {
	const response = await fetch('https://id.twitch.tv/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'client_credentials',
		}),
	});
	if (!response.ok) {
		throw new Error(`Unable to get Twitch access token (HTTP ${response.status}).`);
	}
	const data = await response.json();
	if (!data.access_token) {
		throw new Error('Twitch token response missing access_token.');
	}
	return data.access_token;
}

async function detectTwitchLiveStatus() {
	const clientId = process.env.TWITCH_CLIENT_ID;
	const clientSecret = process.env.TWITCH_CLIENT_SECRET;
	const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
	if (!clientId || !clientSecret || !broadcasterId) return null;

	const token = await getTwitchAppAccessToken(clientId, clientSecret);
	const response = await fetch(
		`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(broadcasterId)}`,
		{
			headers: {
				Authorization: `Bearer ${token}`,
				'Client-Id': clientId,
			},
		}
	);
	if (!response.ok) {
		throw new Error(`Unable to check Twitch stream status (HTTP ${response.status}).`);
	}

	const data = await response.json();
	const stream = Array.isArray(data?.data) ? data.data[0] : null;
	if (!stream) return null;

	const login = stream.user_login || process.env.TWITCH_CHANNEL_LOGIN || 'owenminercs';
	return {
		live: true,
		platform: 'Twitch',
		url: `https://www.twitch.tv/${login}`,
		title: stream.title || '',
	};
}

async function detectYouTubeLiveStatus() {
	const apiKey = process.env.YOUTUBE_API_KEY;
	const channelId = process.env.YOUTUBE_CHANNEL_ID;
	if (!apiKey || !channelId) return null;

	const endpoint = new URL('https://www.googleapis.com/youtube/v3/search');
	endpoint.searchParams.set('part', 'snippet');
	endpoint.searchParams.set('channelId', channelId);
	endpoint.searchParams.set('eventType', 'live');
	endpoint.searchParams.set('type', 'video');
	endpoint.searchParams.set('maxResults', '1');
	endpoint.searchParams.set('key', apiKey);

	const response = await fetch(endpoint.toString());
	if (!response.ok) {
		throw new Error(`Unable to check YouTube stream status (HTTP ${response.status}).`);
	}

	const data = await response.json();
	const item = Array.isArray(data?.items) ? data.items[0] : null;
	const id = item?.id?.videoId;
	if (!id) return null;

	return {
		live: true,
		platform: 'YouTube',
		url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
		title: item?.snippet?.title || '',
	};
}

function manualOverrideStatus() {
	const isLiveValue = String(process.env.LIVE_OVERRIDE_IS_LIVE || '').toLowerCase();
	const isLive = isLiveValue === '1' || isLiveValue === 'true' || isLiveValue === 'yes';
	if (!isLive) return null;

	const url = process.env.LIVE_OVERRIDE_URL || FOLLOW_UPDATES_URL;
	const platform = process.env.LIVE_OVERRIDE_PLATFORM || 'Live';
	return {
		live: true,
		platform,
		url,
	};
}

exports.handler = async function handler(event) {
	if (event.httpMethod !== 'GET') {
		return json(405, { error: 'Method not allowed. Use GET.' });
	}

	const sources = [
		{ name: 'manual', run: manualOverrideStatus },
		{ name: 'twitch', run: detectTwitchLiveStatus },
		{ name: 'youtube', run: detectYouTubeLiveStatus },
	];
	const errors = [];

	for (const source of sources) {
		try {
			const status = await source.run();
			if (status && status.live && status.url) {
				return json(200, {
					live: true,
					platform: status.platform || 'Live',
					url: status.url,
					title: status.title || '',
					source: source.name,
				});
			}
		} catch (error) {
			errors.push({
				source: source.name,
				message: String(error?.message || error),
			});
		}
	}

	return json(200, {
		live: false,
		platform: '',
		url: FOLLOW_UPDATES_URL,
		source: 'fallback',
		errors,
	});
};
