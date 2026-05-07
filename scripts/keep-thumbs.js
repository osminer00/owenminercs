/**
 * Keep hub cards: each `.keep-board .keep-card[data-href]` thumbnail syncs with its target page.
 * Images from the target: `.photogallery-img`, then `.keep-board img.keep-card__thumb` (deduped by URL).
 * If no images: YouTube/Vimeo embeds (one → single embed; several → carousel). Skips static/reddit/manual
 * cards and prefers-reduced-motion (keeps initial thumb).
 * Transitions: wipe / zoom / pop / spin / dissolve; staggered timing per card (hash of data-href).
 * With 2+ albums on the same `.keep-board`, presets follow a shared sequence (neighbor-offset) and
 * quick “burst” transitions are rippled with a short row delay so nearby cards read as choreographed.
 * Clicking the album image toggles pause/resume (instead of navigating the card); the ↗ control still
 * jumps to the current photo on the destination page.
 */
(function () {
	var cards = document.querySelectorAll('.keep-board .keep-card[data-href]');
	if (!cards.length) return;

	/** Pause after transform finishes before swapping buffer (ms). */
	var MIDDLE_GAP_MS = 300;

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

	function extractGallerySlides(doc, baseHref) {
		var seen = Object.create(null);
		var slides = [];
		var pageBase = pageUrlString(baseHref);

		function pushNodes(nodes) {
			for (var i = 0; i < nodes.length; i++) {
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
		return slides;
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
		iframe.src = embed.src;
		iframe.title = embed.title;
		iframe.setAttribute('loading', 'lazy');
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
		iframe.src = src;
		iframe.title = title;
		iframe.setAttribute('loading', 'lazy');
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

		function armNext(delayMs) {
			if (paused) return;
			if (timer) window.clearTimeout(timer);
			timer = window.setTimeout(runOneTransition, delayMs);
		}

		var pauseHit = document.createElement('button');
		pauseHit.type = 'button';
		pauseHit.className = 'keep-card__album-pause-hit';
		pauseHit.setAttribute('aria-label', 'Pause slideshow');
		pauseHit.setAttribute('aria-pressed', 'false');
		function setPaused(next) {
			paused = next;
			if (paused) {
				if (timer) {
					window.clearTimeout(timer);
					timer = null;
				}
				root.classList.add('keep-card__album--paused');
				pauseHit.setAttribute('aria-pressed', 'true');
				pauseHit.setAttribute('aria-label', 'Resume slideshow');
			} else {
				root.classList.remove('keep-card__album--paused');
				pauseHit.setAttribute('aria-pressed', 'false');
				pauseHit.setAttribute('aria-label', 'Pause slideshow');
				armNext(holdBetweenSlidesMs(staggerKey, tickIndex));
			}
		}
		pauseHit.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			setPaused(!paused);
		});
		pauseHit.addEventListener('keydown', function (e) {
			e.stopPropagation();
		});
		root.insertBefore(pauseHit, jumpLink);

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

		document.addEventListener('visibilitychange', function onVis() {
			if (document.visibilityState === 'hidden') {
				if (timer) {
					window.clearTimeout(timer);
					timer = null;
				}
			} else {
				if (!paused) armNext(280);
			}
		});
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

		function armNext(delayMs) {
			if (paused) return;
			if (timer) window.clearTimeout(timer);
			timer = window.setTimeout(runOneTransition, delayMs);
		}

		var pauseHit = document.createElement('button');
		pauseHit.type = 'button';
		pauseHit.className = 'keep-card__album-pause-hit';
		pauseHit.setAttribute('aria-label', 'Pause slideshow');
		pauseHit.setAttribute('aria-pressed', 'false');
		function setIframePaused(next) {
			paused = next;
			if (paused) {
				if (timer) {
					window.clearTimeout(timer);
					timer = null;
				}
				root.classList.add('keep-card__album--paused');
				pauseHit.setAttribute('aria-pressed', 'true');
				pauseHit.setAttribute('aria-label', 'Resume slideshow');
			} else {
				root.classList.remove('keep-card__album--paused');
				pauseHit.setAttribute('aria-pressed', 'false');
				pauseHit.setAttribute('aria-label', 'Pause slideshow');
				armNext(holdBetweenSlidesMs(staggerKey, tickIndex));
			}
		}
		pauseHit.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			setIframePaused(!paused);
		});
		pauseHit.addEventListener('keydown', function (e) {
			e.stopPropagation();
		});
		root.appendChild(pauseHit);

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

		document.addEventListener('visibilitychange', function () {
			if (document.visibilityState === 'hidden') {
				if (timer) {
					window.clearTimeout(timer);
					timer = null;
				}
			} else {
				if (!paused) armNext(280);
			}
		});
	}

	function upgradeThumb(card, slides, embeds) {
		if (REDUCED) {
			if (slides.length >= 1) applySingleImageThumb(card, slides[0]);
			else if (embeds.length >= 1) applyVideoEmbedThumb(card, embeds[0]);
			return;
		}

		if (slides.length >= 2) {
			var album = document.createElement('div');
			album.className = 'keep-card__thumb keep-card__album';
			album.setAttribute('role', 'img');
			replaceThumbNode(card, album);
			startImageCarousel(album, slides, { staggerKey: card.getAttribute('data-href') || '' });
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
			startIframeCarousel(wrap, embeds, { staggerKey: card.getAttribute('data-href') || '' });
		}
	}

	function shouldSkipCard(card) {
		if (card.classList.contains('keep-card--static')) return true;
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
	});
})();
