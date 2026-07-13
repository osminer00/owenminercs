/**
 * Carousel placeholder filter — exclude logo/globe fallback images when real photos exist.
 * Loaded via components.js on most pages; may also be included directly before carousel scripts.
 */
(function initCarouselPlaceholderFilter() {
	if (window.owenminercsCarouselFilter) return;

	function normSrc(src) {
		return String(src || '')
			.trim()
			.toLowerCase();
	}

	/** True for site logo PNGs, globe JPG placeholders, coming-soon cards, favicons, data URLs, SVG. */
	function isCarouselPlaceholderSrc(src) {
		var lower = normSrc(src);
		if (!lower || /^data:/i.test(lower)) return true;
		if (lower.includes('coming-soon-card')) return true;
		if (lower.includes('owenminercs-logo')) return true;
		if (lower.includes('/images/logo/globes/') || lower.includes('logo/globes/globe-')) return true;
		if (/\/images\/logo\/(favicon|apple-touch)/.test(lower)) return true;
		if (lower.endsWith('.svg')) return true;
		return false;
	}

	function slideSrc(slide) {
		if (!slide) return '';
		if (typeof slide === 'string') return slide;
		if (typeof slide.src === 'string') return slide.src;
		if (slide.getAttribute) return slide.getAttribute('src') || '';
		return '';
	}

	/**
	 * Drop placeholder slides when any real content image exists.
	 * If placeholders are the only images, keep them so carousels/cards are not empty.
	 */
	function filterCarouselSlides(slides) {
		if (!slides || !slides.length) return slides || [];
		var real = [];
		var placeholders = [];
		for (var i = 0; i < slides.length; i++) {
			var slide = slides[i];
			if (isCarouselPlaceholderSrc(slideSrc(slide))) placeholders.push(slide);
			else real.push(slide);
		}
		if (real.length) return real;
		return placeholders.length ? placeholders : slides;
	}

	/** Remove placeholder <img> nodes from a carousel container when real images remain. */
	function pruneCarouselImageNodes(container) {
		if (!container || !container.querySelectorAll) return;
		var imgs = container.querySelectorAll('img[src]');
		if (!imgs.length) return;
		var real = [];
		var placeholders = [];
		for (var i = 0; i < imgs.length; i++) {
			var src = imgs[i].getAttribute('src');
			if (isCarouselPlaceholderSrc(src)) placeholders.push(imgs[i]);
			else real.push(imgs[i]);
		}
		if (!real.length || !placeholders.length) return;
		for (var j = 0; j < placeholders.length; j++) {
			placeholders[j].remove();
		}
	}

	var SORTABLE_CARD_SELECTOR =
		'.keep-card, .site-teaser-card, .home-explore-card, .garage-sale-card, .garage-sale-ebay-card';

	function isSortableCard(el) {
		return !!(el && el.matches && el.matches(SORTABLE_CARD_SELECTOR));
	}

	/** True when a card's media is only placeholders (globe, logo, empty thumb, coming-soon). */
	function isCardPlaceholderOnly(card) {
		if (!card) return false;
		if (card.getAttribute && card.getAttribute('data-card-sort-skip') === 'true') return false;
		if (card.querySelector('.keep-card__reddit-embed, .keep-card__video-thumb')) return false;
		if (card.querySelector('iframe[src]')) return false;
		if (card.querySelector('.keep-card__thumb--empty')) return true;

		var album = card.querySelector('.keep-card__album');
		if (album && !album.querySelector('img[src], iframe[src]')) return true;

		var imgs = card.querySelectorAll('img[src]');
		if (!imgs.length) {
			var thumb = card.querySelector('.keep-card__thumb');
			return !!(thumb && thumb.tagName !== 'IMG');
		}

		for (var i = 0; i < imgs.length; i++) {
			if (!isCarouselPlaceholderSrc(imgs[i].getAttribute('src'))) return false;
		}
		return true;
	}

	function cardVideoSlotText(card) {
		var slot = card && card.querySelector('.keep-card__video-slot');
		return slot ? String(slot.textContent || '').trim() : '';
	}

	/** Desk/room/build timeline cards — keep editorial order; do not treat as legacy gear. */
	function isCardSetupArchive(card) {
		if (!card) return false;
		if (card.getAttribute && card.getAttribute('data-card-setup-archive') === 'true') return true;
		if (card.getAttribute && card.getAttribute('data-card-setup-archive') === 'false') return false;
		return /^Archive$/i.test(cardVideoSlotText(card));
	}

	/** Sold or retired product cards (cameras, monitors, audio, etc.) — sort after active gear. */
	function isCardLegacyGear(card) {
		if (!card) return false;
		if (card.getAttribute && card.getAttribute('data-card-sort-skip') === 'true') return false;
		if (card.getAttribute && card.getAttribute('data-card-legacy') === 'false') return false;
		if (isCardSetupArchive(card)) return false;
		if (card.getAttribute && card.getAttribute('data-card-legacy') === 'true') return true;

		var slot = cardVideoSlotText(card);
		if (/^Legacy/i.test(slot)) return true;

		var href = (card.getAttribute && card.getAttribute('data-href')) || '';
		if (/-legacy(\.html|\/|$)/i.test(href)) return true;

		var cta = card.querySelector('.keep-card__cta');
		var ctaText = cta ? String(cta.textContent || '').trim() : '';
		if (/^Archive\s*→/i.test(ctaText)) return true;

		var blob = '';
		var label = card.querySelector('.keep-card__label');
		var aff = card.querySelector('.keep-card__affiliate');
		if (label) blob += label.textContent + ' ';
		if (aff) blob += aff.textContent + ' ';
		return /\bsold\b/i.test(blob);
	}

	/**
	 * Sort rank (lower = earlier): active real (0), active placeholder (1),
	 * legacy real (2), legacy placeholder (3). Setup archive cards use 0/1 only.
	 */
	function cardSortRank(card) {
		var placeholder = isCardPlaceholderOnly(card) ? 1 : 0;
		if (isCardLegacyGear(card)) return 2 + placeholder;
		return placeholder;
	}

	function stableSortCardRun(parent, run) {
		if (!parent || run.length < 2) return false;

		var indexed = run.map(function (card, idx) {
			return { card: card, rank: cardSortRank(card), idx: idx };
		});
		var minRank = indexed[0].rank;
		var maxRank = indexed[0].rank;
		for (var r = 1; r < indexed.length; r++) {
			if (indexed[r].rank < minRank) minRank = indexed[r].rank;
			if (indexed[r].rank > maxRank) maxRank = indexed[r].rank;
		}
		if (minRank === maxRank) return false;

		indexed.sort(function (a, b) {
			if (a.rank !== b.rank) return a.rank - b.rank;
			return a.idx - b.idx;
		});

		var anchor = run[run.length - 1].nextSibling;
		for (var j = 0; j < indexed.length; j++) {
			parent.insertBefore(indexed[j].card, anchor);
		}
		return true;
	}

	/** Sort sibling card runs inside a container; recurse into section wrappers. */
	function sortSiblingCardRuns(parent) {
		if (!parent || !parent.children) return;
		var children = [].slice.call(parent.children);
		var i = 0;
		while (i < children.length) {
			var child = children[i];
			if (isSortableCard(child)) {
				var run = [];
				while (i < children.length && isSortableCard(children[i])) {
					run.push(children[i]);
					i++;
				}
				stableSortCardRun(parent, run);
			} else {
				if (child.querySelector && child.querySelector(SORTABLE_CARD_SELECTOR)) {
					sortSiblingCardRuns(child);
				}
				i++;
			}
		}
	}

	var CARD_GRID_SELECTOR =
		'.keep-board, .site-teaser-grid, .garage-sale-grid, [data-garage-sale-grid], [data-card-sort-grid]';

	function sortAllCardGrids(root) {
		var scope = root && root.querySelectorAll ? root : document;
		var grids = scope.querySelectorAll(CARD_GRID_SELECTOR);
		for (var g = 0; g < grids.length; g++) {
			sortSiblingCardRuns(grids[g]);
		}
	}

	/** True when at least one slide uses a real (non-placeholder) image. */
	function slidesHaveRealMedia(slides) {
		if (!slides || !slides.length) return false;
		for (var i = 0; i < slides.length; i++) {
			if (!isCarouselPlaceholderSrc(slideSrc(slides[i]))) return true;
		}
		return false;
	}

	/** Stable sort for config arrays ({ img } or custom key) — home explore, etc. */
	function sortConfigCardsPlaceholderLast(cards, imgKey) {
		var key = imgKey || 'img';
		if (!cards || !cards.length) return cards || [];
		return cards
			.map(function (card, idx) {
				var src = typeof card === 'string' ? card : card && card[key];
				return {
					card: card,
					idx: idx,
					rank: isCarouselPlaceholderSrc(src) ? 1 : 0,
				};
			})
			.sort(function (a, b) {
				if (a.rank !== b.rank) return a.rank - b.rank;
				return a.idx - b.idx;
			})
			.map(function (item) {
				return item.card;
			});
	}

	window.owenminercsCarouselFilter = {
		isCarouselPlaceholderSrc: isCarouselPlaceholderSrc,
		filterCarouselSlides: filterCarouselSlides,
		pruneCarouselImageNodes: pruneCarouselImageNodes,
		isCardPlaceholderOnly: isCardPlaceholderOnly,
		isCardSetupArchive: isCardSetupArchive,
		isCardLegacyGear: isCardLegacyGear,
		cardSortRank: cardSortRank,
		slidesHaveRealMedia: slidesHaveRealMedia,
		sortSiblingCardRuns: sortSiblingCardRuns,
		sortAllCardGrids: sortAllCardGrids,
		sortConfigCardsPlaceholderLast: sortConfigCardsPlaceholderLast,
	};
})();
