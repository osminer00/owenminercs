# Q&A Mirror Runbook

## Intent

`QA/qa.html` gives visitors a lightweight FAQ and can mirror answered Discord questions. The page should remain useful even when Discord credentials are not configured.

## Codepaths

- Page: `QA/qa.html`
- Browser loader: `QA/scripts/qa-feed.js`
- Static fallback data: `QA/answered-qa.json`
- Cloudflare Pages endpoint: `functions/api/discord-qa.js`
- Netlify mirror endpoint: `netlify/functions/discord-qa.js`

Keep both endpoint implementations aligned when changing parsing, environment variables, or response shape.

## Load order

`qa-feed.js` renders into `#discord-qa-feed`.

1. Detect the site root from the loaded `scripts/components.js` URL.
2. In production only, request `GET /api/discord-qa`.
3. Always request `QA/answered-qa.json`.
4. Merge fallback rows after live rows, deduping by `id` or `question`.
5. Render escaped question/answer blocks with an optional Discord link and formatted date.

Localhost, `127.0.0.1`, and `file://` skip the live endpoint so local previews do not require Discord secrets.

## Endpoint configuration

Required for live Discord data:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`

Optional:

- `DISCORD_QA_FORUM_CHANNEL_ID` - preferred when Q&A is handled in a Discord forum channel.
- `DISCORD_QA_TEXT_CHANNEL_ID` - explicit text channel ID.
- `DISCORD_QA_TEXT_CHANNEL_NAME` - fallback text channel name; defaults to `questions-and-answers`.

Resolution behavior:

- If `DISCORD_QA_FORUM_CHANNEL_ID` and `DISCORD_GUILD_ID` are set, the endpoint reads active and recent archived public threads from that forum.
- If no forum items are found, the endpoint reads the text channel by explicit ID or by matching the configured/default channel name.
- If `DISCORD_BOT_TOKEN` is missing, the endpoint returns `source: "unconfigured"` with an empty `items` array instead of failing the page.

## Supported Discord formats

Text channel messages can be mirrored when they use:

```md
**Q**: How do I find your livestream?

**A**: Twitch and YouTube links are on the Socials page.
```

Embeds can also be mirrored:

- Embed title: optional `Q: ...` text, or the title becomes the question.
- Embed description: answer text.

Forum channels use the starter message or thread title as the question and concatenate non-empty replies as the answer.

## Response shape

```json
{
	"source": "discord",
	"updated": "2026-04-29T00:00:00.000Z",
	"items": [
		{
			"id": "discord-message-or-thread-id",
			"question": "How do I find your livestream?",
			"answer": "Twitch and YouTube links are on the Socials page.",
			"answeredAt": "2026-04-29T00:00:00.000Z",
			"url": "https://discord.com/channels/..."
		}
	]
}
```

`QA/answered-qa.json` uses the same top-level shape and can stay empty:

```json
{
	"source": "static",
	"updated": "2026-04-21T00:00:00.000Z",
	"items": []
}
```

## Troubleshooting

- **The page shows no mirrored answers locally:** expected unless `QA/answered-qa.json` has rows.
- **Production shows empty feed:** check `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, and either forum/text channel configuration.
- **Text channel rows do not appear:** verify the message matches the `**Q**:` then `**A**:` markdown pattern or uses a supported embed.
- **Forum rows do not appear:** the endpoint only mirrors threads with at least one reply and reads active plus recent archived public threads.
- **Discord API errors:** the endpoint returns `source: "error"` and HTTP 500; inspect the JSON `error` field without exposing the bot token.
