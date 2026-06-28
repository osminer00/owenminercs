/**
 * Gaming hub: sync each keep-card thumbnail with its data-href target page.
 * - Uses img.photogallery-img from the target (add more on the page → more slides).
 * - If no gallery images: uses YouTube/Vimeo embeds (one → single embed; several → same RTL carousel).
 * - Skips reddit/embedded thumbs, static cards, and prefers-reduced-motion (keeps initial img).
 */
(function () {
	var board = document.querySelector('.keep-board');
	if (!board) return;

	var SLIDE_MS = 500;
	var MIDDLE_PAUSE_MS = 500;
	var HOLD_MS = 1000;
	var CYCLE_MS = SLIDE_MS + MIDDLE_PAUSE_MS + HOLD_MS;

	var REDUCED =
		window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function resolveUrl(src, baseHref) {
		try {
			return new URL(src, baseHref).href;
		} catch (e) {
			return src;
		}
	}

	function extractGallerySlides(doc, baseHref) {
		var nodes = doc.querySelectorAll('.photogallery-img[src]');
		var slides = [];
		for (var i = 0; i < nodes.length; i++) {
			var src = nodes[i].getAttribute('src');
			if (!src) continue;
			slides.push({
				src: resolveUrl(src, baseHref),
				alt: nodes[i].getAttribute('alt') || 'Gallery image',
			});
		}
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
		if (thumb.tagName === 'IMG') {
			thumb.src = slide.src;
			thumb.alt = slide.alt;
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

	function startImageCarousel(root, slides) {
		if (!slides.length) return;

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
		var paused = false;

		if (slides.length === 1) {
			layers[0].src = slides[0].src;
			layers[0].alt = slides[0].alt;
			layers[0].classList.add('keep-card__album-layer--visible');
			layers[1].remove();
			root.setAttribute('aria-label', slides[0].alt);
			return;
		}

		layers[0].src = slides[0].src;
		layers[0].alt = slides[0].alt;
		layers[0].classList.add('keep-card__album-layer--visible');
		layers[1].src = slides[1].src;
		layers[1].alt = slides[1].alt;
		layers[1].classList.add('keep-card__album-layer--from-right');
		root.setAttribute('aria-label', slides[0].alt);

		function announce() {
			root.setAttribute('aria-label', slides[idx].alt);
		}

		function schedule() {
			if (timer) window.clearTimeout(timer);
			timer = null;
			if (paused) return;
			timer = window.setTimeout(function loop() {
				tick();
				timer = window.setTimeout(loop, CYCLE_MS);
			}, CYCLE_MS);
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
				schedule();
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
		root.appendChild(pauseHit);

		function resetLayerOffRight(layer) {
			layer.classList.add('keep-card__album-layer--instant');
			layer.classList.remove(
				'keep-card__album-layer--visible',
				'keep-card__album-layer--to-left',
				'keep-card__album-layer--from-right',
			);
			layer.classList.add('keep-card__album-layer--from-right');
			void layer.offsetWidth;
			layer.classList.remove('keep-card__album-layer--instant');
		}

		function tick() {
			var next = 1 - active;
			var nextIdx = (idx + 1) % slides.length;
			var preloadIdx = (nextIdx + 1) % slides.length;

			layers[next].src = slides[nextIdx].src;
			layers[next].alt = slides[nextIdx].alt;
			layers[next].style.zIndex = '3';
			resetLayerOffRight(layers[next]);

			window.requestAnimationFrame(function () {
				window.requestAnimationFrame(function () {
					layers[active].classList.remove('keep-card__album-layer--visible');
					layers[active].classList.add('keep-card__album-layer--to-left');
					layers[next].classList.remove('keep-card__album-layer--from-right');
					layers[next].classList.add('keep-card__album-layer--visible');
				});
			});

			window.setTimeout(function () {
				window.setTimeout(function () {
					var oldActive = active;
					idx = nextIdx;
					active = next;
					layers[next].style.zIndex = '';
					resetLayerOffRight(layers[oldActive]);
					layers[oldActive].src = slides[preloadIdx].src;
					layers[oldActive].alt = slides[preloadIdx].alt;
					announce();
				}, MIDDLE_PAUSE_MS);
			}, SLIDE_MS);
		}

		schedule();

		document.addEventListener('visibilitychange', function () {
			if (document.visibilityState === 'hidden') {
				if (timer) {
					window.clearTimeout(timer);
					timer = null;
				}
			} else {
				if (!paused) schedule();
			}
		});
	}

	function startIframeCarousel(root, embeds) {
		if (!embeds.length) return;

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
		var paused = false;

		if (embeds.length === 1) {
			layers[0].classList.add('keep-card__album-layer--visible');
			layers[1].remove();
			root.setAttribute('aria-label', embeds[0].title);
			return;
		}

		layers[0].classList.add('keep-card__album-layer--visible');
		layers[1].classList.add('keep-card__album-layer--from-right');

		function announce() {
			root.setAttribute('aria-label', embeds[idx].title);
		}

		function schedule() {
			if (timer) window.clearTimeout(timer);
			timer = null;
			if (paused) return;
			timer = window.setTimeout(function loop() {
				tick();
				timer = window.setTimeout(loop, CYCLE_MS);
			}, CYCLE_MS);
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
				schedule();
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

		function resetLayerOffRight(layer) {
			layer.classList.add('keep-card__album-layer--instant');
			layer.classList.remove(
				'keep-card__album-layer--visible',
				'keep-card__album-layer--to-left',
				'keep-card__album-layer--from-right',
			);
			layer.classList.add('keep-card__album-layer--from-right');
			void layer.offsetWidth;
			layer.classList.remove('keep-card__album-layer--instant');
		}

		function tick() {
			var next = 1 - active;
			var nextIdx = (idx + 1) % embeds.length;
			var preloadIdx = (nextIdx + 1) % embeds.length;

			layers[next].src = embeds[nextIdx].src;
			layers[next].title = embeds[nextIdx].title;
			layers[next].style.zIndex = '3';
			resetLayerOffRight(layers[next]);

			window.requestAnimationFrame(function () {
				window.requestAnimationFrame(function () {
					layers[active].classList.remove('keep-card__album-layer--visible');
					layers[active].classList.add('keep-card__album-layer--to-left');
					layers[next].classList.remove('keep-card__album-layer--from-right');
					layers[next].classList.add('keep-card__album-layer--visible');
				});
			});

			window.setTimeout(function () {
				window.setTimeout(function () {
					var oldActive = active;
					idx = nextIdx;
					active = next;
					layers[next].style.zIndex = '';
					resetLayerOffRight(layers[oldActive]);
					layers[oldActive].src = embeds[preloadIdx].src;
					layers[oldActive].title = embeds[preloadIdx].title;
					announce();
				}, MIDDLE_PAUSE_MS);
			}, SLIDE_MS);
		}

		schedule();

		document.addEventListener('visibilitychange', function () {
			if (document.visibilityState === 'hidden') {
				if (timer) {
					window.clearTimeout(timer);
					timer = null;
				}
			} else {
				if (!paused) schedule();
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
			startImageCarousel(album, slides);
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
			startIframeCarousel(wrap, embeds);
		}
	}

	function shouldSkipCard(card) {
		if (card.classList.contains('keep-card--static')) return true;
		if (card.querySelector('.keep-card__reddit-embed')) return true;
		if (card.getAttribute('data-keep-thumb-manual') === 'true') return true;
		return false;
	}

	var cards = board.querySelectorAll('.keep-card[data-href]');
	var jobs = [];
	var cardTargets = [];

	for (var c = 0; c < cards.length; c++) {
		var card = cards[c];
		if (shouldSkipCard(card)) continue;
		var href = card.getAttribute('data-href');
		if (!href) continue;
		var absUrl = resolveUrl(href, window.location.href);
		cardTargets.push(card);
		(function (pageUrl) {
			jobs.push(
				fetch(pageUrl, { credentials: 'same-origin' })
					.then(function (r) {
						if (!r.ok) throw new Error('fetch');
						return r.text();
					})
					.then(function (html) {
						return { absUrl: pageUrl, html: html };
					})
					.catch(function () {
						return null;
					}),
			);
		})(absUrl);
	}

	Promise.all(jobs).then(function (results) {
		for (var i = 0; i < results.length; i++) {
			var payload = results[i];
			if (!payload) continue;
			var doc = new DOMParser().parseFromString(payload.html, 'text/html');
			var slides = extractGallerySlides(doc, payload.absUrl);
			var embeds = extractVideoEmbeds(doc, payload.absUrl);
			upgradeThumb(cardTargets[i], slides, embeds);
		}
	});
})();
