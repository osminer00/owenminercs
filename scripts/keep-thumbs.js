/**
 * Keep hub cards: each `.keep-board .keep-card[data-href]` thumbnail syncs with its target page.
 * Images from the target: `.photogallery-img`, then `.keep-board img.keep-card__thumb` (deduped by URL).
 * If no images: YouTube/Vimeo embeds (one → single embed; several → carousel). Skips static/reddit/manual
 * cards and prefers-reduced-motion (keeps initial thumb).
 * Default transitions: wipe / zoom / pop / spin / dissolve; staggered auto-advance per card.
 * Setup hub (`.keep-board--hub`): swipe carousel with auto-advance (~3.2s), arrows, and drag.
 * All carousels pause on hover/focus, when off-screen, and when the tab is hidden.
 * Elsewhere: clicking the album image toggles pause/resume; the ↗ control jumps to the current photo.
 */
(function () {
	if (document.body && document.body.classList.contains('affiliate-quick-page')) return;

	var cards = document.querySelectorAll('.keep-board .keep-card[data-href]');
	if (!cards.length) return;

	/** Pause after transform finishes before swapping buffer (ms). */
	var MIDDLE_GAP_MS = 300;

	/** Hub swipe carousel: dwell time between auto-advances (ms). */
	var SWIPE_AUTO_HOLD_MS = 3200;

	var REDUCED =
		window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function resolveUrl(src, baseHref) {
		try {
			return new URL(src, baseHref).href;
		} catch (e) {
			return src;
		}
	}

	function pageUrlString(href) {
		try {
			var u = new URL(href, window.location.href);
			u.hash = '';
			return u.href;
		} catch (e) {
			return href;
		}
	}

	/** Stable 8-char id for #keep-img-… deep links (matches scripts/components.js photo-focus). */
	function hash8(str) {
		var h = 2166136261;
		for (var i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return ('00000000' + (h >>> 0).toString(16)).slice(-8);
	}

	function buildPhotoJumpHref(slide) {
		if (!slide || !slide.pageUrl || !slide.jumpFrag) return '';
		try {
			var u = new URL(slide.pageUrl);
			u.hash = slide.jumpFrag;
			return u.href;
		} catch (e) {
			return slide.pageUrl + '#' + slide.jumpFrag;
		}
	}

	function filterCarouselSlides(slides) {
		var api = window.owenminercsCarouselFilter;
		return api && typeof api.filterCarouselSlides === 'function'
			? api.filterCarouselSlides(slides)
			: slides;
	}

	function extractGallerySlides(doc, baseHref) {
		var seen = Object.create(null);
		var slides = [];
		var pageBase = pageUrlString(baseHref);

		function pushNodes(nodes) {
			for (var i = 0; i < nodes.length; i++) {
				if (nodes[i].classList && nodes[i].classList.contains('keep-card__thumb--empty')) continue;
				var src = nodes[i].getAttribute('src');
				if (!src) continue;
				var abs = resolveUrl(src, baseHref);
				if (seen[abs]) continue;
				seen[abs] = true;
				slides.push({
					src: abs,
					alt: nodes[i].getAttribute('alt') || 'Gallery image',
					pageUrl: pageBase,
					jumpFrag: 'keep-img-' + hash8(abs),
				});
			}
		}

		pushNodes(doc.querySelectorAll('.photogallery-img[src]'));
		pushNodes(doc.querySelectorAll('.keep-board img.keep-card__thumb[src]'));
		return filterCarouselSlides(slides);
	}

	function extractVideoEmbeds(doc, baseHref) {
		var iframes = doc.querySelectorAll('iframe[src]');
		var out = [];
		for (var i = 0; i < iframes.length; i++) {
			var s = iframes[i].getAttribute('src');
			if (!s) continue;
			if (!/youtube\.com\/embed|youtu\.be|player\.vimeo\.com/i.test(s)) continue;
			out.push({
				src: resolveUrl(s, baseHref),
				title: iframes[i].getAttribute('title') || 'Embedded video',
			});
		}
		return out;
	}

	function replaceThumbNode(card, newNode) {
		var inner = card.querySelector('.keep-card__inner');
		var old = card.querySelector('.keep-card__thumb');
		if (!inner || !old) return;
		inner.replaceChild(newNode, old);
	}

	function applySingleImageThumb(card, slide) {
		var thumb = card.querySelector('.keep-card__thumb');
		if (!thumb) return;
		var jumpHref = buildPhotoJumpHref(slide);
		if (thumb.tagName === 'IMG' && !jumpHref) {
			thumb.src = slide.src;
			thumb.alt = slide.alt;
			return;
		}
		if (thumb.tagName === 'IMG' && jumpHref) {
			var wrap = document.createElement('div');
			wrap.className = 'keep-card__thumb keep-card__album keep-card__album--single';
			var img = document.createElement('img');
			img.className = 'keep-card__album-layer keep-card__album-layer--visible';
			img.src = slide.src;
			img.alt = slide.alt;
			img.decoding = 'async';
			img.loading = 'eager';
			img.style.pointerEvents = 'none';
			wrap.appendChild(img);
			wrap.appendChild(makePhotoJumpLink(jumpHref));
			replaceThumbNode(card, wrap);
			return;
		}
		var img = document.createElement('img');
		img.className = 'keep-card__thumb';
		img.src = slide.src;
		img.alt = slide.alt;
		img.decoding = 'async';
		img.loading = 'eager';
		replaceThumbNode(card, img);
	}

	function makePhotoJumpLink(href) {
		var a = document.createElement('a');
		a.className = 'keep-card__photo-jump';
		a.href = href || '#';
		a.setAttribute('aria-label', 'Open this photo on its page');
		a.setAttribute('title', 'Jump to this photo on the page');
		a.textContent = '↗';
		if (!href) a.hidden = true;
		a.addEventListener('click', function (e) {
			e.stopPropagation();
		});
		a.addEventListener('keydown', function (e) {
			e.stopPropagation();
		});
		return a;
	}

	function buildVideoThumbWrapper(ariaLabel) {
		var wrap = document.createElement('div');
		wrap.className =
			'keep-card__thumb keep-card__album keep-card__video-thumb keep-card__embed-skip-nav';
		wrap.setAttribute('role', 'region');
		wrap.setAttribute('aria-label', ariaLabel || 'Video preview');
		return wrap;
	}

	function applyVideoEmbedThumb(card, embed) {
		var wrap = buildVideoThumbWrapper(embed.title);
		var iframe = document.createElement('iframe');
		iframe.setAttribute('data-embed-src', embed.src);
		iframe.title = embed.title;
		iframe.setAttribute('allowfullscreen', '');
		iframe.setAttribute(
			'allow',
			'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
		);
		iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
		wrap.appendChild(iframe);
		replaceThumbNode(card, wrap);
	}

	function makeIframeLayer(src, title) {
		var iframe = document.createElement('iframe');
		iframe.className = 'keep-card__album-layer';
		iframe.setAttribute('data-embed-src', src);
		iframe.title = title;
		iframe.setAttribute('allowfullscreen', '');
		iframe.setAttribute(
			'allow',
			'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
		);
		iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
		return iframe;
	}

	/** Suffixes for keep-card__album-layer--* (strip before each transition). */
	var ALBUM_LAYER_STATE = [
		'visible',
		'prep-from-right',
		'prep-from-left',
		'prep-from-top',
		'prep-from-bottom',
		'prep-zoom-in',
		'prep-pop',
		'prep-spin',
		'prep-fade',
		'exit-to-left',
		'exit-to-right',
		'exit-to-top',
		'exit-to-bottom',
		'exit-zoom',
		'exit-pop',
		'exit-spin',
		'exit-fade',
	];

	/**
	 * Random transition each step (Premiere-style wipes / zoom / spin / dissolve).
	 * prep = incoming start; exit = outgoing end (see css/owenminercs.css).
	 */
	var ALBUM_PRESETS = [
		{
			prep: 'prep-from-right',
			exit: 'exit-to-left',
			durMs: 430,
			ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
		},
		{
			prep: 'prep-from-left',
			exit: 'exit-to-right',
			durMs: 430,
			ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
		},
		{
			prep: 'prep-from-top',
			exit: 'exit-to-bottom',
			durMs: 445,
			ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
		},
		{
			prep: 'prep-from-bottom',
			exit: 'exit-to-top',
			durMs: 445,
			ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
		},
		{
			prep: 'prep-zoom-in',
			exit: 'exit-zoom',
			durMs: 515,
			ease: 'cubic-bezier(0.33, 1, 0.68, 1)',
		},
		{
			prep: 'prep-pop',
			exit: 'exit-pop',
			durMs: 500,
			ease: 'cubic-bezier(0.34, 1.45, 0.64, 1)',
		},
		{
			prep: 'prep-spin',
			exit: 'exit-spin',
			durMs: 535,
			ease: 'cubic-bezier(0.25, 0.9, 0.25, 1)',
		},
		{
			prep: 'prep-fade',
			exit: 'exit-fade',
			durMs: 395,
			ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
		},
	];

	function hash32(str) {
		var h = 2166136261 >>> 0;
		for (var i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 16777619) >>> 0;
		}
		return h >>> 0;
	}

	function stripAlbumLayerState(layer) {
		for (var i = 0; i < ALBUM_LAYER_STATE.length; i++) {
			layer.classList.remove('keep-card__album-layer--' + ALBUM_LAYER_STATE[i]);
		}
	}

	function setAlbumTiming(root, preset) {
		root.style.setProperty('--keep-album-dur', preset.durMs + 'ms');
		root.style.setProperty('--keep-album-ease', preset.ease);
	}

	function resetLayerToPrep(layer, prepSuffix) {
		layer.classList.add('keep-card__album-layer--instant');
		stripAlbumLayerState(layer);
		layer.classList.add('keep-card__album-layer--' + prepSuffix);
		void layer.offsetWidth;
		layer.classList.remove('keep-card__album-layer--instant');
	}

	function pickRandomPreset() {
		return ALBUM_PRESETS[Math.floor(Math.random() * ALBUM_PRESETS.length)];
	}

	/** Per keep-board: shared preset rhythm + burst detection (see pickPreset / computeBurstStagger). */
	function getBoardOrch(board) {
		if (!board) return null;
		if (!board.__keepAlbumOrch) {
			board.__keepAlbumOrch = {
				registered: 0,
				transitionSeq: 0,
				lastStart: 0,
			};
		}
		return board.__keepAlbumOrch;
	}

	/**
	 * When several albums share a board, advance a common counter and offset by card index so
	 * neighbors rarely use the same transition; reads like a coordinated pattern vs pure RNG.
	 */
	function pickPreset(board, orderIndex) {
		if (!board) return pickRandomPreset();
		var orch = getBoardOrch(board);
		if (!orch || orch.registered < 2) return pickRandomPreset();
		orch.transitionSeq = (orch.transitionSeq + 1) % 1000000;
		var n = ALBUM_PRESETS.length;
		var i = (orderIndex * 5 + orch.transitionSeq * 3 + (orch.transitionSeq % 2)) % n;
		return ALBUM_PRESETS[i];
	}

	/**
	 * If another album on this board just started a transition, delay this one by row index
	 * so nearby cards ripple instead of stacking on the same frame.
	 */
	function computeBurstStagger(board, orderIndex) {
		if (!board) return 0;
		var orch = getBoardOrch(board);
		if (!orch || orch.registered < 2) return 0;
		var now = Date.now();
		var burst = orch.lastStart > 0 && now - orch.lastStart < 460;
		orch.lastStart = now;
		if (burst) return Math.min(orderIndex * 76, 400);
		return 0;
	}

	function staggerInitialMs(staggerKey) {
		return hash32((staggerKey || '') + '|album-stagger') % 2600;
	}

	function isSwipeHubCard(card) {
		return !!(card && card.closest && card.closest('.keep-board--hub'));
	}

	/**
	 * Shared pause/resume for card carousels: hover, focus, off-screen (IO), tab hidden.
	 * runStep is called on each auto-advance tick; scheduleNext(delayMs) arms the timer.
	 */
	function bindCarouselAutoplay(root, runStep, options) {
		options = options || {};
		var holdMs = options.holdMs || SWIPE_AUTO_HOLD_MS;
		var staggerKey = options.staggerKey || '';
		var card = options.card || (root.closest && root.closest('.keep-card'));
		var pauseTarget = options.pauseTarget || card || root;
		var timer = null;
		var userPaused = !!options.userPaused;
		var hoverPaused = false;
		var interactionPaused = false;
		var visible = true;
		var destroyed = false;

		function clearTimer() {
			if (timer) {
				window.clearTimeout(timer);
				timer = null;
			}
		}

		function isBlocked() {
			return (
				destroyed ||
				userPaused ||
				hoverPaused ||
				interactionPaused ||
				!visible ||
				document.visibilityState === 'hidden'
			);
		}

		function scheduleNext(delayMs) {
			clearTimer();
			if (isBlocked()) return;
			timer = window.setTimeout(function tick() {
				if (isBlocked()) return;
				runStep();
				scheduleNext(holdMs);
			}, delayMs !== undefined ? delayMs : holdMs);
		}

		function onHoverIn() {
			hoverPaused = true;
			clearTimer();
		}

		function onHoverOut(event) {
			if (event.type === 'focusout' && pauseTarget.contains(event.relatedTarget)) return;
			hoverPaused = false;
			if (!isBlocked()) scheduleNext(holdMs);
		}

		function onVisibilityChange() {
			if (document.visibilityState === 'hidden') clearTimer();
			else if (!isBlocked()) scheduleNext(280);
		}

		pauseTarget.addEventListener('mouseenter', onHoverIn);
		pauseTarget.addEventListener('mouseleave', onHoverOut);
		pauseTarget.addEventListener('focusin', onHoverIn);
		pauseTarget.addEventListener('focusout', onHoverOut);
		document.addEventListener('visibilitychange', onVisibilityChange);

		var observer = null;
		if ('IntersectionObserver' in window) {
			observer = new IntersectionObserver(
				function (entries) {
					visible = entries[0] && entries[0].isIntersecting;
					if (visible && !isBlocked()) scheduleNext(holdMs);
					else clearTimer();
				},
				{ root: null, threshold: 0.12 },
			);
			observer.observe(pauseTarget);
		}

		var initialDelay =
			options.initialDelay !== undefined
				? options.initialDelay
				: hash32((staggerKey || '') + '|swipe-stagger') % 900;

		scheduleNext(holdMs + initialDelay);

		return {
			scheduleNext: scheduleNext,
			clearTimer: clearTimer,
			setUserPaused: function (next) {
				userPaused = next;
				if (userPaused) clearTimer();
				else if (!isBlocked()) scheduleNext(holdMs);
			},
			setInteractionPaused: function (next) {
				interactionPaused = next;
				if (interactionPaused) clearTimer();
				else if (!isBlocked()) scheduleNext(holdMs);
			},
			destroy: function () {
				destroyed = true;
				clearTimer();
				pauseTarget.removeEventListener('mouseenter', onHoverIn);
				pauseTarget.removeEventListener('mouseleave', onHoverOut);
				pauseTarget.removeEventListener('focusin', onHoverIn);
				pauseTarget.removeEventListener('focusout', onHoverOut);
				document.removeEventListener('visibilitychange', onVisibilityChange);
				if (observer) observer.disconnect();
			},
		};
	}

	/** Hover/focus/off-screen pause for preset album carousels (startImageCarousel / startIframeCarousel). */
	function bindAlbumCarouselPause(root, card, armNext, stopAutoplay, getHoldMs) {
		var pauseTarget = card || root;
		var hoverPaused = false;
		var visible = true;

		function isBlocked() {
			return hoverPaused || !visible || document.visibilityState === 'hidden';
		}

		function maybeArm(delayMs) {
			if (!isBlocked()) armNext(delayMs !== undefined ? delayMs : getHoldMs());
		}

		function onHoverIn() {
			hoverPaused = true;
			stopAutoplay();
		}

		function onHoverOut(event) {
			if (event.type === 'focusout' && pauseTarget.contains(event.relatedTarget)) return;
			hoverPaused = false;
			maybeArm(280);
		}

		function onVisibilityChange() {
			if (document.visibilityState === 'hidden') stopAutoplay();
			else maybeArm(280);
		}

		pauseTarget.addEventListener('mouseenter', onHoverIn);
		pauseTarget.addEventListener('mouseleave', onHoverOut);
		pauseTarget.addEventListener('focusin', onHoverIn);
		pauseTarget.addEventListener('focusout', onHoverOut);
		document.addEventListener('visibilitychange', onVisibilityChange);

		if ('IntersectionObserver' in window) {
			var observer = new IntersectionObserver(
				function (entries) {
					visible = entries[0] && entries[0].isIntersecting;
					if (visible && !hoverPaused) maybeArm(280);
					else stopAutoplay();
				},
				{ root: null, threshold: 0.12 },
			);
			observer.observe(pauseTarget);
		}

		return {
			isHoverOrOffscreenBlocked: function () {
				return hoverPaused || !visible;
			},
		};
	}

	function makeAlbumNav(direction, label) {
		var btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'keep-card__album-nav keep-card__album-nav--' + direction;
		btn.setAttribute('aria-label', label);
		btn.textContent = direction === 'prev' ? '\u2039' : '\u203A';
		btn.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
		});
		btn.addEventListener('keydown', function (e) {
			e.stopPropagation();
		});
		return btn;
	}

	/** Setup hub: swipe carousel (touch + drag + arrows) with auto-advance. */
	function startSwipeImageCarousel(root, slides, options) {
		if (!slides.length) return;
		options = options || {};

		root.classList.add('keep-card__album--swipe');
		root.setAttribute('role', 'region');
		root.setAttribute('aria-roledescription', 'carousel');

		var viewport = document.createElement('div');
		viewport.className = 'keep-card__album-viewport';
		viewport.tabIndex = 0;

		var track = document.createElement('div');
		track.className = 'keep-card__album-track';

		for (var si = 0; si < slides.length; si++) {
			var slideImg = document.createElement('img');
			slideImg.className = 'keep-card__album-slide';
			slideImg.src = slides[si].src;
			slideImg.alt = slides[si].alt;
			slideImg.draggable = false;
			slideImg.decoding = 'async';
			slideImg.loading = si === 0 ? 'eager' : 'lazy';
			track.appendChild(slideImg);
		}

		viewport.appendChild(track);
		root.appendChild(viewport);

		var jumpLink = makePhotoJumpLink(buildPhotoJumpHref(slides[0]));
		root.appendChild(jumpLink);

		var idx = 0;
		var DRAG_THRESHOLD = 8;
		var SWIPE_COMMIT_RATIO = 0.18;
		var dragging = false;
		var didDrag = false;
		var dragStartX = 0;
		var dragOriginIdx = 0;
		var activePointerId = null;

		function syncJumpLink() {
			var href = buildPhotoJumpHref(slides[idx]);
			if (href) {
				jumpLink.href = href;
				jumpLink.hidden = false;
			} else {
				jumpLink.hidden = true;
			}
		}

		function announce() {
			root.setAttribute(
				'aria-label',
				slides[idx].alt + ' (' + (idx + 1) + ' of ' + slides.length + ')',
			);
			syncJumpLink();
		}

		function setTrackIndex(nextIdx, animate) {
			idx = ((nextIdx % slides.length) + slides.length) % slides.length;
			if (animate === false || REDUCED) track.style.transition = 'none';
			else track.style.transition = '';
			track.style.transform = 'translate3d(-' + idx * 100 + '%, 0, 0)';
			if (counter) counter.textContent = idx + 1 + ' / ' + slides.length;
			announce();
		}

		if (slides.length === 1) {
			setTrackIndex(0, false);
			return;
		}

		var prevBtn = makeAlbumNav('prev', 'Previous photo');
		var nextBtn = makeAlbumNav('next', 'Next photo');
		var counter = document.createElement('span');
		counter.className = 'keep-card__album-counter';
		counter.setAttribute('aria-live', 'polite');
		root.appendChild(prevBtn);
		root.appendChild(nextBtn);
		root.appendChild(counter);

		var autoplay = null;

		function go(delta) {
			setTrackIndex(idx + delta, true);
		}

		function bumpAutoplay() {
			if (autoplay) autoplay.scheduleNext(SWIPE_AUTO_HOLD_MS);
		}

		prevBtn.addEventListener('click', function () {
			go(-1);
			bumpAutoplay();
		});
		nextBtn.addEventListener('click', function () {
			go(1);
			bumpAutoplay();
		});

		if (slides.length > 1 && !REDUCED) {
			autoplay = bindCarouselAutoplay(
				root,
				function () {
					go(1);
				},
				{
					holdMs: SWIPE_AUTO_HOLD_MS,
					staggerKey: options.staggerKey || '',
					card: root.closest && root.closest('.keep-card'),
				},
			);
		}

		viewport.addEventListener('keydown', function (e) {
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				e.stopPropagation();
				go(-1);
				bumpAutoplay();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				e.stopPropagation();
				go(1);
				bumpAutoplay();
			}
		});

		function endDrag(event) {
			if (!dragging) return;
			dragging = false;
			activePointerId = null;
			root.classList.remove('keep-card__album--dragging');
			if (viewport.hasPointerCapture(event.pointerId)) {
				viewport.releasePointerCapture(event.pointerId);
			}

			var dx = event.clientX - dragStartX;
			var vw = viewport.offsetWidth || 1;
			if (Math.abs(dx) > Math.max(vw * SWIPE_COMMIT_RATIO, 36)) {
				go(dx > 0 ? -1 : 1);
				bumpAutoplay();
			} else {
				setTrackIndex(dragOriginIdx, true);
				bumpAutoplay();
			}
			if (autoplay) autoplay.setInteractionPaused(false);
		}

		viewport.addEventListener('pointerdown', function (event) {
			if (event.button !== 0 || event.target.closest('.keep-card__album-nav')) return;
			if (autoplay) autoplay.setInteractionPaused(true);
			dragging = true;
			didDrag = false;
			dragStartX = event.clientX;
			dragOriginIdx = idx;
			activePointerId = event.pointerId;
			track.style.transition = 'none';
			root.classList.add('keep-card__album--dragging');
			viewport.setPointerCapture(event.pointerId);
		});

		viewport.addEventListener('pointermove', function (event) {
			if (!dragging || event.pointerId !== activePointerId) return;
			var dx = event.clientX - dragStartX;
			if (Math.abs(dx) > DRAG_THRESHOLD) {
				didDrag = true;
				event.preventDefault();
			}
			var vw = viewport.offsetWidth || 1;
			var offsetPct = (dx / vw) * 100;
			track.style.transform = 'translate3d(-' + (dragOriginIdx * 100 - offsetPct) + '%, 0, 0)';
		});

		viewport.addEventListener('pointerup', endDrag);
		viewport.addEventListener('pointercancel', endDrag);

		viewport.addEventListener(
			'click',
			function (event) {
				if (!didDrag) return;
				event.preventDefault();
				event.stopPropagation();
				didDrag = false;
			},
			true,
		);

		setTrackIndex(0, false);
	}

	function startSwipeIframeCarousel(root, embeds, options) {
		if (!embeds.length) return;
		options = options || {};

		root.classList.add('keep-card__album--swipe', 'keep-card__video-thumb');
		root.setAttribute('role', 'region');
		root.setAttribute('aria-roledescription', 'carousel');

		var viewport = document.createElement('div');
		viewport.className = 'keep-card__album-viewport';
		viewport.tabIndex = 0;

		var track = document.createElement('div');
		track.className = 'keep-card__album-track';

		for (var ei = 0; ei < embeds.length; ei++) {
			var layer = makeIframeLayer(embeds[ei].src, embeds[ei].title);
			layer.className = 'keep-card__album-slide keep-card__album-slide--embed';
			track.appendChild(layer);
		}

		viewport.appendChild(track);
		root.appendChild(viewport);

		var idx = 0;

		function announceEmbed() {
			root.setAttribute(
				'aria-label',
				embeds[idx].title + ' (' + (idx + 1) + ' of ' + embeds.length + ')',
			);
		}

		function setTrackIndex(nextIdx, animate) {
			idx = ((nextIdx % embeds.length) + embeds.length) % embeds.length;
			if (animate === false || REDUCED) track.style.transition = 'none';
			else track.style.transition = '';
			track.style.transform = 'translate3d(-' + idx * 100 + '%, 0, 0)';
			if (counter) counter.textContent = idx + 1 + ' / ' + embeds.length;
			announceEmbed();
		}

		if (embeds.length === 1) {
			setTrackIndex(0, false);
			return;
		}

		var prevBtn = makeAlbumNav('prev', 'Previous video');
		var nextBtn = makeAlbumNav('next', 'Next video');
		var counter = document.createElement('span');
		counter.className = 'keep-card__album-counter';
		counter.setAttribute('aria-live', 'polite');
		root.appendChild(prevBtn);
		root.appendChild(nextBtn);
		root.appendChild(counter);

		var autoplay = null;

		function go(delta) {
			setTrackIndex(idx + delta, true);
		}

		function bumpAutoplay() {
			if (autoplay) autoplay.scheduleNext(SWIPE_AUTO_HOLD_MS);
		}

		prevBtn.addEventListener('click', function () {
			go(-1);
			bumpAutoplay();
		});
		nextBtn.addEventListener('click', function () {
			go(1);
			bumpAutoplay();
		});

		if (embeds.length > 1 && !REDUCED) {
			autoplay = bindCarouselAutoplay(
				root,
				function () {
					go(1);
				},
				{
					holdMs: SWIPE_AUTO_HOLD_MS,
					staggerKey: options.staggerKey || '',
					card: root.closest && root.closest('.keep-card'),
				},
			);
		}

		viewport.addEventListener('keydown', function (e) {
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				e.stopPropagation();
				go(-1);
				bumpAutoplay();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				e.stopPropagation();
				go(1);
				bumpAutoplay();
			}
		});

		var dragging = false;
		var didDrag = false;
		var dragStartX = 0;
		var dragOriginIdx = 0;
		var activePointerId = null;

		function endDrag(event) {
			if (!dragging) return;
			dragging = false;
			activePointerId = null;
			root.classList.remove('keep-card__album--dragging');
			if (viewport.hasPointerCapture(event.pointerId)) {
				viewport.releasePointerCapture(event.pointerId);
			}
			var dx = event.clientX - dragStartX;
			var vw = viewport.offsetWidth || 1;
			if (Math.abs(dx) > Math.max(vw * 0.18, 36)) {
				go(dx > 0 ? -1 : 1);
				bumpAutoplay();
			} else {
				setTrackIndex(dragOriginIdx, true);
				bumpAutoplay();
			}
			if (autoplay) autoplay.setInteractionPaused(false);
		}

		viewport.addEventListener('pointerdown', function (event) {
			if (event.button !== 0 || event.target.closest('.keep-card__album-nav')) return;
			if (autoplay) autoplay.setInteractionPaused(true);
			dragging = true;
			didDrag = false;
			dragStartX = event.clientX;
			dragOriginIdx = idx;
			activePointerId = event.pointerId;
			track.style.transition = 'none';
			root.classList.add('keep-card__album--dragging');
			viewport.setPointerCapture(event.pointerId);
		});

		viewport.addEventListener('pointermove', function (event) {
			if (!dragging || event.pointerId !== activePointerId) return;
			var dx = event.clientX - dragStartX;
			if (Math.abs(dx) > 8) {
				didDrag = true;
				event.preventDefault();
			}
			var vw = viewport.offsetWidth || 1;
			var offsetPct = (dx / vw) * 100;
			track.style.transform = 'translate3d(-' + (dragOriginIdx * 100 - offsetPct) + '%, 0, 0)';
		});

		viewport.addEventListener('pointerup', endDrag);
		viewport.addEventListener('pointercancel', endDrag);

		viewport.addEventListener(
			'click',
			function (event) {
				if (!didDrag) return;
				event.preventDefault();
				event.stopPropagation();
				didDrag = false;
			},
			true,
		);

		setTrackIndex(0, false);
	}

	/**
	 * Dwell time: how long the current image stays before the next transition.
	 * Blends a stable hash with Math.random() so each beat differs; tickIndex changes the hash each step.
	 * Usually ~1.05s–5.7s; ~14% of the time a shorter ~0.45s–2s pause.
	 */
	function holdBetweenSlidesMs(staggerKey, tickIndex) {
		var h = hash32((staggerKey || '') + '|hold|' + tickIndex);
		var r = Math.random();
		var u = ((h % 10001) / 10001) * 0.45 + r * 0.55;
		if (r < 0.14) {
			return Math.round(450 + u * 1550);
		}
		return Math.round(1050 + u * 4650);
	}

	function startImageCarousel(root, slides, options) {
		if (!slides.length) return;
		options = options || {};
		var staggerKey = options.staggerKey || '';

		function buildLayers() {
			var a = document.createElement('img');
			var b = document.createElement('img');
			a.className = 'keep-card__album-layer';
			b.className = 'keep-card__album-layer';
			a.decoding = 'async';
			b.decoding = 'async';
			a.draggable = false;
			b.draggable = false;
			root.appendChild(a);
			root.appendChild(b);
			return [a, b];
		}

		var layers = buildLayers();
		var idx = 0;
		var active = 0;
		var timer;
		var tickIndex = 0;
		var paused = false;
		var jumpLink = makePhotoJumpLink(buildPhotoJumpHref(slides[0]));
		root.appendChild(jumpLink);

		function syncJumpLink() {
			var href = buildPhotoJumpHref(slides[idx]);
			if (href) {
				jumpLink.href = href;
				jumpLink.hidden = false;
			} else {
				jumpLink.hidden = true;
			}
		}

		if (slides.length === 1) {
			layers[0].src = slides[0].src;
			layers[0].alt = slides[0].alt;
			layers[0].classList.add('keep-card__album-layer--visible');
			layers[1].remove();
			root.setAttribute('aria-label', slides[0].alt);
			syncJumpLink();
			return;
		}

		var board = root.closest && root.closest('.keep-board');
		var card = root.closest && root.closest('.keep-card');
		var orderIndex = 0;
		if (board && card) {
			var sibs = board.querySelectorAll('.keep-card[data-href]');
			orderIndex = Array.prototype.indexOf.call(sibs, card);
			if (orderIndex < 0) orderIndex = 0;
			getBoardOrch(board).registered++;
		}

		layers[0].src = slides[0].src;
		layers[0].alt = slides[0].alt;
		layers[0].classList.add('keep-card__album-layer--visible');
		layers[1].src = slides[1].src;
		layers[1].alt = slides[1].alt;
		resetLayerToPrep(layers[1], 'prep-from-right');
		root.setAttribute('aria-label', slides[0].alt);
		syncJumpLink();

		function announce() {
			root.setAttribute('aria-label', slides[idx].alt);
			syncJumpLink();
		}

		function stopAutoplay() {
			if (timer) {
				window.clearTimeout(timer);
				timer = null;
			}
		}

		function armNext(delayMs) {
			if (paused || (albumPause && albumPause.isHoverOrOffscreenBlocked())) return;
			if (document.visibilityState === 'hidden') return;
			stopAutoplay();
			timer = window.setTimeout(runOneTransition, delayMs);
		}

		var albumPause = null;

		albumPause = bindAlbumCarouselPause(root, card, armNext, stopAutoplay, function () {
			return holdBetweenSlidesMs(staggerKey, tickIndex);
		});

		function runOneTransition() {
			var preset = pickPreset(board, orderIndex);
			var burstDelay = computeBurstStagger(board, orderIndex);

			function go() {
				setAlbumTiming(root, preset);
				var next = 1 - active;
				var nextIdx = (idx + 1) % slides.length;
				var preloadIdx = (nextIdx + 1) % slides.length;

				layers[next].src = slides[nextIdx].src;
				layers[next].alt = slides[nextIdx].alt;
				layers[next].style.zIndex = '3';
				resetLayerToPrep(layers[next], preset.prep);

				window.requestAnimationFrame(function () {
					window.requestAnimationFrame(function () {
						stripAlbumLayerState(layers[active]);
						layers[active].classList.add('keep-card__album-layer--' + preset.exit);
						stripAlbumLayerState(layers[next]);
						layers[next].classList.add('keep-card__album-layer--visible');
					});
				});

				var animMs = preset.durMs;
				window.setTimeout(function () {
					window.setTimeout(function () {
						var oldActive = active;
						idx = nextIdx;
						active = next;
						layers[next].style.zIndex = '';
						layers[oldActive].src = slides[preloadIdx].src;
						layers[oldActive].alt = slides[preloadIdx].alt;
						resetLayerToPrep(layers[oldActive], 'prep-from-right');
						announce();
						tickIndex += 1;
						armNext(holdBetweenSlidesMs(staggerKey, tickIndex));
					}, MIDDLE_GAP_MS);
				}, animMs);
			}

			if (burstDelay > 0) {
				window.setTimeout(go, burstDelay);
			} else {
				go();
			}
		}

		armNext(staggerInitialMs(staggerKey));
	}

	function startIframeCarousel(root, embeds, options) {
		if (!embeds.length) return;
		options = options || {};
		var staggerKey = options.staggerKey || '';

		function buildLayers() {
			var a = makeIframeLayer(embeds[0].src, embeds[0].title);
			var b = makeIframeLayer(
				embeds.length > 1 ? embeds[1].src : embeds[0].src,
				embeds.length > 1 ? embeds[1].title : embeds[0].title,
			);
			root.appendChild(a);
			root.appendChild(b);
			return [a, b];
		}

		var layers = buildLayers();
		var idx = 0;
		var active = 0;
		var timer;
		var tickIndex = 0;
		var paused = false;

		if (embeds.length === 1) {
			layers[0].classList.add('keep-card__album-layer--visible');
			layers[1].remove();
			root.setAttribute('aria-label', embeds[0].title);
			return;
		}

		var board = root.closest && root.closest('.keep-board');
		var card = root.closest && root.closest('.keep-card');
		var orderIndex = 0;
		if (board && card) {
			var sibs = board.querySelectorAll('.keep-card[data-href]');
			orderIndex = Array.prototype.indexOf.call(sibs, card);
			if (orderIndex < 0) orderIndex = 0;
			getBoardOrch(board).registered++;
		}

		layers[0].classList.add('keep-card__album-layer--visible');
		resetLayerToPrep(layers[1], 'prep-from-right');

		function announce() {
			root.setAttribute('aria-label', embeds[idx].title);
		}

		function stopAutoplay() {
			if (timer) {
				window.clearTimeout(timer);
				timer = null;
			}
		}

		function armNext(delayMs) {
			if (paused || (albumPause && albumPause.isHoverOrOffscreenBlocked())) return;
			if (document.visibilityState === 'hidden') return;
			stopAutoplay();
			timer = window.setTimeout(runOneTransition, delayMs);
		}

		var albumPause = null;

		albumPause = bindAlbumCarouselPause(root, card, armNext, stopAutoplay, function () {
			return holdBetweenSlidesMs(staggerKey, tickIndex);
		});

		function runOneTransition() {
			var preset = pickPreset(board, orderIndex);
			var burstDelay = computeBurstStagger(board, orderIndex);

			function go() {
				setAlbumTiming(root, preset);
				var next = 1 - active;
				var nextIdx = (idx + 1) % embeds.length;
				var preloadIdx = (nextIdx + 1) % embeds.length;

				layers[next].src = embeds[nextIdx].src;
				layers[next].title = embeds[nextIdx].title;
				layers[next].style.zIndex = '3';
				resetLayerToPrep(layers[next], preset.prep);

				window.requestAnimationFrame(function () {
					window.requestAnimationFrame(function () {
						stripAlbumLayerState(layers[active]);
						layers[active].classList.add('keep-card__album-layer--' + preset.exit);
						stripAlbumLayerState(layers[next]);
						layers[next].classList.add('keep-card__album-layer--visible');
					});
				});

				var animMs = preset.durMs;
				window.setTimeout(function () {
					window.setTimeout(function () {
						var oldActive = active;
						idx = nextIdx;
						active = next;
						layers[next].style.zIndex = '';
						layers[oldActive].src = embeds[preloadIdx].src;
						layers[oldActive].title = embeds[preloadIdx].title;
						resetLayerToPrep(layers[oldActive], 'prep-from-right');
						announce();
						tickIndex += 1;
						armNext(holdBetweenSlidesMs(staggerKey, tickIndex));
					}, MIDDLE_GAP_MS);
				}, animMs);
			}

			if (burstDelay > 0) {
				window.setTimeout(go, burstDelay);
			} else {
				go();
			}
		}

		armNext(staggerInitialMs(staggerKey));
	}

	function upgradeThumb(card, slides, embeds) {
		var swipeHub = isSwipeHubCard(card);

		if (REDUCED) {
			if (slides.length >= 1) applySingleImageThumb(card, slides[0]);
			else if (embeds.length >= 1) applyVideoEmbedThumb(card, embeds[0]);
			return;
		}

		if (slides.length >= 2) {
			var album = document.createElement('div');
			album.className = 'keep-card__thumb keep-card__album';
			if (!swipeHub) album.setAttribute('role', 'img');
			replaceThumbNode(card, album);
			var thumbKey = card.getAttribute('data-href') || '';
			if (swipeHub) startSwipeImageCarousel(album, slides, { staggerKey: thumbKey });
			else startImageCarousel(album, slides, { staggerKey: thumbKey });
			return;
		}

		if (slides.length === 1) {
			applySingleImageThumb(card, slides[0]);
			return;
		}

		if (embeds.length >= 1) {
			if (embeds.length === 1) {
				applyVideoEmbedThumb(card, embeds[0]);
				return;
			}
			var wrap = buildVideoThumbWrapper(embeds[0].title);
			replaceThumbNode(card, wrap);
			var embedKey = card.getAttribute('data-href') || '';
			if (swipeHub) startSwipeIframeCarousel(wrap, embeds, { staggerKey: embedKey });
			else startIframeCarousel(wrap, embeds, { staggerKey: embedKey });
		}
	}

	function shouldSkipCard(card) {
		if (card.classList.contains('keep-card--static')) return true;
		if (card.classList.contains('keep-card--affiliate-quick')) return true;
		if (card.querySelector('.keep-card__reddit-embed')) return true;
		if (card.getAttribute('data-keep-thumb-manual') === 'true') return true;
		var mode = card.getAttribute('data-keep-thumb');
		if (mode === 'youtube' || mode === 'embed' || mode === 'skip') return true;
		return false;
	}

	/* One entry per fetch; card + URL stay paired so Promise.all order cannot drift from targets. */
	var work = [];

	for (var c = 0; c < cards.length; c++) {
		var card = cards[c];
		if (shouldSkipCard(card)) continue;
		var href = card.getAttribute('data-href');
		if (!href) continue;
		var absUrl = resolveUrl(href, window.location.href);
		work.push({ card: card, absUrl: absUrl });
	}

	var jobs = work.map(function (w) {
		return fetch(w.absUrl, { credentials: 'same-origin' })
			.then(function (r) {
				if (!r.ok) throw new Error('fetch');
				return r.text();
			})
			.then(function (html) {
				return { absUrl: w.absUrl, html: html };
			})
			.catch(function () {
				return null;
			});
	});

	Promise.all(jobs).then(function (results) {
		for (var i = 0; i < results.length; i++) {
			var payload = results[i];
			if (!payload) continue;
			var doc = new DOMParser().parseFromString(payload.html, 'text/html');
			var slides = extractGallerySlides(doc, payload.absUrl);
			var embeds = extractVideoEmbeds(doc, payload.absUrl);
			upgradeThumb(work[i].card, slides, embeds);
		}
		var sortApi = window.owenminercsCarouselFilter;
		if (sortApi && typeof sortApi.sortAllCardGrids === 'function') {
			sortApi.sortAllCardGrids(document);
		}
	});
})();
