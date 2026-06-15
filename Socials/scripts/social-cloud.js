(function () {
	const cloud = document.getElementById('socialCloud');
	const hashtagFilterBar = document.getElementById('socialHashtagFilters');
	if (!cloud) return;

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const MODE_STORAGE_KEY = 'smc-cloud-mode';
	const VISITED_LINKS_STORAGE_KEY = 'smc-visited-links';
	const LIGHT_MODE_VALUE = 'light';
	const FULL_MODE_VALUE = 'full';
	const connection =
		navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
	const hardwareConcurrency = Number(navigator.hardwareConcurrency || 0);
	const deviceMemory = Number(navigator.deviceMemory || 0);
	const effectiveType = String(connection?.effectiveType || '').toLowerCase();
	const saveDataEnabled = Boolean(connection?.saveData);
	const isSlowNetwork =
		saveDataEnabled ||
		effectiveType.includes('2g') ||
		effectiveType === 'slow-2g' ||
		effectiveType === '3g';
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
		return '';
	}

	function setStoredModePreference(value) {
		try {
			localStorage.setItem(MODE_STORAGE_KEY, value);
		} catch (_err) {
			// Ignore storage errors.
		}
	}

	function loadVisitedLinks() {
		try {
			const raw = localStorage.getItem(VISITED_LINKS_STORAGE_KEY);
			if (!raw) return new Set();
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return new Set();
			return new Set(parsed.filter((entry) => typeof entry === 'string' && entry));
		} catch (_err) {
			return new Set();
		}
	}

	const visitedLinks = loadVisitedLinks();

	function normalizeVisitedUrl(url) {
		try {
			const normalized = new URL(String(url || ''), window.location.origin).toString();
			if (!/^https?:/i.test(normalized)) return '';
			return normalized;
		} catch (_err) {
			return '';
		}
	}

	function persistVisitedLinks() {
		try {
			localStorage.setItem(VISITED_LINKS_STORAGE_KEY, JSON.stringify([...visitedLinks]));
		} catch (_err) {
			// Ignore storage errors.
		}
	}

	function isLinkVisited(url) {
		const normalized = normalizeVisitedUrl(url);
		return normalized ? visitedLinks.has(normalized) : false;
	}

	function markLinkVisited(url) {
		const normalized = normalizeVisitedUrl(url);
		if (!normalized || visitedLinks.has(normalized)) return;
		visitedLinks.add(normalized);
		persistVisitedLinks();
	}

	let useLightMode =
		getStoredModePreference() === LIGHT_MODE_VALUE ||
		(getStoredModePreference() === '' && autoLightMode);

	// Tweak notes:
	// - Increase/decrease card count with `cardCountDesktop` and `cardCountMobile`.
	// - Animation pace is controlled with `baseSpeed`.
	// - Enable/disable content kinds in `enabledNoteTypes`.
	const config = {
		cardCountDesktop: 20,
		cardCountMobile: 12,
		baseSpeed: 28,
		enabledNoteTypes: ['video', 'social'],
		preferredYouTubeContentTypes: [],
		useInlineVideoByDefault: true,
	};
	const LOCAL_YOUTUBE_SHORTS_PATH = '/Socials/data/youtube-shorts.json';
	const LOCAL_YOUTUBE_VIDEOS_PATH = '/Socials/data/youtube-videos.json';
	const LOCAL_X_TOP_POSTS_PATH = '/Socials/data/x-top-posts.json';
	const LOCAL_INSTAGRAM_POSTS_PATH = '/Socials/data/instagram-posts.json';
	const LOCAL_TIKTOK_POSTS_PATH = '/Socials/data/tiktok-posts.json';
	const LOCAL_FACEBOOK_POSTS_PATH = '/Socials/data/facebook-posts.json';
	const LOCAL_TWITCH_POSTS_PATH = '/Socials/data/twitch-posts.json';
	const MIN_SOCIAL_ENGAGEMENT = 101;
	const X_MIN_LIKES = MIN_SOCIAL_ENGAGEMENT;
	const REDDIT_MIN_UPVOTES = MIN_SOCIAL_ENGAGEMENT;
	const REDDIT_FETCH_LIMIT = 100;
	const SOCIAL_CARD_FIDGET_REV_DEG = 5 * 360;
	const SOCIAL_CARD_FIDGET_TOL_DEG = 20;
	const SOCIAL_CARD_FIDGET_TURBO_MS = 1600;
	const SOCIAL_CARD_FIDGET_TURBO_DEG_PER_SEC = 2200;
	const SOCIAL_CARD_IDLE_SPIN_MS = 15 * 60 * 1000;
	const SOCIAL_CARD_IDLE_SPIN_DEG_PER_SEC = 240;
	const ACH_SOCIAL_DOCK_MOVE = 'social-dock-move';
	const ACH_SOCIAL_CARD_PIN_AND_MOVE = 'social-card-pin-and-move';
	const SOCIAL_CARD_PIN_MOVE_PROGRESS_KEY = 'smc-social-card-pin-move-progress-v1';
	const SOCIAL_CARD_FIDGET_FX_VARIANTS = 6;
	function pickSocialCardFidgetFxVariant() {
		return Math.floor(Math.random() * SOCIAL_CARD_FIDGET_FX_VARIANTS);
	}

	function loadSocialCardPinMoveProgress() {
		try {
			const raw = localStorage.getItem(SOCIAL_CARD_PIN_MOVE_PROGRESS_KEY);
			if (!raw) return { moved: false, pinned: false };
			const parsed = JSON.parse(raw);
			return {
				moved: Boolean(parsed?.moved),
				pinned: Boolean(parsed?.pinned),
			};
		} catch (_err) {
			return { moved: false, pinned: false };
		}
	}

	const socialCardPinMoveProgress = loadSocialCardPinMoveProgress();

	function persistSocialCardPinMoveProgress() {
		try {
			localStorage.setItem(
				SOCIAL_CARD_PIN_MOVE_PROGRESS_KEY,
				JSON.stringify(socialCardPinMoveProgress)
			);
		} catch (_err) {
			// Ignore storage errors.
		}
	}

	function maybeUnlockSocialCardPinMoveAchievement() {
		if (
			!socialCardPinMoveProgress.moved ||
			!socialCardPinMoveProgress.pinned ||
			typeof window.owenminercsUnlockAchievement !== 'function'
		) {
			return;
		}
		try {
			window.owenminercsUnlockAchievement(ACH_SOCIAL_CARD_PIN_AND_MOVE);
		} catch (_err) {
			// Achievement unlocks are best-effort and should never break card gestures.
		}
	}

	function markSocialCardMoved() {
		if (socialCardPinMoveProgress.moved) {
			maybeUnlockSocialCardPinMoveAchievement();
			return;
		}
		socialCardPinMoveProgress.moved = true;
		persistSocialCardPinMoveProgress();
		maybeUnlockSocialCardPinMoveAchievement();
	}

	function markSocialCardPinned() {
		if (socialCardPinMoveProgress.pinned) {
			maybeUnlockSocialCardPinMoveAchievement();
			return;
		}
		socialCardPinMoveProgress.pinned = true;
		persistSocialCardPinMoveProgress();
		maybeUnlockSocialCardPinMoveAchievement();
	}

	function applyModeConfig() {
		config.cardCountDesktop = useLightMode ? 8 : 16;
		config.cardCountMobile = useLightMode ? 6 : 10;
		config.baseSpeed = useLightMode ? 20 : 28;
		// Thumbnails only in lightweight mode; full mode uses inline iframes/video players.
		config.useInlineVideoByDefault = !useLightMode;
	}

	applyModeConfig();

	const platformMeta = {
		instagram: { label: 'Instagram', accent: '#d7b4ff', type: 'social' },
		youtube: { label: 'YouTube', accent: '#ff8f9d', type: 'video' },
		twitch: { label: 'Twitch', accent: '#b8a0ff', type: 'social' },
		tiktok: { label: 'TikTok', accent: '#7de7ff', type: 'video' },
		x: { label: 'X', accent: '#9dc2ff', type: 'social' },
		reddit: { label: 'Reddit', accent: '#ff9966', type: 'social' },
		facebook: { label: 'Facebook', accent: '#8fb7ff', type: 'social' },
		discord: { label: 'Discord', accent: '#99b3ff', type: 'social' },
	};
	const socialProfileFallbacks = {
		x: 'https://x.com/OwenMiner',
		reddit: 'https://www.reddit.com/user/OwenMCS',
		youtube: 'https://www.youtube.com/@OwenMinerCS',
		twitch: 'https://www.twitch.tv/owenminercs',
		instagram: 'https://www.instagram.com/owenminercs/',
		facebook: 'https://www.facebook.com/profile.php?id=100095719715453',
		tiktok: 'https://www.tiktok.com/@owenminercs',
		discord: 'https://discord.gg/fA9GbxmAge',
	};
	const youtubeProfileAvatarUrl = 'https://unavatar.io/youtube/OwenMinerCS';
	const socialIconPaths = {
		x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
		reddit: 'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z',
		youtube:
			'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
		twitch: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z',
		instagram:
			'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
		facebook:
			'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
		tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
		discord:
			'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 0 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
	};
	const socialProfileSelectors = {
		x: ".site-social-nav__link[href*='x.com/']",
		reddit: ".site-social-nav__link[href*='reddit.com/']",
		youtube: ".site-social-nav__link[href*='youtube.com/']",
		twitch: ".site-social-nav__link[href*='twitch.tv/']",
		instagram: ".site-social-nav__link[href*='instagram.com/']",
		facebook: ".site-social-nav__link[href*='facebook.com/']",
		tiktok: ".site-social-nav__link[href*='tiktok.com/']",
		discord: ".site-social-nav__link[href*='discord']",
	};

	function normalizePlatformKey(value) {
		const normalized = String(value || '')
			.toLowerCase()
			.trim();
		if (normalized === 'twitter') return 'x';
		return normalized;
	}

	function isHttpUrl(value) {
		return /^https?:\/\//i.test(String(value || '').trim());
	}

	function getSocialProfileLink(platformKey) {
		const normalizedKey = normalizePlatformKey(platformKey);
		const selector = socialProfileSelectors[normalizedKey];
		const fallback = socialProfileFallbacks[normalizedKey] || '';
		if (selector) {
			const href = String(
				document.querySelector(selector)?.getAttribute('href') || ''
			).trim();
			if (isHttpUrl(href)) return href;
		}
		return fallback;
	}

	function getSocialIconMarkup(platformKey) {
		const normalizedKey = normalizePlatformKey(platformKey);
		const iconPath = socialIconPaths[normalizedKey];
		if (!iconPath) return '';
		return `<svg class="site-social-nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="${iconPath}"></path></svg>`;
	}

	function getExternalLinkIconMarkup() {
		return `<svg class="site-social-nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 3h7v7h-2V6.414l-8.293 8.293-1.414-1.414L17.586 5H14V3z"></path><path fill="currentColor" d="M19 21H3V5h8V3H3C1.897 3 1 3.897 1 5v16c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2v-8h-2v8z"></path></svg>`;
	}

	// Manual card source. Add/update entries here instead of using the API feed.
	const manualSocialContentItems = [
		{
			platform: 'youtube',
			contentType: 'short',
			title: 'Bye Bye',
			url: 'https://www.youtube.com/shorts/EmNTRsInyiA',
			thumbnail: 'https://i2.ytimg.com/vi/EmNTRsInyiA/hqdefault.jpg',
			caption:
				'#csgo #cs2 #counterstrike #gaming #fps Subscribe for more CS2 Content :) Twitch: https://www.twitch.tv/owenminercs Twitter...',
			publishedAt: '2026-02-13',
		},
		{
			platform: 'youtube',
			contentType: 'video',
			title: '🔴CS2 Premier Road to 30K',
			url: 'https://www.youtube.com/watch?v=ian1kvdwsEA',
			thumbnail: 'https://i2.ytimg.com/vi/ian1kvdwsEA/hqdefault.jpg',
			caption:
				'Welcome to my Counter Strike 2 live stream. If you could drop a like and type how you are doing today in chat it would really...',
			publishedAt: '2025-12-03',
		},
		{
			platform: 'youtube',
			contentType: 'short',
			title: '🟥 Premier Games Road to 30K CS2',
			url: 'https://www.youtube.com/watch?v=k-5x7qVcMPM',
			thumbnail: 'https://i4.ytimg.com/vi/k-5x7qVcMPM/hqdefault.jpg',
			caption:
				'This is a Youtube shorts live stream. Full screen 16:9 stream available here and on Twitch: https://youtube.com/live/ian1kvdwsEA?...',
			publishedAt: '2025-12-03',
		},
		{
			platform: 'youtube',
			contentType: 'video',
			title: '🔴Live CS2 Gameplay |⭐Grinding Armory Pass| Unironically 6\'7"',
			url: 'https://www.youtube.com/watch?v=oxTFIYagz_w',
			thumbnail: 'https://i4.ytimg.com/vi/oxTFIYagz_w/hqdefault.jpg',
			caption:
				'Welcome to my Counter Strike 2 live stream. If you could drop a like and type how you are doing today in chat it would really...',
			publishedAt: '2025-12-01',
		},
		{
			platform: 'youtube',
			contentType: 'short',
			title: '🟥 Premier Games CS2',
			url: 'https://www.youtube.com/watch?v=81VXn70I1_I',
			thumbnail: 'https://i1.ytimg.com/vi/81VXn70I1_I/hqdefault.jpg',
			caption:
				'This is a Youtube shorts live stream. Full screen 16:9 stream available here and on Twitch: https://youtube.com/live/oxTFIYagz_w?...',
			publishedAt: '2025-12-01',
		},
		{
			platform: 'youtube',
			contentType: 'short',
			title: '🟥29K Premier',
			url: 'https://www.youtube.com/watch?v=ii8tklMkYks',
			thumbnail: 'https://i2.ytimg.com/vi/ii8tklMkYks/hqdefault.jpg',
			caption:
				'This is a Youtube shorts live stream. Full screen 16:9 stream available here and on Twitch: https://youtube.com/live/G0csbjC77Tk?...',
			publishedAt: '2025-11-30',
		},
		{
			platform: 'youtube',
			contentType: 'video',
			title: '🔴29K Premier',
			url: 'https://www.youtube.com/watch?v=G0csbjC77Tk',
			thumbnail: 'https://i4.ytimg.com/vi/G0csbjC77Tk/hqdefault.jpg',
			caption:
				'Welcome to my Counter Strike 2 live stream. If you could drop a like and type how you are doing today in chat it would really...',
			publishedAt: '2025-11-29',
		},
		{
			platform: 'youtube',
			contentType: 'video',
			title: 'Chicken Head Taps',
			url: 'https://www.youtube.com/watch?v=rc_Np4Wwp5Q',
			thumbnail: 'https://i3.ytimg.com/vi/rc_Np4Wwp5Q/hqdefault.jpg',
			caption:
				'Thanksgiving Turkey Taps. During my post-Thanksgiving livestream, I was playing some Counter-Strike 2 in 29,000 Premier Rating...',
			publishedAt: '2025-11-29',
		},
		{
			platform: 'youtube',
			contentType: 'short',
			title: '🟥29K Premier Post Thanksgiving Games 🦃(Chicken Head)',
			url: 'https://www.youtube.com/watch?v=0OA7_gvF31Q',
			thumbnail: 'https://i1.ytimg.com/vi/0OA7_gvF31Q/hqdefault.jpg',
			caption:
				'This is a Youtube shorts live stream. Full screen 16:9 stream available here and on Twitch: https://youtube.com/live/5mjw-ulqB6Y?...',
			publishedAt: '2025-11-29',
		},
		{
			platform: 'youtube',
			contentType: 'video',
			title: '🔴29K Premier Post Thanksgiving Games (Chicken Head)',
			url: 'https://www.youtube.com/watch?v=5mjw-ulqB6Y',
			thumbnail: 'https://i2.ytimg.com/vi/5mjw-ulqB6Y/hqdefault.jpg',
			caption:
				'Welcome to my Counter Strike 2 live stream. If you could drop a like and type how you are doing today in chat it would really...',
			publishedAt: '2025-11-29',
		},
	];

	function toSafeNumber(value) {
		const parsed = Number.parseInt(String(value ?? ''), 10);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	function normalizeFeedItems(payloadItems) {
		if (!Array.isArray(payloadItems)) return [];
		return payloadItems.map((item) => ({
			platform: normalizePlatformKey(item?.platform),
			contentType: String(item?.contentType || '').toLowerCase(),
			title: item?.title || '',
			url: item?.permalink || '',
			thumbnail: item?.media?.thumbnailUrl || '',
			embedUrl: item?.media?.embedUrl || '',
			caption: item?.description || '',
			publishedAt: item?.publishedAt || '',
			viewCount: toSafeNumber(item?.metrics?.viewCount),
			likeCount: toSafeNumber(item?.metrics?.likeCount ?? item?.metrics?.upvoteCount),
			upvoteCount: toSafeNumber(item?.metrics?.upvoteCount),
			commentCount: toSafeNumber(item?.metrics?.commentCount ?? item?.metrics?.replyCount),
			mediaKind: String(item?.media?.kind || '').toLowerCase(),
			aspectRatio: String(item?.media?.aspectRatio || '').trim(),
			isLive: Boolean(item?.isLive),
		}));
	}

	function normalizeAspectRatio(width, height, fallback = '16 / 9') {
		const safeWidth = Number(width);
		const safeHeight = Number(height);
		if (
			!Number.isFinite(safeWidth) ||
			!Number.isFinite(safeHeight) ||
			safeWidth <= 0 ||
			safeHeight <= 0
		) {
			return fallback;
		}
		return `${safeWidth} / ${safeHeight}`;
	}

	function applyCardMediaAspectVars(cardEl, ratioCss) {
		const cleaned = String(ratioCss || '')
			.replace(/\s/g, '')
			.trim();
		const match = cleaned.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
		if (match) {
			cardEl.style.setProperty('--smc-ar-w', match[1]);
			cardEl.style.setProperty('--smc-ar-h', match[2]);
		} else {
			cardEl.style.setProperty('--smc-ar-w', '16');
			cardEl.style.setProperty('--smc-ar-h', '9');
		}
	}

	function parseAspectRatioValue(rawRatio) {
		const value = String(rawRatio || '').trim();
		if (!value) return 0;
		const match = value.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
		if (!match) return 0;
		const width = Number.parseFloat(match[1]);
		const height = Number.parseFloat(match[2]);
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
			return 0;
		return width / height;
	}

	function getLegacyVideoRatioForItem(item) {
		const platform = String(item?.platform || '').toLowerCase();
		const embedUrl = String(item?.embedUrl || '').trim();
		// redditmedia iframe players are landscape. Reddit often ships preview/reddit_video
		// dimensions that are portrait or square while the embed is 16:9 — a portrait
		// --smc-card-ratio makes a tall slot and crops the sides of the actual video.
		if (
			platform === 'reddit' &&
			embedUrl.includes('redditmedia.com') &&
			!isRedditProgressiveMp4Url(embedUrl)
		) {
			return '16 / 9';
		}

		const resolvedType = getResolvedContentType(item);
		if (resolvedType === 'video' || resolvedType === 'short') {
			return '16 / 9';
		}
		const parsedRatio = parseAspectRatioValue(item?.aspectRatio);
		if (parsedRatio > 0) return item.aspectRatio;
		return '16 / 9';
	}

	function getVideoRatioForItem(item) {
		const resolvedType = getResolvedContentType(item);
		const parsedRatio = parseAspectRatioValue(item?.aspectRatio);
		if (parsedRatio > 0) return item.aspectRatio;
		if (resolvedType === 'short') return '9 / 16';
		if (normalizePlatformKey(item?.platform) === 'tiktok') return '9 / 16';
		return '16 / 9';
	}

	function decodeHtmlEntities(value) {
		return String(value || '')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'");
	}

	function sanitizeRedditText(value) {
		return String(value || '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function createBlurbLink(href, label) {
		if (!isHttpUrl(href)) return null;
		const link = document.createElement('a');
		link.className = 'smc-inline-link';
		link.href = href;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.textContent = label || href;
		return link;
	}

	function setBlurbContent(element, value) {
		if (!(element instanceof HTMLElement)) return;
		const text = String(value || '');
		element.textContent = '';
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
				const trimmedUrl = rawUrl.replace(/[),.!?;:]+$/g, '');
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
		const urlValue = String(rawUrl || '');
		const match = urlValue.match(/reddit\.com\/(?:user|u)\/([^/?#]+)/i);
		return match?.[1] ? match[1].trim() : '';
	}

	function getRedditProfileUrlFromPage() {
		const domCandidate = document.querySelector(
			'a[href*="reddit.com/user/"], a[href*="reddit.com/u/"]'
		);
		const hrefFromDom = String(domCandidate?.getAttribute('href') || '').trim();
		if (hrefFromDom) return hrefFromDom;

		const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
		for (const script of jsonLdScripts) {
			const source = String(script?.textContent || '');
			if (!source) continue;
			const match = source.match(
				/https?:\/\/(?:www\.)?reddit\.com\/(?:user|u)\/[^"'\s,\]]+/i
			);
			if (match?.[0]) return match[0];
		}
		return 'https://www.reddit.com/user/OwenMCS';
	}

	function getRedditPreviewImage(data) {
		const previewImage = data?.preview?.images?.[0];
		const sourceImage = previewImage?.source;
		if (!sourceImage?.url) return { url: '', aspectRatio: '' };
		return {
			url: decodeHtmlEntities(sourceImage.url),
			aspectRatio: normalizeAspectRatio(sourceImage.width, sourceImage.height, '4 / 3'),
		};
	}

	function getRedditGalleryImage(data) {
		const galleryData = data?.gallery_data?.items;
		const mediaMeta = data?.media_metadata;
		if (!Array.isArray(galleryData) || !mediaMeta || typeof mediaMeta !== 'object')
			return { url: '', aspectRatio: '' };
		for (const galleryItem of galleryData) {
			const mediaId = String(galleryItem?.media_id || '');
			if (!mediaId) continue;
			const meta = mediaMeta[mediaId];
			const preview =
				Array.isArray(meta?.p) && meta.p.length ? meta.p[meta.p.length - 1] : null;
			const source = meta?.s || preview;
			if (!source?.u) continue;
			return {
				url: decodeHtmlEntities(source.u),
				aspectRatio: normalizeAspectRatio(source.x, source.y, '4 / 3'),
			};
		}
		return { url: '', aspectRatio: '' };
	}

	function getRedditVideoData(postData) {
		const candidates = [
			postData,
			...(Array.isArray(postData?.crosspost_parent_list)
				? postData.crosspost_parent_list
				: []
			).filter(Boolean),
		];

		for (const candidate of candidates) {
			const secureVideo = candidate?.secure_media?.reddit_video;
			if (secureVideo && typeof secureVideo === 'object') return secureVideo;
			const mediaVideo = candidate?.media?.reddit_video;
			if (mediaVideo && typeof mediaVideo === 'object') return mediaVideo;
			const previewVideo = candidate?.preview?.reddit_video_preview;
			if (previewVideo && typeof previewVideo === 'object') return previewVideo;
		}
		return {};
	}

	function getRedditHostedVideoFallbackUrl(postData) {
		const urlCandidates = [
			postData?.url_overridden_by_dest,
			postData?.url,
			...(Array.isArray(postData?.crosspost_parent_list)
				? postData.crosspost_parent_list
				: []
			).map((entry) => entry?.url_overridden_by_dest || entry?.url),
		];
		for (const rawUrl of urlCandidates) {
			const match = String(rawUrl || '').match(/https?:\/\/v\.redd\.it\/([a-z0-9]+)/i);
			if (match?.[1]) {
				return `https://v.redd.it/${match[1]}/DASH_720.mp4?source=fallback`;
			}
		}
		return '';
	}

	function getRedditIframeFallbackUrl(permalink) {
		const path = String(permalink || '').trim();
		if (!path) return '';
		return `https://www.redditmedia.com${path}?ref_source=embed&ref=share&embed=true`;
	}

	function isRedditProgressiveMp4Url(rawUrl) {
		return /\.(mp4|webm)(?:\?|$)/i.test(String(rawUrl || ''));
	}

	function isRedditNonNativeVideoStreamUrl(rawUrl) {
		const value = String(rawUrl || '').toLowerCase();
		return value.includes('.m3u8') || value.includes('.mpd');
	}

	function redditPostUrlToMediaEmbed(absolutePostUrl) {
		const raw = String(absolutePostUrl || '').trim();
		if (!raw || !isHttpUrl(raw)) return '';
		try {
			const parsed = new URL(raw);
			const host = parsed.hostname.toLowerCase();
			if (!host.endsWith('reddit.com')) return '';
			const path = parsed.pathname.replace(/\/+$/, '');
			if (!path || path.split('/').length < 4) return '';
			return `https://www.redditmedia.com${path}?ref_source=embed&ref=share&embed=true`;
		} catch (_err) {
			return '';
		}
	}

	function toRedditContentItem(postData) {
		const score = toSafeNumber(postData?.score);
		if (score < REDDIT_MIN_UPVOTES) return null;

		const permalink = String(postData?.permalink || '').trim();
		const absoluteUrl = permalink
			? `https://www.reddit.com${permalink}`
			: String(postData?.url || '').trim();
		if (!absoluteUrl) return null;

		const secureVideo = getRedditVideoData(postData);
		const postHint = String(postData?.post_hint || '').toLowerCase();
		const hasAnyVideoUrl = Boolean(
			secureVideo?.fallback_url || secureVideo?.hls_url || secureVideo?.dash_url
		);
		const isVideo =
			Boolean(postData?.is_video) ||
			hasAnyVideoUrl ||
			postHint === 'hosted:video' ||
			postHint === 'rich:video';
		const galleryImage = getRedditGalleryImage(postData);
		const previewImage = getRedditPreviewImage(postData);
		const thumbnail =
			galleryImage.url ||
			previewImage.url ||
			(String(postData?.thumbnail || '').startsWith('http')
				? String(postData.thumbnail)
				: '');

		const description =
			sanitizeRedditText(postData?.selftext) || sanitizeRedditText(postData?.title);
		const createdUtc = Number(postData?.created_utc || 0);
		const publishedAt =
			createdUtc > 0 ? new Date(createdUtc * 1000).toISOString() : new Date().toISOString();
		const rawFallback = decodeHtmlEntities(String(secureVideo?.fallback_url || '').trim());
		const hostedFallbackUrl = getRedditHostedVideoFallbackUrl(postData);
		// Many older posts omit MP4 fallback_url but still expose hls_url. Chrome/Edge cannot play
		// HLS in a plain <video> src, so prefer progressive MP4 (API or v.redd.it DASH_*.mp4) and
		// fall back to Reddit's embed iframe instead of passing .m3u8 / MPEG-DASH to <video>.
		const progressiveFromApi = isRedditProgressiveMp4Url(rawFallback) ? rawFallback : '';
		const videoFallbackUrl = progressiveFromApi || hostedFallbackUrl;
		const resolvedEmbedUrl = isVideo ? videoFallbackUrl : '';
		const isGallery = Boolean(postData?.is_gallery) || Boolean(galleryImage.url);
		const contentType = isVideo
			? 'video'
			: isGallery
				? 'gallery'
				: thumbnail
					? 'image'
					: 'post';
		const aspectRatio = isVideo
			? normalizeAspectRatio(secureVideo?.width || 16, secureVideo?.height || 9, '16 / 9')
			: galleryImage.aspectRatio || previewImage.aspectRatio || '4 / 3';

		return {
			platform: 'reddit',
			contentType,
			title: sanitizeRedditText(postData?.title) || 'Untitled Reddit post',
			url: absoluteUrl,
			thumbnail,
			caption: description,
			embedUrl: resolvedEmbedUrl,
			mediaKind: isVideo ? 'video' : 'image',
			publishedAt,
			upvoteCount: score,
			commentCount: toSafeNumber(postData?.num_comments),
			viewCount: toSafeNumber(postData?.view_count),
			likeCount: score,
			aspectRatio,
		};
	}

	async function fetchRedditTopContentItems() {
		try {
			const redditProfileUrl = getRedditProfileUrlFromPage();
			const username = parseRedditUsernameFromUrl(redditProfileUrl);
			if (!username) return [];

			const endpoint = `https://www.reddit.com/user/${encodeURIComponent(username)}/submitted.json?limit=${REDDIT_FETCH_LIMIT}&sort=top&t=all&raw_json=1`;
			const response = await fetch(endpoint, {
				method: 'GET',
				headers: { accept: 'application/json' },
				cache: 'no-cache',
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
				method: 'GET',
				headers: { accept: 'application/json' },
				cache: 'no-cache',
			});
			if (!response.ok) return [];
			const payload = await response.json().catch(() => ({}));
			return Array.isArray(payload) ? payload : [];
		} catch (_err) {
			return [];
		}
	}

	function normalizeLocalSocialSourceItem(item) {
		return {
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
				aspectRatio: item?.aspectRatio,
			},
			metrics: {
				viewCount: item?.viewCount,
				likeCount: item?.likeCount,
				upvoteCount: item?.upvoteCount,
				commentCount: item?.commentCount,
			},
		};
	}

	async function fetchLocalSocialContentItems() {
		const [
			localShorts,
			localVideos,
			localXTopPosts,
			localInstagramPosts,
			localTikTokPosts,
			localFacebookPosts,
			localTwitchPosts,
		] = await Promise.all([
			fetchJsonArray(LOCAL_YOUTUBE_SHORTS_PATH),
			fetchJsonArray(LOCAL_YOUTUBE_VIDEOS_PATH),
			fetchJsonArray(LOCAL_X_TOP_POSTS_PATH),
			fetchJsonArray(LOCAL_INSTAGRAM_POSTS_PATH),
			fetchJsonArray(LOCAL_TIKTOK_POSTS_PATH),
			fetchJsonArray(LOCAL_FACEBOOK_POSTS_PATH),
			fetchJsonArray(LOCAL_TWITCH_POSTS_PATH),
		]);
		const mergedLocal = normalizeFeedItems(
			[
				...localShorts,
				...localVideos,
				...localXTopPosts,
				...localInstagramPosts,
				...localTikTokPosts,
				...localFacebookPosts,
				...localTwitchPosts,
			].map(normalizeLocalSocialSourceItem)
		);
		return mergedLocal;
	}

	function getCuratedShortScore(item) {
		const views = Math.max(0, Number(item?.viewCount || 0));
		const likes = Math.max(0, Number(item?.likeCount || 0));
		const publishedMs = Date.parse(item?.publishedAt || '');
		const ageDays = Number.isFinite(publishedMs)
			? Math.max(0, (Date.now() - publishedMs) / (1000 * 60 * 60 * 24))
			: 365;
		const recencyBoost = Math.max(0, 45 - ageDays) / 45;
		return Math.log10(views + 1) * 4 + Math.log10(likes + 1) * 6 + recencyBoost * 5;
	}

	function hasMinimumSocialEngagement(item) {
		const platform = normalizePlatformKey(item?.platform);
		const engagementCount =
			platform === 'reddit'
				? toSafeNumber(item?.upvoteCount || item?.likeCount)
				: toSafeNumber(item?.likeCount || item?.upvoteCount);
		return engagementCount >= MIN_SOCIAL_ENGAGEMENT;
	}

	function formatDate(dateInput) {
		if (!dateInput) return '';
		const date = new Date(dateInput);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	}

	function isShortFormVideo(item) {
		const contentType = String(item?.contentType || '').toLowerCase();
		if (contentType === 'short') return true;
		const combined = [item?.url, item?.embedUrl, item?.title, item?.caption]
			.map((value) => String(value || '').toLowerCase())
			.join(' ');
		return (
			combined.includes('/shorts/') ||
			combined.includes('#shorts') ||
			combined.includes('youtube shorts') ||
			combined.includes('shorts ')
		);
	}

	function getResolvedContentType(item) {
		const contentType = String(item?.contentType || '').toLowerCase();
		if (
			contentType === 'image' ||
			contentType === 'photo' ||
			contentType === 'gallery' ||
			contentType === 'post'
		) {
			return contentType;
		}
		if (contentType === 'short') return 'short';
		if (contentType === 'video') return 'video';
		if (isShortFormVideo(item)) return 'short';
		return 'video';
	}

	/** Pixel reference only for width/height ratio (iframe layout, not display size). */
	function getIframeReferenceDimensions(item, embed) {
		const cls = String(embed?.className || '').toLowerCase();
		const resolved = getResolvedContentType(item);
		const arNum = Number(item?.videoAspectRatio) || 0;
		const portrait = Number.isFinite(arNum) && arNum > 0 && arNum < 0.92;
		if (cls === 'tiktok') {
			return { w: 405, h: 720 };
		}
		if (cls === 'youtube') {
			if (resolved === 'short' || portrait) {
				return { w: 720, h: 1280 };
			}
			return { w: 1280, h: 720 };
		}
		if (portrait) {
			return { w: 720, h: 1280 };
		}
		return { w: 1280, h: 720 };
	}

	function fitIframeToBox(boxW, boxH, refW, refH) {
		const ar = refW / refH;
		let w = boxW;
		let h = w / ar;
		if (h > boxH) {
			h = boxH;
			w = h * ar;
		}
		return {
			w: Math.max(1, Math.floor(w)),
			h: Math.max(1, Math.floor(h)),
		};
	}

	function wireIframeResizeToSlot(playerWrap, iframe, item, embed) {
		const apply = () => {
			iframe.style.width = '100%';
			iframe.style.height = '100%';
		};
		playerWrap.__smcRefitIframe = apply;
		iframe.addEventListener('load', apply);
		window.requestAnimationFrame(apply);
	}

	function isLivestreamLikeContent(item) {
		const combined = [item?.url, item?.embedUrl, item?.title, item?.caption]
			.map((value) => String(value || '').toLowerCase())
			.join(' ');
		return (
			combined.includes(' livestream') ||
			combined.includes('live stream') ||
			combined.includes('/live/') ||
			combined.includes('youtube.com/live/') ||
			combined.includes('youtube shorts live stream')
		);
	}

	function getCardMetrics(item) {
		const normalizedPlatform = normalizePlatformKey(item?.platform);
		const views = toSafeNumber(item?.viewCount);
		const likes =
			normalizedPlatform === 'reddit'
				? toSafeNumber(item?.upvoteCount || item?.likeCount)
				: toSafeNumber(item?.likeCount || item?.upvoteCount);
		const comments = toSafeNumber(item?.commentCount);
		const contentType = getResolvedContentType(item);
		const isVideoLike = contentType === 'video' || contentType === 'short';
		const showCommentsInLabel = comments > 0;
		const label =
			normalizedPlatform === 'reddit'
				? showCommentsInLabel
					? `${likes.toLocaleString()} upvotes • ${comments.toLocaleString()} comments`
					: `${likes.toLocaleString()} upvotes`
				: showCommentsInLabel
					? `${views.toLocaleString()} views • ${likes.toLocaleString()} likes • ${comments.toLocaleString()} comments`
					: `${views.toLocaleString()} views • ${likes.toLocaleString()} likes`;
		return {
			viewCount: views,
			likeCount: likes,
			commentCount: comments,
			label,
		};
	}

	function normalizeHashtagToken(value) {
		return String(value || '')
			.toLowerCase()
			.trim()
			.replace(/^#/, '')
			.replace(/[^a-z0-9_]/g, '');
	}

	function extractHashtagsFromText(value) {
		const text = String(value || '');
		if (!text) return [];
		const tags = new Set();
		const pattern = /(^|\s)#([a-z0-9_]{2,40})\b/gi;
		let match;
		while ((match = pattern.exec(text))) {
			const normalized = normalizeHashtagToken(match[2]);
			if (normalized) tags.add(normalized);
		}
		return [...tags];
	}

	function getContentItemHashtags(item) {
		const tags = new Set();
		const sources = [item?.title, item?.caption, item?.description];
		for (const source of sources) {
			for (const tag of extractHashtagsFromText(source)) {
				tags.add(tag);
			}
		}
		return [...tags];
	}

	function toContentCard(item) {
		const meta = platformMeta[item.platform] || {};
		const contentTypeLabel = getResolvedContentType(item);
		const isShort = contentTypeLabel === 'short';
		const isVideoLike = contentTypeLabel === 'video' || contentTypeLabel === 'short';
		const videoAspectRatio = getVideoRatioForItem(item);
		const videoAspectValue =
			parseAspectRatioValue(videoAspectRatio) || (isShort ? 9 / 16 : 16 / 9);
		const publishedLabel = formatDate(item.publishedAt);
		const metrics = getCardMetrics(item);
		return {
			platform: meta.label || item.platform || 'Content',
			platformKey: String(item?.platform || '').toLowerCase(),
			type: isVideoLike ? 'video' : meta.type || 'social',
			contentType: contentTypeLabel,
			videoAspectRatio: videoAspectValue,
			videoAspectRatioCss: videoAspectRatio,
			title: item.title || 'Untitled content',
			blurb: item.caption || '',
			scoreLabel: metrics.label,
			url: item.url || '#',
			accent: meta.accent || '#69e3ff',
			thumbnail: item.thumbnail || '',
			embedUrl: item.embedUrl || '',
			mediaKind: String(item?.mediaKind || '').toLowerCase(),
			aspectRatio: String(item?.aspectRatio || '').trim(),
			publishedLabel,
			hashtags: getContentItemHashtags(item),
		};
	}

	function interleaveCardGroups(groups) {
		const queues = groups
			.map((group) => (Array.isArray(group) ? [...group] : []))
			.filter((group) => group.length);
		const mixed = [];
		let index = 0;

		while (queues.length) {
			const queue = queues[index % queues.length];
			const item = queue.shift();
			if (item) mixed.push(item);
			if (!queue.length) {
				queues.splice(index % queues.length, 1);
				if (!queues.length) break;
				index %= queues.length;
			} else {
				index = (index + 1) % queues.length;
			}
		}

		return mixed;
	}

	function getCardCatalog(contentItems) {
		const sourceItems = (contentItems || []).filter(hasMinimumSocialEngagement);
		const youtubeItems = sourceItems.filter((item) => {
			const platform = String(item?.platform || '').toLowerCase();
			if (platform !== 'youtube') return false;
			if (Boolean(item?.isLive)) return false;
			return !isLivestreamLikeContent(item);
		});
		const dedupedByVideoId = [];
		const seenVideoIds = new Set();
		for (const item of youtubeItems) {
			const videoId = getYouTubeVideoId(item?.url || item?.embedUrl || '');
			const dedupeKey = videoId || String(item?.url || item?.title || '');
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
				.filter((item) => String(item?.platform || '').toLowerCase() === platformKey)
				.filter((item) => {
					if (minUpvotes > 0 && toSafeNumber(item?.upvoteCount) < minUpvotes)
						return false;
					if (minLikes > 0 && toSafeNumber(item?.likeCount) < minLikes) return false;
					const dedupeKey = String(item?.url || item?.title || '');
					if (!dedupeKey || seen.has(dedupeKey)) return false;
					seen.add(dedupeKey);
					return true;
				})
				.sort((a, b) => {
					if (sortByUpvotes) {
						const upvoteDelta =
							toSafeNumber(b?.upvoteCount) - toSafeNumber(a?.upvoteCount);
						if (upvoteDelta !== 0) return upvoteDelta;
					}
					const likeDelta = toSafeNumber(b?.likeCount) - toSafeNumber(a?.likeCount);
					if (likeDelta !== 0) return likeDelta;
					const viewDelta = toSafeNumber(b?.viewCount) - toSafeNumber(a?.viewCount);
					if (viewDelta !== 0) return viewDelta;
					const commentDelta =
						toSafeNumber(b?.commentCount) - toSafeNumber(a?.commentCount);
					if (commentDelta !== 0) return commentDelta;
					return Date.parse(b?.publishedAt || 0) - Date.parse(a?.publishedAt || 0);
				})
				.map(toContentCard);
		}

		const xCards = toPlatformCards('x', { minLikes: X_MIN_LIKES });

		const redditCards = toPlatformCards('reddit', {
			minUpvotes: REDDIT_MIN_UPVOTES,
			sortByUpvotes: true,
		});

		const instagramCards = toPlatformCards('instagram');
		const tiktokCards = toPlatformCards('tiktok');
		const facebookCards = toPlatformCards('facebook');
		const twitchCards = toPlatformCards('twitch');

		return interleaveCardGroups([
			youtubeCards,
			xCards,
			instagramCards,
			redditCards,
			tiktokCards,
			facebookCards,
			twitchCards,
		]);
	}

	function getYouTubeVideoId(rawUrl) {
		if (!rawUrl) return '';
		try {
			const parsed = new URL(rawUrl);
			let videoId = '';
			if (parsed.hostname.includes('youtu.be')) {
				videoId = parsed.pathname.replace('/', '').trim();
			} else if (parsed.searchParams.get('v')) {
				videoId = parsed.searchParams.get('v').trim();
			} else if (parsed.pathname.includes('/shorts/')) {
				videoId = parsed.pathname.split('/shorts/')[1].split('/')[0].trim();
			} else if (parsed.pathname.includes('/embed/')) {
				videoId = parsed.pathname.split('/embed/')[1].split('/')[0].trim();
			}
			if (videoId) return videoId;
		} catch (_err) {
			// Fall through to relaxed parsing below.
		}
		const idMatch = String(rawUrl).match(
			/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{8,})/i
		);
		if (idMatch && idMatch[1]) return idMatch[1].trim();
		return '';
	}

	function getYouTubeEmbedUrl(rawUrl, options = {}) {
		const videoId = getYouTubeVideoId(rawUrl);
		if (videoId) {
			const origin =
				typeof window !== 'undefined' && window.location?.origin
					? `&origin=${encodeURIComponent(window.location.origin)}`
					: '';
			// enablejsapi=1 allows postMessage playVideo fallback after pin (Shorts / some clients).
			return `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1&enablejsapi=1${origin}`;
		}
		const handleMatch = rawUrl.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
		if (handleMatch && handleMatch[1]) {
			return `https://www.youtube.com/embed?listType=user_uploads&list=${encodeURIComponent(handleMatch[1])}&rel=0`;
		}
		return '';
	}

	function getTikTokEmbedUrl(rawUrl) {
		if (!rawUrl) return '';
		const idMatch = rawUrl.match(/\/video\/(\d+)/);
		if (idMatch && idMatch[1]) {
			return `https://www.tiktok.com/player/v1/${idMatch[1]}`;
		}
		const profileMatch = rawUrl.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i);
		if (profileMatch && profileMatch[1]) {
			return `https://www.tiktok.com/embed/@${profileMatch[1]}`;
		}
		return '';
	}

	function getEmbedConfig(item) {
		const platform = (item.platform || '').toLowerCase();
		if (platform === 'youtube') {
			const contentType = getResolvedContentType(item);
			const src = item.embedUrl || getYouTubeEmbedUrl(item.url, { contentType });
			if (!src) return null;
			return { kind: 'iframe', src, className: 'youtube' };
		}
		if (platform === 'tiktok') {
			const src = item.embedUrl || getTikTokEmbedUrl(item.url);
			if (!src) return null;
			return { kind: 'iframe', src, className: 'tiktok' };
		}
		if (platform === 'reddit') {
			const contentType = getResolvedContentType(item);
			if (contentType !== 'video') return null;
			let src = String(item.embedUrl || '').trim();
			if (!src) return null;
			if (isRedditNonNativeVideoStreamUrl(src)) {
				return null;
			}
			const isDirectVideo = isRedditProgressiveMp4Url(src);
			if (!isDirectVideo) return null;
			return { kind: 'video', src, className: 'reddit' };
		}
		if (platform === 'x') {
			const src = String(item.embedUrl || '').trim();
			const mediaKind = String(item.mediaKind || '').toLowerCase();
			if (!src || mediaKind !== 'video') return null;
			return { kind: 'video', src, className: 'x' };
		}
		return null;
	}

	function getAutoplayEmbedUrl(rawSrc) {
		if (!rawSrc) return '';
		try {
			const parsed = new URL(rawSrc, window.location.origin);
			parsed.searchParams.set('autoplay', '1');
			parsed.searchParams.set('playsinline', '1');
			parsed.searchParams.set('loop', '1');
			const host = parsed.hostname.toLowerCase();
			if (host.includes('youtube.com') || host.includes('youtu.be')) {
				// Muted autoplay satisfies browser policies so the Short actually starts in the card.
				parsed.searchParams.set('mute', '1');
				parsed.searchParams.set('enablejsapi', '1');
				if (typeof window !== 'undefined' && window.location?.origin) {
					parsed.searchParams.set('origin', window.location.origin);
				}
				const videoId = getYouTubeVideoId(parsed.toString());
				if (videoId) {
					parsed.searchParams.set('playlist', videoId);
				}
			}
			if (host.includes('tiktok.com')) {
				parsed.searchParams.set('autoplay', '1');
				parsed.searchParams.set('muted', '1');
			}
			return parsed.toString();
		} catch (_err) {
			const hasQuery = rawSrc.includes('?');
			const autoplayParam = 'autoplay=1&playsinline=1&loop=1';
			return `${rawSrc}${hasQuery ? '&' : '?'}${autoplayParam}`;
		}
	}

	function cueYouTubeIframePlay(iframeEl) {
		if (!(iframeEl instanceof HTMLIFrameElement)) return;
		const send = () => {
			try {
				iframeEl.contentWindow?.postMessage(
					JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
					'*'
				);
			} catch (_err) {
				// Ignore cross-origin postMessage failures.
			}
		};
		send();
		window.setTimeout(send, 120);
		window.setTimeout(send, 450);
	}

	function upgradeIframeToAutoplay(iframeEl, embedSrc) {
		if (!(iframeEl instanceof HTMLIFrameElement) || !embedSrc) return;
		const nextSrc = getAutoplayEmbedUrl(embedSrc);
		if (!nextSrc) return;
		const current = String(iframeEl.getAttribute('src') || iframeEl.src || '');
		let host = '';
		try {
			host = new URL(embedSrc, window.location.origin).hostname.toLowerCase();
		} catch (_e) {
			host = '';
		}
		const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');
		if (current === nextSrc) {
			if (isYouTube) cueYouTubeIframePlay(iframeEl);
			return;
		}
		if (isYouTube) {
			iframeEl.addEventListener(
				'load',
				() => {
					cueYouTubeIframePlay(iframeEl);
				},
				{ once: true }
			);
		}
		iframeEl.loading = 'eager';
		iframeEl.src = nextSrc;
		const playerWrap = iframeEl.closest('.smc-player');
		if (playerWrap && typeof playerWrap.__smcRefitIframe === 'function') {
			window.requestAnimationFrame(() => playerWrap.__smcRefitIframe());
		}
	}

	function startInlineVideoPlayback(videoEl) {
		if (!(videoEl instanceof HTMLVideoElement)) return;
		videoEl.muted = true;
		videoEl.defaultMuted = true;
		videoEl.setAttribute('muted', '');
		videoEl.playsInline = true;
		const tryPlay = () => {
			const p = videoEl.play();
			if (p && typeof p.catch === 'function') {
				p.catch(() => {});
			}
		};
		videoEl.addEventListener('loadeddata', tryPlay, { once: true });
		window.setTimeout(tryPlay, 0);
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function normalizeAngleDelta(deg) {
		let next = deg;
		while (next > 180) next -= 360;
		while (next < -180) next += 360;
		return next;
	}

	function isBlockedSocialContentItem(item) {
		const haystack = [
			item?.title,
			item?.blurb,
			item?.caption,
			item?.url,
			item?.thumbnail,
			item?.embedUrl,
		]
			.map((value) => String(value || '').toLowerCase())
			.join(' ');
		return (
			haystack.includes('harman kardon') ||
			haystack.includes('harmon kardon') ||
			haystack.includes('harman/kardon') ||
			haystack.includes('harmon/kardon') ||
			haystack.includes('harman-kardon') ||
			haystack.includes('harmon-kardon') ||
			haystack.includes('go + play 3') ||
			haystack.includes('go+play 3')
		);
	}

	function getEnabledCatalog(contentItems) {
		const cardCatalog = getCardCatalog(contentItems || []);
		const enabledTypes = new Set(
			config.enabledNoteTypes.map((value) => String(value || '').toLowerCase())
		);
		const preferredYoutubeTypes = new Set(
			config.preferredYouTubeContentTypes.map((value) => String(value || '').toLowerCase())
		);
		const enabled = cardCatalog.filter((item) => {
			if (isBlockedSocialContentItem(item)) return false;
			if (!enabledTypes.has(String(item?.type || '').toLowerCase())) return false;
			if (String(item?.platform || '').toLowerCase() !== 'youtube') return true;
			if (!preferredYoutubeTypes.size) return true;
			return preferredYoutubeTypes.has(String(item?.contentType || '').toLowerCase());
		});
		const activeTag = normalizeHashtagToken(selectedHashtagFilter);
		if (!activeTag) return enabled;
		return enabled.filter((item) => {
			if (String(item?.type || '').toLowerCase() !== 'video') return false;
			const hashtags = Array.isArray(item?.hashtags) ? item.hashtags : [];
			return hashtags.includes(activeTag);
		});
	}

	function getHashtagFilterCounts(contentItems) {
		const counts = new Map();
		for (const item of getCardCatalog(contentItems || [])) {
			if (String(item?.type || '').toLowerCase() !== 'video') continue;
			const hashtags = Array.isArray(item?.hashtags) ? item.hashtags : [];
			for (const tag of hashtags) {
				const normalized = normalizeHashtagToken(tag);
				if (!normalized) continue;
				counts.set(normalized, (counts.get(normalized) || 0) + 1);
			}
		}
		return [...counts.entries()].sort((a, b) => {
			const countDelta = b[1] - a[1];
			if (countDelta !== 0) return countDelta;
			return a[0].localeCompare(b[0]);
		});
	}

	function renderHashtagFilterBar(contentItems) {
		if (!hashtagFilterBar) return;
		hashtagFilterBar.textContent = '';
		const hashtags = getHashtagFilterCounts(contentItems);
		if (!hashtags.length) {
			hasAvailableHashtagFilters = false;
			showHashtagFilterBar = false;
			hashtagFilterBar.hidden = true;
			selectedHashtagFilter = '';
			if (filterToggleButton) {
				filterToggleButton.hidden = true;
				filterToggleButton.disabled = true;
				filterToggleButton.setAttribute('aria-pressed', 'false');
				filterToggleButton.classList.remove('is-active');
			}
			return;
		}
		hasAvailableHashtagFilters = true;
		const availableTags = new Set(hashtags.map(([tag]) => tag));
		if (selectedHashtagFilter && !availableTags.has(selectedHashtagFilter)) {
			selectedHashtagFilter = '';
		}
		const leftArrow = document.createElement('button');
		leftArrow.type = 'button';
		leftArrow.className = 'smc-filter-arrow smc-filter-arrow-left';
		leftArrow.setAttribute('aria-label', 'Scroll hashtag filters left');
		leftArrow.textContent = '‹';

		const rightArrow = document.createElement('button');
		rightArrow.type = 'button';
		rightArrow.className = 'smc-filter-arrow smc-filter-arrow-right';
		rightArrow.setAttribute('aria-label', 'Scroll hashtag filters right');
		rightArrow.textContent = '›';

		const track = document.createElement('div');
		track.className = 'smc-filter-track';
		track.setAttribute('role', 'group');
		track.setAttribute('aria-label', 'Hashtag filter scroller');

		const chipsRow = document.createElement('div');
		chipsRow.className = 'smc-filter-chips';

		const allChip = document.createElement('button');
		allChip.type = 'button';
		allChip.className = `smc-filter-chip ${selectedHashtagFilter ? '' : 'is-active'}`.trim();
		allChip.textContent = 'All videos';
		allChip.addEventListener('click', () => {
			if (!selectedHashtagFilter) return;
			selectedHashtagFilter = '';
			rebuildCloud(activeContentItems);
		});
		chipsRow.appendChild(allChip);
		for (const [tag, count] of hashtags) {
			const chip = document.createElement('button');
			chip.type = 'button';
			chip.className = `smc-filter-chip ${selectedHashtagFilter === tag ? 'is-active' : ''}`.trim();
			chip.textContent = `#${tag} (${count})`;
			chip.addEventListener('click', () => {
				if (selectedHashtagFilter === tag) return;
				selectedHashtagFilter = tag;
				rebuildCloud(activeContentItems);
			});
			chipsRow.appendChild(chip);
		}
		track.appendChild(chipsRow);
		hashtagFilterBar.appendChild(leftArrow);
		hashtagFilterBar.appendChild(track);
		hashtagFilterBar.appendChild(rightArrow);

		const scrollByAmount = () => Math.max(180, Math.round(track.clientWidth * 0.65));
		leftArrow.addEventListener('click', () => {
			track.scrollBy({ left: -scrollByAmount(), behavior: 'smooth' });
		});
		rightArrow.addEventListener('click', () => {
			track.scrollBy({ left: scrollByAmount(), behavior: 'smooth' });
		});

		track.addEventListener(
			'wheel',
			(event) => {
				const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
				if (!delta) return;
				event.preventDefault();
				track.scrollBy({ left: delta, behavior: 'auto' });
			},
			{ passive: false }
		);

		let dragPointerId = null;
		let dragStartX = 0;
		let dragStartScrollLeft = 0;
		track.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) return;
			dragPointerId = event.pointerId;
			dragStartX = event.clientX;
			dragStartScrollLeft = track.scrollLeft;
			track.classList.add('is-dragging');
			track.setPointerCapture(event.pointerId);
		});
		track.addEventListener('pointermove', (event) => {
			if (dragPointerId !== event.pointerId) return;
			const deltaX = event.clientX - dragStartX;
			track.scrollLeft = dragStartScrollLeft - deltaX;
		});
		const endDrag = (event) => {
			if (dragPointerId !== event.pointerId) return;
			if (track.hasPointerCapture(event.pointerId)) {
				track.releasePointerCapture(event.pointerId);
			}
			dragPointerId = null;
			track.classList.remove('is-dragging');
		};
		track.addEventListener('pointerup', endDrag);
		track.addEventListener('pointercancel', endDrag);

		hashtagFilterBar.hidden = !showHashtagFilterBar;
		if (filterToggleButton) {
			filterToggleButton.hidden = false;
			filterToggleButton.disabled = false;
			filterToggleButton.setAttribute('aria-pressed', showHashtagFilterBar ? 'true' : 'false');
			filterToggleButton.classList.toggle('is-active', showHashtagFilterBar);
		}
	}

	function createPlayerElement(embed, item, autoplay = false) {
		if (!embed?.src) return null;
		const playerWrap = document.createElement('span');
		playerWrap.className = `smc-player ${embed.className || ''}`.trim();
		if (embed.kind === 'video') {
			const video = document.createElement('video');
			video.src = embed.src;
			video.controls = true;
			video.preload = autoplay ? 'auto' : 'metadata';
			video.playsInline = true;
			if (autoplay) {
				video.autoplay = true;
				video.muted = true;
				video.defaultMuted = true;
				video.setAttribute('muted', '');
				const startPlayback = () => {
					const playPromise = video.play();
					if (playPromise && typeof playPromise.catch === 'function') {
						playPromise.catch(() => {
							// Ignore autoplay rejection; user can press play.
						});
					}
				};
				video.addEventListener('loadeddata', startPlayback, { once: true });
				window.setTimeout(startPlayback, 0);
			}
			video.title = `${item?.platform || 'Social'} video: ${item?.title || 'Untitled content'}`;
			playerWrap.appendChild(video);
			return playerWrap;
		}

		const iframe = document.createElement('iframe');
		iframe.src = autoplay ? getAutoplayEmbedUrl(embed.src) : embed.src;
		// Lazy iframes often never start until scroll; pinned autoplay must load immediately.
		iframe.loading = autoplay ? 'eager' : 'lazy';
		iframe.allowFullscreen = true;
		iframe.referrerPolicy = 'strict-origin-when-cross-origin';
		iframe.title = `${item?.platform || 'Social'} player: ${item?.title || 'Untitled content'}`;
		iframe.allow = 'autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share';
		if (autoplay) {
			const host = (() => {
				try {
					return new URL(embed.src, window.location.origin).hostname.toLowerCase();
				} catch (_e) {
					return '';
				}
			})();
			if (host.includes('youtube.com') || host.includes('youtu.be')) {
				iframe.addEventListener(
					'load',
					() => {
						cueYouTubeIframePlay(iframe);
					},
					{ once: true }
				);
			}
		}
		const iframeShell = document.createElement('span');
		iframeShell.className = 'smc-player-iframe-shell';
		iframeShell.appendChild(iframe);
		playerWrap.appendChild(iframeShell);
		wireIframeResizeToSlot(playerWrap, iframe, item, embed);
		return playerWrap;
	}

	let enabledCatalog = [];
	let catalogCursor = 0;
	let activeContentItems = manualSocialContentItems;
	let selectedHashtagFilter = '';
	let showHashtagFilterBar = false;
	let hasAvailableHashtagFilters = false;
	let filterToggleButton = null;
	let cardCount = window.innerWidth < 780 ? config.cardCountMobile : config.cardCountDesktop;
	const states = [];
	const elementStateMap = new WeakMap();
	let rafId = 0;
	let lastFrame = performance.now();
	let cloudWidth = 0;
	let cloudHeight = 0;
	let pageHeaderHeight = 0;
	let pageFooterHeight = 0;
	let topCardLayer = 12;
	let ambientLayer = null;
	let pinnedLayer = null;
	let ambientIntervalId = 0;
	let ambientTickRaf = 0;
	const socialCardSpinControllers = [];
	let idleSpinActive = false;
	let idleSpinTimerId = 0;
	let currentAmbientColors = [
		[34, 78, 58],
		[118, 76, 44],
		[28, 42, 74],
	];
	let currentAmbientGreen = [20, 72, 42];
	const DARK_GREEN_TARGET = [20, 72, 42];

	function mountAmbientLayer() {
		if (ambientLayer && ambientLayer.isConnected) return;
		ambientLayer = document.createElement('div');
		ambientLayer.className = 'smc-ambient-layer';
		const parent = cloud.parentElement || document.body;
		parent.insertBefore(ambientLayer, cloud);
	}

	function mountPinnedLayer() {
		if (pinnedLayer && pinnedLayer.isConnected) return;
		pinnedLayer = document.createElement('div');
		pinnedLayer.className = 'smc-pinned-layer';
		document.body.appendChild(pinnedLayer);
	}

	function stopIdleSpinForAllCards() {
		idleSpinActive = false;
		for (let i = 0; i < socialCardSpinControllers.length; i += 1) {
			const controls = socialCardSpinControllers[i];
			if (!controls || typeof controls.stop !== 'function') continue;
			controls.stop();
		}
	}

	function startIdleSpinForAllCards() {
		if (prefersReducedMotion || idleSpinActive) return;
		idleSpinActive = true;
		for (let i = 0; i < socialCardSpinControllers.length; i += 1) {
			const controls = socialCardSpinControllers[i];
			if (!controls || typeof controls.start !== 'function') continue;
			controls.start();
		}
	}

	function clearIdleSpinTimer() {
		if (!idleSpinTimerId) return;
		window.clearTimeout(idleSpinTimerId);
		idleSpinTimerId = 0;
	}

	function scheduleIdleSpinTimer() {
		clearIdleSpinTimer();
		idleSpinTimerId = window.setTimeout(() => {
			idleSpinTimerId = 0;
			startIdleSpinForAllCards();
		}, SOCIAL_CARD_IDLE_SPIN_MS);
	}

	function handleIdleSpinInterrupt() {
		stopIdleSpinForAllCards();
		scheduleIdleSpinTimer();
	}

	function bindIdleSpinInteractionWatchers() {
		const options = { passive: true };
		window.addEventListener('pointerdown', handleIdleSpinInterrupt, options);
		window.addEventListener('pointermove', handleIdleSpinInterrupt, options);
		window.addEventListener('keydown', handleIdleSpinInterrupt);
		window.addEventListener('wheel', handleIdleSpinInterrupt, options);
		window.addEventListener('touchstart', handleIdleSpinInterrupt, options);
		window.addEventListener(
			'visibilitychange',
			() => {
				if (document.visibilityState !== 'visible') {
					clearIdleSpinTimer();
					stopIdleSpinForAllCards();
					return;
				}
				handleIdleSpinInterrupt();
			},
			options
		);
		scheduleIdleSpinTimer();
	}

	function parseCssColor(value) {
		const input = String(value || '').trim();
		if (!input) return null;
		const rgbMatch = input.match(/rgba?\(([^)]+)\)/i);
		if (rgbMatch && rgbMatch[1]) {
			const parts = rgbMatch[1].split(',').map((part) => Number.parseFloat(part.trim()));
			if (parts.length >= 3) {
				const alpha = Number.isFinite(parts[3]) ? parts[3] : 1;
				return [
					clamp(parts[0], 0, 255),
					clamp(parts[1], 0, 255),
					clamp(parts[2], 0, 255),
					clamp(alpha, 0, 1),
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
				1,
			];
		}
		if (hex.length === 6 || hex.length === 8) {
			return [
				Number.parseInt(hex.slice(0, 2), 16),
				Number.parseInt(hex.slice(2, 4), 16),
				Number.parseInt(hex.slice(4, 6), 16),
				hex.length === 8 ? clamp(Number.parseInt(hex.slice(6, 8), 16) / 255, 0, 1) : 1,
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
		return Boolean(node.closest('.smc-ambient-layer') || node === cloud);
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
					weight: (1.1 - depth * 0.16) * background[3] * (0.4 + backgroundSat * 1.1),
				});
			}
			const border = parseCssColor(style.borderColor);
			if (border && border[3] > 0.06) {
				const borderSat = getColorSaturation(border);
				weighted.push({
					color: [border[0], border[1], border[2]],
					weight: (0.52 - depth * 0.08) * border[3] * (0.36 + borderSat * 1.2),
				});
			}
			const text = parseCssColor(style.color);
			if (text && text[3] > 0.15) {
				const textSat = getColorSaturation(text);
				weighted.push({
					color: [text[0], text[1], text[2]],
					weight: (0.16 - depth * 0.02) * text[3] * (0.2 + textSat * 0.8),
				});
			}
			const accent = parseCssColor(style.getPropertyValue('--smc-accent'));
			if (accent) {
				weighted.push({
					color: [accent[0], accent[1], accent[2]],
					weight: 0.95 - depth * 0.14,
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
			const accent = parseCssColor(String(state.item.accent || ''));
			if (!accent) continue;
			const visibleWidth = Math.max(
				0,
				Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
			);
			const visibleHeight = Math.max(
				0,
				Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
			);
			const areaWeight = clamp((visibleWidth * visibleHeight) / 36000, 0.18, 2.2);
			weighted.push({
				color: [accent[0], accent[1], accent[2]],
				weight: 0.9 * areaWeight,
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
				const x = Math.round(marginX + (width - marginX * 2) * ((col + 0.5) / cols));
				const y = Math.round(marginY + (height - marginY * 2) * ((row + 0.5) / rows));
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
		const blended = ranked.reduce(
			(acc, entry) => {
				const w = Math.max(0, entry.weight) / totalWeight;
				acc[0] += entry.color[0] * w;
				acc[1] += entry.color[1] * w;
				acc[2] += entry.color[2] * w;
				return acc;
			},
			[0, 0, 0]
		);

		const first = ranked[0].color;
		const second = ranked.find((entry) => colorDistance(entry.color, first) > 46)?.color || [
			blended[0] * 0.95,
			blended[1] * 1.02,
			blended[2] * 1.05,
		];
		const third = ranked.find(
			(entry) =>
				colorDistance(entry.color, first) > 40 && colorDistance(entry.color, second) > 34
		)?.color || [blended[0] * 0.82, blended[1] * 0.9, blended[2] * 1.08];

		const greenBias = useLightMode ? 0.24 : 0.32;
		const boosted = [first, second, third].map((color, index) => {
			const strength = index === 2 ? greenBias + 0.2 : greenBias;
			return [
				color[0] * (1 - strength) + DARK_GREEN_TARGET[0] * strength,
				color[1] * (1 - strength) + DARK_GREEN_TARGET[1] * strength,
				color[2] * (1 - strength) + DARK_GREEN_TARGET[2] * strength,
			];
		});

		return boosted.map((color) => [
			clamp(color[0], 10, 236),
			clamp(color[1], 20, 236),
			clamp(color[2], 10, 236),
		]);
	}

	function applyAmbientPalette(palette) {
		if (!(document.body instanceof HTMLElement)) return;
		const ease = useLightMode ? 0.3 : 0.4;
		currentAmbientColors = currentAmbientColors.map((prev, index) => {
			const next = palette[index] || prev;
			return [
				prev[0] + (next[0] - prev[0]) * ease,
				prev[1] + (next[1] - prev[1]) * ease,
				prev[2] + (next[2] - prev[2]) * ease,
			];
		});
		const blendedPalette = currentAmbientColors
			.reduce(
				(acc, color) => {
					acc[0] += color[0];
					acc[1] += color[1];
					acc[2] += color[2];
					return acc;
				},
				[0, 0, 0]
			)
			.map((channel) => channel / Math.max(1, currentAmbientColors.length));
		const greenEase = useLightMode ? 0.22 : 0.3;
		const targetGreen = [
			blendedPalette[0] * 0.3 + DARK_GREEN_TARGET[0] * 0.7,
			blendedPalette[1] * 0.36 + DARK_GREEN_TARGET[1] * 0.64,
			blendedPalette[2] * 0.24 + DARK_GREEN_TARGET[2] * 0.76,
		];
		currentAmbientGreen = [
			currentAmbientGreen[0] + (targetGreen[0] - currentAmbientGreen[0]) * greenEase,
			currentAmbientGreen[1] + (targetGreen[1] - currentAmbientGreen[1]) * greenEase,
			currentAmbientGreen[2] + (targetGreen[2] - currentAmbientGreen[2]) * greenEase,
		];

		const strength = useLightMode ? 0.34 : 0.5;
		document.body.style.setProperty(
			'--smc-ambient-1',
			toCssRgbTriplet(currentAmbientColors[0])
		);
		document.body.style.setProperty(
			'--smc-ambient-2',
			toCssRgbTriplet(currentAmbientColors[1])
		);
		document.body.style.setProperty(
			'--smc-ambient-3',
			toCssRgbTriplet(currentAmbientColors[2])
		);
		document.body.style.setProperty(
			'--smc-ambient-green',
			toCssRgbTriplet(currentAmbientGreen)
		);
		document.body.style.setProperty('--smc-ambient-strength', String(strength));
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
			if (document.visibilityState !== 'visible') return;
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
		const targetCount =
			window.innerWidth < 780 ? config.cardCountMobile : config.cardCountDesktop;
		cardCount = Math.min(enabledCatalog.length || targetCount, targetCount);
	}

	function getCardWidth() {
		return window.innerWidth < 780 ? 176 + Math.random() * 28 : 198 + Math.random() * 34;
	}

	function getLaneY(index, laneCount) {
		const lane = index % laneCount;
		const top = getVisibleTop();
		const bottom = getVisibleBottom();
		const laneHeight = Math.max(120, (bottom - top) / laneCount);
		return clamp(
			top + lane * laneHeight + Math.random() * Math.max(0, laneHeight - 120),
			top,
			Math.max(top, bottom - 140)
		);
	}

	function getInitialX(index, width) {
		const maxX = Math.max(8, cloudWidth - width - 8);
		const spread = (index + 0.3) / Math.max(1, cardCount);
		return clamp(spread * maxX, 8, maxX);
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
		const safeWidth = Number(width) || getCardWidth();
		return clamp(8, 8, Math.max(8, cloudWidth - safeWidth - 8));
	}

	function isInteractiveCardTarget(target) {
		if (!(target instanceof Element)) return false;
		if (
			target.closest(
				'.smc-resize-handle, .smc-desc-toggle, iframe, .smc-inline-link'
			)
		) {
			return true;
		}
		const tag = target.tagName.toUpperCase();
		return (
			tag === 'A' ||
			tag === 'BUTTON' ||
			tag === 'INPUT' ||
			tag === 'TEXTAREA' ||
			tag === 'SELECT'
		);
	}

	function updatePageHeightBudget() {
		const header = document.querySelector('shared-header');
		const footer = document.querySelector('shared-footer');
		const headerHeight = header ? Math.round(header.getBoundingClientRect().height) : 0;
		const footerHeight = footer ? Math.round(footer.getBoundingClientRect().height) : 0;
		pageHeaderHeight = headerHeight;
		pageFooterHeight = footerHeight;
		document.body.style.setProperty('--smc-header-h', `${headerHeight}px`);
		document.body.style.setProperty('--smc-footer-h', `${footerHeight}px`);
	}

	function getVisibleTop() {
		return Math.max(8, pageHeaderHeight + 8);
	}

	function getVisibleBottom() {
		return Math.max(getVisibleTop() + 120, cloudHeight - pageFooterHeight - 8);
	}

	/** Pinned drag/resize: use full cloud height so fixed header/footer do not cap geometry. */
	function getPinnedCardMinY() {
		return 8;
	}

	function getPinnedCardMaxBottom() {
		return Math.max(getPinnedCardMinY() + 1, cloudHeight - 8);
	}

	function getStateWidth(state) {
		return state?.el?.offsetWidth || state?.width || getCardWidth();
	}

	function getStateHeight(state) {
		return state?.el?.offsetHeight || 140;
	}

	function clampStateToVisibleArea(state) {
		if (!state?.el || state.isPinned) return;
		state.width = getStateWidth(state);
		const cardHeight = getStateHeight(state);
		const maxX = Math.max(8, cloudWidth - state.width - 8);
		const minY = getVisibleTop();
		const maxY = Math.max(minY, getVisibleBottom() - cardHeight);
		state.x = clamp(state.x, 8, maxX);
		state.y = clamp(state.y, minY, maxY);
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
			rotate: -5 + Math.random() * 10,
		};
	}

	function buildMetaMarqueeRoot(kind) {
		const root = document.createElement('span');
		root.className = `smc-meta-line-marquee smc-meta-line-marquee--${kind}`;
		const track = document.createElement('span');
		track.className = 'smc-meta-line-track';
		const text = document.createElement('span');
		text.className =
			kind === 'date' ? 'smc-meta-line-text smc-date' : 'smc-meta-line-text smc-stats';
		const clone = document.createElement('span');
		clone.className = `${text.className} smc-meta-line-text-clone`;
		clone.setAttribute('aria-hidden', 'true');
		track.appendChild(text);
		track.appendChild(clone);
		root.appendChild(track);
		return { root, text, clone };
	}

	function refreshMetaMarquee(root) {
		if (!(root instanceof HTMLElement)) return;
		const text = root.querySelector('.smc-meta-line-text:not(.smc-meta-line-text-clone)');
		const clone = root.querySelector('.smc-meta-line-text-clone');
		if (!text || !clone) return;
		const isStatsLine = root.classList.contains('smc-meta-line-marquee--stats');
		clone.textContent = isStatsLine ? '' : text.textContent;
		if (!root.dataset.wheelScrollBound) {
			root.addEventListener(
				'wheel',
				(event) => {
					if (!root.classList.contains('is-overflow')) return;
					const delta =
						Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
					if (!delta) return;
					event.preventDefault();
					root.scrollBy({ left: delta, behavior: 'auto' });
				},
				{ passive: false }
			);
			root.dataset.wheelScrollBound = '1';
		}
		window.requestAnimationFrame(() => {
			const room = root.clientWidth;
			const need = text.scrollWidth;
			const overflow = room > 0 && need > room + 0.5;
			root.classList.toggle('is-overflow', overflow);
			if (isStatsLine && !overflow) {
				root.scrollLeft = 0;
			}
			const gap = 20;
			const duration = isStatsLine ? '0s' : overflow ? `${7 + Math.min(14, need / 55)}s` : '0s';
			root.style.setProperty('--smc-scroll-duration', duration);
			root.style.setProperty('--smc-scroll-distance', overflow ? `${need + gap}px` : '0px');
		});
	}

	function wireTitleMarqueeHeading(heading) {
		const root = document.createElement('span');
		root.className = 'smc-title-marquee';
		const track = document.createElement('span');
		track.className = 'smc-title-track';
		const text = document.createElement('span');
		text.className = 'smc-title-text';
		const clone = document.createElement('span');
		clone.className = 'smc-title-text-clone';
		clone.setAttribute('aria-hidden', 'true');
		track.appendChild(text);
		track.appendChild(clone);
		root.appendChild(track);
		heading.appendChild(root);
	}

	function refreshTitleMarquee(root) {
		if (!(root instanceof HTMLElement) || !root.isConnected) return;
		const text = root.querySelector('.smc-title-text');
		const clone = root.querySelector('.smc-title-text-clone');
		if (!text || !clone) return;
		if (!root.dataset.wheelScrollBound) {
			root.addEventListener(
				'wheel',
				(event) => {
					if (!root.classList.contains('is-overflow')) return;
					const delta =
						Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
					if (!delta) return;
					event.preventDefault();
					root.scrollBy({ left: delta, behavior: 'auto' });
				},
				{ passive: false }
			);
			root.dataset.wheelScrollBound = '1';
		}
		const heading = root.closest('.smc-title');
		if (heading instanceof HTMLElement && heading.hidden) {
			clone.textContent = '';
			root.classList.remove('is-overflow');
			root.style.setProperty('--smc-scroll-duration', '0s');
			root.style.setProperty('--smc-scroll-distance', '0px');
			return;
		}
		clone.textContent = text.textContent;
		window.requestAnimationFrame(() => {
			const room = root.clientWidth;
			const need = text.scrollWidth;
			const overflow = room > 0 && need > room + 0.5;
			root.classList.toggle('is-overflow', overflow);
			const gap = 20;
			const duration = overflow ? `${7 + Math.min(14, need / 55)}s` : '0s';
			root.style.setProperty('--smc-scroll-duration', duration);
			root.style.setProperty('--smc-scroll-distance', overflow ? `${need + gap}px` : '0px');
		});
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
			const card = document.createElement('article');
			card.className = 'smc-card';
			card.setAttribute('role', 'listitem');
			card.tabIndex = 0;
			const cardEmbed = getEmbedConfig(item);

			const metaRow = document.createElement('div');
			metaRow.className = 'smc-meta-row';
			const dateMarquee = buildMetaMarqueeRoot('date');
			const metaDateWrap = dateMarquee.root;
			const metaDate = dateMarquee.text;
			metaDateWrap.hidden = true;
			const metaTrail = document.createElement('div');
			metaTrail.className = 'smc-meta-trail';
			const metaTextStack = document.createElement('div');
			metaTextStack.className = 'smc-meta-text';
			const detailsWrap = document.createElement('div');
			detailsWrap.className = 'smc-details';
			const titleHeading = document.createElement('h3');
			titleHeading.className = 'smc-title';
			wireTitleMarqueeHeading(titleHeading);
			const titleMarqueeRoot = titleHeading.querySelector('.smc-title-marquee');
			const titleTextEl = titleHeading.querySelector('.smc-title-text');
			const blurbText = document.createElement('p');
			blurbText.className = 'smc-blurb';
			const statsMarquee = buildMetaMarqueeRoot('stats');
			const statsRowWrap = statsMarquee.root;
			const statsRow = statsMarquee.text;
			const metaByline = document.createElement('div');
			metaByline.className = 'smc-meta-byline';
			const metaBylineSep = document.createElement('span');
			metaBylineSep.className = 'smc-meta-byline-sep';
			metaBylineSep.setAttribute('aria-hidden', 'true');
			metaBylineSep.textContent = '·';
			metaByline.appendChild(metaDateWrap);
			metaByline.appendChild(metaBylineSep);
			metaByline.appendChild(statsRowWrap);
			const mediaSlot = document.createElement('div');
			mediaSlot.className = 'smc-media-slot';
			const topChrome = document.createElement('div');
			topChrome.className = 'smc-top-chrome';
			const bottomChrome = document.createElement('div');
			bottomChrome.className = 'smc-bottom-chrome';
			const openPostLink = document.createElement('a');
			openPostLink.className = 'smc-bottom-action smc-open-post-link';
			openPostLink.target = '_blank';
			openPostLink.rel = 'noopener noreferrer';
			openPostLink.textContent = 'Link';
			const openChannelLink = document.createElement('a');
			openChannelLink.className = 'smc-bottom-action smc-open-channel-link';
			openChannelLink.target = '_blank';
			openChannelLink.rel = 'noopener noreferrer';
			openChannelLink.setAttribute('aria-label', 'Go to channel');
			const openChannelAvatar = document.createElement('img');
			openChannelAvatar.className = 'smc-channel-avatar';
			openChannelAvatar.alt = '';
			openChannelAvatar.loading = 'lazy';
			openChannelAvatar.decoding = 'async';
			openChannelAvatar.src = youtubeProfileAvatarUrl;
			openChannelLink.appendChild(openChannelAvatar);
			bottomChrome.appendChild(openPostLink);
			bottomChrome.appendChild(openChannelLink);
			const syncVisitedActionState = () => {
				openPostLink.classList.toggle('is-visited', isLinkVisited(openPostLink.href));
				openChannelLink.classList.toggle('is-visited', isLinkVisited(openChannelLink.href));
			};
			[openPostLink, openChannelLink].forEach((actionLink) => {
				actionLink.addEventListener('click', () => {
					if (!isHttpUrl(actionLink.href)) return;
					markLinkVisited(actionLink.href);
					syncVisitedActionState();
				});
			});
			metaTextStack.appendChild(metaByline);
			metaTextStack.appendChild(titleHeading);
			metaTrail.appendChild(metaTextStack);
			metaRow.appendChild(metaTrail);
			detailsWrap.appendChild(blurbText);
			topChrome.appendChild(metaRow);
			topChrome.appendChild(detailsWrap);
			card.appendChild(topChrome);
			card.appendChild(mediaSlot);
			const pinStripButton = document.createElement('button');
			pinStripButton.type = 'button';
			pinStripButton.className = 'smc-pin-strip';
			pinStripButton.setAttribute('aria-label', 'Pin this card');
			card.appendChild(pinStripButton);
			card.appendChild(bottomChrome);

			const openLink = document.createElement('span');
			openLink.className = 'smc-open-hint';
			openLink.textContent = 'Click card to load video and pause movement';
			card.appendChild(openLink);

			fragment.appendChild(card);
			const state = spawnState(card, i, true);
			state.item = item;
			state.isPinned = false;
			state.playerWrap = null;
			state.inlinePlayerWrap = null;
			state.embed = cardEmbed;

			function syncPinnedChrome() {
				const pinned = card.classList.contains('is-active');
				if (!pinned) {
					card.classList.remove('smc-desc-visible');
				}
				pinStripButton.setAttribute(
					'aria-label',
					pinned ? 'Unpin this card' : 'Pin this card'
				);
			}

			const setItemOnCard = (nextItem) => {
				if (!nextItem) return;
				stopCardFidgetSpin();
				state.item = nextItem;
				card.classList.remove('is-short');
				card.classList.remove('smc-video-card');
				card.classList.remove('smc-reddit-card');
				card.classList.remove('smc-x-card');
				card.classList.remove('smc-image-card');
				card.classList.remove('smc-ratio-portrait');
				card.classList.remove('smc-ratio-square');
				card.classList.remove('smc-ratio-landscape');
				card.classList.remove('has-active-player');
				card.setAttribute('data-type', nextItem.type);
				card.setAttribute(
					'data-platform',
					normalizePlatformKey(nextItem.platformKey || nextItem.platform)
				);
				card.setAttribute(
					'aria-label',
					`${nextItem.platform}: ${nextItem.title}${nextItem.contentType ? ` (${nextItem.contentType})` : ''}. Click to pause this card. Use X to resume movement.`
				);
				card.style.setProperty('--smc-accent', nextItem.accent);
				if (nextItem.platformKey === 'x') {
					card.classList.add('smc-x-card');
				}
				if (nextItem.platformKey === 'reddit') {
					card.classList.add('smc-reddit-card');
				}
				if (nextItem.type === 'video') {
					card.classList.add('smc-video-card');
					const ratioValue = nextItem.videoAspectRatioCss || '16 / 9';
					card.style.setProperty('--smc-card-ratio', ratioValue);
					applyCardMediaAspectVars(card, ratioValue);
					const ratioNumber = parseAspectRatioValue(ratioValue);
					if (ratioNumber > 0 && ratioNumber < 0.92) {
						card.classList.add('smc-ratio-portrait');
					} else if (ratioNumber >= 0.92 && ratioNumber <= 1.12) {
						card.classList.add('smc-ratio-square');
					} else {
						card.classList.add('smc-ratio-landscape');
					}
				} else {
					const ratioValue = (nextItem.aspectRatio || '').trim() || '4 / 3';
					card.style.setProperty('--smc-card-ratio', ratioValue);
					applyCardMediaAspectVars(card, ratioValue);
					const ratioNumber = parseAspectRatioValue(ratioValue);
					if (ratioNumber > 0 && ratioNumber < 0.92) {
						card.classList.add('smc-ratio-portrait');
					} else if (ratioNumber >= 0.92 && ratioNumber <= 1.12) {
						card.classList.add('smc-ratio-square');
					} else {
						card.classList.add('smc-ratio-landscape');
					}
				}
				if (getResolvedContentType(nextItem) === 'short') {
					card.classList.add('is-short');
				}

				metaRow.textContent = '';
				metaRow.appendChild(metaTrail);
				if (nextItem.publishedLabel) {
					metaDate.textContent = nextItem.publishedLabel;
					metaDateWrap.hidden = false;
				} else {
					metaDate.textContent = '';
					metaDateWrap.hidden = true;
				}
				const titleValue = String(nextItem.title || '').trim();
				const blurbValue = String(nextItem.blurb || '').trim();
				if (titleTextEl) {
					titleTextEl.textContent = titleValue || 'Untitled content';
				}
				titleHeading.hidden = !Boolean(titleValue);
				setBlurbContent(blurbText, blurbValue);
				blurbText.hidden = !Boolean(blurbValue);
				syncPinnedChrome();
				card.classList.remove('smc-desc-visible');
				const scoreSummary = nextItem.scoreLabel || '';
				statsRow.textContent = scoreSummary;
				statsRowWrap.hidden = !Boolean(scoreSummary);
				metaBylineSep.hidden = metaDateWrap.hidden || statsRowWrap.hidden;
				const postUrl = isHttpUrl(nextItem.url) ? nextItem.url : '';
				openPostLink.href = postUrl || '#';
				openPostLink.setAttribute('aria-disabled', postUrl ? 'false' : 'true');
				openPostLink.tabIndex = postUrl ? 0 : -1;
				openPostLink.hidden = !postUrl;
				openPostLink.textContent = 'Link';
				const channelUrl = getSocialProfileLink(nextItem.platformKey);
				openChannelLink.href = channelUrl || '#';
				openChannelLink.setAttribute('aria-disabled', channelUrl ? 'false' : 'true');
				openChannelLink.tabIndex = channelUrl ? 0 : -1;
				openChannelLink.hidden = !Boolean(channelUrl);
				syncVisitedActionState();
				refreshMetaMarquee(metaDateWrap);
				refreshMetaMarquee(statsRowWrap);

				mediaSlot.querySelectorAll('.smc-media').forEach((node) => node.remove());
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
					nextEmbed && nextItem.type === 'video' && config.useInlineVideoByDefault
				);
				if (shouldRenderInlinePlayer) {
					const inlinePlayer = createPlayerElement(nextEmbed, nextItem, false);
					if (inlinePlayer) {
						mediaSlot.appendChild(inlinePlayer);
						state.inlinePlayerWrap = inlinePlayer;
					}
				} else {
					const thumbSrc = nextItem.thumbnail || nextItem.imageSrc;
					if (thumbSrc) {
						const isImagePost =
							String(nextItem.mediaKind || '').toLowerCase() === 'image' ||
							['photo', 'image', 'gallery'].includes(
								String(nextItem.contentType || '').toLowerCase()
							);
						if (isImagePost) {
							card.classList.add('smc-image-card');
						}
						const thumbRatioCss =
							nextItem.imageClass === 'qr'
								? '1 / 1'
								: (nextItem.aspectRatio || '').trim() ||
									(nextItem.type === 'video'
										? nextItem.videoAspectRatioCss || '16 / 9'
										: '4 / 3');
						card.style.setProperty('--smc-card-ratio', thumbRatioCss);
						applyCardMediaAspectVars(card, thumbRatioCss);
						const mediaWrap = document.createElement('span');
						mediaWrap.className =
							`smc-media ${nextItem.imageClass === 'qr' ? 'qr' : ''}`.trim();
						mediaWrap.draggable = false;
						mediaWrap.addEventListener('dragstart', (dragEvent) => {
							dragEvent.preventDefault();
						});
						const img = document.createElement('img');
						img.className = `smc-thumb ${nextItem.imageClass || ''}`.trim();
						img.src = thumbSrc;
						img.alt =
							nextItem.imageAlt ||
							`${nextItem.platform} preview for ${nextItem.title}`;
						img.loading = 'lazy';
						img.decoding = 'async';
						img.draggable = false;
						img.addEventListener('dragstart', (dragEvent) => {
							dragEvent.preventDefault();
						});
						img.addEventListener(
							'error',
							() => {
								mediaWrap.remove();
							},
							{ once: true }
						);
						mediaWrap.appendChild(img);
						if (isImagePost) {
							const pictureTag = document.createElement('span');
							pictureTag.className = 'smc-picture-tag';
							pictureTag.textContent = 'picture';
							mediaWrap.appendChild(pictureTag);
						}
						mediaSlot.appendChild(mediaWrap);
					}
				}

				const hasPlayableEmbed = Boolean(nextEmbed);
				openLink.textContent = hasPlayableEmbed
					? shouldRenderInlinePlayer
						? 'Click card to pause movement'
						: 'Click card to load video and pause movement'
					: 'Click card to pause movement';
				state.width = card.offsetWidth || state.width;
				if (titleMarqueeRoot) {
					refreshTitleMarquee(titleMarqueeRoot);
				}
			};
			state.setItem = setItemOnCard;
			let fidgetSpinRaf = 0;
			state.setItem(item);
			elementStateMap.set(card, state);
			let dragPointerId = null;
			let dragOffsetX = 0;
			let dragOffsetY = 0;
			let dragStartX = 0;
			let dragStartY = 0;
			let isDragging = false;
			let dragStartedOnPinStrip = false;
			let suppressNextPinStripClick = false;
			let pointerStartedOnCardBody = false;
			let deferPointerCapture = false;
			let resizePointerId = null;
			let resizeCorner = '';
			let resizeStartClientX = 0;
			let resizeStartClientY = 0;
			let resizeStartWidth = 0;
			let resizeStartHeight = 0;
			let resizeStartX = 0;
			let resizeStartY = 0;
			let resizeStartRatio = 1;
			/** Non-media chrome (meta, padding, copy) height; only used for video cards while resizing. */
			let resizeChromeExtra = 0;
			let rotatePointerId = null;
			let rotateStartClientX = 0;
			let rotateStartClientY = 0;
			let rotateStartAngle = 0;
			let rotateStartValue = 0;
			let rotateLastAngle = 0;
			let rotatePositiveDeg = 0;
			let rotateNegativeDeg = 0;
			let isRotateDragging = false;
			let wasPinnedAtRotateStart = false;
			let rotateStartedFromBorder = false;
			let suppressNextCardClick = false;

			const resizeHandles = ['nw', 'ne', 'sw', 'se'].map((corner) => {
				const handle = document.createElement('button');
				handle.type = 'button';
				handle.className = `smc-resize-handle smc-resize-${corner}`;
				handle.setAttribute(
					'aria-label',
					`Resize card from ${corner.toUpperCase()} corner`
				);
				handle.setAttribute('data-corner', corner);
				card.appendChild(handle);
				return handle;
			});

			const rotateHandles = ['top', 'right', 'bottom', 'left'].map((edge) => {
				const handle = document.createElement('button');
				handle.type = 'button';
				handle.className = `smc-rotate-edge smc-rotate-edge-${edge}`;
				handle.setAttribute('aria-label', `Rotate card from ${edge} border`);
				handle.setAttribute('data-edge', edge);
				card.appendChild(handle);
				return handle;
			});

			function applyStateTransform() {
				state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0) rotate(${state.rotate.toFixed(2)}deg)`;
			}

			function stopCardFidgetSpin() {
				if (!fidgetSpinRaf) return;
				window.cancelAnimationFrame(fidgetSpinRaf);
				fidgetSpinRaf = 0;
				card.classList.remove('is-fidget-spinning');
				card.removeAttribute('data-fidget-fx');
			}

			function unlockSocialDockMoveAchievement() {
				if (typeof window.owenminercsUnlockAchievement !== 'function') return;
				try {
					window.owenminercsUnlockAchievement(ACH_SOCIAL_DOCK_MOVE);
				} catch (_err) {
					// Achievement unlocks are best-effort and should never break card gestures.
				}
			}

			function startCardFidgetSpin(sign) {
				unlockSocialDockMoveAchievement();
				stopCardFidgetSpin();
				if (prefersReducedMotion) return;
				const spinSign = sign === -1 ? -1 : 1;
				if (idleSpinActive) {
					let lastT = performance.now();
					card.classList.add('is-fidget-spinning');
					card.setAttribute('data-fidget-fx', String(pickSocialCardFidgetFxVariant()));
					const step = (rafT) => {
						if (!idleSpinActive) {
							fidgetSpinRaf = 0;
							card.classList.remove('is-fidget-spinning');
							card.removeAttribute('data-fidget-fx');
							return;
						}
						const t = typeof rafT === 'number' ? rafT : performance.now();
						const dt = Math.max(0, Math.min(0.05, (t - lastT) / 1000));
						lastT = t;
						state.rotate += SOCIAL_CARD_IDLE_SPIN_DEG_PER_SEC * spinSign * dt;
						applyStateTransform();
						fidgetSpinRaf = window.requestAnimationFrame(step);
					};
					fidgetSpinRaf = window.requestAnimationFrame(step);
					return;
				}
				const startedAt = performance.now();
				let lastT = startedAt;
				card.classList.add('is-fidget-spinning');
				if (!prefersReducedMotion) {
					card.setAttribute('data-fidget-fx', String(pickSocialCardFidgetFxVariant()));
				}
				const step = (rafT) => {
					const t = typeof rafT === 'number' ? rafT : performance.now();
					const dt = Math.max(0, Math.min(0.05, (t - lastT) / 1000));
					const elapsed = t - startedAt;
					lastT = t;
					const progress = clamp(elapsed / SOCIAL_CARD_FIDGET_TURBO_MS, 0, 1);
					const easeOut = 1 - progress * progress;
					const rate = SOCIAL_CARD_FIDGET_TURBO_DEG_PER_SEC * (0.16 + easeOut * 0.84);
					state.rotate += rate * spinSign * dt;
					applyStateTransform();
					if (progress >= 1) {
						fidgetSpinRaf = 0;
						card.classList.remove('is-fidget-spinning');
						card.removeAttribute('data-fidget-fx');
						return;
					}
					fidgetSpinRaf = window.requestAnimationFrame(step);
				};
				fidgetSpinRaf = window.requestAnimationFrame(step);
			}

			function bringCardToFront() {
				topCardLayer += 1;
				card.style.zIndex = String(topCardLayer);
			}

			function setPinnedHint(text) {
				openLink.textContent = text;
				state.isPinned = true;
				markSocialCardPinned();
				if (pinnedLayer && card.parentElement !== pinnedLayer) {
					pinnedLayer.appendChild(card);
				}
				card.classList.add('is-active');
				if (state.playerWrap || state.inlinePlayerWrap) {
					card.classList.add('has-active-player');
					setCardMediaVisibility(true, '.smc-player');
					setCardMediaVisibility(false, '.smc-media');
				} else {
					card.classList.remove('has-active-player');
				}
				syncPinnedChrome();
				window.requestAnimationFrame(() => {
					refreshMetaMarquee(metaDateWrap);
					refreshMetaMarquee(statsRowWrap);
					if (titleMarqueeRoot) {
						refreshTitleMarquee(titleMarqueeRoot);
					}
				});
			}

			function setCardMediaVisibility(isVisible, selector = '.smc-media, .smc-player') {
				const mediaNodes = card.querySelectorAll(selector);
				mediaNodes.forEach((node) => {
					if (node instanceof HTMLElement) {
						node.style.display = isVisible ? '' : 'none';
						node.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
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

				const pauseIframeElement = (iframeEl, fallbackSrc = '') => {
					if (!(iframeEl instanceof HTMLIFrameElement)) return;
					const currentSrc = String(
						iframeEl.getAttribute('src') || iframeEl.src || ''
					).trim();
					if (!currentSrc) return;

					try {
						const parsedUrl = new URL(currentSrc, window.location.origin);
						const hostname = parsedUrl.hostname.toLowerCase();
						if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
							iframeEl.contentWindow?.postMessage(
								JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
								'*'
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

				const activePlayerWraps = [state.playerWrap, state.inlinePlayerWrap].filter(
					Boolean
				);
				activePlayerWraps.forEach((wrap) => {
					const videoEl = wrap.querySelector('video');
					if (videoEl) {
						pauseVideoElement(videoEl);
						return;
					}
					const iframeEl = wrap.querySelector('iframe');
					if (iframeEl) {
						const fallbackSrc = state.embed?.kind === 'iframe' ? state.embed.src : '';
						pauseIframeElement(iframeEl, fallbackSrc);
					}
				});
			}

			function getPointerAngle(event) {
				const cloudRect = cloud.getBoundingClientRect();
				const pointerX = event.clientX - cloudRect.left;
				const pointerY = event.clientY - cloudRect.top;
				const centerX = state.x + card.offsetWidth / 2;
				const centerY = state.y + card.offsetHeight / 2;
				return Math.atan2(pointerY - centerY, pointerX - centerX) * (180 / Math.PI);
			}

			function startRotate(event, sourceLabel, startedFromBorder = false) {
				stopCardFidgetSpin();
				bringCardToFront();
				rotatePointerId = event.pointerId;
				rotateStartClientX = event.clientX;
				rotateStartClientY = event.clientY;
				rotateStartAngle = getPointerAngle(event);
				rotateStartValue = state.rotate;
				rotateLastAngle = rotateStartAngle;
				rotatePositiveDeg = 0;
				rotateNegativeDeg = 0;
				isRotateDragging = false;
				wasPinnedAtRotateStart = state.isPinned;
				rotateStartedFromBorder = startedFromBorder;
				if (!state.isPinned) {
					setPinnedHint(`Pinned. Drag the ${sourceLabel} to rotate.`);
				}
			}

			function unpinCard() {
				stopCardFidgetSpin();
				pauseActivePlayback();
				if (card.parentElement !== cloud) {
					cloud.appendChild(card);
				}
				card.style.width = '';
				card.style.height = '';
				const hasActivePlayer = Boolean(state.playerWrap || state.inlinePlayerWrap);
				card.classList.toggle('has-active-player', hasActivePlayer);
				setCardMediaVisibility(true);
				if (hasActivePlayer) {
					// Keep active video visible while card drifts, but hide static thumbnail.
					setCardMediaVisibility(false, '.smc-media');
				}
				state.isPinned = false;
				isDragging = false;
				card.classList.remove('is-active');
				card.classList.remove('smc-desc-visible');
				card.classList.remove('is-dragging');
				openLink.textContent = hasActivePlayer
					? 'Video keeps playing while drifting. Click card to pause movement'
					: 'Click card to pause movement';
				syncPinnedChrome();
			}

			function pinCard(embed) {
				state.isPinned = true;
				card.classList.add('is-active');
				card.classList.toggle(
					'has-active-player',
					Boolean(state.playerWrap || state.inlinePlayerWrap)
				);
				setCardMediaVisibility(false);
				// Already showing a dedicated pinned player (autoplay).
				if (state.playerWrap) {
					setPinnedHint('Pinned. Click the card background to resume drift');
					return;
				}
				// Thumbnail + inline preview iframe/video: swap to autoplay on pin (never leave static thumb).
				if (state.inlinePlayerWrap) {
					const inlineIframe = state.inlinePlayerWrap.querySelector('iframe');
					const inlineVideo = state.inlinePlayerWrap.querySelector('video');
					if (inlineIframe && embed?.kind === 'iframe' && embed.src) {
						upgradeIframeToAutoplay(inlineIframe, embed.src);
						inlineIframe.loading = 'eager';
					} else if (inlineVideo && embed?.kind === 'video') {
						startInlineVideoPlayback(inlineVideo);
					}
					card.classList.add('has-active-player');
					setPinnedHint('Pinned. Click the card background to resume drift');
					return;
				}
				const playerWrap = createPlayerElement(embed, state.item, true);
				if (playerWrap) {
					mediaSlot.appendChild(playerWrap);
					state.playerWrap = playerWrap;
					card.classList.add('has-active-player');
				}
				setPinnedHint('Pinned. Click the card background to resume drift');
			}

			function activateCardPlayback() {
				if (state.isPinned) return;
				if (state.embed) {
					pinCard(state.embed);
					return;
				}
				setPinnedHint('Pinned. Click the card background to resume drift');
			}

			pinStripButton.addEventListener('click', (event) => {
				if (suppressNextPinStripClick) {
					suppressNextPinStripClick = false;
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				bringCardToFront();
				if (state.isPinned) {
					unpinCard();
					return;
				}
				if (state.embed) {
					pinCard(state.embed);
					return;
				}
				setPinnedHint('Pinned. Click the card background to resume drift');
			});

			card.addEventListener('pointerdown', (event) => {
				if (event.button !== 0) return;
				bringCardToFront();
				suppressNextCardClick = false;
				const pointerPath =
					typeof event.composedPath === 'function' ? event.composedPath() : [];
				dragStartedOnPinStrip =
					pointerPath.includes(pinStripButton) ||
					(event.target instanceof Element &&
						Boolean(event.target.closest('.smc-pin-strip')));
				suppressNextPinStripClick = false;
				if (isInteractiveCardTarget(event.target) && !dragStartedOnPinStrip) return;
				const cardRect = card.getBoundingClientRect();
				const startedOnPlayerSurface =
					event.target instanceof Element && Boolean(event.target.closest('.smc-player'));
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

			card.addEventListener('pointermove', (event) => {
				if (rotatePointerId === event.pointerId) {
					const moveDistance = Math.hypot(
						event.clientX - rotateStartClientX,
						event.clientY - rotateStartClientY
					);
					if (!isRotateDragging && moveDistance < 4) return;
					isRotateDragging = true;
					const currentAngle = getPointerAngle(event);
					const rotateDelta = normalizeAngleDelta(currentAngle - rotateLastAngle);
					rotateLastAngle = currentAngle;
					if (rotateDelta >= 0) {
						rotatePositiveDeg += rotateDelta;
					} else {
						rotateNegativeDeg += Math.abs(rotateDelta);
					}
					state.rotate += rotateDelta;
					applyStateTransform();
					return;
				}
				if (dragPointerId !== event.pointerId) return;
				const moveDistance = Math.hypot(
					event.clientX - dragStartX,
					event.clientY - dragStartY
				);
				if (!isDragging && moveDistance < 4) return;

				const cloudRect = cloud.getBoundingClientRect();
				const cardWidth = card.offsetWidth;
				const cardHeight = card.offsetHeight;
				const minY = state.isPinned ? getPinnedCardMinY() : getVisibleTop();
				const maxBottom = state.isPinned ? getPinnedCardMaxBottom() : getVisibleBottom();
				const maxY = Math.max(minY, maxBottom - cardHeight);
				const nextX = clamp(
					event.clientX - cloudRect.left - dragOffsetX,
					8,
					Math.max(8, cloudWidth - cardWidth - 8)
				);
				const nextY = clamp(event.clientY - cloudRect.top - dragOffsetY, minY, maxY);

				if (!isDragging) {
					isDragging = true;
					markSocialCardMoved();
					if (dragStartedOnPinStrip) {
						suppressNextPinStripClick = true;
					}
					if (deferPointerCapture && !card.hasPointerCapture(event.pointerId)) {
						card.setPointerCapture(event.pointerId);
					}
					deferPointerCapture = false;
					// Dragging from the pin strip should move the card without toggling pin/open state.
					if (!dragStartedOnPinStrip) {
						setPinnedHint('Pinned. Drag to place. Click the card background to resume drift');
					}
					card.classList.add('is-dragging');
				}

				state.x = nextX;
				state.y = nextY;
				applyStateTransform();
			});

			card.addEventListener('pointerup', (event) => {
				if (rotatePointerId === event.pointerId) {
					endRotate(event);
					return;
				}
				if (dragPointerId !== event.pointerId) return;
				if (card.hasPointerCapture(event.pointerId)) {
					card.releasePointerCapture(event.pointerId);
				}
				const shouldSuppressClick = pointerStartedOnCardBody && isDragging;
				dragPointerId = null;
				dragStartedOnPinStrip = false;
				pointerStartedOnCardBody = false;
				deferPointerCapture = false;
				if (isDragging) {
					card.classList.remove('is-dragging');
				}
				isDragging = false;
				suppressNextCardClick = shouldSuppressClick;
			});

			card.addEventListener('pointercancel', (event) => {
				if (rotatePointerId === event.pointerId) {
					endRotate(event);
					return;
				}
				if (dragPointerId !== event.pointerId) return;
				if (card.hasPointerCapture(event.pointerId)) {
					card.releasePointerCapture(event.pointerId);
				}
				dragPointerId = null;
				pointerStartedOnCardBody = false;
				deferPointerCapture = false;
				if (isDragging) {
					card.classList.remove('is-dragging');
				}
				isDragging = false;
			});

			function getResizeMediaRatio() {
				const ratioCss =
					card.style.getPropertyValue('--smc-card-ratio') ||
					state.item?.videoAspectRatioCss ||
					state.item?.aspectRatio ||
					'';
				return (
					parseAspectRatioValue(ratioCss) ||
					Number(state.item?.videoAspectRatio) ||
					resizeStartWidth / Math.max(1, resizeStartHeight)
				);
			}

			function getCardChromeMinWidth() {
				const cardStyles = window.getComputedStyle(card);
				const cardPaddingX =
					toSafeNumber(cardStyles.paddingLeft) + toSafeNumber(cardStyles.paddingRight);

				const bylineStyles = window.getComputedStyle(metaByline);
				const bylineGap = toSafeNumber(bylineStyles.columnGap || bylineStyles.gap);
				const dateWidth = Math.ceil(metaDateWrap.scrollWidth || metaDateWrap.offsetWidth || 0);
				const statsMinWidth = 82;
				const dateDrivenMin = dateWidth + statsMinWidth + bylineGap + cardPaddingX + 12;

				const bottomStyles = window.getComputedStyle(bottomChrome);
				const bottomGap = toSafeNumber(bottomStyles.columnGap || bottomStyles.gap);
				const openPostWidth = Math.ceil(openPostLink.offsetWidth || 0);
				const openChannelWidth = Math.ceil(openChannelLink.offsetWidth || 0);
				const buttonDrivenMin =
					openPostWidth + openChannelWidth + bottomGap + cardPaddingX + 12;

				return Math.max(180, dateDrivenMin, buttonDrivenMin);
			}

			function getResizeDimensions(event, corner) {
				const minWidth = getCardChromeMinWidth();
				const maxWidth = Math.max(minWidth, cloudWidth);
				const minX = 8;
				const maxRight = Math.max(minX + minWidth, cloudWidth - 8);
				const minY = getPinnedCardMinY();
				const maxBottom = getPinnedCardMaxBottom();
				const dx = event.clientX - resizeStartClientX;
				const dy = event.clientY - resizeStartClientY;
				const r = resizeStartRatio;
				const sx = corner.includes('e') ? 1 : -1;
				const sy = corner.includes('s') ? 1 : -1;
				const wFromDx = resizeStartWidth + sx * dx;
				const wFromDy = (resizeStartHeight + sy * dy - resizeChromeExtra) * r;
				let nextWidth = clamp((wFromDx + wFromDy) / 2, minWidth, maxWidth);

				const fullCardHeight = (w) => w / r + resizeChromeExtra;
				let nextHeight = fullCardHeight(nextWidth);

				let nextX = corner.includes('w')
					? resizeStartX + resizeStartWidth - nextWidth
					: resizeStartX;
				let nextY = corner.includes('n')
					? resizeStartY + resizeStartHeight - nextHeight
					: resizeStartY;

				if (nextX < minX) {
					nextX = minX;
					nextWidth = clamp(
						corner.includes('w') ? resizeStartX + resizeStartWidth : nextWidth,
						minWidth,
						maxWidth
					);
					nextHeight = fullCardHeight(nextWidth);
				}
				if (nextX + nextWidth > maxRight) {
					nextWidth = Math.max(minWidth, maxRight - nextX);
					nextHeight = fullCardHeight(nextWidth);
					if (corner.includes('w')) {
						nextX = Math.max(minX, resizeStartX + resizeStartWidth - nextWidth);
					}
				}
				if (nextY < minY) {
					nextY = minY;
					if (corner.includes('n')) {
						nextHeight = resizeStartY + resizeStartHeight - minY;
						nextWidth = clamp((nextHeight - resizeChromeExtra) * r, minWidth, maxWidth);
						nextHeight = fullCardHeight(nextWidth);
						nextX = corner.includes('w')
							? Math.max(minX, resizeStartX + resizeStartWidth - nextWidth)
							: nextX;
					} else {
						nextHeight = fullCardHeight(nextWidth);
					}
				}
				if (nextY + nextHeight > maxBottom) {
					nextHeight = Math.max(minWidth / r + resizeChromeExtra, maxBottom - nextY);
					nextWidth = clamp((nextHeight - resizeChromeExtra) * r, minWidth, maxWidth);
					nextHeight = fullCardHeight(nextWidth);
					if (corner.includes('n')) {
						nextY = Math.max(minY, resizeStartY + resizeStartHeight - nextHeight);
					}
				}

				nextWidth = clamp(nextWidth, minWidth, maxWidth);
				nextHeight = fullCardHeight(nextWidth);
				nextX = clamp(nextX, minX, Math.max(minX, maxRight - nextWidth));
				nextY = clamp(nextY, minY, Math.max(minY, maxBottom - nextHeight));
				return { nextX, nextY, nextWidth, nextHeight };
			}

			resizeHandles.forEach((handle) => {
				handle.addEventListener('pointerdown', (event) => {
					if (event.button !== 0) return;
					event.preventDefault();
					event.stopPropagation();
					bringCardToFront();
					resizePointerId = event.pointerId;
					resizeCorner = handle.getAttribute('data-corner') || 'se';
					resizeStartClientX = event.clientX;
					resizeStartClientY = event.clientY;
					resizeStartWidth = card.offsetWidth;
					resizeStartHeight = card.offsetHeight;
					resizeStartRatio = getResizeMediaRatio();
					resizeChromeExtra = Math.max(
						0,
						resizeStartHeight - resizeStartWidth / resizeStartRatio
					);
					resizeStartX = state.x;
					resizeStartY = state.y;
					setPinnedHint(
						'Pinned. Resize from any corner. Click the card background to resume drift'
					);
					handle.setPointerCapture(event.pointerId);
				});

				handle.addEventListener('pointermove', (event) => {
					if (resizePointerId !== event.pointerId) return;
					event.preventDefault();
					const dims = getResizeDimensions(event, resizeCorner);
					state.x = dims.nextX;
					state.y = dims.nextY;
					state.width = dims.nextWidth;
					state.height = dims.nextHeight;
					card.style.width = `${dims.nextWidth}px`;
					card.style.height = `${dims.nextHeight}px`;
					state.y = clamp(
						state.y,
						getPinnedCardMinY(),
						Math.max(getPinnedCardMinY(), getPinnedCardMaxBottom() - dims.nextHeight)
					);
					const playerWrap = state.inlinePlayerWrap || state.playerWrap;
					if (playerWrap && typeof playerWrap.__smcRefitIframe === 'function') {
						playerWrap.__smcRefitIframe();
					}
					applyStateTransform();
					refreshMetaMarquee(metaDateWrap);
					refreshMetaMarquee(statsRowWrap);
					if (titleMarqueeRoot) {
						refreshTitleMarquee(titleMarqueeRoot);
					}
				});

				const endResize = (event) => {
					if (resizePointerId !== event.pointerId) return;
					if (handle.hasPointerCapture(event.pointerId)) {
						handle.releasePointerCapture(event.pointerId);
					}
					resizePointerId = null;
					resizeCorner = '';
					// Keep both width and height after resize so inline size matches the
					// aspect math used while dragging. Clearing only height left a fixed
					// width with auto height, which broke embed layout (clipped players).
					refreshMetaMarquee(metaDateWrap);
					refreshMetaMarquee(statsRowWrap);
					if (titleMarqueeRoot) {
						refreshTitleMarquee(titleMarqueeRoot);
					}
				};

				handle.addEventListener('pointerup', endResize);
				handle.addEventListener('pointercancel', endResize);
			});

			const endRotate = (event) => {
				if (rotatePointerId !== event.pointerId) return;
				const positiveDeg = rotatePositiveDeg;
				const negativeDeg = rotateNegativeDeg;
				const netDeg = state.rotate - rotateStartValue;
				rotateHandles.forEach((handle) => {
					if (handle.hasPointerCapture(event.pointerId)) {
						handle.releasePointerCapture(event.pointerId);
					}
				});
				if (card.hasPointerCapture(event.pointerId)) {
					card.releasePointerCapture(event.pointerId);
				}
				rotatePointerId = null;
				if (!isRotateDragging) {
					if (!rotateStartedFromBorder) {
						bringCardToFront();
						if (wasPinnedAtRotateStart) {
							unpinCard();
						} else {
							activateCardPlayback();
						}
					}
				} else {
					const threshold = SOCIAL_CARD_FIDGET_REV_DEG - SOCIAL_CARD_FIDGET_TOL_DEG;
					const maxOneWay = Math.max(positiveDeg, negativeDeg);
					if (maxOneWay >= threshold || Math.abs(netDeg) >= threshold) {
						const sign =
							maxOneWay >= threshold
								? positiveDeg >= negativeDeg
									? 1
									: -1
								: netDeg >= 0
									? 1
									: -1;
						setPinnedHint('Fidget spin unlocked. Click the card background to resume drift');
						startCardFidgetSpin(sign);
					} else {
						setPinnedHint('Pinned. Click the card background to resume drift');
					}
				}
				isRotateDragging = false;
				rotateStartedFromBorder = false;
			};

			rotateHandles.forEach((handle) => {
				handle.addEventListener('pointerdown', (event) => {
					if (event.button !== 0) return;
					event.preventDefault();
					event.stopPropagation();
					startRotate(event, 'card edge', true);
					handle.setPointerCapture(event.pointerId);
				});

				handle.addEventListener('pointermove', (event) => {
					if (rotatePointerId !== event.pointerId) return;
					const moveDistance = Math.hypot(
						event.clientX - rotateStartClientX,
						event.clientY - rotateStartClientY
					);
					if (!isRotateDragging && moveDistance < 4) return;
					isRotateDragging = true;
					const currentAngle = getPointerAngle(event);
					const rotateDelta = normalizeAngleDelta(currentAngle - rotateLastAngle);
					rotateLastAngle = currentAngle;
					if (rotateDelta >= 0) {
						rotatePositiveDeg += rotateDelta;
					} else {
						rotateNegativeDeg += Math.abs(rotateDelta);
					}
					state.rotate += rotateDelta;
					applyStateTransform();
				});

				handle.addEventListener('pointerup', endRotate);
				handle.addEventListener('pointercancel', endRotate);
			});

			card.addEventListener('click', (event) => {
				if (isInteractiveCardTarget(event.target)) return;
				if (suppressNextCardClick) {
					suppressNextCardClick = false;
					return;
				}
				bringCardToFront();
				if (state.isPinned) {
					unpinCard();
				} else {
					activateCardPlayback();
				}
			});

			card.addEventListener('keydown', (event) => {
				if (event.key !== 'Enter' && event.key !== ' ') return;
				event.preventDefault();
				bringCardToFront();
				if (state.isPinned) {
					unpinCard();
				} else {
					activateCardPlayback();
				}
			});

			const initialBob =
				Math.sin(lastFrame * 0.001 * state.driftRate + state.phase) * state.driftAmp;
			state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${(state.y + initialBob).toFixed(2)}px, 0) rotate(${state.rotate.toFixed(2)}deg)`;
			socialCardSpinControllers.push({
				start: () => startCardFidgetSpin(Math.random() < 0.5 ? -1 : 1),
				stop: stopCardFidgetSpin,
			});

			states.push(state);
		}
		cloud.appendChild(fragment);
		window.requestAnimationFrame(() => {
			for (let i = 0; i < states.length; i += 1) {
				const state = states[i];
				if (!state?.el || state.isPinned) continue;
				clampStateToVisibleArea(state);
				state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0) rotate(${state.rotate.toFixed(2)}deg)`;
			}
		});
	}

	function resetState(state) {
		if (typeof state.setItem === 'function' && enabledCatalog.length > cardCount) {
			const nextItem = enabledCatalog[catalogCursor % enabledCatalog.length];
			catalogCursor += 1;
			state.setItem(nextItem);
		}
		state.width = getStateWidth(state);
		state.x = getRespawnX(state.width, state);
		const cardHeight = getStateHeight(state);
		const minY = getVisibleTop();
		const maxY = Math.max(minY, getVisibleBottom() - cardHeight);
		state.y = clamp(state.y + (Math.random() * 80 - 40), minY, maxY);
		state.speed = config.baseSpeed * (0.82 + Math.random() * 0.45);
		state.phase = Math.random() * Math.PI * 2;
	}

	function tick(now) {
		const dt = Math.min(0.032, (now - lastFrame) / 1000);
		lastFrame = now;

		for (let i = 0; i < states.length; i += 1) {
			const state = states[i];
			if (state.isPinned) continue;
			state.width = getStateWidth(state);
			const resetThresholdX = cloudWidth + state.width;
			state.x += state.speed * dt;
			if (state.x > resetThresholdX) {
				resetState(state);
			}
			const minY = getVisibleTop();
			const maxY = Math.max(minY, getVisibleBottom() - getStateHeight(state));
			state.y = clamp(state.y, minY, maxY);
			state.x = Math.max(8, state.x);
			const bob = Math.sin(now * 0.001 * state.driftRate + state.phase) * state.driftAmp;
			state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${(state.y + bob).toFixed(2)}px, 0) rotate(${state.rotate.toFixed(2)}deg)`;
		}

		rafId = window.requestAnimationFrame(tick);
	}

	function placeStaticCards() {
		const columns = window.innerWidth < 780 ? 2 : 3;
		const gutter = 14;
		const cardWidth = Math.min(
			230,
			Math.max(156, (cloudWidth - (columns + 1) * gutter) / columns)
		);
		const top = getVisibleTop();
		for (let i = 0; i < states.length; i += 1) {
			const row = Math.floor(i / columns);
			const col = i % columns;
			const x = gutter + col * (cardWidth + gutter);
			const y = top + gutter + row * 138;
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
		clearIdleSpinTimer();
		stopIdleSpinForAllCards();
		states.length = 0;
		socialCardSpinControllers.length = 0;
		if (pinnedLayer) {
			pinnedLayer.textContent = '';
		}
		cloud.textContent = '';
		lastFrame = performance.now();
		syncCloudBounds();
		renderHashtagFilterBar(contentItems);
		enabledCatalog = getEnabledCatalog(contentItems);
		updateCardCountForViewport();
		renderCards();
		startCloudAnimation();
		startAmbientUpdates();
	}

	function getModeToggleLabel() {
		return useLightMode ? 'Lightweight: On' : 'Lightweight: Off';
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
			moved: false,
		};
		let suppressClick = false;

		function clampModeButtonPosition(left, top) {
			const rect = modeButton.getBoundingClientRect();
			const maxLeft = Math.max(DRAG_MARGIN, window.innerWidth - rect.width - DRAG_MARGIN);
			const maxTop = Math.max(DRAG_MARGIN, window.innerHeight - rect.height - DRAG_MARGIN);
			return {
				left: clamp(left, DRAG_MARGIN, maxLeft),
				top: clamp(top, DRAG_MARGIN, maxTop),
			};
		}

		modeButton.addEventListener('pointerdown', (event) => {
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
			modeButton.classList.add('is-dragging');
			event.preventDefault();
		});

		modeButton.addEventListener('pointermove', (event) => {
			if (!dragState.active || event.pointerId !== dragState.pointerId) return;
			const offsetX = event.clientX - dragState.startPointerX;
			const offsetY = event.clientY - dragState.startPointerY;
			if (
				!dragState.moved &&
				(Math.abs(offsetX) >= DRAG_THRESHOLD || Math.abs(offsetY) >= DRAG_THRESHOLD)
			) {
				dragState.moved = true;
			}
			const constrained = clampModeButtonPosition(
				dragState.startLeft + offsetX,
				dragState.startTop + offsetY
			);
			modeButton.style.left = `${constrained.left}px`;
			modeButton.style.top = `${constrained.top}px`;
			modeButton.style.right = 'auto';
			modeButton.style.bottom = 'auto';
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
			modeButton.classList.remove('is-dragging');
		}

		modeButton.addEventListener('pointerup', finishPointer);
		modeButton.addEventListener('pointercancel', finishPointer);

		modeButton.addEventListener(
			'click',
			(event) => {
				if (!suppressClick) return;
				suppressClick = false;
				event.preventDefault();
				event.stopPropagation();
			},
			true
		);

		window.addEventListener(
			'resize',
			() => {
				const hasCustomPosition = modeButton.style.left && modeButton.style.top;
				if (!hasCustomPosition) return;
				const currentLeft = Number.parseFloat(modeButton.style.left);
				const currentTop = Number.parseFloat(modeButton.style.top);
				if (!Number.isFinite(currentLeft) || !Number.isFinite(currentTop)) return;
				const constrained = clampModeButtonPosition(currentLeft, currentTop);
				modeButton.style.left = `${constrained.left}px`;
				modeButton.style.top = `${constrained.top}px`;
			},
			{ passive: true }
		);
	}

	function mountModeToggle() {
		const modeButton = document.createElement('button');
		modeButton.type = 'button';
		modeButton.className = 'smc-mode-toggle';
		modeButton.textContent = getModeToggleLabel();
		modeButton.setAttribute('aria-pressed', useLightMode ? 'true' : 'false');
		modeButton.setAttribute('aria-label', 'Toggle lightweight mode');
		modeButton.title = 'Toggle lightweight mode';
		modeButton.addEventListener('click', () => {
			useLightMode = !useLightMode;
			setStoredModePreference(useLightMode ? LIGHT_MODE_VALUE : FULL_MODE_VALUE);
			applyModeConfig();
			modeButton.textContent = getModeToggleLabel();
			modeButton.setAttribute('aria-pressed', useLightMode ? 'true' : 'false');
			rebuildCloud(activeContentItems);
		});
		enableModeToggleDrag(modeButton);
		document.body.appendChild(modeButton);
	}

	function mountFilterToggle() {
		if (!hashtagFilterBar) return;
		filterToggleButton = document.createElement('button');
		filterToggleButton.type = 'button';
		filterToggleButton.className = 'smc-filter-toggle';
		filterToggleButton.textContent = 'Filters';
		filterToggleButton.setAttribute('aria-pressed', 'false');
		filterToggleButton.setAttribute('aria-label', 'Show hashtag filters');
		filterToggleButton.title = 'Show hashtag filters';
		filterToggleButton.hidden = true;
		filterToggleButton.disabled = true;
		filterToggleButton.addEventListener('click', () => {
			if (!hasAvailableHashtagFilters) return;
			showHashtagFilterBar = !showHashtagFilterBar;
			renderHashtagFilterBar(activeContentItems);
		});
		document.body.appendChild(filterToggleButton);
	}

	async function initializeCloud() {
		mountAmbientLayer();
		mountPinnedLayer();
		bindIdleSpinInteractionWatchers();
		syncCloudBounds();
		const [localItems, redditItems] = await Promise.all([
			fetchLocalSocialContentItems(),
			fetchRedditTopContentItems(),
		]);
		const youtubeItems = localItems.length ? localItems : manualSocialContentItems;
		const contentItems = [...redditItems, ...youtubeItems];
		activeContentItems = contentItems;
		renderHashtagFilterBar(contentItems);
		enabledCatalog = getEnabledCatalog(contentItems);
		catalogCursor = 0;
		updateCardCountForViewport();
		renderCards();
		startCloudAnimation();
		startAmbientUpdates();
		mountModeToggle();
		mountFilterToggle();
		renderHashtagFilterBar(contentItems);
	}

	initializeCloud();

	window.addEventListener(
		'resize',
		() => {
			syncCloudBounds();
			if (prefersReducedMotion) {
				placeStaticCards();
			} else {
				for (let i = 0; i < states.length; i += 1) {
					clampStateToVisibleArea(states[i]);
					states[i].width = getStateWidth(states[i]);
					const maxX = Math.max(8, cloudWidth - states[i].width - 8);
					if (states[i].x > maxX) resetState(states[i]);
					states[i].x = clamp(states[i].x, 8, maxX);
				}
			}
			if (!ambientTickRaf) {
				ambientTickRaf = window.requestAnimationFrame(() => {
					ambientTickRaf = 0;
					updateAmbientPalette();
				});
			}
			window.requestAnimationFrame(() => {
				for (let i = 0; i < states.length; i += 1) {
					const el = states[i]?.el;
					if (!(el instanceof HTMLElement)) continue;
					const titleRoot = el.querySelector('.smc-title-marquee');
					if (titleRoot) {
						refreshTitleMarquee(titleRoot);
					}
				}
			});
		},
		{ passive: true }
	);

	window.setTimeout(syncCloudBounds, 140);
	window.setTimeout(syncCloudBounds, 520);

	window.addEventListener('pagehide', () => {
		clearIdleSpinTimer();
		stopIdleSpinForAllCards();
		if (rafId) {
			window.cancelAnimationFrame(rafId);
			rafId = 0;
		}
		stopAmbientUpdates();
	});
})();
