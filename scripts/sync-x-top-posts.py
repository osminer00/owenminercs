#!/usr/bin/env python3
"""Build local X top-post data for Social Cloud cards.

Fetches recent tweet IDs from Nitter RSS, enriches each post through
api.fxtwitter.com for likes/media, then writes ranked media posts to:
Socials/data/x-top-posts.json
"""

from __future__ import annotations

import json
import re
import urllib.request
import xml.etree.ElementTree as et
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path


DEFAULT_USERNAME = "OwenMiner"
MAX_ITEMS = 20
MIN_LIKES = 1

RSS_URL_TEMPLATE = "https://nitter.net/{username}/rss"
RSS_SEARCH_URL_TEMPLATE = (
    "https://nitter.net/search/rss?f=tweets&q=%28from%3A{username}%29%20min_faves%3A{min_likes}"
)
FX_STATUS_URL_TEMPLATE = "https://api.fxtwitter.com/{username}/status/{status_id}"


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "ignore")


def fetch_json(url: str) -> dict:
    raw = fetch_text(url)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def parse_rss_status_ids(rss_text: str) -> list[str]:
    root = et.fromstring(rss_text)
    channel = root.find("channel")
    if channel is None:
        return []

    status_ids: list[str] = []
    seen: set[str] = set()
    for item in channel.findall("item"):
        guid = (item.findtext("guid") or "").strip()
        link = (item.findtext("link") or "").strip()
        title = (item.findtext("title") or "").strip()

        # Skip retweets and replies from the RSS stream.
        if title.startswith("RT by @") or title.startswith("R to @"):
            continue

        status_id = ""
        if guid.isdigit():
            status_id = guid
        else:
            match = re.search(r"/status/(\d+)", link)
            if match:
                status_id = match.group(1)

        if not status_id or status_id in seen:
            continue
        seen.add(status_id)
        status_ids.append(status_id)

    return status_ids


def to_iso_datetime(raw_value: str) -> str:
    if not raw_value:
        return datetime.now(timezone.utc).isoformat()
    try:
        parsed = parsedate_to_datetime(raw_value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def normalize_ratio(width: int | float | None, height: int | float | None) -> str:
    try:
        width_value = float(width or 0)
        height_value = float(height or 0)
    except (TypeError, ValueError):
        return ""
    if width_value <= 0 or height_value <= 0:
        return ""
    return f"{int(width_value)} / {int(height_value)}"


def truncate_text(text: str, max_len: int = 120) -> str:
    compact = " ".join(str(text or "").split())
    if len(compact) <= max_len:
        return compact
    return compact[: max_len - 3].rstrip() + "..."


def select_primary_media(tweet: dict) -> dict | None:
    media_container = tweet.get("media") or {}
    media_all = media_container.get("all")
    if not isinstance(media_all, list):
        return None
    for media in media_all:
        media_type = str(media.get("type") or "").lower()
        if media_type in ("photo", "video", "gif"):
            return media
    return None


def build_content_item(tweet: dict, username: str) -> dict | None:
    author = tweet.get("author") or {}
    if str(author.get("screen_name") or "").lower() != username.lower():
        return None

    primary_media = select_primary_media(tweet)
    if not primary_media:
        return None

    likes = int(tweet.get("likes") or 0)
    if likes < MIN_LIKES:
        return None
    comments = int(tweet.get("replies") or 0)

    media_type = str(primary_media.get("type") or "").lower()
    is_video = media_type in ("video", "gif")

    video_url = str(primary_media.get("url") or "").strip() if is_video else ""
    thumb_url = str(primary_media.get("thumbnail_url") or "").strip()
    image_url = str(primary_media.get("url") or "").strip()
    preview_url = thumb_url if thumb_url else image_url

    tweet_text = str(tweet.get("text") or "").strip()
    if not tweet_text:
        tweet_text = "X post"

    return {
        "platform": "x",
        "contentType": "video" if is_video else "photo",
        "title": truncate_text(tweet_text),
        "url": str(tweet.get("url") or f"https://x.com/{username}/status/{tweet.get('id', '')}").strip(),
        "thumbnail": preview_url,
        "embedUrl": video_url,
        "caption": tweet_text,
        "publishedAt": to_iso_datetime(str(tweet.get("created_at") or "")),
        "viewCount": int(tweet.get("views") or 0),
        "likeCount": likes,
        "commentCount": comments,
        "mediaKind": "video" if is_video else "image",
        "aspectRatio": normalize_ratio(primary_media.get("width"), primary_media.get("height")),
    }


def by_score_desc(item: dict) -> tuple:
    published_at = str(item.get("publishedAt") or "")
    like_count = int(item.get("likeCount") or 0)
    view_count = int(item.get("viewCount") or 0)
    comment_count = int(item.get("commentCount") or 0)
    return (like_count, view_count, comment_count, published_at)


def resolve_username_from_nav(repo_root: Path) -> str:
    components_path = repo_root / "scripts" / "components.js"
    if not components_path.exists():
        return DEFAULT_USERNAME
    source = components_path.read_text(encoding="utf-8", errors="ignore")
    match = re.search(r"https://x\.com/([A-Za-z0-9_]+)", source)
    if not match:
        return DEFAULT_USERNAME
    username = match.group(1).strip()
    return username or DEFAULT_USERNAME


def build_top_posts(username: str) -> list[dict]:
    status_ids: list[str] = []
    seen_ids: set[str] = set()

    rss_candidates = [
        RSS_SEARCH_URL_TEMPLATE.format(username=username, min_likes=100),
        RSS_URL_TEMPLATE.format(username=username),
    ]
    for rss_url in rss_candidates:
        try:
            rss_text = fetch_text(rss_url)
            parsed_ids = parse_rss_status_ids(rss_text)
            for status_id in parsed_ids:
                if status_id in seen_ids:
                    continue
                seen_ids.add(status_id)
                status_ids.append(status_id)
        except Exception:
            # Keep going and try the next source.
            continue

    out: list[dict] = []
    for status_id in status_ids:
        payload = fetch_json(FX_STATUS_URL_TEMPLATE.format(username=username, status_id=status_id))
        tweet = payload.get("tweet")
        if not isinstance(tweet, dict):
            continue
        item = build_content_item(tweet, username)
        if item:
            out.append(item)

    out.sort(key=by_score_desc, reverse=True)
    return out[:MAX_ITEMS]


def has_existing_posts(target_path: Path) -> bool:
    if not target_path.exists():
        return False
    try:
        existing = json.loads(target_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return isinstance(existing, list) and len(existing) > 0


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    target_path = repo_root / "Socials" / "data" / "x-top-posts.json"
    username = resolve_username_from_nav(repo_root)

    posts = build_top_posts(username)
    if not posts and has_existing_posts(target_path):
        raise RuntimeError(
            f"Refusing to overwrite existing X post data with 0 posts for @{username}. "
            "Check the RSS/fxTwitter sources and retry."
        )

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(json.dumps(posts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Wrote {len(posts)} post(s) for @{username} to {target_path}")


if __name__ == "__main__":
    main()
