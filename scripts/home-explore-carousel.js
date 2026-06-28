/**
 * Home page — Explore the site carousel: renders hub cards and auto-cycles with hover nav.
 */
(function () {
	const PLACEHOLDER = 'images/coming-soon-card.svg';
	const SETUP = 'The%20Setup/';

	const EXPLORE_CARDS = [
		{
			href: 'Keyboard/60he.html',
			img: 'Keyboard/images/killowattKeyboard.webp',
			alt: 'Wooting 60HE Kilowatt keyboard build',
			title: 'Wooting 60HE keyboard build',
			desc: 'Cases, switches, keycaps, silicone dampening, galleries, and build eras.',
			tags: ['Parts', 'Switches', 'Keycaps'],
		},
		{
			href: 'Gaming/gaming.html',
			img: 'images/csShelves.webp',
			alt: 'CS2 Major merchandise on shelves',
			title: 'Gaming — Counter-Strike',
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
			tags: ['Specs', 'Parts list', 'Gallery'],
		},
		{
			href: `${SETUP}the-setup.html`,
			img: 'images/gamingSetup.webp',
			alt: 'Gear desk setup with monitors',
			title: 'Gear',
			desc: 'Desk, monitors, audio, lighting, peripherals, plants, and priced gear cards.',
			tags: ['Desk', 'Monitors', 'Peripherals'],
		},
		{
			href: 'Counter-Strike/nosmoking.html',
			img: 'images/Desktop_background/smoke v2 black background.png',
			alt: 'Agent Number K CS2 wallpaper preview',
			title: 'Agent Number K Wallpapers',
			desc: 'Free Agent Number K CS2 wallpapers (No Smoking theme).',
			tags: ['Wallpapers', 'CS2', 'Free'],
		},
		{
			href: 'Gaming/counter-strike-background.html',
			img: 'images/roomSetupDark.webp',
			alt: 'Gaming setup with multiple displays',
			title: 'Counter-Strike background',
			desc: 'From 2015 community servers to FACEIT level 10 and Premier leaderboard runs.',
			tags: ['FACEIT', 'Story', 'CS2'],
		},
		{
			href: 'Gaming/cs2-merch.html',
			img: 'images/csShelves.webp',
			alt: 'PGL Shanghai Major merch shelves',
			title: 'CS2 Major merch',
			desc: 'PGL Shanghai Major shelves—collectibles and display pieces.',
			tags: ['Merch', 'Shanghai Major', 'Collectibles'],
		},
		{
			href: 'Gaming/cs2-videos.html',
			img: 'images/roomSetupDark.webp',
			alt: 'Multi-monitor gaming setup',
			title: 'CS2 videos',
			desc: 'Long-form, Shorts, and clips from YouTube and TikTok.',
			tags: ['YouTube', 'TikTok', 'Clips'],
		},
		{
			href: 'Gaming/ohnepixel-labubu.html',
			img: 'Counter-Strike/ohnepixel-labubu/ohnepixel-gold-labubu-thumb.png',
			alt: 'Ohnepixel holding the 24K Gold Labubu plush',
			title: 'Ohnepixel Gold³ Labubu',
			desc: '24K Gold³ Labubu unboxing and Shorts with Ohnepixel.',
			tags: ['Video', 'Ohnepixel', 'Unboxing'],
		},
		{
			href: 'Gaming/cs2-dust2-gap-bug.html',
			img: 'images/roomSetupDark.webp',
			alt: 'Dust II wall crack gameplay tip',
			title: 'Dust II wall crack bug',
			desc: 'Tiny geometry gap that can reveal your position—map tweak notes included.',
			tags: ['CS2', 'Dust II', 'Tip'],
		},
		{
			href: `${SETUP}previous-setups.html`,
			img: 'images/roomSetupDark.webp',
			alt: 'Past desk and gaming setup photos',
			title: 'Setup archive',
			desc: 'Year-by-year setup archive cards with wide desk shots.',
			tags: ['Archive', 'Desk', 'History'],
		},
		{
			href: `${SETUP}keyboards.html`,
			img: 'Keyboard/images/killowattKeyboard.webp',
			alt: 'Wooting 60HE keyboard category',
			title: 'Keyboards',
			desc: 'Wooting build and future keyboard slots grouped in one category.',
			tags: ['Wooting', 'Category', 'Peripherals'],
		},
		{
			href: 'Keyboard/60he-2025.html',
			img: 'Keyboard/images/killowattKeyboard.webp',
			alt: '2025 Kilowatt Wooting 60HE build',
			title: '2025 Kilowatt build',
			desc: 'Latest Wooting 60HE era with Kilowatt-style case and galleries.',
			tags: ['2025', 'Kilowatt', 'Build'],
		},
		{
			href: 'Keyboard/60he-2023.html',
			img: 'Keyboard/images/Wooting 60HE Top View Wood Background.webp',
			alt: 'Wooting 60HE Crosshair Alpha build',
			title: '2023 Crosshair Alpha & v1',
			desc: 'Earlier Wooting 60HE eras, switches, and build photos.',
			tags: ['2023', 'Archive', 'Wooting'],
		},
		{
			href: `${SETUP}computers.html`,
			img: 'PC/images/pc.webp',
			alt: 'Gaming PC category',
			title: 'Computers',
			desc: 'Current gaming PC and older systems grouped in one category.',
			tags: ['PC', '4090', 'Category'],
		},
		{
			href: 'PC/pc.html',
			img: 'PC/images/pc.webp',
			alt: '2024 custom gaming PC',
			title: 'PC build page',
			desc: 'Full 2024 build write-up with parts, photos, and retailer links.',
			tags: ['Ryzen', 'RTX 4090', 'Gallery'],
		},
		{
			href: `${SETUP}consoles.html`,
			img: 'images/roomSetupDark.webp',
			alt: 'TV and gaming area with consoles',
			title: 'Consoles',
			desc: 'Xbox, PlayStation, Nintendo, handhelds, and legacy systems.',
			tags: ['Xbox', 'PlayStation', 'Nintendo'],
		},
		{
			href: `${SETUP}monitors.html`,
			img: 'images/gamingSetup.webp',
			alt: 'Gaming setup with multiple monitors',
			title: 'Monitors',
			desc: 'Main gaming panel, ultrawide, and utility displays.',
			tags: ['Ultrawide', 'Displays', 'Desk'],
		},
		{
			href: `${SETUP}lighting-hub.html`,
			img: 'images/lightcontroller.webp',
			alt: 'Desk key light controller',
			title: 'Lighting',
			desc: 'Key light, ambient Govee strips, and lamp cards.',
			tags: ['Key light', 'Govee', 'Ambient'],
		},
		{
			href: `${SETUP}mice.html`,
			img: 'images/superlight.webp',
			alt: 'Logitech Superlight gaming mouse',
			title: 'Mice',
			desc: 'Main mouse and mouse pad cards with links.',
			tags: ['Mouse', 'Superlight', 'Pad'],
		},
		{
			href: `${SETUP}furniture.html`,
			img: 'images/RoomSetupLightStanding.webp',
			alt: 'Standing desk setup with lighting',
			title: 'Furniture',
			desc: 'Flexispot E6 desk and room for more furniture picks.',
			tags: ['Desk', 'Flexispot', 'Standing'],
		},
		{
			href: `${SETUP}audio.html`,
			img: 'images/streamerx.webp',
			alt: 'Rode Streamer X audio interface',
			title: 'Audio',
			desc: 'Microphone, interface, mic arm, and Beyerdynamic headphones.',
			tags: ['Mic', 'Interface', 'Headphones'],
		},
		{
			href: `${SETUP}cameras.html`,
			img: PLACEHOLDER,
			alt: 'Streaming and content cameras',
			title: 'Cameras',
			desc: 'iPhone Pro Max, ZV-E10, Insta360 X5, C920, cage, and tripods.',
			tags: ['Sony', 'Insta360', 'Webcam'],
		},
		{
			href: `${SETUP}cable-management.html`,
			img: 'images/roomSetupDark.webp',
			alt: 'Desk with routed cables',
			title: 'Cable management',
			desc: 'Trays, raceways, wall channels, and reusable straps.',
			tags: ['Cables', 'Routing', 'Desk'],
		},
		{
			href: `${SETUP}networking.html`,
			img: 'images/roomSetupDark.webp',
			alt: 'Desk area with networking runs',
			title: 'Networking',
			desc: 'Router, long Ethernet runs, and white stick-on wall channels.',
			tags: ['Ethernet', 'Router', 'Channels'],
		},
		{
			href: `${SETUP}power.html`,
			img: PLACEHOLDER,
			alt: 'Power strips and rechargeable batteries',
			title: 'Power',
			desc: 'Rechargeable AAs, D cells, and under-desk surge protection.',
			tags: ['Batteries', 'Surge', 'Desk'],
		},
		{
			href: `${SETUP}mounts-arms.html`,
			img: PLACEHOLDER,
			alt: 'Monitor and mic arms',
			title: 'Mounts & arms',
			desc: 'Monitor arms, mic arms, webcam arms, and camera mounts.',
			tags: ['Arms', 'Mounts', 'Desk'],
		},
		{
			href: `${SETUP}phones-archive.html`,
			img: 'images/archive/old-pcs/first-keyboard-and-phones.jpg',
			alt: 'First keyboard with iPhone 4S and 8 Plus',
			title: 'Phones archive',
			desc: 'Older iPhones plus first keyboard in frame.',
			tags: ['Archive', 'iPhone', 'History'],
		},
		{
			href: `${SETUP}plants.html`,
			img: PLACEHOLDER,
			alt: 'Desk plants category',
			title: 'Plants',
			desc: 'Desk plants, pots, grow lights, and fake plant picks.',
			tags: ['Plants', 'Desk', 'Greenery'],
		},
		{
			href: `${SETUP}clothing.html`,
			img: PLACEHOLDER,
			alt: 'Outfits and fit checks',
			title: 'Outfits',
			desc: 'Fit checks, stream looks, apparel links, and OBS multi-camera routing.',
			tags: ['Fit check', 'Stream', 'OBS'],
		},
		{
			href: 'Desk%20Setup/fit-check.html',
			img: PLACEHOLDER,
			alt: 'OBS multi-camera fit check',
			title: 'Multi-camera fit check',
			desc: 'Route cameras to each monitor and TV for on-stream outfit checks.',
			tags: ['OBS', 'Cameras', 'Monitors'],
		},
		{
			href: `${SETUP}workout-equipment.html`,
			img: PLACEHOLDER,
			alt: 'Walking pad and workout gear',
			title: 'Workout equipment',
			desc: 'Walking pad notes and future gym gear links.',
			tags: ['Walking pad', 'Fitness', 'Desk'],
		},
		{
			href: `${SETUP}gadgets.html`,
			img: PLACEHOLDER,
			alt: 'Desk gadgets and hand warmers',
			title: 'Gadgets',
			desc: 'CS2 hand warmers, Ocoopa pocket warmers, and electric air duster.',
			tags: ['Warmers', 'LAN', 'Desk'],
		},
		{
			href: `${SETUP}tools.html`,
			img: PLACEHOLDER,
			alt: 'Physical tools for desk setup',
			title: 'Tools',
			desc: 'Cordless drill page and iFixit write-up—physical tools only.',
			tags: ['Drill', 'iFixit', 'Build'],
		},
		{
			href: `${SETUP}drill.html`,
			img: PLACEHOLDER,
			alt: 'Cordless drill and bits',
			title: 'Drill',
			desc: 'Cordless drill, impact bits, and HSS twist bits with Amazon listings.',
			tags: ['Drill', 'Bits', 'Amazon'],
		},
		{
			href: `${SETUP}magnets.html`,
			img: PLACEHOLDER,
			alt: 'Desk magnets and cable clips',
			title: 'Magnets',
			desc: 'Neodymium discs, cable clips, and magnetic charging bits.',
			tags: ['Magnets', 'Cable clips', 'Desk'],
		},
		{
			href: 'Socials/socials.html',
			img: 'images/owenminercs-logo.png',
			alt: 'Owen Miner CS logo',
			title: 'Content & socials',
			desc: 'Official profiles, social cloud, and top posts across platforms.',
			tags: ['YouTube', 'X', 'TikTok'],
		},
		{
			href: 'dev/dev-stack.html',
			img: PLACEHOLDER,
			alt: 'Programs and coding stack',
			title: 'Programs',
			desc: 'Cursor, Codex, Adobe, OBS, and the local Ollama stack.',
			tags: ['Cursor', 'OBS', 'Dev'],
		},
		{
			href: 'Achievements/achievements.html',
			img: 'images/owenminercs-logo.png',
			alt: 'OwenMinerCS logo',
			title: 'Achievements',
			desc: 'Hunt easter eggs across the site—progress saved in your browser.',
			tags: ['Easter eggs', 'Fun', 'Progress'],
		},
		{
			href: 'Garage%20Sale/garage-sale.html',
			img: PLACEHOLDER,
			alt: 'Garage sale listings',
			title: 'Garage sale',
			desc: 'Resale listings when available—direct checkout when linked.',
			tags: ['Shop', 'Resale', 'Listings'],
		},
	];

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
		const tagsHtml = card.tags
			? `<p class="home-explore-card__tags">${renderTags(card.tags)}</p>`
			: renderLinks(card.links);
		return `<article class="home-explore-card">
			<a class="home-explore-card__primary" href="${escapeHtml(card.href)}">
				<span class="home-explore-card__media">
					<img src="${escapeHtml(card.img)}" width="640" height="360" loading="lazy" decoding="async" alt="${escapeHtml(card.alt)}" />
				</span>
			</a>
			<div class="home-explore-card__body">
				<p class="home-explore-card__title"><a href="${escapeHtml(card.href)}">${escapeHtml(card.title)}</a></p>
				<p class="home-explore-card__desc">${escapeHtml(card.desc)}</p>
				${tagsHtml}
			</div>
		</article>`;
	}

	function getVisibleCount(viewportWidth) {
		if (viewportWidth <= 560) return 1;
		if (viewportWidth <= 900) return 2;
		if (viewportWidth <= 1200) return 3;
		return 4;
	}

	function mod(n, m) {
		return ((n % m) + m) % m;
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
		let originalCount = EXPLORE_CARDS.length;
		let slideIndex = 0;
		let autoTimer = null;
		let holdTimer = null;
		let dragging = false;
		let didDrag = false;
		let dragStartX = 0;
		let dragOriginIndex = 0;
		let activePointerId = null;

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
			const tmp = document.createElement('div');
			tmp.innerHTML = EXPLORE_CARDS.map(renderCard).join('');
			const cards = [...tmp.children];
			originalCount = cards.length;
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

		function startAuto() {
			stopAuto();
			if (reducedMotion || dragging || holdTimer) return;
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
				if (!dragging) startAuto();
			};

			btn.addEventListener('pointerdown', startHold);
			btn.addEventListener('pointerup', stopHoldSafe);
			btn.addEventListener('pointerleave', stopHoldSafe);
			btn.addEventListener('pointercancel', stopHoldSafe);
			btn.addEventListener('click', (event) => event.preventDefault());
		}

		function endDrag(event) {
			if (!dragging) return;
			dragging = false;
			activePointerId = null;
			root.classList.remove('home-explore-carousel--dragging');

			if (track.hasPointerCapture(event.pointerId)) {
				track.releasePointerCapture(event.pointerId);
			}

			const step = stepPx();
			const dx = event.clientX - dragStartX;
			const currentPx = dragOriginIndex * step - dx;
			const rawIndex = step > 0 ? Math.round(currentPx / step) : slideIndex;
			const nextIndex = normalizeLoopIndex(rawIndex);
			setSlideIndex(nextIndex, !reducedMotion);
			startAuto();
		}

		bindHoldButton(prevBtn, -1);
		bindHoldButton(nextBtn, 1);

		viewport.addEventListener('pointerdown', (event) => {
			if (event.button !== 0 || event.target.closest('.home-explore-carousel__nav')) return;
			dragging = true;
			didDrag = false;
			activePointerId = event.pointerId;
			dragStartX = event.clientX;
			dragOriginIndex = slideIndex;
			root.classList.add('home-explore-carousel--dragging');
			track.setPointerCapture(event.pointerId);
			track.style.transition = 'none';
			stopAuto();
			stopHold();
		});

		track.addEventListener('pointermove', (event) => {
			if (!dragging || event.pointerId !== activePointerId) return;
			const dx = event.clientX - dragStartX;
			if (Math.abs(dx) > DRAG_THRESHOLD) {
				didDrag = true;
				event.preventDefault();
			}
			const px = dragOriginIndex * stepPx() - dx;
			setTranslatePx(px, false);
		});

		track.addEventListener('pointerup', endDrag);
		track.addEventListener('pointercancel', endDrag);

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

		root.addEventListener('mouseenter', stopAuto);
		root.addEventListener('mouseleave', () => {
			stopHold();
			if (!dragging) startAuto();
		});
		root.addEventListener('focusin', stopAuto);
		root.addEventListener('focusout', (event) => {
			if (!root.contains(event.relatedTarget)) startAuto();
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

		buildTrack();
		startAuto();
	}

	document.addEventListener('DOMContentLoaded', () => {
		document.querySelectorAll('[data-home-explore-carousel]').forEach(initCarousel);
	});
})();
