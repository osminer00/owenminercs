# Social Cloud Content Runbook

Last reviewed: 2026-04-30

The Socials area is a static, client-rendered content browser. It does **not** call
privileged provider APIs from the browser. Public pages read committed JSON feed
snapshots from `Socials/data/` plus Reddit's public JSON endpoint.

## Current Architecture

| Surface              | Codepath                                                                                               | Purpose                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Animated content hub | `Socials/socials.html`, `Socials/scripts/social-cloud.js`, `Socials/social-cloud.css`                  | Floating cards, lightweight mode, pin/drag/resize/rotate, media playback, hashtag filters.         |
| All-content index    | `Socials/view-all-content.html`, `Socials/scripts/view-all-content.js`, `Socials/view-all-content.css` | Static grid that groups the same clip/post across platforms and links to each platform copy.       |
| Feed data            | `Socials/data/*.json`                                                                                  | Sanitized public snapshots for YouTube, X, TikTok, Instagram, Facebook, and Twitch when available. |
| Shared shell         | `scripts/components.js`, `css/owenminercs.css`                                                         | Header/footer, social dock, shared card styles used by Socials pages.                              |

## Feed Files

`social-cloud.js` fetches these absolute paths and treats missing/unreachable files
as empty optional feeds:

- `/Socials/data/youtube-shorts.json`
- `/Socials/data/youtube-videos.json`
- `/Socials/data/x-top-posts.json`
- `/Socials/data/instagram-posts.json`
- `/Socials/data/tiktok-posts.json`
- `/Socials/data/facebook-posts.json`
- `/Socials/data/twitch-posts.json`

`view-all-content.js` reads the same filenames relative to `Socials/`:

- `data/youtube-videos.json`
- `data/youtube-shorts.json`
- `data/tiktok-posts.json`
- `data/x-top-posts.json`
- `data/instagram-posts.json`
- `data/facebook-posts.json`
- `data/twitch-posts.json`

The animated hub also fetches Reddit from the public JSON endpoint for
`u/OwenMCS` and filters it through the same card catalog. If all local Socials
JSON files are empty or fail, the hub falls back to the manual items inside
`social-cloud.js`.

## Public Feed Schema

Each JSON file is an array of public objects. Keep secrets, private IDs, drafts,
and raw API payloads out of these files.

```json
{
	"platform": "youtube",
	"contentType": "video",
	"title": "He's Right Behind You - 4:3 Moment - CS2",
	"url": "https://www.youtube.com/watch?v=C9e4xtgWftE",
	"thumbnail": "https://i.ytimg.com/vi/C9e4xtgWftE/hqdefault.jpg",
	"embedUrl": "",
	"caption": "Public caption text",
	"publishedAt": "2024-05-08T00:57:33.000Z",
	"viewCount": 254820,
	"likeCount": 3333,
	"commentCount": 0,
	"mediaKind": "video",
	"aspectRatio": "16 / 9"
}
```

Field notes:

- `platform`: normalized platform key. `twitter` is treated as `x` in the all-content page.
- `contentType`: `short`, `video`, `reel`, `photo`, or similar user-facing type.
- `url`: required for rendering and grouping.
- `thumbnail`: optional, but missing thumbnails render as empty cards in the all-content grid.
- `embedUrl`: optional direct media/embed URL for inline playback.
- `caption`: used as card body copy and as a source for hashtag chips.
- `publishedAt`: ISO-like date string. Invalid or missing dates sort/group poorly.
- `likeCount` / `upvoteCount`: used for inclusion thresholds.
- `mediaKind` and `aspectRatio`: improve image/video handling and card sizing.

## Filtering And Grouping Rules

### Animated hub

- `MIN_SOCIAL_ENGAGEMENT` is `101`; non-Reddit posts need at least 101 likes or
  upvotes, and Reddit posts use upvotes.
- YouTube items are deduped by YouTube video ID, sorted by a score that combines
  views, likes, and recency.
- Livestream-like YouTube content is excluded from the YouTube card group.
- Hashtag filters are derived from `title`, `caption`, and `description`, then
  normalized to lowercase `a-z`, `0-9`, and `_`.
- Known blocked terms in `isBlockedSocialContentItem()` hide specific unwanted
  content from the card catalog.

### All-content page

`view-all-content.js` groups entries with union-find so cross-posts appear once:

- Same platform: same `url`, or same YouTube ID.
- Different platforms: only video-like items can merge with video-like items, and
  image-like items can merge with image-like items.
- Date match: same UTC date and published within `20` hours.
- Title match: normalized titles of at least 16 characters match within `14` days.

The primary action is chosen by platform order: YouTube, YouTube Shorts, TikTok,
Instagram, X, Facebook, Twitch, then Reddit/unknown platforms.

## Runtime Preferences And Local Storage

- Lightweight mode key: `smc-cloud-mode`
    - Values: `light`, `full`
    - Auto-enables on reduced motion, slow connections, save-data, or low-end devices.
- Visited social links key: `smc-visited-links`
- Pin-and-move achievement progress key: `smc-social-card-pin-move-progress-v1`

These keys are client-only conveniences. The site must keep working when storage
is unavailable.

## Updating Feeds

1. Refresh or edit the relevant file in `Socials/data/`.
2. Confirm each item has `platform`, `contentType`, `title`, `url`, and `publishedAt`.
3. Include public engagement counts when the item should appear in the animated hub.
4. Keep `caption` concise enough for hover/peek text, but do not strip meaningful hashtags.
5. Test:
    - `Socials/socials.html` for animated cards, filters, and lightweight mode.
    - `Socials/view-all-content.html` for grouping count and platform buttons.

## Troubleshooting

- **Card missing from animated hub:** verify `likeCount` or `upvoteCount` is at
  least `101`, `url` is present, and the item is not caught by the blocked-term list.
- **Card visible on all-content page but not animated hub:** the all-content page
  does not apply the 101-engagement threshold.
- **Duplicate cross-posts in all-content:** confirm dates are close enough, titles
  match after punctuation removal, or the same YouTube ID is present in the URL.
- **Hashtag filter not shown:** filters only appear when video cards expose hashtags
  in `title`, `caption`, or `description`.
- **Inline video does not play:** check `embedUrl`, `mediaKind`, and `aspectRatio`;
  fallback thumbnail cards should still link out.

## Security Constraints

- Do not commit provider tokens, cookies, private API responses, or draft-only
  content to `Socials/data/`.
- Any future server-side ingestion must sanitize its output down to the public
  schema above before writing JSON or serving an endpoint.
- Browser code can only consume public JSON or public unauthenticated endpoints.
