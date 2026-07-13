/**
 * Home page — Explore the site carousel: renders hub cards and auto-cycles with hover nav.
 * Card media crossfades through images fetched from each destination page (photogallery + keep thumbs).
 */
(function () {
	const GLOBE = {
		red: '/images/logo/globes/globe-red.jpg',
		redText: '/images/logo/globes/globe-red-text.jpg',
		blue: '/images/logo/globes/globe-blue.jpg',
		darkBlue: '/images/logo/globes/globe-dark-blue.jpg',
		purple: '/images/logo/globes/globe-purple.jpg',
		purpleDark: '/images/logo/globes/globe-purple-dark.jpg',
		purpleRed: '/images/logo/globes/globe-purple-red.jpg',
		silver: '/images/logo/globes/globe-silver.jpg',
	};
	const SETUP = 'The%20Setup/';
	const SLIDE_HOLD_MS = 2000;
	const SLIDE_FADE_MS = 480;
	const MAX_SLIDES_PER_CARD = 12;
	const FETCH_CONCURRENCY = 8;

	const EXPLORE_CARDS = [
		{
			href: 'The%20Setup/keyboards.html',
			img: 'Keyboard/images/killowattKeyboard.webp',
			alt: 'Wooting 60HE Kilowatt keyboard build',
			title: 'Wooting 60HE keyboard build',
			desc: 'Cases, switches, keycaps, silicone dampening, galleries, and build eras.',
			links: [
				{ href: 'Keyboard/60he-2026.html', label: '2026 Kilowatt build' },
				{ href: 'Keyboard/60he-2025.html', label: '2025 Kilowatt build' },
				{ href: 'Keyboard/60he-2023.html', label: '2023 Crosshair Alpha & v1' },
			],
		},
		{
			href: 'Gaming/gaming.html',
			img: 'images/csShelves.webp',
			alt: 'CS2 Major merchandise on shelves',
			title: 'Gaming: Counter-Strike',
			desc: 'FACEIT-level play, merch shelves, wallpapers, skins, and CS2 pages.',
			links: [
				{ href: 'Gaming/counter-strike-background.html', label: 'FACEIT & background' },
				{ href: 'Gaming/cs2-merch.html', label: 'Merch' },
				{ href: 'Counter-Strike/nosmoking.html', label: 'Wallpapers' },
			],
		},
		{
			href: `${SETUP}gaming-pc.html`,
			img: 'PC/images/pc.webp',
			alt: '2024 gaming PC build',
			title: '2024 PC build',
			desc: 'Ryzen, RTX 4090, case, and parts list with retailer links.',
			links: [
				{ href: 'PC/pc.html', label: 'PC build page' },
				{ href: `${SETUP}computers.html`, label: 'Computers' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}the-setup.html`,
			img: 'images/gamingSetup.webp',
			alt: 'Gear desk setup with monitors',
			title: 'Gear',
			desc: 'Desk, displays, audio, lighting, peripherals, plants, and priced gear cards.',
			links: [
				{ href: `${SETUP}keyboards.html`, label: 'Keyboards' },
				{ href: `${SETUP}displays.html`, label: 'Displays' },
				{ href: `${SETUP}audio.html`, label: 'Audio' },
			],
		},
		{
			href: 'Counter-Strike/nosmoking.html',
			img: 'images/Desktop_background/smoke v2 black background.png',
			alt: 'Agent Number K CS2 wallpaper preview',
			title: 'Agent Number K Wallpapers',
			desc: 'Free Agent Number K CS2 wallpapers (No Smoking theme).',
			links: [
				{ href: 'Gaming/counter-strike-background.html', label: 'FACEIT & background' },
				{ href: 'Gaming/cs2-merch.html', label: 'Merch' },
				{ href: 'Gaming/gaming.html', label: 'Gaming' },
			],
		},
		{
			href: 'Gaming/counter-strike-background.html',
			img: 'images/roomSetupDark.webp',
			alt: 'Gaming setup with multiple displays',
			title: 'Counter-Strike background',
			desc: 'From 2015 community servers to FACEIT level 10 and Premier leaderboard runs.',
			links: [
				{ href: 'Counter-Strike/nosmoking.html', label: 'Wallpapers' },
				{ href: 'Gaming/cs2-merch.html', label: 'Merch' },
				{ href: 'Gaming/cs2-videos.html', label: 'CS2 videos' },
			],
		},
		{
			href: 'Gaming/cs2-merch.html',
			img: 'images/csShelves.webp',
			alt: 'PGL Shanghai Major merch shelves',
			title: 'CS2 Major merch',
			desc: 'PGL Shanghai Major shelves, collectibles and display pieces.',
			links: [
				{ href: 'Counter-Strike/nosmoking.html', label: 'Wallpapers' },
				{ href: 'Gaming/counter-strike-background.html', label: 'FACEIT & background' },
				{ href: 'Gaming/cs2-videos.html', label: 'CS2 videos' },
			],
		},
		{
			href: 'Gaming/cs2-videos.html',
			img: 'images/roomSetupDark.webp',
			alt: 'Multi-monitor gaming setup',
			title: 'CS2 videos',
			desc: 'Long-form, Shorts, and clips from YouTube and TikTok.',
			links: [
				{ href: 'Gaming/cs2-merch.html', label: 'Merch' },
				{ href: 'Counter-Strike/nosmoking.html', label: 'Wallpapers' },
				{ href: 'Gaming/counter-strike-background.html', label: 'FACEIT & background' },
			],
		},
		{
			href: 'Gaming/ohnepixel-labubu.html',
			img: 'Counter-Strike/ohnepixel-labubu/ohnepixel-gold-labubu-thumb.png',
			alt: 'Ohnepixel holding the 24K Gold Labubu plush',
			title: 'Ohnepixel Gold³ Labubu',
			desc: '24K Gold³ Labubu unboxing and Shorts with Ohnepixel.',
			links: [
				{ href: 'Gaming/cs2-videos.html', label: 'CS2 videos' },
				{ href: 'Gaming/gaming-memorabilia.html', label: 'Gaming memorabilia' },
				{ href: 'Gaming/gaming.html', label: 'Gaming' },
			],
		},
		{
			href: 'Gaming/cs2-dust2-gap-bug.html',
			img: 'Gaming/images/dust2-wall-crack-short.webp',
			alt: 'Dust II wall crack pixel gap in CS2 gameplay',
			title: 'Dust II wall crack bug',
			desc: 'Tiny geometry gap that can reveal your position. Map tweak notes included.',
			links: [
				{ href: 'Gaming/cs2-videos.html', label: 'CS2 videos' },
				{ href: 'Gaming/counter-strike-background.html', label: 'FACEIT & background' },
				{ href: 'Gaming/gaming.html', label: 'Gaming' },
			],
		},
		{
			href: `${SETUP}previous-setups.html`,
			img: 'images/roomSetupDark.webp',
			alt: 'Past desk and gaming setup photos',
			title: 'Setup archive',
			desc: 'Year-by-year setup archive cards with wide desk shots.',
			links: [
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
				{ href: `${SETUP}gaming-pc.html`, label: '2024 PC build' },
				{ href: `${SETUP}keyboards.html`, label: 'Keyboards' },
			],
		},
		{
			href: `${SETUP}keyboards.html`,
			img: 'Keyboard/images/killowattKeyboard.webp',
			alt: 'Wooting 60HE keyboard category',
			title: 'Keyboards',
			desc: 'Wooting build and future keyboard slots grouped in one category.',
			links: [
				{ href: 'Keyboard/60he-2026.html', label: '2026 Kilowatt build' },
				{ href: 'Keyboard/60he-2025.html', label: '2025 Kilowatt build' },
				{ href: 'Keyboard/60he-2023.html', label: '2023 Crosshair Alpha & v1' },
			],
		},
		{
			href: 'Keyboard/60he-2025.html',
			img: 'Keyboard/images/killowattKeyboard.webp',
			alt: '2025 Kilowatt Wooting 60HE build',
			title: '2025 Kilowatt build',
			desc: 'Latest Wooting 60HE era with Kilowatt-style case and galleries.',
			links: [
				{ href: 'Keyboard/60he-2026.html', label: '2026 Kilowatt build' },
				{ href: 'Keyboard/60he-2023.html', label: '2023 Crosshair Alpha & v1' },
				{ href: `${SETUP}keyboards.html`, label: 'Keyboards' },
			],
		},
		{
			href: 'Keyboard/60he-2023.html',
			img: 'Keyboard/images/Wooting 60HE Top View Wood Background.webp',
			alt: 'Wooting 60HE Crosshair Alpha build',
			title: '2023 Crosshair Alpha & v1',
			desc: 'Earlier Wooting 60HE eras, switches, and build photos.',
			links: [
				{ href: 'Keyboard/60he-2025.html', label: '2025 Kilowatt build' },
				{ href: 'Keyboard/60he-2026.html', label: '2026 Kilowatt build' },
				{ href: `${SETUP}keyboards.html`, label: 'Keyboards' },
			],
		},
		{
			href: `${SETUP}computers.html`,
			img: 'PC/images/pc.webp',
			alt: 'Gaming PC category',
			title: 'Computers',
			desc: 'Current gaming PC and older systems grouped in one category.',
			links: [
				{ href: `${SETUP}gaming-pc.html`, label: '2024 PC build' },
				{ href: 'PC/pc.html', label: 'PC build page' },
				{ href: `${SETUP}legacy-laptop.html`, label: 'Razer Blade 2019' },
			],
		},
		{
			href: 'PC/pc.html',
			img: 'PC/images/pc.webp',
			alt: '2024 custom gaming PC',
			title: 'PC build page',
			desc: 'Full 2024 build write-up with parts, photos, and retailer links.',
			links: [
				{ href: `${SETUP}gaming-pc.html`, label: '2024 PC build' },
				{ href: `${SETUP}computers.html`, label: 'Computers' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}consoles.html`,
			img: 'images/roomSetupDark.webp',
			alt: 'TV and gaming area with consoles',
			title: 'Consoles',
			desc: 'Xbox, PlayStation, Nintendo, handhelds, and legacy systems.',
			links: [
				{ href: `${SETUP}console-nintendo-ds.html`, label: 'Nintendo DS Lite' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
				{ href: `${SETUP}computers.html`, label: 'Computers' },
			],
		},
		{
			href: `${SETUP}displays.html`,
			img: 'images/gamingSetup.webp',
			alt: 'Gaming setup with multiple monitors',
			title: 'Displays',
			desc: 'Main gaming panel, ultrawide, and utility displays.',
			links: [
				{ href: `${SETUP}gaming-monitor.html`, label: 'Gaming monitor' },
				{ href: `${SETUP}ultrawide-monitor.html`, label: 'Ultrawide monitor' },
				{ href: `${SETUP}other-displays.html`, label: 'Asus 24" monitor' },
			],
		},
		{
			href: `${SETUP}lighting-hub.html`,
			img: 'images/lightcontroller.webp',
			alt: 'Desk key light controller',
			title: 'Lighting',
			desc: 'Key light, ambient Govee strips, and lamp cards.',
			links: [
				{ href: `${SETUP}key-light.html`, label: 'Key light' },
				{ href: `${SETUP}lighting.html`, label: 'Ambient lights' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}mice.html`,
			img: 'images/superlight.webp',
			alt: 'Logitech Superlight gaming mouse',
			title: 'Mice',
			desc: 'Main mouse and mouse pad cards with links.',
			links: [
				{ href: `${SETUP}mouse.html`, label: 'Mouse' },
				{ href: `${SETUP}mouse-pad.html`, label: 'Mouse pad' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}furniture.html`,
			img: 'images/RoomSetupLightStanding.webp',
			alt: 'Standing desk setup with lighting',
			title: 'Furniture',
			desc: 'Flexispot E6 desk and room for more furniture picks.',
			links: [
				{ href: `${SETUP}desk.html`, label: 'Desk' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
				{ href: `${SETUP}displays.html`, label: 'Displays' },
			],
		},
		{
			href: `${SETUP}audio.html`,
			img: 'images/streamerx.webp',
			alt: 'Rode Streamer X audio interface',
			title: 'Audio',
			desc: 'Microphone, interface, mic arm, and Beyerdynamic headphones.',
			links: [
				{ href: `${SETUP}microphone.html`, label: 'Microphone' },
				{ href: `${SETUP}audio-interface.html`, label: 'Audio interface' },
				{ href: `${SETUP}headphones.html`, label: 'Headphones' },
			],
		},
		{
			href: `${SETUP}cameras.html`,
			img: GLOBE.blue,
			alt: 'OwenMinerCS logo with blue globe, cameras hub preview',
			title: 'Cameras',
			desc: 'iPhone Pro Max, ZV-E10, Insta360 X5, C920, cage, and tripods.',
			links: [
				{ href: `${SETUP}camera.html`, label: 'Sony ZV-E10' },
				{ href: `${SETUP}insta360-x5.html`, label: 'Insta360 X5' },
				{ href: `${SETUP}webcam.html`, label: 'Logitech C920' },
			],
		},
		{
			href: `${SETUP}cable-management.html`,
			img: 'images/roomSetupDark.webp',
			alt: 'Desk with routed cables',
			title: 'Cable management',
			desc: 'Trays, raceways, wall channels, and reusable straps.',
			links: [
				{ href: `${SETUP}magnets.html`, label: 'Magnetic cable clips' },
				{ href: `${SETUP}networking.html`, label: 'Networking' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}networking.html`,
			img: 'images/roomSetupDark.webp',
			alt: 'Desk area with networking runs',
			title: 'Networking',
			desc: 'Router, long Ethernet runs, and white stick-on wall channels.',
			links: [
				{ href: `${SETUP}cable-management.html`, label: 'Cable management' },
				{ href: `${SETUP}power.html`, label: 'Power' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}power.html`,
			img: GLOBE.purple,
			alt: 'OwenMinerCS logo with purple globe, power hub preview',
			title: 'Power',
			desc: 'Rechargeable AAs, D cells, and under-desk surge protection.',
			links: [
				{ href: `${SETUP}cable-management.html`, label: 'Cable management' },
				{ href: `${SETUP}networking.html`, label: 'Networking' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}mounts-arms.html`,
			img: GLOBE.redText,
			alt: 'OwenMinerCS logo with red globe, mounts and arms preview',
			title: 'Mounts & arms',
			desc: 'Monitor arms, mic arms, webcam arms, and camera mounts.',
			links: [
				{ href: `${SETUP}monitor-arms.html`, label: 'Monitor arms' },
				{ href: `${SETUP}microphone-arm.html`, label: 'Mic arm' },
				{ href: `${SETUP}webcam-arm.html`, label: 'Webcam arm' },
			],
		},
		{
			href: `${SETUP}phones-archive.html`,
			img: 'images/archive/old-pcs/first-keyboard-and-phones.jpg',
			alt: 'First keyboard with iPhone 4S and 8 Plus',
			title: 'Phones archive',
			desc: 'Older iPhones plus first keyboard in frame.',
			links: [
				{ href: `${SETUP}previous-setups.html`, label: 'Setup archive' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
				{ href: `${SETUP}computers.html`, label: 'Computers' },
			],
		},
		{
			href: `${SETUP}plants.html`,
			img: GLOBE.silver,
			alt: 'OwenMinerCS logo with silver globe, plants hub preview',
			title: 'Plants',
			desc: 'Desk plants, pots, grow lights, and fake plant picks.',
			links: [
				{ href: `${SETUP}plants-fake.html`, label: 'Fake plants' },
				{ href: `${SETUP}plants-real.html`, label: 'Real plants' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}clothing.html`,
			img: GLOBE.purpleDark,
			alt: 'OwenMinerCS logo with dark purple globe, outfits preview',
			title: 'Outfits',
			desc: 'Fit checks, stream looks, and apparel links.',
			links: [
				{ href: `${SETUP}coolest-shoes.html`, label: 'Coolest shoes' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
				{ href: 'Socials/socials.html', label: 'Content & socials' },
			],
		},
		{
			href: `${SETUP}workout-equipment.html`,
			img: GLOBE.purpleRed,
			alt: 'OwenMinerCS logo with purple and red globe, workout gear preview',
			title: 'Workout equipment',
			desc: 'Walking pad notes and future gym gear links.',
			links: [
				{ href: `${SETUP}walking-pad.html`, label: 'Walking pad' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
				{ href: `${SETUP}furniture.html`, label: 'Furniture' },
			],
		},
		{
			href: `${SETUP}gadgets.html`,
			img: GLOBE.red,
			alt: 'OwenMinerCS logo with red globe, gadgets preview',
			title: 'Gadgets',
			desc: 'CS2 hand warmers, Ocoopa pocket warmers, and electric air duster.',
			links: [
				{ href: `${SETUP}ocoopa-hand-warmers.html`, label: 'Ocoopa hand warmers' },
				{ href: 'Gaming/cs2-merch.html#cs2-hand-warmers', label: 'CS2 hand warmers' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}tools.html`,
			img: GLOBE.blue,
			alt: 'OwenMinerCS logo with blue globe, tools preview',
			title: 'Tools',
			desc: 'Cordless drill page and iFixit write-up, physical tools only.',
			links: [
				{ href: `${SETUP}drill.html`, label: 'Drill' },
				{ href: `${SETUP}ifixit-tools.html`, label: 'iFixit tool set' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}drill.html`,
			img: GLOBE.purple,
			alt: 'OwenMinerCS logo with purple globe, drill preview',
			title: 'Drill',
			desc: 'Cordless drill, impact bits, and HSS twist bits with Amazon listings.',
			links: [
				{ href: `${SETUP}tools.html`, label: 'Tools' },
				{ href: `${SETUP}ifixit-tools.html`, label: 'iFixit tool set' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: `${SETUP}magnets.html`,
			img: GLOBE.silver,
			alt: 'OwenMinerCS logo with silver globe, magnets preview',
			title: 'Magnets',
			desc: 'Neodymium discs, cable clips, and magnetic charging bits.',
			links: [
				{ href: `${SETUP}cable-management.html`, label: 'Cable management' },
				{ href: `${SETUP}mouse.html`, label: 'Magnetic USB charging' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: 'Socials/socials.html',
			img: 'images/owenminercs-logo.png',
			alt: 'Owen Miner CS logo',
			title: 'Content & socials',
			desc: 'Official profiles, social cloud, and top posts across platforms.',
			links: [
				{ href: 'Socials/view-all-content.html', label: 'View all content' },
				{ href: 'Gaming/gaming.html', label: 'Gaming' },
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
			],
		},
		{
			href: 'dev/dev-stack.html',
			img: GLOBE.darkBlue,
			alt: 'OwenMinerCS logo with dark blue globe, programs preview',
			title: 'Programs',
			desc: 'Cursor, Codex, Adobe, OBS, and the local Ollama stack.',
			links: [
				{ href: 'dev/dev-stack.html#coding', label: 'Cursor' },
				{ href: 'dev/dev-stack.html#streaming', label: 'OBS Studio' },
				{ href: 'dev/dev-stack.html#creative-cloud', label: 'Premiere Pro' },
			],
		},
		{
			href: 'Achievements/achievements.html',
			img: 'images/owenminercs-logo.png',
			alt: 'OwenMinerCS logo',
			title: 'Achievements',
			desc: 'Hunt easter eggs across the site. Progress saved in your browser.',
			links: [
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
				{ href: 'Gaming/gaming.html', label: 'Gaming' },
				{ href: 'Socials/socials.html', label: 'Content & socials' },
			],
		},
		{
			href: 'Garage%20Sale/garage-sale.html',
			img: GLOBE.red,
			alt: 'OwenMinerCS logo with red globe, garage sale preview',
			title: 'Garage sale',
			desc: 'Resale listings when available, direct checkout when linked.',
			links: [
				{ href: `${SETUP}the-setup.html`, label: 'Gear' },
				{ href: 'Gaming/gaming.html', label: 'Gaming' },
				{ href: 'Socials/socials.html', label: 'Content & socials' },
			],
		},
	];

	let visibleExploreCards = [];

	function exploreCardHasRealMedia(card, fetchedSlides) {
		const slides = collectCardSlides(card, fetchedSlides);
		const api = window.owenminercsCarouselFilter;
		if (api && typeof api.slidesHaveRealMedia === 'function') {
			return api.slidesHaveRealMedia(slides);
		}
		return slides.some((slide) => !shouldSkipGallerySrc(slide.src));
	}

	function resolveVisibleExploreCards(slidesByHref) {
		const map = slidesByHref || new Map();
		return EXPLORE_CARDS.filter((card) => {
			const abs = resolveUrl(card.href, window.location.href);
			const fetched = map.get(abs) || [];
			return exploreCardHasRealMedia(card, fetched);
		});
	}

	function visibleCardsChanged(nextCards) {
		if (nextCards.length !== visibleExploreCards.length) return true;
		for (let i = 0; i < nextCards.length; i++) {
			if (nextCards[i] !== visibleExploreCards[i]) return true;
		}
		return false;
	}

	const galleryCache = new Map();
	let slideshowControllers = [];

	function resolveUrl(src, baseHref) {
		try {
			return new URL(src, baseHref).href;
		} catch (e) {
			return src;
		}
	}

	function hash32(str) {
		let h = 2166136261 >>> 0;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 16777619) >>> 0;
		}
		return h >>> 0;
	}

	function shouldSkipGallerySrc(src) {
		const api = window.owenminercsCarouselFilter;
		if (api && typeof api.isCarouselPlaceholderSrc === 'function') {
			return api.isCarouselPlaceholderSrc(src);
		}
		if (!src || /^data:/i.test(src)) return true;
		const lower = src.toLowerCase();
		return (
			lower.includes('coming-soon-card') ||
			lower.includes('owenminercs-logo') ||
			lower.includes('/images/logo/globes/') ||
			lower.includes('logo/globes/globe-') ||
			lower.endsWith('.svg')
		);
	}

	function filterCarouselSlides(slides) {
		const api = window.owenminercsCarouselFilter;
		return api && typeof api.filterCarouselSlides === 'function'
			? api.filterCarouselSlides(slides)
			: slides;
	}

	function extractGallerySlides(doc, baseHref) {
		const seen = Object.create(null);
		const slides = [];

		function pushNodes(nodes) {
			for (let i = 0; i < nodes.length; i++) {
				const node = nodes[i];
				if (node.classList && node.classList.contains('keep-card__thumb--empty')) continue;
				const src = node.getAttribute('src');
				if (!src || shouldSkipGallerySrc(src)) continue;
				const abs = resolveUrl(src, baseHref);
				if (seen[abs]) continue;
				seen[abs] = true;
				slides.push({
					src: abs,
					alt: node.getAttribute('alt') || 'Gallery image',
				});
			}
		}

		pushNodes(doc.querySelectorAll('.photogallery-img[src]'));
		pushNodes(doc.querySelectorAll('.photogallery img[src]'));
		pushNodes(doc.querySelectorAll('.keep-board img.keep-card__thumb[src]'));
		pushNodes(doc.querySelectorAll('.keep-card__thumb-row img[src], .keep-card__thumb-shot img[src]'));
		pushNodes(doc.querySelectorAll('.gallery2 img[src], .pc-build-gallery img[src]'));
		return slides;
	}

	function fetchGallery(href) {
		const absUrl = resolveUrl(href, window.location.href);
		if (galleryCache.has(absUrl)) return galleryCache.get(absUrl);

		const promise = fetch(absUrl, { credentials: 'same-origin' })
			.then((r) => (r.ok ? r.text() : ''))
			.then((html) => {
				if (!html) return [];
				const doc = new DOMParser().parseFromString(html, 'text/html');
				return extractGallerySlides(doc, absUrl);
			})
			.catch(() => []);

		galleryCache.set(absUrl, promise);
		return promise;
	}

	function fetchGalleryBatch(hrefs) {
		const unique = [...new Set(hrefs.map((href) => resolveUrl(href, window.location.href)))];
		let index = 0;

		function worker() {
			if (index >= unique.length) return Promise.resolve();
			const href = unique[index++];
			return fetchGallery(href).then(worker);
		}

		const workers = [];
		for (let i = 0; i < Math.min(FETCH_CONCURRENCY, unique.length); i++) {
			workers.push(worker());
		}
		return Promise.all(workers);
	}

	function collectCardSlides(card, fetchedSlides) {
		const seen = new Set();
		const out = [];

		function push(src, alt) {
			if (!src || shouldSkipGallerySrc(src)) return;
			const abs = resolveUrl(src, window.location.href);
			if (seen.has(abs)) return;
			seen.add(abs);
			out.push({ src: abs, alt: alt || card.alt || 'Preview image' });
		}

		push(card.img, card.alt);
		if (Array.isArray(card.gallery)) {
			card.gallery.forEach((src) => push(src, card.alt));
		}
		fetchedSlides.forEach((slide) => push(slide.src, slide.alt));
		return out.slice(0, MAX_SLIDES_PER_CARD);
	}

	function mergeSlidesForCard(card, fetchedSlides) {
		return filterCarouselSlides(collectCardSlides(card, fetchedSlides));
	}

	function destroyAllSlideshows() {
		slideshowControllers.forEach((controller) => controller.destroy());
		slideshowControllers = [];
	}

	function startCardSlideshow(media, slides, staggerKey, viewport) {
		const reducedMotion =
			window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reducedMotion || slides.length < 2) return null;

		const card = media.closest('.home-explore-card');
		if (!card) return null;

		media.classList.add('home-explore-card__media--slideshow');

		const imgA = media.querySelector('img');
		if (!imgA) return null;

		const imgB = document.createElement('img');
		imgB.className = 'home-explore-card__slide';
		imgB.width = 640;
		imgB.height = 360;
		imgB.decoding = 'async';
		imgB.loading = 'lazy';
		imgB.draggable = false;
		imgA.classList.add('home-explore-card__slide', 'home-explore-card__slide--visible');
		imgA.draggable = false;
		media.appendChild(imgB);

		let idx = 0;
		let active = imgA;
		let idle = imgB;
		let timer = null;
		let paused = false;
		let visible = true;
		let destroyed = false;

		imgA.src = slides[0].src;
		imgA.alt = slides[0].alt;
		imgB.src = slides[1].src;
		imgB.alt = slides[1].alt;

		function clearTimer() {
			if (timer !== null) {
				window.clearTimeout(timer);
				timer = null;
			}
		}

		function scheduleNext(delayMs) {
			clearTimer();
			if (destroyed || paused || !visible || slides.length < 2) return;
			timer = window.setTimeout(tick, delayMs);
		}

		function tick() {
			const nextIdx = (idx + 1) % slides.length;
			const preloadIdx = (nextIdx + 1) % slides.length;

			idle.src = slides[nextIdx].src;
			idle.alt = slides[nextIdx].alt;

			window.requestAnimationFrame(() => {
				active.classList.remove('home-explore-card__slide--visible');
				idle.classList.add('home-explore-card__slide--visible');
			});

			window.setTimeout(() => {
				if (destroyed) return;
				idx = nextIdx;
				const oldActive = active;
				active = idle;
				idle = oldActive;
				idle.src = slides[preloadIdx].src;
				idle.alt = slides[preloadIdx].alt;
				idle.classList.remove('home-explore-card__slide--visible');
				scheduleNext(SLIDE_HOLD_MS);
			}, SLIDE_FADE_MS);
		}

		function pause() {
			paused = true;
			clearTimer();
		}

		function resume() {
			if (destroyed || !paused) return;
			paused = false;
			if (visible) scheduleNext(SLIDE_HOLD_MS);
		}

		function onCardEnter() {
			pause();
		}

		function onCardLeave(event) {
			if (event.type === 'focusout' && card.contains(event.relatedTarget)) return;
			resume();
		}

		function onVisibilityChange() {
			if (document.visibilityState === 'hidden') pause();
			else if (!card.matches(':hover') && !card.contains(document.activeElement)) resume();
		}

		card.addEventListener('mouseenter', onCardEnter);
		card.addEventListener('mouseleave', onCardLeave);
		card.addEventListener('focusin', onCardEnter);
		card.addEventListener('focusout', onCardLeave);
		document.addEventListener('visibilitychange', onVisibilityChange);

		let observer = null;
		if (viewport && 'IntersectionObserver' in window) {
			observer = new IntersectionObserver(
				(entries) => {
					visible = entries[0]?.isIntersecting !== false;
					if (visible && !paused) scheduleNext(SLIDE_HOLD_MS);
					else clearTimer();
				},
				{ root: viewport, threshold: 0.12 }
			);
			observer.observe(card);
		}

		const initialDelay = hash32(staggerKey || '') % 900;
		scheduleNext(SLIDE_HOLD_MS + initialDelay);

		const controller = {
			destroy() {
				destroyed = true;
				clearTimer();
				card.removeEventListener('mouseenter', onCardEnter);
				card.removeEventListener('mouseleave', onCardLeave);
				card.removeEventListener('focusin', onCardEnter);
				card.removeEventListener('focusout', onCardLeave);
				document.removeEventListener('visibilitychange', onVisibilityChange);
				if (observer) observer.disconnect();
			},
		};
		slideshowControllers.push(controller);
		return controller;
	}

	function initExploreSlideshows(track, viewport, onVisibilityResolved) {
		const cards = track.querySelectorAll('.home-explore-card[data-explore-href]');
		if (!cards.length) return;

		const hrefToConfig = new Map();
		EXPLORE_CARDS.forEach((card) => {
			const abs = resolveUrl(card.href, window.location.href);
			if (!hrefToConfig.has(abs)) hrefToConfig.set(abs, card);
		});

		const hrefs = [...hrefToConfig.keys()];
		fetchGalleryBatch(hrefs).then(() =>
			Promise.all(hrefs.map((absHref) => fetchGallery(hrefToConfig.get(absHref).href))).then(
				(results) => {
					const fetchedByHref = new Map();
					const slidesByHref = new Map();
					hrefs.forEach((absHref, i) => {
						const fetched = results[i] || [];
						fetchedByHref.set(absHref, fetched);
						slidesByHref.set(
							absHref,
							mergeSlidesForCard(hrefToConfig.get(absHref), fetched)
						);
					});

					if (typeof onVisibilityResolved === 'function') {
						onVisibilityResolved(fetchedByHref);
					}

					cards.forEach((cardEl) => {
						const href = resolveUrl(
							cardEl.getAttribute('data-explore-href'),
							window.location.href
						);
						const slides = slidesByHref.get(href) || [];
						const media = cardEl.querySelector('.home-explore-card__media');
						if (!media || slides.length < 2) return;
						startCardSlideshow(media, slides, href, viewport);
					});
				}
			)
		);
	}

	function escapeHtml(str) {
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function renderTags(tags) {
		if (!tags || !tags.length) return '';
		return tags
			.map((tag, i) => {
				const dot =
					i > 0 ? '<span class="home-explore-card__dot" aria-hidden="true">·</span>' : '';
				return `${dot}<span>${escapeHtml(tag)}</span>`;
			})
			.join('');
	}

	function getCardTheme(card) {
		const img = (card.img || '').toLowerCase();
		const href = (card.href || '').toLowerCase();
		const title = (card.title || '').toLowerCase();

		if (img.includes('labubu') || title.includes('labubu')) return 'gold-amber';
		if (
			img.includes('kilowatt') ||
			img.includes('wooting') ||
			href.includes('keyboard/') ||
			href.includes('keyboards')
		) {
			return 'kilowatt-orange';
		}
		if (img.includes('csshelves') || title.includes('merch')) return 'warm-amber';
		if (
			img.includes('pc.webp') ||
			href.includes('pc/') ||
			href.includes('computers') ||
			title.includes('pc build')
		) {
			return 'cyan-teal';
		}
		if (img.includes('owenminercs-logo') || href.includes('achievements') || href.includes('socials')) {
			return 'brand-green';
		}
		if (href.includes('dev-stack') || href.includes('garage-sale')) return 'brand-green';
		if (
			img.includes('roomsetuplightstanding') ||
			img.includes('lightcontroller') ||
			img.includes('first-keyboard') ||
			img.includes('superlight') ||
			img.includes('streamerx')
		) {
			return 'warm-amber';
		}
		if (img.includes('coming-soon')) return 'neutral-slate';
		if (
			img.includes('roomsetup') ||
			img.includes('gamingsetup') ||
			img.includes('desktop_background') ||
			img.includes('smoke')
		) {
			return 'cool-blue-purple';
		}
		return 'cool-blue-purple';
	}

	function renderLinks(links) {
		if (!links || !links.length) return '';
		const items = links
			.map(
				(link) =>
					`<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`
			)
			.join('');
		return `<ul class="home-explore-card__links">${items}</ul>`;
	}

	function renderCard(card) {
		const tagsHtml = card.links?.length
			? renderLinks(card.links)
			: card.tags
				? `<p class="home-explore-card__tags">${renderTags(card.tags)}</p>`
				: '';
		const theme = getCardTheme(card);
		return `<article class="home-explore-card" data-card-theme="${escapeHtml(theme)}" data-explore-href="${escapeHtml(card.href)}">
			<a class="home-explore-card__primary" href="${escapeHtml(card.href)}" aria-label="${escapeHtml(card.title)}"></a>
			<span class="home-explore-card__media">
				<img class="home-explore-card__slide" src="${escapeHtml(card.img)}" width="640" height="360" loading="lazy" decoding="async" draggable="false" alt="${escapeHtml(card.alt)}" />
			</span>
			<div class="home-explore-card__body">
				<p class="home-explore-card__title">${escapeHtml(card.title)}</p>
				<p class="home-explore-card__desc">${escapeHtml(card.desc)}</p>
				${tagsHtml}
			</div>
		</article>`;
	}

	function wireExploreCardClicks(track) {
		track.querySelectorAll('.home-explore-card[data-explore-href]:not([data-explore-clone])').forEach((card) => {
			const href = card.getAttribute('data-explore-href');
			if (!href || card.dataset.exploreClickBound === '1') return;
			card.dataset.exploreClickBound = '1';
			card.addEventListener('click', (e) => {
				if (e.defaultPrevented) return;
				if (e.target.closest('.home-explore-card__links a[href]')) return;
				window.location.href = href;
			});
		});
	}

	function getVisibleCount(viewportWidth) {
		if (viewportWidth <= 560) return 1;
		if (viewportWidth <= 720) return 2;
		if (viewportWidth <= 1000) return 3;
		if (viewportWidth <= 1280) return 4;
		return 5;
	}

	function mod(n, m) {
		return ((n % m) + m) % m;
	}

	function disableNativeImageDrag(container) {
		if (!container) return;
		container.querySelectorAll('img').forEach((img) => {
			img.draggable = false;
		});
	}

	function initCarousel(root) {
		const track = root.querySelector('[data-home-explore-track]');
		const viewport = root.querySelector('.home-explore-carousel__viewport');
		const prevBtn = root.querySelector('.home-explore-carousel__nav--prev');
		const nextBtn = root.querySelector('.home-explore-carousel__nav--next');
		if (!track || !viewport || !prevBtn || !nextBtn) return;

		const INITIAL_AUTO_MS = 1400;
		const AUTO_MS = 3800;
		const HOLD_MS = 280;
		const DRAG_THRESHOLD = 6;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		let cloneCount = 4;
		let originalCount = visibleExploreCards.length;
		let slideIndex = 0;
		let autoTimer = null;
		let holdTimer = null;
		let pointerActive = false;
		let dragging = false;
		let didDrag = false;
		let dragStartX = 0;
		let dragOriginIndex = 0;
		let activePointerId = null;
		let hoverPaused = false;
		let focusPaused = false;
		let interactionPaused = false;

		function readGap() {
			const styles = getComputedStyle(track);
			return parseFloat(styles.columnGap || styles.gap) || 0;
		}

		function stepPx() {
			const card = track.querySelector('.home-explore-card:not([data-explore-clone])');
			if (!card) return 0;
			return card.getBoundingClientRect().width + readGap();
		}

		function setTranslatePx(px, animate) {
			if (reducedMotion || animate === false) track.style.transition = 'none';
			else track.style.transition = '';
			track.style.transform = `translate3d(${-px}px, 0, 0)`;
		}

		function syncNormalize() {
			if (slideIndex >= cloneCount + originalCount || slideIndex <= 0) {
				slideIndex = normalizeSlideIndex(slideIndex);
				setTranslatePx(slideIndex * stepPx(), false);
			}
		}

		function setSlideIndex(index, animate) {
			slideIndex = index;
			const shouldAnimate = animate !== false && !reducedMotion;
			setTranslatePx(slideIndex * stepPx(), shouldAnimate);
			if (!shouldAnimate) syncNormalize();
		}

		function normalizeLoopIndex(rawIndex) {
			return cloneCount + mod(rawIndex - cloneCount, originalCount);
		}

		function onTransitionEnd(event) {
			if (event.target !== track || event.propertyName !== 'transform') return;
			syncNormalize();
		}

		function buildTrack() {
			destroyAllSlideshows();

			const tmp = document.createElement('div');
			tmp.innerHTML = visibleExploreCards.map(renderCard).join('');
			const cards = [...tmp.children];
			originalCount = cards.length;
			if (!originalCount) {
				track.innerHTML = '';
				stopAuto();
				return;
			}
			cloneCount = Math.min(getVisibleCount(viewport.clientWidth), originalCount);

			track.innerHTML = '';
			const tailStart = Math.max(0, originalCount - cloneCount);
			for (let i = tailStart; i < originalCount; i++) {
				const clone = cards[i].cloneNode(true);
				clone.dataset.exploreClone = '1';
				clone.setAttribute('aria-hidden', 'true');
				clone.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', '-1'));
				track.appendChild(clone);
			}
			cards.forEach((card) => track.appendChild(card));
			for (let i = 0; i < cloneCount; i++) {
				const clone = cards[i].cloneNode(true);
				clone.dataset.exploreClone = '1';
				clone.setAttribute('aria-hidden', 'true');
				clone.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', '-1'));
				track.appendChild(clone);
			}

			slideIndex = cloneCount;
			setSlideIndex(slideIndex, false);
			disableNativeImageDrag(track);
			wireExploreCardClicks(track);
			initExploreSlideshows(track, viewport, onGalleryVisibilityResolved);
		}

		function onGalleryVisibilityResolved(fetchedByHref) {
			const nextVisible = resolveVisibleExploreCards(fetchedByHref);
			if (!visibleCardsChanged(nextVisible)) return;

			const pxBefore = originalCount ? mod(slideIndex - cloneCount, originalCount) : 0;
			visibleExploreCards = nextVisible;
			buildTrack();
			if (!visibleExploreCards.length) return;
			setSlideIndex(cloneCount + mod(pxBefore, visibleExploreCards.length), false);
			startAuto();
		}

		function normalizeSlideIndex(index) {
			if (index >= cloneCount + originalCount) return cloneCount;
			if (index <= 0) return originalCount;
			return index;
		}

		function go(delta, animate) {
			setSlideIndex(slideIndex + delta, animate !== false);
		}

		function goInstant(delta) {
			let next = slideIndex + delta;
			if (next >= cloneCount + originalCount) next = cloneCount;
			else if (next <= 0) next = originalCount;
			setSlideIndex(next, false);
		}

		function stopAuto() {
			if (autoTimer !== null) {
				window.clearTimeout(autoTimer);
				autoTimer = null;
			}
		}

		function canAutoPlay() {
			return (
				!reducedMotion &&
				!dragging &&
				!holdTimer &&
				!pointerActive &&
				!interactionPaused &&
				!hoverPaused &&
				!focusPaused
			);
		}

		function tryResumeAuto() {
			if (canAutoPlay()) startAuto();
		}

		function startAuto() {
			stopAuto();
			if (!canAutoPlay()) return;
			autoTimer = window.setTimeout(function firstAutoStep() {
				go(1);
				autoTimer = window.setInterval(() => go(1), AUTO_MS);
			}, INITIAL_AUTO_MS);
		}

		function stopHold() {
			if (holdTimer) {
				window.clearInterval(holdTimer);
				holdTimer = null;
			}
		}

		function bindHoldButton(btn, delta) {
			const startHold = (event) => {
				event.preventDefault();
				stopAuto();
				stopHold();
				goInstant(delta);
				holdTimer = window.setInterval(() => goInstant(delta), HOLD_MS);
			};
			const stopHoldSafe = () => {
				stopHold();
				if (!dragging) tryResumeAuto();
			};

			btn.addEventListener('pointerdown', startHold);
			btn.addEventListener('pointerup', stopHoldSafe);
			btn.addEventListener('pointerleave', stopHoldSafe);
			btn.addEventListener('pointercancel', stopHoldSafe);
			btn.addEventListener('click', (event) => event.preventDefault());
		}

		function clearPointerListeners() {
			document.removeEventListener('pointermove', onPointerMove);
			document.removeEventListener('pointerup', onPointerEnd);
			document.removeEventListener('pointercancel', onPointerEnd);
		}

		function endDrag(event) {
			const step = stepPx();
			const dx = event.clientX - dragStartX;
			const currentPx = dragOriginIndex * step - dx;
			const rawIndex = step > 0 ? Math.round(currentPx / step) : slideIndex;
			const nextIndex = normalizeLoopIndex(rawIndex);
			setSlideIndex(nextIndex, !reducedMotion);
		}

		function onPointerMove(event) {
			if (!pointerActive || event.pointerId !== activePointerId) return;
			const dx = event.clientX - dragStartX;
			if (!dragging && Math.abs(dx) > DRAG_THRESHOLD) {
				dragging = true;
				didDrag = true;
				root.classList.add('home-explore-carousel--dragging');
				viewport.setPointerCapture(event.pointerId);
				track.style.transition = 'none';
			}
			if (!dragging) return;
			event.preventDefault();
			const px = dragOriginIndex * stepPx() - dx;
			setTranslatePx(px, false);
		}

		function onPointerEnd(event) {
			if (!pointerActive || event.pointerId !== activePointerId) return;
			clearPointerListeners();
			if (viewport.hasPointerCapture(event.pointerId)) {
				viewport.releasePointerCapture(event.pointerId);
			}
			if (dragging) endDrag(event);
			pointerActive = false;
			dragging = false;
			interactionPaused = false;
			activePointerId = null;
			root.classList.remove('home-explore-carousel--dragging');
			tryResumeAuto();
		}

		bindHoldButton(prevBtn, -1);
		bindHoldButton(nextBtn, 1);

		viewport.addEventListener('dragstart', (event) => event.preventDefault(), true);

		viewport.addEventListener('pointerdown', (event) => {
			if (event.button !== 0 || event.target.closest('.home-explore-carousel__nav')) return;
			pointerActive = true;
			dragging = false;
			didDrag = false;
			interactionPaused = true;
			activePointerId = event.pointerId;
			dragStartX = event.clientX;
			dragOriginIndex = slideIndex;
			stopAuto();
			stopHold();
			document.addEventListener('pointermove', onPointerMove);
			document.addEventListener('pointerup', onPointerEnd);
			document.addEventListener('pointercancel', onPointerEnd);
		});

		viewport.addEventListener(
			'click',
			(event) => {
				if (!didDrag) return;
				event.preventDefault();
				event.stopPropagation();
				didDrag = false;
			},
			true
		);

		track.addEventListener('transitionend', onTransitionEnd);

		root.addEventListener('mouseenter', () => {
			hoverPaused = true;
			stopAuto();
		});
		root.addEventListener('mouseleave', () => {
			hoverPaused = false;
			stopHold();
			if (!dragging) tryResumeAuto();
		});
		root.addEventListener('focusin', () => {
			focusPaused = true;
			stopAuto();
		});
		root.addEventListener('focusout', (event) => {
			if (!root.contains(event.relatedTarget)) {
				focusPaused = false;
				tryResumeAuto();
			}
		});

		let resizeTimer = null;
		window.addEventListener('resize', () => {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(() => {
				const pxBefore = mod(slideIndex - cloneCount, originalCount);
				buildTrack();
				setSlideIndex(cloneCount + pxBefore, false);
			}, 120);
		});

		visibleExploreCards = resolveVisibleExploreCards(new Map());
		buildTrack();
		startAuto();
	}

	document.addEventListener('DOMContentLoaded', () => {
		document.querySelectorAll('[data-home-explore-carousel]').forEach(initCarousel);
	});
})();
