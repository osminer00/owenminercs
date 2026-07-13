#!/usr/bin/env python3
"""Build local X top-post data for Social Cloud cards.

Fetches recent tweet IDs from Nitter RSS, enriches each post through
api.fxtwitter.com for likes/media, then writes ranked media posts to:
Socials/data/x-top-posts.json
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as et
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path


DEFAULT_USERNAME = "OwenMiner"
MAX_ITEMS = 20
MIN_LIKES = 100

RSS_URL_TEMPLATE = "https://nitter.net/{username}/rss"
RSS_SEARCH_URL_TEMPLATE = (
    "https://nitter.net/search/rss?f=tweets&q=%28from%3A{username}%29%20min_faves%3A{min_likes}"
)
FX_STATUS_URL_TEMPLATE = "https://api.fxtwitter.com/{username}/status/{status_id}"
PROFILE_MIRROR_URLS = (
    "https://zamantika.com/profile/owenminer",
    "https://zamantika.com/profile/OwenMiner",
)


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

        # Skip retweets only; keep replies for the home X row.
        if title.startswith("RT by @"):
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


def author_is_owen(tweet: dict, username: str) -> bool:
    author = tweet.get("author") or {}
    screen_name = str(author.get("screen_name") or "").lower()
    allowed = {username.lower(), "owenminer", "owenminercs"}
    return screen_name in allowed


def build_content_item(tweet: dict, username: str) -> dict | None:
    if not author_is_owen(tweet, username):
        return None

    primary_media = select_primary_media(tweet)

    likes = int(tweet.get("likes") or 0)
    if likes < MIN_LIKES:
        return None
    comments = int(tweet.get("replies") or 0)

    media_type = str((primary_media or {}).get("type") or "").lower()
    is_video = media_type in ("video", "gif")

    video_url = str(primary_media.get("url") or "").strip() if primary_media and is_video else ""
    thumb_url = str(primary_media.get("thumbnail_url") or "").strip() if primary_media else ""
    image_url = str(primary_media.get("url") or "").strip() if primary_media else ""
    preview_url = thumb_url if thumb_url else image_url

    tweet_text = str(tweet.get("text") or "").strip()
    if not tweet_text:
        tweet_text = "X post"

    return {
        "platform": "x",
        "contentType": "video" if is_video else ("photo" if primary_media else "text"),
        "title": truncate_text(tweet_text),
        "url": str(tweet.get("url") or f"https://x.com/{username}/status/{tweet.get('id', '')}").strip(),
        "thumbnail": preview_url,
        "embedUrl": video_url,
        "caption": tweet_text,
        "publishedAt": to_iso_datetime(str(tweet.get("created_at") or "")),
        "viewCount": int(tweet.get("views") or 0),
        "likeCount": likes,
        "commentCount": comments,
        "mediaKind": "video" if is_video else ("image" if primary_media else "text"),
        "aspectRatio": normalize_ratio(
            (primary_media or {}).get("width"),
            (primary_media or {}).get("height"),
        ),
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


def load_existing_posts(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return payload if isinstance(payload, list) else []


def extract_status_id_from_url(url: str) -> str:
    match = re.search(r"/status/(\d+)", str(url or ""))
    return match.group(1) if match else ""


def collect_status_ids_from_posts(posts: list[dict]) -> list[str]:
    status_ids: list[str] = []
    seen: set[str] = set()
    for item in posts:
        status_id = extract_status_id_from_url(str(item.get("url") or ""))
        if not status_id or status_id in seen:
            continue
        seen.add(status_id)
        status_ids.append(status_id)
    return status_ids


def fetch_profile_mirror_status_ids() -> list[str]:
    status_ids: list[str] = []
    seen_ids: set[str] = set()
    for mirror_url in PROFILE_MIRROR_URLS:
        try:
            page_text = fetch_text(mirror_url)
            for match in re.finditer(r"status/(\d{10,})", page_text):
                status_id = match.group(1)
                if status_id in seen_ids:
                    continue
                seen_ids.add(status_id)
                status_ids.append(status_id)
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            print(f"[x-top-posts] profile mirror error: {mirror_url}: {exc}", file=sys.stderr)
            continue
        except Exception as exc:
            print(f"[x-top-posts] profile mirror error: {mirror_url}: {exc}", file=sys.stderr)
            continue
    return status_ids


def fetch_rss_status_ids(username: str) -> tuple[list[str], list[str]]:
    status_ids: list[str] = []
    seen_ids: set[str] = set()
    errors: list[str] = []

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
        except (urllib.error.URLError, TimeoutError, et.ParseError, ValueError) as exc:
            errors.append(f"{rss_url}: {exc}")
            continue
        except Exception as exc:
            errors.append(f"{rss_url}: {exc}")
            continue

    return status_ids, errors


def build_posts_from_status_ids(username: str, status_ids: list[str]) -> list[dict]:
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


def build_top_posts(username: str, existing_posts: list[dict]) -> tuple[list[dict], bool, list[str]]:
    status_ids, rss_errors = fetch_rss_status_ids(username)
    used_existing_fallback = False

    mirror_ids = fetch_profile_mirror_status_ids()
    if mirror_ids:
        seen_ids = set(status_ids)
        for status_id in mirror_ids:
            if status_id in seen_ids:
                continue
            seen_ids.add(status_id)
            status_ids.append(status_id)

    for status_id in collect_status_ids_from_posts(existing_posts):
        if status_id not in status_ids:
            status_ids.append(status_id)

    if not status_ids and existing_posts:
        status_ids = collect_status_ids_from_posts(existing_posts)
        used_existing_fallback = bool(status_ids)
        if used_existing_fallback:
            print(
                f"Nitter RSS unavailable; refreshing {len(status_ids)} known status ID(s) via fxtwitter.",
                file=sys.stderr,
            )

    posts = build_posts_from_status_ids(username, status_ids)
    fetch_failed = bool(rss_errors) and not status_ids
    if not posts and status_ids and not fetch_failed:
        fetch_failed = True
    return posts, fetch_failed, rss_errors


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    target_path = repo_root / "Socials" / "data" / "x-top-posts.json"
    username = resolve_username_from_nav(repo_root)
    existing_posts = load_existing_posts(target_path)

    posts, fetch_failed, rss_errors = build_top_posts(username, existing_posts)

    if not posts and existing_posts:
        for error in rss_errors:
            print(f"[x-top-posts] RSS error: {error}", file=sys.stderr)
        filtered_existing = [
            item
            for item in existing_posts
            if int(item.get("likeCount") or 0) >= MIN_LIKES
        ]
        if filtered_existing:
            target_path.write_text(
                json.dumps(filtered_existing, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            print(
                f"[x-top-posts] Sync returned 0 new posts; kept {len(filtered_existing)} existing post(s) at {MIN_LIKES}+ likes.",
                file=sys.stderr,
            )
            sys.exit(1)
        print(
            f"[x-top-posts] Sync returned 0 posts and no existing posts meet {MIN_LIKES}+ likes; wrote empty list.",
            file=sys.stderr,
        )
        target_path.write_text("[]\n", encoding="utf-8")
        sys.exit(1)

    if fetch_failed and not posts:
        for error in rss_errors:
            print(f"[x-top-posts] RSS error: {error}", file=sys.stderr)
        print("[x-top-posts] Fetch failed with no posts to write.", file=sys.stderr)
        sys.exit(1)

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(json.dumps(posts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Wrote {len(posts)} post(s) for @{username} to {target_path}")


if __name__ == "__main__":
    main()
