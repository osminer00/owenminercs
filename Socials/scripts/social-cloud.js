(function () {
  const cloud = document.getElementById("socialCloud");
  if (!cloud) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MODE_STORAGE_KEY = "smc-cloud-mode";
  const LIGHT_MODE_VALUE = "light";
  const FULL_MODE_VALUE = "full";
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const hardwareConcurrency = Number(navigator.hardwareConcurrency || 0);
  const deviceMemory = Number(navigator.deviceMemory || 0);
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  const saveDataEnabled = Boolean(connection?.saveData);
  const isSlowNetwork =
    saveDataEnabled ||
    effectiveType.includes("2g") ||
    effectiveType === "slow-2g" ||
    effectiveType === "3g";
  const isLowEndDevice =
    (hardwareConcurrency > 0 && hardwareConcurrency <= 4) ||
    (deviceMemory > 0 && deviceMemory <= 4);
  const autoLightMode = isSlowNetwork || isLowEndDevice || prefersReducedMotion;

  function getStoredModePreference() {
    try {
      const raw = localStorage.getItem(MODE_STORAGE_KEY);
      if (raw === LIGHT_MODE_VALUE || raw === FULL_MODE_VALUE) return raw;
    } catch (_err) {
      // Ignore storage errors and keep auto mode.
    }
    return "";
  }

  function setStoredModePreference(value) {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, value);
    } catch (_err) {
      // Ignore storage errors.
    }
  }

  let useLightMode = getStoredModePreference() === LIGHT_MODE_VALUE || (getStoredModePreference() === "" && autoLightMode);

  // Tweak notes:
  // - Increase/decrease card count with `cardCountDesktop` and `cardCountMobile`.
  // - Animation pace is controlled with `baseSpeed`.
  // - Enable/disable content kinds in `enabledNoteTypes`.
  const config = {
    cardCountDesktop: 20,
    cardCountMobile: 12,
    baseSpeed: 28,
    enabledNoteTypes: ["video", "social"],
    preferredYouTubeContentTypes: [],
    useInlineVideoByDefault: true
  };
  const LOCAL_YOUTUBE_SHORTS_PATH = "/Socials/data/youtube-shorts.json";
  const LOCAL_YOUTUBE_VIDEOS_PATH = "/Socials/data/youtube-videos.json";
  const LOCAL_X_TOP_POSTS_PATH = "/Socials/data/x-top-posts.json";
  const X_MIN_LIKES = 51;
  const REDDIT_MIN_UPVOTES = 50;
  const REDDIT_FETCH_LIMIT = 100;

  function applyModeConfig() {
    config.cardCountDesktop = useLightMode ? 8 : 16;
    config.cardCountMobile = useLightMode ? 6 : 10;
    config.baseSpeed = useLightMode ? 20 : 28;
    config.useInlineVideoByDefault = false;
  }

  applyModeConfig();

  const platformMeta = {
    instagram: { label: "Instagram", accent: "#d7b4ff", type: "social" },
    youtube: { label: "YouTube", accent: "#ff8f9d", type: "video" },
    tiktok: { label: "TikTok", accent: "#7de7ff", type: "video" },
    x: { label: "X", accent: "#9dc2ff", type: "social" },
    reddit: { label: "Reddit", accent: "#ff9966", type: "social" },
    facebook: { label: "Facebook", accent: "#8fb7ff", type: "social" },
    discord: { label: "Discord", accent: "#99b3ff", type: "social" }
  };
  const socialProfileFallbacks = {
    x: "https://x.com/OwenMinerCS",
    reddit: "https://www.reddit.com/user/OwenMCS",
    youtube: "https://www.youtube.com/@OwenMinerCS",
    instagram: "https://www.instagram.com/owenminercs/",
    facebook: "https://www.facebook.com/profile.php?id=100095719715453",
    tiktok: "https://www.tiktok.com/@owenminercs",
    discord: "https://discord.gg/fA9GbxmAge"
  };
  const socialIconPaths = {
    x: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
    reddit: "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z",
    youtube: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
    instagram: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
    facebook: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    tiktok: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
    discord: "M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 0 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
  };
  const socialProfileSelectors = {
    x: ".site-social-nav__link[href*='x.com/']",
    reddit: ".site-social-nav__link[href*='reddit.com/']",
    youtube: ".site-social-nav__link[href*='youtube.com/']",
    instagram: ".site-social-nav__link[href*='instagram.com/']",
    facebook: ".site-social-nav__link[href*='facebook.com/']",
    tiktok: ".site-social-nav__link[href*='tiktok.com/']",
    discord: ".site-social-nav__link[href*='discord']"
  };

  function normalizePlatformKey(value) {
    const normalized = String(value || "").toLowerCase().trim();
    if (normalized === "twitter") return "x";
    return normalized;
  }

  function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || "").trim());
  }

  function getSocialProfileLink(platformKey) {
    const normalizedKey = normalizePlatformKey(platformKey);
    const selector = socialProfileSelectors[normalizedKey];
    const fallback = socialProfileFallbacks[normalizedKey] || "";
    if (selector) {
      const href = String(document.querySelector(selector)?.getAttribute("href") || "").trim();
      if (isHttpUrl(href)) return href;
    }
    return fallback;
  }

  function getSocialIconMarkup(platformKey) {
    const normalizedKey = normalizePlatformKey(platformKey);
    const iconPath = socialIconPaths[normalizedKey];
    if (!iconPath) return "";
    return `<svg class="site-social-nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="${iconPath}"></path></svg>`;
  }

  function getExternalLinkIconMarkup() {
    return `<svg class="site-social-nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 3h7v7h-2V6.414l-8.293 8.293-1.414-1.414L17.586 5H14V3z"></path><path fill="currentColor" d="M19 21H3V5h8V3H3C1.897 3 1 3.897 1 5v16c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2v-8h-2v8z"></path></svg>`;
  }

  // Manual card source. Add/update entries here instead of using the API feed.
  const manualSocialContentItems = [
    {
      platform: "youtube",
      contentType: "short",
      title: "Bye Bye",
      url: "https://www.youtube.com/shorts/EmNTRsInyiA",
      thumbnail: "https://i2.ytimg.com/vi/EmNTRsInyiA/hqdefault.jpg",
      caption: "#csgo #cs2 #counterstrike #gaming #fps Subscribe for more CS2 Content :) Twitch: https://www.twitch.tv/owenminercs Twitter...",
      publishedAt: "2026-02-13"
    },
    {
      platform: "youtube",
      contentType: "video",
      title: "🔴CS2 Premier Road to 30K",
      url: "https://www.youtube.com/watch?v=ian1kvdwsEA",
      thumbnail: "https://i2.ytimg.com/vi/ian1kvdwsEA/hqdefault.jpg",
      caption: "Welcome to my Counter Strike 2 live stream. If you could drop a like and type how you are doing today in chat it would really...",
      publishedAt: "2025-12-03"
    },
    {
      platform: "youtube",
      contentType: "short",
      title: "🟥 Premier Games Road to 30K CS2",
      url: "https://www.youtube.com/watch?v=k-5x7qVcMPM",
      thumbnail: "https://i4.ytimg.com/vi/k-5x7qVcMPM/hqdefault.jpg",
      caption: "This is a Youtube shorts live stream. Full screen 16:9 stream available here and on Twitch: https://youtube.com/live/ian1kvdwsEA?...",
      publishedAt: "2025-12-03"
    },
    {
      platform: "youtube",
      contentType: "video",
      title: "🔴Live CS2 Gameplay |⭐Grinding Armory Pass| Unironically 6'7\"",
      url: "https://www.youtube.com/watch?v=oxTFIYagz_w",
      thumbnail: "https://i4.ytimg.com/vi/oxTFIYagz_w/hqdefault.jpg",
      caption: "Welcome to my Counter Strike 2 live stream. If you could drop a like and type how you are doing today in chat it would really...",
      publishedAt: "2025-12-01"
    },
    {
      platform: "youtube",
      contentType: "short",
      title: "🟥 Premier Games CS2",
      url: "https://www.youtube.com/watch?v=81VXn70I1_I",
      thumbnail: "https://i1.ytimg.com/vi/81VXn70I1_I/hqdefault.jpg",
      caption: "This is a Youtube shorts live stream. Full screen 16:9 stream available here and on Twitch: https://youtube.com/live/oxTFIYagz_w?...",
      publishedAt: "2025-12-01"
    },
    {
      platform: "youtube",
      contentType: "short",
      title: "🟥29K Premier",
      url: "https://www.youtube.com/watch?v=ii8tklMkYks",
      thumbnail: "https://i2.ytimg.com/vi/ii8tklMkYks/hqdefault.jpg",
      caption: "This is a Youtube shorts live stream. Full screen 16:9 stream available here and on Twitch: https://youtube.com/live/G0csbjC77Tk?...",
      publishedAt: "2025-11-30"
    },
    {
      platform: "youtube",
      contentType: "video",
      title: "🔴29K Premier",
      url: "https://www.youtube.com/watch?v=G0csbjC77Tk",
      thumbnail: "https://i4.ytimg.com/vi/G0csbjC77Tk/hqdefault.jpg",
      caption: "Welcome to my Counter Strike 2 live stream. If you could drop a like and type how you are doing today in chat it would really...",
      publishedAt: "2025-11-29"
    },
    {
      platform: "youtube",
      contentType: "video",
      title: "Chicken Head Taps",
      url: "https://www.youtube.com/watch?v=rc_Np4Wwp5Q",
      thumbnail: "https://i3.ytimg.com/vi/rc_Np4Wwp5Q/hqdefault.jpg",
      caption: "Thanksgiving Turkey Taps. During my post-Thanksgiving livestream, I was playing some Counter-Strike 2 in 29,000 Premier Rating...",
      publishedAt: "2025-11-29"
    },
    {
      platform: "youtube",
      contentType: "short",
      title: "🟥29K Premier Post Thanksgiving Games 🦃(Chicken Head)",
      url: "https://www.youtube.com/watch?v=0OA7_gvF31Q",
      thumbnail: "https://i1.ytimg.com/vi/0OA7_gvF31Q/hqdefault.jpg",
      caption: "This is a Youtube shorts live stream. Full screen 16:9 stream available here and on Twitch: https://youtube.com/live/5mjw-ulqB6Y?...",
      publishedAt: "2025-11-29"
    },
    {
      platform: "youtube",
      contentType: "video",
      title: "🔴29K Premier Post Thanksgiving Games (Chicken Head)",
      url: "https://www.youtube.com/watch?v=5mjw-ulqB6Y",
      thumbnail: "https://i2.ytimg.com/vi/5mjw-ulqB6Y/hqdefault.jpg",
      caption: "Welcome to my Counter Strike 2 live stream. If you could drop a like and type how you are doing today in chat it would really...",
      publishedAt: "2025-11-29"
    }
  ];

  function toSafeNumber(value) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeFeedItems(payloadItems) {
    if (!Array.isArray(payloadItems)) return [];
    return payloadItems.map((item) => ({
      platform: normalizePlatformKey(item?.platform),
      contentType: String(item?.contentType || "").toLowerCase(),
      title: item?.title || "",
      url: item?.permalink || "",
      thumbnail: item?.media?.thumbnailUrl || "",
      embedUrl: item?.media?.embedUrl || "",
      caption: item?.description || "",
      publishedAt: item?.publishedAt || "",
      viewCount: toSafeNumber(item?.metrics?.viewCount),
      likeCount: toSafeNumber(item?.metrics?.likeCount ?? item?.metrics?.upvoteCount),
      upvoteCount: toSafeNumber(item?.metrics?.upvoteCount),
      commentCount: toSafeNumber(item?.metrics?.commentCount ?? item?.metrics?.replyCount),
      mediaKind: String(item?.media?.kind || "").toLowerCase(),
      aspectRatio: String(item?.media?.aspectRatio || "").trim(),
      isLive: Boolean(item?.isLive)
    }));
  }

  function normalizeAspectRatio(width, height, fallback = "16 / 9") {
    const safeWidth = Number(width);
    const safeHeight = Number(height);
    if (!Number.isFinite(safeWidth) || !Number.isFinite(safeHeight) || safeWidth <= 0 || safeHeight <= 0) {
      return fallback;
    }
    return `${safeWidth} / ${safeHeight}`;
  }

  function parseAspectRatioValue(rawRatio) {
    const value = String(rawRatio || "").trim();
    if (!value) return 0;
    const match = value.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (!match) return 0;
    const width = Number.parseFloat(match[1]);
    const height = Number.parseFloat(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
    return width / height;
  }

  function getVideoRatioForItem(item) {
    const resolvedType = getResolvedContentType(item);
    const parsedRatio = parseAspectRatioValue(item?.aspectRatio);
    if (resolvedType === "short") {
      // Shorts should stay portrait even if feed metadata is inconsistent.
      if (parsedRatio > 0 && parsedRatio < 1) return item.aspectRatio;
      return "9 / 16";
    }
    if (parsedRatio > 0) return item.aspectRatio;
    return "16 / 9";
  }

  function decodeHtmlEntities(value) {
    return String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'");
  }

  function sanitizeRedditText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function createBlurbLink(href, label) {
    if (!isHttpUrl(href)) return null;
    const link = document.createElement("a");
    link.className = "smc-inline-link";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label || href;
    return link;
  }

  function setBlurbContent(element, value) {
    if (!(element instanceof HTMLElement)) return;
    const text = String(value || "");
    element.textContent = "";
    if (!text) return;

    const tokenPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/gi;
    let cursor = 0;
    let match;
    while ((match = tokenPattern.exec(text)) !== null) {
      if (match.index > cursor) {
        element.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      }

      if (match[2]) {
        const markdownLink = createBlurbLink(match[2], match[1] || match[2]);
        if (markdownLink) {
          element.appendChild(markdownLink);
        } else {
          element.appendChild(document.createTextNode(match[0]));
        }
      } else if (match[3]) {
        const rawUrl = match[3];
        const trimmedUrl = rawUrl.replace(/[),.!?;:]+$/g, "");
        const trailingText = rawUrl.slice(trimmedUrl.length);
        const plainLink = createBlurbLink(trimmedUrl, trimmedUrl);
        if (plainLink) {
          element.appendChild(plainLink);
          if (trailingText) element.appendChild(document.createTextNode(trailingText));
        } else {
          element.appendChild(document.createTextNode(rawUrl));
        }
      } else {
        element.appendChild(document.createTextNode(match[0]));
      }

      cursor = tokenPattern.lastIndex;
    }

    if (cursor < text.length) {
      element.appendChild(document.createTextNode(text.slice(cursor)));
    }
  }

  function parseRedditUsernameFromUrl(rawUrl) {
    const urlValue = String(rawUrl || "");
    const match = urlValue.match(/reddit\.com\/(?:user|u)\/([^/?#]+)/i);
    return match?.[1] ? match[1].trim() : "";
  }

  function getRedditProfileUrlFromPage() {
    const domCandidate = document.querySelector('a[href*="reddit.com/user/"], a[href*="reddit.com/u/"]');
    const hrefFromDom = String(domCandidate?.getAttribute("href") || "").trim();
    if (hrefFromDom) return hrefFromDom;

    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      const source = String(script?.textContent || "");
      if (!source) continue;
      const match = source.match(/https?:\/\/(?:www\.)?reddit\.com\/(?:user|u)\/[^"'\s,\]]+/i);
      if (match?.[0]) return match[0];
    }
    return "https://www.reddit.com/user/OwenMCS";
  }

  function getRedditPreviewImage(data) {
    const previewImage = data?.preview?.images?.[0];
    const sourceImage = previewImage?.source;
    if (!sourceImage?.url) return { url: "", aspectRatio: "" };
    return {
      url: decodeHtmlEntities(sourceImage.url),
      aspectRatio: normalizeAspectRatio(sourceImage.width, sourceImage.height, "4 / 3")
    };
  }

  function getRedditGalleryImage(data) {
    const galleryData = data?.gallery_data?.items;
    const mediaMeta = data?.media_metadata;
    if (!Array.isArray(galleryData) || !mediaMeta || typeof mediaMeta !== "object") return { url: "", aspectRatio: "" };
    for (const galleryItem of galleryData) {
      const mediaId = String(galleryItem?.media_id || "");
      if (!mediaId) continue;
      const meta = mediaMeta[mediaId];
      const preview = Array.isArray(meta?.p) && meta.p.length ? meta.p[meta.p.length - 1] : null;
      const source = meta?.s || preview;
      if (!source?.u) continue;
      return {
        url: decodeHtmlEntities(source.u),
        aspectRatio: normalizeAspectRatio(source.x, source.y, "4 / 3")
      };
    }
    return { url: "", aspectRatio: "" };
  }

  function getRedditVideoData(postData) {
    const candidates = [
      postData,
      ...((Array.isArray(postData?.crosspost_parent_list) ? postData.crosspost_parent_list : []).filter(Boolean))
    ];

    for (const candidate of candidates) {
      const secureVideo = candidate?.secure_media?.reddit_video;
      if (secureVideo && typeof secureVideo === "object") return secureVideo;
      const mediaVideo = candidate?.media?.reddit_video;
      if (mediaVideo && typeof mediaVideo === "object") return mediaVideo;
      const previewVideo = candidate?.preview?.reddit_video_preview;
      if (previewVideo && typeof previewVideo === "object") return previewVideo;
    }
    return {};
  }

  function getRedditHostedVideoFallbackUrl(postData) {
    const urlCandidates = [
      postData?.url_overridden_by_dest,
      postData?.url,
      ...((Array.isArray(postData?.crosspost_parent_list) ? postData.crosspost_parent_list : []).map((entry) => entry?.url_overridden_by_dest || entry?.url))
    ];
    for (const rawUrl of urlCandidates) {
      const match = String(rawUrl || "").match(/https?:\/\/v\.redd\.it\/([a-z0-9]+)/i);
      if (match?.[1]) {
        return `https://v.redd.it/${match[1]}/DASH_720.mp4?source=fallback`;
      }
    }
    return "";
  }

  function getRedditIframeFallbackUrl(permalink) {
    const path = String(permalink || "").trim();
    if (!path) return "";
    return `https://www.redditmedia.com${path}?ref_source=embed&ref=share&embed=true`;
  }

  function toRedditContentItem(postData) {
    const score = toSafeNumber(postData?.score);
    if (score < REDDIT_MIN_UPVOTES) return null;

    const permalink = String(postData?.permalink || "").trim();
    const absoluteUrl = permalink ? `https://www.reddit.com${permalink}` : String(postData?.url || "").trim();
    if (!absoluteUrl) return null;

    const secureVideo = getRedditVideoData(postData);
    const postHint = String(postData?.post_hint || "").toLowerCase();
    const hasAnyVideoUrl = Boolean(secureVideo?.fallback_url || secureVideo?.hls_url || secureVideo?.dash_url);
    const isVideo = Boolean(postData?.is_video) || hasAnyVideoUrl || postHint === "hosted:video" || postHint === "rich:video";
    const galleryImage = getRedditGalleryImage(postData);
    const previewImage = getRedditPreviewImage(postData);
    const thumbnail =
      galleryImage.url ||
      previewImage.url ||
      (String(postData?.thumbnail || "").startsWith("http") ? String(postData.thumbnail) : "");

    const description = sanitizeRedditText(postData?.selftext) || sanitizeRedditText(postData?.title);
    const createdUtc = Number(postData?.created_utc || 0);
    const publishedAt = createdUtc > 0
      ? new Date(createdUtc * 1000).toISOString()
      : new Date().toISOString();
    const videoFallbackUrl = decodeHtmlEntities(
      String(secureVideo?.fallback_url || secureVideo?.hls_url || secureVideo?.dash_url || "").trim()
    );
    const hostedFallbackUrl = getRedditHostedVideoFallbackUrl(postData);
    const iframeFallbackUrl = getRedditIframeFallbackUrl(permalink);
    const resolvedEmbedUrl = videoFallbackUrl || hostedFallbackUrl || iframeFallbackUrl;
    const isGallery = Boolean(postData?.is_gallery) || Boolean(galleryImage.url);
    const contentType = isVideo ? "video" : (isGallery ? "gallery" : (thumbnail ? "image" : "post"));
    const aspectRatio = isVideo
      ? normalizeAspectRatio(secureVideo?.width || 16, secureVideo?.height || 9, "16 / 9")
      : (galleryImage.aspectRatio || previewImage.aspectRatio || "4 / 3");

    return {
      platform: "reddit",
      contentType,
      title: sanitizeRedditText(postData?.title) || "Untitled Reddit post",
      url: absoluteUrl,
      thumbnail,
      caption: description,
      embedUrl: resolvedEmbedUrl,
      mediaKind: isVideo ? "video" : "image",
      publishedAt,
      upvoteCount: score,
      commentCount: toSafeNumber(postData?.num_comments),
      viewCount: toSafeNumber(postData?.view_count),
      likeCount: score,
      aspectRatio
    };
  }

  async function fetchRedditTopContentItems() {
    try {
      const redditProfileUrl = getRedditProfileUrlFromPage();
      const username = parseRedditUsernameFromUrl(redditProfileUrl);
      if (!username) return [];

      const endpoint = `https://www.reddit.com/user/${encodeURIComponent(username)}/submitted.json?limit=${REDDIT_FETCH_LIMIT}&sort=top&t=all&raw_json=1`;
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { "accept": "application/json" },
        cache: "no-cache"
      });
      if (!response.ok) return [];

      const payload = await response.json().catch(() => ({}));
      const children = Array.isArray(payload?.data?.children) ? payload.data.children : [];
      const mapped = children
        .map((entry) => toRedditContentItem(entry?.data || {}))
        .filter(Boolean)
        .sort((a, b) => {
          const scoreDelta = toSafeNumber(b?.upvoteCount) - toSafeNumber(a?.upvoteCount);
          if (scoreDelta !== 0) return scoreDelta;
          return Date.parse(b?.publishedAt || 0) - Date.parse(a?.publishedAt || 0);
        });
      return mapped;
    } catch (_err) {
      return [];
    }
  }

  async function fetchJsonArray(path) {
    try {
      const response = await fetch(path, {
        method: "GET",
        headers: { "accept": "application/json" },
        cache: "no-cache"
      });
      if (!response.ok) return [];
      const payload = await response.json().catch(() => ({}));
      return Array.isArray(payload) ? payload : [];
    } catch (_err) {
      return [];
    }
  }

  async function fetchLocalSocialContentItems() {
    const [localShorts, localVideos, localXTopPosts] = await Promise.all([
      fetchJsonArray(LOCAL_YOUTUBE_SHORTS_PATH),
      fetchJsonArray(LOCAL_YOUTUBE_VIDEOS_PATH),
      fetchJsonArray(LOCAL_X_TOP_POSTS_PATH)
    ]);
    const mergedLocal = normalizeFeedItems([...localShorts, ...localVideos, ...localXTopPosts].map((item) => ({
      platform: item?.platform,
      contentType: item?.contentType,
      title: item?.title,
      permalink: item?.url,
      description: item?.caption,
      publishedAt: item?.publishedAt,
      media: {
        thumbnailUrl: item?.thumbnail,
        embedUrl: item?.embedUrl,
        kind: item?.mediaKind,
        aspectRatio: item?.aspectRatio
      },
      metrics: {
        viewCount: item?.viewCount,
        likeCount: item?.likeCount,
        commentCount: item?.commentCount
      }
    })));
    return mergedLocal;
  }

  function getCuratedShortScore(item) {
    const views = Math.max(0, Number(item?.viewCount || 0));
    const likes = Math.max(0, Number(item?.likeCount || 0));
    const publishedMs = Date.parse(item?.publishedAt || "");
    const ageDays = Number.isFinite(publishedMs)
      ? Math.max(0, (Date.now() - publishedMs) / (1000 * 60 * 60 * 24))
      : 365;
    const recencyBoost = Math.max(0, 45 - ageDays) / 45;
    return (
      (Math.log10(views + 1) * 4) +
      (Math.log10(likes + 1) * 6) +
      (recencyBoost * 5)
    );
  }

  function formatDate(dateInput) {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function isShortFormVideo(item) {
    const contentType = String(item?.contentType || "").toLowerCase();
    if (contentType === "short") return true;
    const combined = [
      item?.url,
      item?.embedUrl,
      item?.title,
      item?.caption
    ].map((value) => String(value || "").toLowerCase()).join(" ");
    return (
      combined.includes("/shorts/") ||
      combined.includes("#shorts") ||
      combined.includes("youtube shorts") ||
      combined.includes("shorts ")
    );
  }

  function getResolvedContentType(item) {
    const contentType = String(item?.contentType || "").toLowerCase();
    if (contentType === "image" || contentType === "gallery" || contentType === "post") return contentType;
    if (contentType === "short") return "short";
    if (contentType === "video") return "video";
    if (isShortFormVideo(item)) return "short";
    return "video";
  }

  function isLivestreamLikeContent(item) {
    const combined = [
      item?.url,
      item?.embedUrl,
      item?.title,
      item?.caption
    ].map((value) => String(value || "").toLowerCase()).join(" ");
    return (
      combined.includes(" livestream") ||
      combined.includes("live stream") ||
      combined.includes("/live/") ||
      combined.includes("youtube.com/live/") ||
      combined.includes("youtube shorts live stream")
    );
  }

  function getCardMetrics(item) {
    const normalizedPlatform = normalizePlatformKey(item?.platform);
    const views = toSafeNumber(item?.viewCount);
    const likes = normalizedPlatform === "reddit"
      ? toSafeNumber(item?.upvoteCount || item?.likeCount)
      : toSafeNumber(item?.likeCount || item?.upvoteCount);
    const comments = toSafeNumber(item?.commentCount);
    const label = normalizedPlatform === "reddit"
      ? `${likes.toLocaleString()} upvotes • ${comments.toLocaleString()} comments`
      : `${views.toLocaleString()} views • ${likes.toLocaleString()} likes • ${comments.toLocaleString()} comments`;
    return {
      viewCount: views,
      likeCount: likes,
      commentCount: comments,
      label
    };
  }

  function toContentCard(item) {
    const meta = platformMeta[item.platform] || {};
    const contentTypeLabel = getResolvedContentType(item);
    const isShort = contentTypeLabel === "short";
    const isVideoLike = contentTypeLabel === "video" || contentTypeLabel === "short";
    const videoAspectRatio = getVideoRatioForItem(item);
    const videoAspectValue = parseAspectRatioValue(videoAspectRatio) || (isShort ? (9 / 16) : (16 / 9));
    const publishedLabel = formatDate(item.publishedAt);
    const metrics = getCardMetrics(item);
    return {
      platform: meta.label || item.platform || "Content",
      platformKey: String(item?.platform || "").toLowerCase(),
      type: isVideoLike ? "video" : (meta.type || "social"),
      contentType: contentTypeLabel,
      videoAspectRatio: videoAspectValue,
      videoAspectRatioCss: videoAspectRatio,
      title: item.title || "Untitled content",
      blurb: item.caption || "",
      scoreLabel: metrics.label,
      url: item.url || "#",
      accent: meta.accent || "#69e3ff",
      thumbnail: item.thumbnail || "",
      embedUrl: item.embedUrl || "",
      mediaKind: String(item?.mediaKind || "").toLowerCase(),
      aspectRatio: String(item?.aspectRatio || "").trim(),
      publishedLabel
    };
  }

  function getCardCatalog(contentItems) {
    const sourceItems = contentItems || [];
    const youtubeItems = sourceItems.filter((item) => {
      const platform = String(item?.platform || "").toLowerCase();
      if (platform !== "youtube") return false;
      if (Boolean(item?.isLive)) return false;
      return !isLivestreamLikeContent(item);
    });
    const dedupedByVideoId = [];
    const seenVideoIds = new Set();
    for (const item of youtubeItems) {
      const videoId = getYouTubeVideoId(item?.url || item?.embedUrl || "");
      const dedupeKey = videoId || String(item?.url || item?.title || "");
      if (!dedupeKey || seenVideoIds.has(dedupeKey)) continue;
      seenVideoIds.add(dedupeKey);
      dedupedByVideoId.push(item);
    }
    dedupedByVideoId.sort((a, b) => {
      const scoreDelta = getCuratedShortScore(b) - getCuratedShortScore(a);
      if (Math.abs(scoreDelta) > 0.0001) return scoreDelta;
      return Date.parse(b?.publishedAt || 0) - Date.parse(a?.publishedAt || 0);
    });
    const youtubeCards = dedupedByVideoId.map(toContentCard);

    function toPlatformCards(platformKey, options = {}) {
      const seen = new Set();
      const minUpvotes = toSafeNumber(options?.minUpvotes);
      const minLikes = toSafeNumber(options?.minLikes);
      const sortByUpvotes = Boolean(options?.sortByUpvotes);
      return sourceItems
        .filter((item) => String(item?.platform || "").toLowerCase() === platformKey)
        .filter((item) => {
          if (minUpvotes > 0 && toSafeNumber(item?.upvoteCount) < minUpvotes) return false;
          if (minLikes > 0 && toSafeNumber(item?.likeCount) < minLikes) return false;
          const dedupeKey = String(item?.url || item?.title || "");
          if (!dedupeKey || seen.has(dedupeKey)) return false;
          seen.add(dedupeKey);
          return true;
        })
        .sort((a, b) => {
          if (sortByUpvotes) {
            const upvoteDelta = toSafeNumber(b?.upvoteCount) - toSafeNumber(a?.upvoteCount);
            if (upvoteDelta !== 0) return upvoteDelta;
          }
          const likeDelta = toSafeNumber(b?.likeCount) - toSafeNumber(a?.likeCount);
          if (likeDelta !== 0) return likeDelta;
          const viewDelta = toSafeNumber(b?.viewCount) - toSafeNumber(a?.viewCount);
          if (viewDelta !== 0) return viewDelta;
          const commentDelta = toSafeNumber(b?.commentCount) - toSafeNumber(a?.commentCount);
          if (commentDelta !== 0) return commentDelta;
          return Date.parse(b?.publishedAt || 0) - Date.parse(a?.publishedAt || 0);
        })
        .map(toContentCard);
    }

    const xCards = toPlatformCards("x", { minLikes: X_MIN_LIKES });

    const redditCards = toPlatformCards("reddit", {
      minUpvotes: REDDIT_MIN_UPVOTES,
      sortByUpvotes: true
    });

    const instagramCards = toPlatformCards("instagram");
    const tiktokCards = toPlatformCards("tiktok");
    const facebookCards = toPlatformCards("facebook");

    return [...xCards, ...redditCards, ...instagramCards, ...tiktokCards, ...facebookCards, ...youtubeCards];
  }

  function getYouTubeVideoId(rawUrl) {
    if (!rawUrl) return "";
    try {
      const parsed = new URL(rawUrl);
      let videoId = "";
      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.replace("/", "").trim();
      } else if (parsed.searchParams.get("v")) {
        videoId = parsed.searchParams.get("v").trim();
      } else if (parsed.pathname.includes("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1].split("/")[0].trim();
      } else if (parsed.pathname.includes("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1].split("/")[0].trim();
      }
      if (videoId) return videoId;
    } catch (_err) {
      // Fall through to relaxed parsing below.
    }
    const idMatch = String(rawUrl).match(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{8,})/i);
    if (idMatch && idMatch[1]) return idMatch[1].trim();
    return "";
  }

  function getYouTubeEmbedUrl(rawUrl, options = {}) {
    const videoId = getYouTubeVideoId(rawUrl);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1`;
    }
    const handleMatch = rawUrl.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
    if (handleMatch && handleMatch[1]) {
      return `https://www.youtube.com/embed?listType=user_uploads&list=${encodeURIComponent(handleMatch[1])}&rel=0`;
    }
    return "";
  }

  function getTikTokEmbedUrl(rawUrl) {
    if (!rawUrl) return "";
    const idMatch = rawUrl.match(/\/video\/(\d+)/);
    if (idMatch && idMatch[1]) {
      return `https://www.tiktok.com/player/v1/${idMatch[1]}`;
    }
    const profileMatch = rawUrl.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i);
    if (profileMatch && profileMatch[1]) {
      return `https://www.tiktok.com/embed/@${profileMatch[1]}`;
    }
    return "";
  }

  function getEmbedConfig(item) {
    const platform = (item.platform || "").toLowerCase();
    if (platform === "youtube") {
      const contentType = getResolvedContentType(item);
      const src = item.embedUrl || getYouTubeEmbedUrl(item.url, { contentType });
      if (!src) return null;
      return { kind: "iframe", src, className: "youtube" };
    }
    if (platform === "tiktok") {
      const src = item.embedUrl || getTikTokEmbedUrl(item.url);
      if (!src) return null;
      return { kind: "iframe", src, className: "tiktok" };
    }
    if (platform === "reddit") {
      const src = String(item.embedUrl || "").trim();
      if (!src) return null;
      const isDirectVideo = /\.(mp4|webm)(?:\?|$)/i.test(src) || src.includes(".m3u8");
      return { kind: isDirectVideo ? "video" : "iframe", src, className: "reddit" };
    }
    if (platform === "x") {
      const src = String(item.embedUrl || "").trim();
      const mediaKind = String(item.mediaKind || "").toLowerCase();
      if (!src || mediaKind !== "video") return null;
      return { kind: "video", src, className: "x" };
    }
    return null;
  }

  function getAutoplayEmbedUrl(rawSrc) {
    if (!rawSrc) return "";
    try {
      const parsed = new URL(rawSrc, window.location.origin);
      parsed.searchParams.set("autoplay", "1");
      parsed.searchParams.set("playsinline", "1");
      parsed.searchParams.set("loop", "1");
      const host = parsed.hostname.toLowerCase();
      if (host.includes("youtube.com") || host.includes("youtu.be")) {
        // Muted autoplay satisfies browser policies so the Short actually starts in the card.
        parsed.searchParams.set("mute", "1");
        const videoId = getYouTubeVideoId(parsed.toString());
        if (videoId) {
          parsed.searchParams.set("playlist", videoId);
        }
      }
      return parsed.toString();
    } catch (_err) {
      const hasQuery = rawSrc.includes("?");
      const autoplayParam = "autoplay=1&playsinline=1&loop=1";
      return `${rawSrc}${hasQuery ? "&" : "?"}${autoplayParam}`;
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getEnabledCatalog(contentItems) {
    const cardCatalog = getCardCatalog(contentItems || []);
    const enabledTypes = new Set(config.enabledNoteTypes.map((value) => String(value || "").toLowerCase()));
    const preferredYoutubeTypes = new Set(config.preferredYouTubeContentTypes.map((value) => String(value || "").toLowerCase()));
    const enabled = cardCatalog.filter((item) => {
      if (!enabledTypes.has(String(item?.type || "").toLowerCase())) return false;
      if (String(item?.platform || "").toLowerCase() !== "youtube") return true;
      if (!preferredYoutubeTypes.size) return true;
      return preferredYoutubeTypes.has(String(item?.contentType || "").toLowerCase());
    });
    return enabled.length ? enabled : cardCatalog;
  }

  function createPlayerElement(embed, item, autoplay = false) {
    if (!embed?.src) return null;
    const playerWrap = document.createElement("span");
    playerWrap.className = `smc-player ${embed.className || ""}`.trim();
    if (embed.kind === "video") {
      const video = document.createElement("video");
      video.src = embed.src;
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      if (autoplay) {
        video.autoplay = true;
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute("muted", "");
        const startPlayback = () => {
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {
              // Ignore autoplay rejection; user can press play.
            });
          }
        };
        video.addEventListener("loadeddata", startPlayback, { once: true });
        window.setTimeout(startPlayback, 0);
      }
      video.title = `${item?.platform || "Social"} video: ${item?.title || "Untitled content"}`;
      playerWrap.appendChild(video);
      return playerWrap;
    }

    const iframe = document.createElement("iframe");
    iframe.src = autoplay ? getAutoplayEmbedUrl(embed.src) : embed.src;
    iframe.loading = "lazy";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.title = `${item?.platform || "Social"} player: ${item?.title || "Untitled content"}`;
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share";
    playerWrap.appendChild(iframe);
    return playerWrap;
  }

  let enabledCatalog = [];
  let catalogCursor = 0;
  let activeContentItems = manualSocialContentItems;
  let cardCount = window.innerWidth < 780 ? config.cardCountMobile : config.cardCountDesktop;
  const states = [];
  const elementStateMap = new WeakMap();
  let rafId = 0;
  let lastFrame = performance.now();
  let cloudWidth = 0;
  let cloudHeight = 0;
  let topCardLayer = 12;
  let ambientLayer = null;
  let pinnedLayer = null;
  let ambientIntervalId = 0;
  let ambientTickRaf = 0;
  let currentAmbientColors = [
    [34, 78, 58],
    [118, 76, 44],
    [28, 42, 74]
  ];
  let currentAmbientGreen = [20, 72, 42];
  const DARK_GREEN_TARGET = [20, 72, 42];

  function mountAmbientLayer() {
    if (ambientLayer && ambientLayer.isConnected) return;
    ambientLayer = document.createElement("div");
    ambientLayer.className = "smc-ambient-layer";
    const parent = cloud.parentElement || document.body;
    parent.insertBefore(ambientLayer, cloud);
  }

  function mountPinnedLayer() {
    if (pinnedLayer && pinnedLayer.isConnected) return;
    pinnedLayer = document.createElement("div");
    pinnedLayer.className = "smc-pinned-layer";
    document.body.appendChild(pinnedLayer);
  }

  function parseCssColor(value) {
    const input = String(value || "").trim();
    if (!input) return null;
    const rgbMatch = input.match(/rgba?\(([^)]+)\)/i);
    if (rgbMatch && rgbMatch[1]) {
      const parts = rgbMatch[1].split(",").map((part) => Number.parseFloat(part.trim()));
      if (parts.length >= 3) {
        const alpha = Number.isFinite(parts[3]) ? parts[3] : 1;
        return [
          clamp(parts[0], 0, 255),
          clamp(parts[1], 0, 255),
          clamp(parts[2], 0, 255),
          clamp(alpha, 0, 1)
        ];
      }
    }
    const hexMatch = input.match(/^#([0-9a-f]{3,8})$/i);
    if (!hexMatch) return null;
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return [
        Number.parseInt(`${hex[0]}${hex[0]}`, 16),
        Number.parseInt(`${hex[1]}${hex[1]}`, 16),
        Number.parseInt(`${hex[2]}${hex[2]}`, 16),
        1
      ];
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
        hex.length === 8 ? clamp(Number.parseInt(hex.slice(6, 8), 16) / 255, 0, 1) : 1
      ];
    }
    return null;
  }

  function colorDistance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  function getColorSaturation(color) {
    if (!Array.isArray(color) || color.length < 3) return 0;
    const r = color[0] / 255;
    const g = color[1] / 255;
    const b = color[2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max <= 0) return 0;
    return (max - min) / max;
  }

  function toCssRgbTriplet(color) {
    return `${Math.round(clamp(color[0], 0, 255))} ${Math.round(clamp(color[1], 0, 255))} ${Math.round(clamp(color[2], 0, 255))}`;
  }

  function isIgnoredSampleNode(node) {
    if (!(node instanceof Element)) return true;
    return Boolean(
      node.closest(".smc-ambient-layer") ||
      node === cloud
    );
  }

  function getWeightedColorsFromElement(element) {
    const weighted = [];
    if (!(element instanceof Element)) return weighted;
    const maxDepth = 4;
    let cursor = element;
    let depth = 0;
    while (cursor && depth < maxDepth) {
      const style = window.getComputedStyle(cursor);
      const background = parseCssColor(style.backgroundColor);
      if (background && background[3] > 0.02) {
        const backgroundSat = getColorSaturation(background);
        weighted.push({
          color: [background[0], background[1], background[2]],
          weight: (1.1 - (depth * 0.16)) * background[3] * (0.4 + (backgroundSat * 1.1))
        });
      }
      const border = parseCssColor(style.borderColor);
      if (border && border[3] > 0.06) {
        const borderSat = getColorSaturation(border);
        weighted.push({
          color: [border[0], border[1], border[2]],
          weight: (0.52 - (depth * 0.08)) * border[3] * (0.36 + (borderSat * 1.2))
        });
      }
      const text = parseCssColor(style.color);
      if (text && text[3] > 0.15) {
        const textSat = getColorSaturation(text);
        weighted.push({
          color: [text[0], text[1], text[2]],
          weight: (0.16 - (depth * 0.02)) * text[3] * (0.2 + (textSat * 0.8))
        });
      }
      const accent = parseCssColor(style.getPropertyValue("--smc-accent"));
      if (accent) {
        weighted.push({
          color: [accent[0], accent[1], accent[2]],
          weight: 0.95 - (depth * 0.14)
        });
      }
      cursor = cursor.parentElement;
      depth += 1;
    }
    return weighted.filter((entry) => entry.weight > 0.04);
  }

  function sampleVisibleCardAccents() {
    const weighted = [];
    for (let i = 0; i < states.length; i += 1) {
      const state = states[i];
      if (!state?.el || !state?.item) continue;
      const rect = state.el.getBoundingClientRect();
      const intersectsViewport =
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight;
      if (!intersectsViewport) continue;
      const accent = parseCssColor(String(state.item.accent || ""));
      if (!accent) continue;
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const areaWeight = clamp((visibleWidth * visibleHeight) / 36000, 0.18, 2.2);
      weighted.push({
        color: [accent[0], accent[1], accent[2]],
        weight: 0.9 * areaWeight
      });
    }
    return weighted;
  }

  function sampleViewportColors() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const rows = 4;
    const cols = 7;
    const marginX = width * 0.08;
    const marginY = height * 0.08;
    const colors = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = Math.round(marginX + ((width - (marginX * 2)) * ((col + 0.5) / cols)));
        const y = Math.round(marginY + ((height - (marginY * 2)) * ((row + 0.5) / rows)));
        const stack = document.elementsFromPoint(x, y);
        const target = stack.find((candidate) => !isIgnoredSampleNode(candidate));
        if (!target) continue;
        const weighted = getWeightedColorsFromElement(target);
        if (weighted.length) colors.push(...weighted);
      }
    }
    const cardAccentColors = sampleVisibleCardAccents();
    if (cardAccentColors.length) colors.push(...cardAccentColors);
    return colors;
  }

  function selectAmbientPalette(weightedColors) {
    if (!Array.isArray(weightedColors) || !weightedColors.length) {
      return currentAmbientColors;
    }

    const ranked = [...weightedColors]
      .filter((entry) => Array.isArray(entry.color) && Number.isFinite(entry.weight))
      .sort((a, b) => b.weight - a.weight);
    if (!ranked.length) return currentAmbientColors;

    const totalWeight = ranked.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0) || 1;
    const blended = ranked.reduce((acc, entry) => {
      const w = Math.max(0, entry.weight) / totalWeight;
      acc[0] += entry.color[0] * w;
      acc[1] += entry.color[1] * w;
      acc[2] += entry.color[2] * w;
      return acc;
    }, [0, 0, 0]);

    const first = ranked[0].color;
    const second = ranked.find((entry) => colorDistance(entry.color, first) > 46)?.color
      || [blended[0] * 0.95, blended[1] * 1.02, blended[2] * 1.05];
    const third = ranked.find((entry) =>
      colorDistance(entry.color, first) > 40 && colorDistance(entry.color, second) > 34
    )?.color || [blended[0] * 0.82, blended[1] * 0.9, blended[2] * 1.08];

    const greenBias = useLightMode ? 0.24 : 0.32;
    const boosted = [first, second, third].map((color, index) => {
      const strength = index === 2 ? (greenBias + 0.2) : greenBias;
      return [
        (color[0] * (1 - strength)) + (DARK_GREEN_TARGET[0] * strength),
        (color[1] * (1 - strength)) + (DARK_GREEN_TARGET[1] * strength),
        (color[2] * (1 - strength)) + (DARK_GREEN_TARGET[2] * strength)
      ];
    });

    return boosted.map((color) => [
      clamp(color[0], 10, 236),
      clamp(color[1], 20, 236),
      clamp(color[2], 10, 236)
    ]);
  }

  function applyAmbientPalette(palette) {
    if (!(document.body instanceof HTMLElement)) return;
    const ease = useLightMode ? 0.3 : 0.4;
    currentAmbientColors = currentAmbientColors.map((prev, index) => {
      const next = palette[index] || prev;
      return [
        prev[0] + ((next[0] - prev[0]) * ease),
        prev[1] + ((next[1] - prev[1]) * ease),
        prev[2] + ((next[2] - prev[2]) * ease)
      ];
    });
    const blendedPalette = currentAmbientColors.reduce((acc, color) => {
      acc[0] += color[0];
      acc[1] += color[1];
      acc[2] += color[2];
      return acc;
    }, [0, 0, 0]).map((channel) => channel / Math.max(1, currentAmbientColors.length));
    const greenEase = useLightMode ? 0.22 : 0.3;
    const targetGreen = [
      (blendedPalette[0] * 0.3) + (DARK_GREEN_TARGET[0] * 0.7),
      (blendedPalette[1] * 0.36) + (DARK_GREEN_TARGET[1] * 0.64),
      (blendedPalette[2] * 0.24) + (DARK_GREEN_TARGET[2] * 0.76)
    ];
    currentAmbientGreen = [
      currentAmbientGreen[0] + ((targetGreen[0] - currentAmbientGreen[0]) * greenEase),
      currentAmbientGreen[1] + ((targetGreen[1] - currentAmbientGreen[1]) * greenEase),
      currentAmbientGreen[2] + ((targetGreen[2] - currentAmbientGreen[2]) * greenEase)
    ];

    const strength = useLightMode ? 0.34 : 0.5;
    document.body.style.setProperty("--smc-ambient-1", toCssRgbTriplet(currentAmbientColors[0]));
    document.body.style.setProperty("--smc-ambient-2", toCssRgbTriplet(currentAmbientColors[1]));
    document.body.style.setProperty("--smc-ambient-3", toCssRgbTriplet(currentAmbientColors[2]));
    document.body.style.setProperty("--smc-ambient-green", toCssRgbTriplet(currentAmbientGreen));
    document.body.style.setProperty("--smc-ambient-strength", String(strength));
  }

  function updateAmbientPalette() {
    const sampledColors = sampleViewportColors();
    const palette = selectAmbientPalette(sampledColors);
    applyAmbientPalette(palette);
  }

  function stopAmbientUpdates() {
    if (ambientIntervalId) {
      window.clearInterval(ambientIntervalId);
      ambientIntervalId = 0;
    }
    if (ambientTickRaf) {
      window.cancelAnimationFrame(ambientTickRaf);
      ambientTickRaf = 0;
    }
  }

  function startAmbientUpdates() {
    stopAmbientUpdates();
    const intervalMs = useLightMode ? 1200 : 780;
    const tickAmbient = () => {
      ambientTickRaf = 0;
      if (document.visibilityState !== "visible") return;
      updateAmbientPalette();
    };
    updateAmbientPalette();
    ambientIntervalId = window.setInterval(() => {
      if (ambientTickRaf) return;
      ambientTickRaf = window.requestAnimationFrame(tickAmbient);
    }, intervalMs);
  }

  function getLaneCount() {
    return window.innerWidth < 780 ? 3 : 4;
  }

  function updateCardCountForViewport() {
    const targetCount = window.innerWidth < 780 ? config.cardCountMobile : config.cardCountDesktop;
    cardCount = Math.min(enabledCatalog.length || targetCount, targetCount);
  }

  function getCardWidth() {
    return window.innerWidth < 780 ? 176 + Math.random() * 28 : 198 + Math.random() * 34;
  }

  function getLaneY(index, laneCount) {
    const lane = index % laneCount;
    const laneHeight = cloudHeight / laneCount;
    return clamp((lane * laneHeight) + Math.random() * (laneHeight - 120), 10, Math.max(10, cloudHeight - 140));
  }

  function getInitialX(index, width) {
    const maxX = Math.max(0, cloudWidth - width - 8);
    const spread = (index + 0.3) / Math.max(1, cardCount);
    return clamp(spread * maxX, 0, maxX);
  }

  function getWaveRespawnX(width, excludedState = null) {
    const laneGap = window.innerWidth < 780 ? 12 : 18;
    const offscreenStartX = -width - laneGap;
    let leftMost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < states.length; i += 1) {
      const state = states[i];
      if (state === excludedState || state.isPinned) continue;
      leftMost = Math.min(leftMost, state.x);
    }
    if (Number.isFinite(leftMost)) {
      // Prevent a new wave from spawning deep inside the viewport, which leaves
      // a visible empty gap on the left side between waves.
      return Math.min(leftMost - width - laneGap, offscreenStartX);
    }
    return offscreenStartX;
  }

  function getRespawnX(width, excludedState = null) {
    return getWaveRespawnX(width, excludedState);
  }

  function isInteractiveCardTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest(".smc-close-btn, .smc-rotate-btn, .smc-visit-link, .smc-resize-handle, .smc-fullscreen-btn, iframe, .smc-inline-link")) {
      return true;
    }
    const tag = target.tagName.toUpperCase();
    return tag === "A" || tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function updatePageHeightBudget() {
    const header = document.querySelector("shared-header");
    const footer = document.querySelector("shared-footer");
    const headerHeight = header ? Math.round(header.getBoundingClientRect().height) : 0;
    const footerHeight = footer ? Math.round(footer.getBoundingClientRect().height) : 0;
    document.body.style.setProperty("--smc-header-h", `${headerHeight}px`);
    document.body.style.setProperty("--smc-footer-h", `${footerHeight}px`);
  }

  function syncCloudBounds() {
    updatePageHeightBudget();
    cloudWidth = cloud.clientWidth;
    cloudHeight = cloud.clientHeight;
    updateCardCountForViewport();
  }

  function spawnState(element, index, isInitialPlacement = false) {
    const laneCount = getLaneCount();
    const width = getCardWidth();
    const y = getLaneY(index, laneCount);
    const speedScale = 0.82 + Math.random() * 0.45;
    return {
      el: element,
      x: isInitialPlacement ? getInitialX(index, width) : getRespawnX(width),
      y,
      width,
      speed: config.baseSpeed * speedScale,
      driftAmp: 4 + Math.random() * 9,
      driftRate: 0.35 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      rotate: -5 + Math.random() * 10
    };
  }

  function renderCards() {
    if (!enabledCatalog.length) return;
    const renderCount = Math.min(cardCount, enabledCatalog.length);
    const getNextCatalogItem = () => {
      if (!enabledCatalog.length) return null;
      const item = enabledCatalog[catalogCursor % enabledCatalog.length];
      catalogCursor += 1;
      return item;
    };
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < renderCount; i += 1) {
      const item = getNextCatalogItem();
      if (!item) continue;
      const card = document.createElement("article");
      card.className = "smc-card";
      card.setAttribute("role", "listitem");
      card.tabIndex = 0;
      const cardEmbed = getEmbedConfig(item);

      const metaRow = document.createElement("div");
      metaRow.className = "smc-meta-row";
      card.appendChild(metaRow);
      const metaLeftActions = document.createElement("span");
      metaLeftActions.className = "smc-meta-actions smc-meta-actions-left";
      const metaDate = document.createElement("span");
      metaDate.className = "smc-date";
      metaDate.hidden = true;
      const metaActions = document.createElement("span");
      metaActions.className = "smc-meta-actions";
      const copyWrap = document.createElement("div");
      copyWrap.className = "smc-copy";
      const detailsWrap = document.createElement("div");
      detailsWrap.className = "smc-details";
      const titleHeading = document.createElement("h3");
      titleHeading.className = "smc-title";
      const blurbText = document.createElement("p");
      blurbText.className = "smc-blurb";
      const statsRow = document.createElement("p");
      statsRow.className = "smc-stats";
      const visitProfileLink = document.createElement("a");
      visitProfileLink.className = "site-social-nav__link smc-visit-link";
      visitProfileLink.target = "_blank";
      visitProfileLink.rel = "noopener noreferrer";
      visitProfileLink.setAttribute("aria-label", "Open social profile");
      visitProfileLink.title = "Open social profile";
      const openPostLink = document.createElement("a");
      openPostLink.className = "site-social-nav__link smc-visit-link smc-open-post-link";
      openPostLink.target = "_blank";
      openPostLink.rel = "noopener noreferrer";
      openPostLink.setAttribute("aria-label", "Open post in new tab");
      openPostLink.title = "Open post in new tab";
      openPostLink.innerHTML = getExternalLinkIconMarkup();
      copyWrap.appendChild(titleHeading);
      card.appendChild(copyWrap);
      detailsWrap.appendChild(statsRow);
      detailsWrap.appendChild(blurbText);
      card.appendChild(detailsWrap);

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "smc-close-btn";
      closeButton.textContent = "📌";
      closeButton.setAttribute("aria-label", "Resume card movement");
      closeButton.title = "Pinned. Click to resume movement";
      closeButton.hidden = true;
      card.appendChild(closeButton);

      const rotateButton = document.createElement("button");
      rotateButton.type = "button";
      rotateButton.className = "smc-rotate-btn";
      rotateButton.textContent = "↻";
      rotateButton.setAttribute("aria-label", "Click to Center or Drag to Rotate");
      rotateButton.title = "Click to Center or Drag to Rotate";
      metaLeftActions.appendChild(rotateButton);
      metaLeftActions.appendChild(closeButton);
      metaRow.appendChild(metaLeftActions);
      metaRow.appendChild(metaDate);
      metaRow.appendChild(metaActions);

      const fullscreenButton = document.createElement("button");
      fullscreenButton.type = "button";
      fullscreenButton.className = "smc-fullscreen-btn";
      fullscreenButton.setAttribute("aria-label", "Expand card to full screen");
      fullscreenButton.title = "Full screen";
      fullscreenButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 13h2v4h4v2H3v-6zm16 4h-4v2h6v-6h-2v4z"/></svg>`;
      fullscreenButton.addEventListener("click", function (e) {
        e.stopPropagation();
        const isFs = card.classList.contains("is-fullscreen");
        if (isFs) {
          card.classList.remove("is-fullscreen");
          if (card._fsLeft !== undefined) card.style.left = card._fsLeft;
          if (card._fsTop !== undefined) card.style.top = card._fsTop;
          if (card._fsWidth !== undefined) card.style.width = card._fsWidth;
          if (card._fsTransform !== undefined) card.style.transform = card._fsTransform;
          fullscreenButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 13h2v4h4v2H3v-6zm16 4h-4v2h6v-6h-2v4z"/></svg>`;
          fullscreenButton.setAttribute("aria-label", "Expand card to full screen");
          fullscreenButton.title = "Full screen";
        } else {
          card._fsLeft = card.style.left;
          card._fsTop = card.style.top;
          card._fsWidth = card.style.width;
          card._fsTransform = card.style.transform;
          card.classList.add("is-fullscreen");
          fullscreenButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 9h4V5H7v2H5V9zm10-4v4h4V7h-2V5h-2zm-8 8H5v2h2v2h2v-4zm6 4h2v-2h2v-2h-4v4z"/></svg>`;
          fullscreenButton.setAttribute("aria-label", "Exit full screen");
          fullscreenButton.title = "Exit full screen";
        }
      });

      const openLink = document.createElement("span");
      openLink.className = "smc-open-hint";
      openLink.textContent = "Click card to load video and pause movement";
      card.appendChild(openLink);

      fragment.appendChild(card);
      const state = spawnState(card, i, true);
      state.item = item;
      state.isPinned = false;
      state.playerWrap = null;
      state.inlinePlayerWrap = null;
      state.embed = cardEmbed;
      const setItemOnCard = (nextItem) => {
        if (!nextItem) return;
        state.item = nextItem;
        card.classList.remove("is-short");
        card.classList.remove("smc-video-card");
        card.classList.remove("smc-reddit-card");
        card.classList.remove("smc-x-card");
        card.classList.remove("smc-image-card");
        card.classList.remove("has-active-player");
        card.setAttribute("data-type", nextItem.type);
        card.setAttribute("data-platform", normalizePlatformKey(nextItem.platformKey || nextItem.platform));
        card.setAttribute("aria-label", `${nextItem.platform}: ${nextItem.title}${nextItem.contentType ? ` (${nextItem.contentType})` : ""}. Click to pause this card. Use X to resume movement.`);
        card.style.setProperty("--smc-accent", nextItem.accent);
        if (nextItem.platformKey === "x") {
          card.classList.add("smc-x-card");
        }
        if (nextItem.platformKey === "reddit") {
          card.classList.add("smc-reddit-card");
        }
        if (nextItem.type === "video") {
          card.classList.add("smc-video-card");
          const ratioValue = nextItem.videoAspectRatioCss || (nextItem.contentType === "short" ? "9 / 16" : "16 / 9");
          card.style.setProperty("--smc-card-ratio", ratioValue);
        } else {
          card.style.removeProperty("--smc-card-ratio");
        }
        if (getResolvedContentType(nextItem) === "short") {
          card.classList.add("is-short");
        }

        metaRow.textContent = "";
        metaRow.appendChild(metaLeftActions);
        metaRow.appendChild(metaDate);
        metaRow.appendChild(metaActions);
        metaActions.textContent = "";
        const platformKey = normalizePlatformKey(nextItem.platformKey || nextItem.platform);
        const profileUrl = getSocialProfileLink(platformKey);
        const iconMarkup = getSocialIconMarkup(platformKey);
        const profileLabel = nextItem.platform || "social";
        visitProfileLink.href = profileUrl;
        visitProfileLink.innerHTML = iconMarkup;
        visitProfileLink.hidden = !isHttpUrl(profileUrl) || !iconMarkup;
        visitProfileLink.setAttribute("aria-label", `Open ${profileLabel} profile`);
        visitProfileLink.title = `${profileLabel} profile`;
        if (!visitProfileLink.hidden) {
          metaActions.appendChild(visitProfileLink);
        }
        const postUrl = String(nextItem.url || "").trim();
        openPostLink.href = postUrl;
        openPostLink.hidden = !isHttpUrl(postUrl);
        openPostLink.setAttribute("aria-label", `Open ${profileLabel} post in new tab`);
        openPostLink.title = `${profileLabel} post`;
        if (!openPostLink.hidden) {
          metaActions.appendChild(openPostLink);
        }
        metaActions.appendChild(fullscreenButton);
        if (nextItem.publishedLabel) {
          metaDate.textContent = nextItem.publishedLabel;
          metaDate.hidden = false;
        } else {
          metaDate.textContent = "";
          metaDate.hidden = true;
        }
        const titleValue = String(nextItem.title || "").trim();
        const blurbValue = String(nextItem.blurb || "").trim();
        titleHeading.textContent = titleValue || "Untitled content";
        titleHeading.hidden = !Boolean(titleValue);
        setBlurbContent(blurbText, blurbValue);
        blurbText.hidden = !Boolean(blurbValue);
        const scoreSummary = nextItem.scoreLabel || "";
        statsRow.textContent = scoreSummary;
        statsRow.hidden = !Boolean(scoreSummary);

        const oldMediaNodes = card.querySelectorAll(".smc-media");
        oldMediaNodes.forEach((node) => node.remove());
        if (state.inlinePlayerWrap) {
          state.inlinePlayerWrap.remove();
          state.inlinePlayerWrap = null;
        }
        if (state.playerWrap) {
          state.playerWrap.remove();
          state.playerWrap = null;
        }

        const nextEmbed = getEmbedConfig(nextItem);
        state.embed = nextEmbed;
        const shouldRenderInlinePlayer = Boolean(
          nextEmbed &&
          nextItem.type === "video" &&
          config.useInlineVideoByDefault
        );
        if (shouldRenderInlinePlayer) {
          const inlinePlayer = createPlayerElement(nextEmbed, nextItem, false);
          if (inlinePlayer) {
            card.insertBefore(inlinePlayer, detailsWrap);
            state.inlinePlayerWrap = inlinePlayer;
          }
        } else {
          const thumbSrc = nextItem.thumbnail || nextItem.imageSrc;
          if (thumbSrc) {
            const isImagePost = String(nextItem.mediaKind || "").toLowerCase() === "image" ||
              ["photo", "image", "gallery"].includes(String(nextItem.contentType || "").toLowerCase());
            if (isImagePost) {
              card.classList.add("smc-image-card");
            }
            const mediaWrap = document.createElement("span");
            mediaWrap.className = `smc-media ${nextItem.imageClass === "qr" ? "qr" : ""}`.trim();
            mediaWrap.draggable = false;
            mediaWrap.addEventListener("dragstart", (dragEvent) => {
              dragEvent.preventDefault();
            });
            const img = document.createElement("img");
            img.className = `smc-thumb ${nextItem.imageClass || ""}`.trim();
            img.src = thumbSrc;
            img.alt = nextItem.imageAlt || `${nextItem.platform} preview for ${nextItem.title}`;
            img.loading = "lazy";
            img.decoding = "async";
            if (nextItem.aspectRatio) {
              img.style.aspectRatio = nextItem.aspectRatio;
            }
            img.draggable = false;
            img.addEventListener("dragstart", (dragEvent) => {
              dragEvent.preventDefault();
            });
            img.addEventListener("error", () => {
              mediaWrap.remove();
            }, { once: true });
            mediaWrap.appendChild(img);
            card.insertBefore(mediaWrap, detailsWrap);
          }
        }

        const hasPlayableEmbed = Boolean(nextEmbed);
        openLink.textContent = hasPlayableEmbed
          ? (shouldRenderInlinePlayer ? "Click card to pause movement" : "Click card to load video and pause movement")
          : "Click card to pause movement";
      };
      state.setItem = setItemOnCard;
      state.setItem(item);
      elementStateMap.set(card, state);
      let dragPointerId = null;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      let dragStartX = 0;
      let dragStartY = 0;
      let isDragging = false;
      let pointerStartedOnCardBody = false;
      let deferPointerCapture = false;
      let resizePointerId = null;
      let resizeCorner = "";
      let resizeStartClientX = 0;
      let resizeStartClientY = 0;
      let resizeStartWidth = 0;
      let resizeStartHeight = 0;
      let resizeStartX = 0;
      let resizeStartY = 0;
      let resizeStartRatio = 1;
      let rotatePointerId = null;
      let rotateStartClientX = 0;
      let rotateStartClientY = 0;
      let rotateStartAngle = 0;
      let rotateStartValue = 0;
      let isRotateDragging = false;

      const resizeHandles = ["nw", "ne", "sw", "se"].map((corner) => {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = `smc-resize-handle smc-resize-${corner}`;
        handle.setAttribute("aria-label", `Resize card from ${corner.toUpperCase()} corner`);
        handle.setAttribute("data-corner", corner);
        card.appendChild(handle);
        return handle;
      });

      function applyStateTransform() {
        state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0) rotate(${state.rotate.toFixed(2)}deg)`;
      }

      function bringCardToFront() {
        topCardLayer += 1;
        card.style.zIndex = String(topCardLayer);
      }

      function setPinnedHint(text) {
        openLink.textContent = text;
        state.isPinned = true;
        if (pinnedLayer && card.parentElement !== pinnedLayer) {
          pinnedLayer.appendChild(card);
        }
        card.classList.add("is-active");
        if (state.playerWrap || state.inlinePlayerWrap) {
          card.classList.add("has-active-player");
          setCardMediaVisibility(true, ".smc-player");
          setCardMediaVisibility(false, ".smc-media");
        } else {
          card.classList.remove("has-active-player");
        }
        closeButton.hidden = false;
        rotateButton.hidden = false;
      }

      function setCardMediaVisibility(isVisible, selector = ".smc-media, .smc-player") {
        const mediaNodes = card.querySelectorAll(selector);
        mediaNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            node.style.display = isVisible ? "" : "none";
            node.setAttribute("aria-hidden", isVisible ? "false" : "true");
          }
        });
      }

      function pauseActivePlayback() {
        const pauseVideoElement = (videoEl) => {
          if (!(videoEl instanceof HTMLVideoElement)) return;
          if (!videoEl.paused) {
            videoEl.pause();
          }
        };

        const pauseIframeElement = (iframeEl, fallbackSrc = "") => {
          if (!(iframeEl instanceof HTMLIFrameElement)) return;
          const currentSrc = String(iframeEl.getAttribute("src") || iframeEl.src || "").trim();
          if (!currentSrc) return;

          try {
            const parsedUrl = new URL(currentSrc, window.location.origin);
            const hostname = parsedUrl.hostname.toLowerCase();
            if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
              iframeEl.contentWindow?.postMessage(
                JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
                "*"
              );
            }
          } catch (_err) {
            // Ignore URL parsing/postMessage failures and continue with fallback.
          }

          const targetSrc = String(fallbackSrc || currentSrc).trim();
          if (targetSrc) {
            // Reloading the iframe with a non-autoplay source ensures playback stops.
            iframeEl.src = targetSrc;
          }
        };

        const activePlayerWraps = [state.playerWrap, state.inlinePlayerWrap].filter(Boolean);
        activePlayerWraps.forEach((wrap) => {
          const videoEl = wrap.querySelector("video");
          if (videoEl) {
            pauseVideoElement(videoEl);
            return;
          }
          const iframeEl = wrap.querySelector("iframe");
          if (iframeEl) {
            const fallbackSrc = state.embed?.kind === "iframe" ? state.embed.src : "";
            pauseIframeElement(iframeEl, fallbackSrc);
          }
        });
      }

      function getPointerAngle(event) {
        const cloudRect = cloud.getBoundingClientRect();
        const pointerX = event.clientX - cloudRect.left;
        const pointerY = event.clientY - cloudRect.top;
        const centerX = state.x + (card.offsetWidth / 2);
        const centerY = state.y + (card.offsetHeight / 2);
        return Math.atan2(pointerY - centerY, pointerX - centerX) * (180 / Math.PI);
      }

      function unpinCard() {
        pauseActivePlayback();
        if (card.parentElement !== cloud) {
          cloud.appendChild(card);
        }
        const hasActivePlayer = Boolean(state.playerWrap || state.inlinePlayerWrap);
        card.classList.toggle("has-active-player", hasActivePlayer);
        setCardMediaVisibility(true);
        if (hasActivePlayer) {
          // Keep active video visible while card drifts, but hide static thumbnail.
          setCardMediaVisibility(false, ".smc-media");
        }
        state.isPinned = false;
        isDragging = false;
        card.classList.remove("is-active");
        card.classList.remove("is-dragging");
        openLink.textContent = hasActivePlayer
          ? "Video keeps playing while drifting. Click card to pause movement"
          : "Click card to pause movement";
        closeButton.hidden = true;
      }

      function pinCard(embed) {
        state.isPinned = true;
        card.classList.add("is-active");
        card.classList.toggle("has-active-player", Boolean(state.playerWrap || state.inlinePlayerWrap));
        setCardMediaVisibility(false);
        if (state.playerWrap || state.inlinePlayerWrap) {
          setPinnedHint("Paused. Click X to resume drift");
          return;
        }
        const playerWrap = createPlayerElement(embed, state.item, true);
        if (playerWrap) {
          card.insertBefore(playerWrap, copyWrap);
          state.playerWrap = playerWrap;
          card.classList.add("has-active-player");
        }
        setPinnedHint("Paused. Click X to resume drift");
      }

      function activateCardPlayback() {
        if (state.isPinned) return;
        if (state.embed && !state.inlinePlayerWrap && !state.playerWrap) {
          pinCard(state.embed);
          return;
        }
        setPinnedHint("Paused. Click X to resume drift");
      }

      closeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        bringCardToFront();
        unpinCard();
      });

      card.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        bringCardToFront();
        if (isInteractiveCardTarget(event.target)) return;
        const cardRect = card.getBoundingClientRect();
        const startedOnPlayerSurface = event.target instanceof Element && Boolean(event.target.closest(".smc-player"));
        dragPointerId = event.pointerId;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        dragOffsetX = event.clientX - cardRect.left;
        dragOffsetY = event.clientY - cardRect.top;
        isDragging = false;
        pointerStartedOnCardBody = true;
        deferPointerCapture = startedOnPlayerSurface;
        if (!deferPointerCapture) {
          card.setPointerCapture(event.pointerId);
        }
      });

      card.addEventListener("pointermove", (event) => {
        if (dragPointerId !== event.pointerId) return;
        const moveDistance = Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY);
        if (!isDragging && moveDistance < 4) return;

        const cloudRect = cloud.getBoundingClientRect();
        const cardWidth = card.offsetWidth;
        const cardHeight = card.offsetHeight;
        const nextX = clamp(event.clientX - cloudRect.left - dragOffsetX, 0, Math.max(0, cloudWidth - cardWidth));
        const nextY = clamp(event.clientY - cloudRect.top - dragOffsetY, 0, Math.max(0, cloudHeight - cardHeight));

        if (!isDragging) {
          isDragging = true;
          if (deferPointerCapture && !card.hasPointerCapture(event.pointerId)) {
            card.setPointerCapture(event.pointerId);
          }
          deferPointerCapture = false;
          setPinnedHint("Paused. Drag to place. Click X to resume drift");
          card.classList.add("is-dragging");
        }

        state.x = nextX;
        state.y = nextY;
        applyStateTransform();
      });

      card.addEventListener("pointerup", (event) => {
        if (dragPointerId !== event.pointerId) return;
        if (card.hasPointerCapture(event.pointerId)) {
          card.releasePointerCapture(event.pointerId);
        }
        const shouldActivatePlayback = pointerStartedOnCardBody && !isDragging;
        dragPointerId = null;
        pointerStartedOnCardBody = false;
        deferPointerCapture = false;
        if (isDragging) {
          card.classList.remove("is-dragging");
        }
        isDragging = false;
        if (shouldActivatePlayback) {
          activateCardPlayback();
        }
      });

      card.addEventListener("pointercancel", (event) => {
        if (dragPointerId !== event.pointerId) return;
        if (card.hasPointerCapture(event.pointerId)) {
          card.releasePointerCapture(event.pointerId);
        }
        dragPointerId = null;
        pointerStartedOnCardBody = false;
        deferPointerCapture = false;
        if (isDragging) {
          card.classList.remove("is-dragging");
        }
        isDragging = false;
      });

      function getResizeDimensions(event, corner) {
        const minWidth = 160;
        const maxWidth = Math.max(minWidth, cloudWidth);
        const dx = event.clientX - resizeStartClientX;
        const dy = event.clientY - resizeStartClientY;
        const widthFromHorizontal = clamp(
          corner.includes("w") ? resizeStartWidth - dx : resizeStartWidth + dx,
          minWidth,
          maxWidth
        );
        const widthFromVertical = clamp(
          (corner.includes("n") ? resizeStartHeight - dy : resizeStartHeight + dy) * resizeStartRatio,
          minWidth,
          maxWidth
        );
        const horizontalIntent = Math.abs(dx / Math.max(1, resizeStartWidth));
        const verticalIntent = Math.abs(dy / Math.max(1, resizeStartHeight));
        let nextWidth = horizontalIntent >= verticalIntent ? widthFromHorizontal : widthFromVertical;
        let nextHeight = nextWidth / resizeStartRatio;

        let nextX = corner.includes("w")
          ? resizeStartX + resizeStartWidth - nextWidth
          : resizeStartX;
        let nextY = corner.includes("n")
          ? resizeStartY + resizeStartHeight - nextHeight
          : resizeStartY;

        if (nextX < 0) {
          nextX = 0;
          nextWidth = corner.includes("w") ? resizeStartX + resizeStartWidth : nextWidth;
          nextHeight = nextWidth / resizeStartRatio;
        }
        if (nextY < 0) {
          nextY = 0;
          nextHeight = corner.includes("n") ? resizeStartY + resizeStartHeight : nextHeight;
          nextWidth = nextHeight * resizeStartRatio;
        }
        if (nextX + nextWidth > cloudWidth) {
          nextWidth = Math.max(minWidth, cloudWidth - nextX);
          nextHeight = nextWidth / resizeStartRatio;
          if (corner.includes("w")) {
            nextX = Math.max(0, resizeStartX + resizeStartWidth - nextWidth);
          }
        }
        if (nextY + nextHeight > cloudHeight) {
          nextHeight = Math.max(minWidth / resizeStartRatio, cloudHeight - nextY);
          nextWidth = nextHeight * resizeStartRatio;
          if (corner.includes("n")) {
            nextY = Math.max(0, resizeStartY + resizeStartHeight - nextHeight);
          }
        }

        nextWidth = clamp(nextWidth, minWidth, cloudWidth);
        nextHeight = nextWidth / resizeStartRatio;
        nextX = clamp(nextX, 0, Math.max(0, cloudWidth - nextWidth));
        nextY = clamp(nextY, 0, Math.max(0, cloudHeight - nextHeight));
        return { nextX, nextY, nextWidth, nextHeight };
      }

      resizeHandles.forEach((handle) => {
        handle.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          bringCardToFront();
          resizePointerId = event.pointerId;
          resizeCorner = handle.getAttribute("data-corner") || "se";
          resizeStartClientX = event.clientX;
          resizeStartClientY = event.clientY;
          resizeStartWidth = card.offsetWidth;
          resizeStartHeight = card.offsetHeight;
          resizeStartRatio = state.item.type === "video"
            ? state.item.videoAspectRatio
            : (resizeStartWidth / Math.max(1, resizeStartHeight));
          resizeStartX = state.x;
          resizeStartY = state.y;
          setPinnedHint("Paused. Resize from any corner. Click X to resume drift");
          handle.setPointerCapture(event.pointerId);
        });

        handle.addEventListener("pointermove", (event) => {
          if (resizePointerId !== event.pointerId) return;
          const dims = getResizeDimensions(event, resizeCorner);
          state.x = dims.nextX;
          state.y = dims.nextY;
          state.width = dims.nextWidth;
          card.style.width = `${dims.nextWidth}px`;
          if (state.item.type === "video") {
            // Let media ratio drive card height for embedded players.
            card.style.height = "";
          } else {
            card.style.height = `${dims.nextHeight}px`;
          }
          applyStateTransform();
        });

        const endResize = (event) => {
          if (resizePointerId !== event.pointerId) return;
          if (handle.hasPointerCapture(event.pointerId)) {
            handle.releasePointerCapture(event.pointerId);
          }
          resizePointerId = null;
          resizeCorner = "";
        };

        handle.addEventListener("pointerup", endResize);
        handle.addEventListener("pointercancel", endResize);
      });

      rotateButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        bringCardToFront();
      });

      rotateButton.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        bringCardToFront();
        rotatePointerId = event.pointerId;
        rotateStartClientX = event.clientX;
        rotateStartClientY = event.clientY;
        rotateStartAngle = getPointerAngle(event);
        rotateStartValue = state.rotate;
        isRotateDragging = false;
        setPinnedHint("Paused. Drag rotate to rotate card. Click rotate to center.");
        rotateButton.setPointerCapture(event.pointerId);
      });

      rotateButton.addEventListener("pointermove", (event) => {
        if (rotatePointerId !== event.pointerId) return;
        const moveDistance = Math.hypot(event.clientX - rotateStartClientX, event.clientY - rotateStartClientY);
        if (!isRotateDragging && moveDistance < 4) return;
        isRotateDragging = true;
        const currentAngle = getPointerAngle(event);
        state.rotate = rotateStartValue + (currentAngle - rotateStartAngle);
        applyStateTransform();
      });

      const endRotate = (event) => {
        if (rotatePointerId !== event.pointerId) return;
        if (rotateButton.hasPointerCapture(event.pointerId)) {
          rotateButton.releasePointerCapture(event.pointerId);
        }
        rotatePointerId = null;
        if (!isRotateDragging) {
          state.rotate = 0;
          applyStateTransform();
          setPinnedHint("Paused. Rotation centered. Drag rotate to adjust.");
        }
      };

      rotateButton.addEventListener("pointerup", endRotate);
      rotateButton.addEventListener("pointercancel", endRotate);

      card.addEventListener("click", (event) => {
        if (isInteractiveCardTarget(event.target)) return;
        bringCardToFront();
        activateCardPlayback();
      });

      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        bringCardToFront();
        activateCardPlayback();
      });

      const initialBob = Math.sin((lastFrame * 0.001 * state.driftRate) + state.phase) * state.driftAmp;
      state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${(state.y + initialBob).toFixed(2)}px, 0) rotate(${state.rotate.toFixed(2)}deg)`;

      states.push(state);
    }
    cloud.appendChild(fragment);
  }

  function resetState(state) {
    if (typeof state.setItem === "function" && enabledCatalog.length > cardCount) {
      const nextItem = enabledCatalog[catalogCursor % enabledCatalog.length];
      catalogCursor += 1;
      state.setItem(nextItem);
    }
    state.x = getRespawnX(state.width, state);
    state.y = clamp(state.y + (Math.random() * 80 - 40), 10, Math.max(10, cloudHeight - 150));
    state.speed = config.baseSpeed * (0.82 + Math.random() * 0.45);
    state.phase = Math.random() * Math.PI * 2;
  }

  function tick(now) {
    const dt = Math.min(0.032, (now - lastFrame) / 1000);
    lastFrame = now;

    for (let i = 0; i < states.length; i += 1) {
      const state = states[i];
      if (state.isPinned) continue;
      state.x += state.speed * dt;
      if (state.x > cloudWidth + 30) resetState(state);
      const bob = Math.sin((now * 0.001 * state.driftRate) + state.phase) * state.driftAmp;
      state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${(state.y + bob).toFixed(2)}px, 0) rotate(${state.rotate.toFixed(2)}deg)`;
    }

    rafId = window.requestAnimationFrame(tick);
  }

  function placeStaticCards() {
    const columns = window.innerWidth < 780 ? 2 : 3;
    const gutter = 14;
    const cardWidth = Math.min(230, Math.max(156, (cloudWidth - ((columns + 1) * gutter)) / columns));
    for (let i = 0; i < states.length; i += 1) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const x = gutter + (col * (cardWidth + gutter));
      const y = gutter + (row * 138);
      states[i].el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }

  function startCloudAnimation() {
    if (!prefersReducedMotion) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      placeStaticCards();
    }
  }

  function rebuildCloud(contentItems = manualSocialContentItems) {
    activeContentItems = contentItems;
    catalogCursor = 0;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    states.length = 0;
    if (pinnedLayer) {
      pinnedLayer.textContent = "";
    }
    cloud.textContent = "";
    lastFrame = performance.now();
    syncCloudBounds();
    enabledCatalog = getEnabledCatalog(contentItems);
    updateCardCountForViewport();
    renderCards();
    startCloudAnimation();
    startAmbientUpdates();
  }

  function getModeToggleLabel() {
    return useLightMode ? "Lightweight: On" : "Lightweight: Off";
  }

  function enableModeToggleDrag(modeButton) {
    const DRAG_MARGIN = 8;
    const DRAG_THRESHOLD = 4;
    const dragState = {
      active: false,
      pointerId: null,
      startPointerX: 0,
      startPointerY: 0,
      startLeft: 0,
      startTop: 0,
      moved: false
    };
    let suppressClick = false;

    function clampModeButtonPosition(left, top) {
      const rect = modeButton.getBoundingClientRect();
      const maxLeft = Math.max(DRAG_MARGIN, window.innerWidth - rect.width - DRAG_MARGIN);
      const maxTop = Math.max(DRAG_MARGIN, window.innerHeight - rect.height - DRAG_MARGIN);
      return {
        left: clamp(left, DRAG_MARGIN, maxLeft),
        top: clamp(top, DRAG_MARGIN, maxTop)
      };
    }

    modeButton.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const rect = modeButton.getBoundingClientRect();
      dragState.active = true;
      dragState.pointerId = event.pointerId;
      dragState.startPointerX = event.clientX;
      dragState.startPointerY = event.clientY;
      dragState.startLeft = rect.left;
      dragState.startTop = rect.top;
      dragState.moved = false;
      modeButton.setPointerCapture(event.pointerId);
      modeButton.classList.add("is-dragging");
      event.preventDefault();
    });

    modeButton.addEventListener("pointermove", (event) => {
      if (!dragState.active || event.pointerId !== dragState.pointerId) return;
      const offsetX = event.clientX - dragState.startPointerX;
      const offsetY = event.clientY - dragState.startPointerY;
      if (!dragState.moved && ((Math.abs(offsetX) >= DRAG_THRESHOLD) || (Math.abs(offsetY) >= DRAG_THRESHOLD))) {
        dragState.moved = true;
      }
      const constrained = clampModeButtonPosition(dragState.startLeft + offsetX, dragState.startTop + offsetY);
      modeButton.style.left = `${constrained.left}px`;
      modeButton.style.top = `${constrained.top}px`;
      modeButton.style.right = "auto";
      modeButton.style.bottom = "auto";
      event.preventDefault();
    });

    function finishPointer(event) {
      if (!dragState.active || event.pointerId !== dragState.pointerId) return;
      if (modeButton.hasPointerCapture(event.pointerId)) {
        modeButton.releasePointerCapture(event.pointerId);
      }
      suppressClick = dragState.moved;
      dragState.active = false;
      dragState.pointerId = null;
      modeButton.classList.remove("is-dragging");
    }

    modeButton.addEventListener("pointerup", finishPointer);
    modeButton.addEventListener("pointercancel", finishPointer);

    modeButton.addEventListener("click", (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    window.addEventListener("resize", () => {
      const hasCustomPosition = modeButton.style.left && modeButton.style.top;
      if (!hasCustomPosition) return;
      const currentLeft = Number.parseFloat(modeButton.style.left);
      const currentTop = Number.parseFloat(modeButton.style.top);
      if (!Number.isFinite(currentLeft) || !Number.isFinite(currentTop)) return;
      const constrained = clampModeButtonPosition(currentLeft, currentTop);
      modeButton.style.left = `${constrained.left}px`;
      modeButton.style.top = `${constrained.top}px`;
    }, { passive: true });
  }

  function mountModeToggle() {
    const modeButton = document.createElement("button");
    modeButton.type = "button";
    modeButton.className = "smc-mode-toggle";
    modeButton.textContent = getModeToggleLabel();
    modeButton.setAttribute("aria-pressed", useLightMode ? "true" : "false");
    modeButton.setAttribute("aria-label", "Toggle lightweight mode");
    modeButton.title = "Toggle lightweight mode";
    modeButton.addEventListener("click", () => {
      useLightMode = !useLightMode;
      setStoredModePreference(useLightMode ? LIGHT_MODE_VALUE : FULL_MODE_VALUE);
      applyModeConfig();
      modeButton.textContent = getModeToggleLabel();
      modeButton.setAttribute("aria-pressed", useLightMode ? "true" : "false");
      rebuildCloud(activeContentItems);
    });
    enableModeToggleDrag(modeButton);
    document.body.appendChild(modeButton);
  }

  async function initializeCloud() {
    mountAmbientLayer();
    mountPinnedLayer();
    syncCloudBounds();
    const [localItems, redditItems] = await Promise.all([
      fetchLocalSocialContentItems(),
      fetchRedditTopContentItems()
    ]);
    const youtubeItems = localItems.length ? localItems : manualSocialContentItems;
    const contentItems = [...redditItems, ...youtubeItems];
    activeContentItems = contentItems;
    enabledCatalog = getEnabledCatalog(contentItems);
    catalogCursor = 0;
    updateCardCountForViewport();
    renderCards();
    startCloudAnimation();
    startAmbientUpdates();
    mountModeToggle();
  }

  initializeCloud();

  window.addEventListener("resize", () => {
    syncCloudBounds();
    if (prefersReducedMotion) {
      placeStaticCards();
    } else {
      for (let i = 0; i < states.length; i += 1) {
        states[i].y = clamp(states[i].y, 10, Math.max(10, cloudHeight - 150));
        if (states[i].x > cloudWidth + 40) resetState(states[i]);
      }
    }
    if (!ambientTickRaf) {
      ambientTickRaf = window.requestAnimationFrame(() => {
        ambientTickRaf = 0;
        updateAmbientPalette();
      });
    }
  }, { passive: true });

  window.setTimeout(syncCloudBounds, 140);
  window.setTimeout(syncCloudBounds, 520);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const fsCard = document.querySelector(".smc-card.is-fullscreen");
    if (!fsCard) return;
    fsCard.classList.remove("is-fullscreen");
    if (fsCard._fsLeft !== undefined) fsCard.style.left = fsCard._fsLeft;
    if (fsCard._fsTop !== undefined) fsCard.style.top = fsCard._fsTop;
    if (fsCard._fsWidth !== undefined) fsCard.style.width = fsCard._fsWidth;
    if (fsCard._fsTransform !== undefined) fsCard.style.transform = fsCard._fsTransform;
    const btn = fsCard.querySelector(".smc-fullscreen-btn");
    if (btn) {
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 13h2v4h4v2H3v-6zm16 4h-4v2h6v-6h-2v4z"/></svg>`;
      btn.setAttribute("aria-label", "Expand card to full screen");
      btn.title = "Full screen";
    }
  });

  window.addEventListener("pagehide", () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    stopAmbientUpdates();
  });
})();
