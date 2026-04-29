(function () {
	var roots = {
		garage: document.getElementById('shop-ebay-garage'),
		digital: document.getElementById('shop-ebay-digital'),
	};
	var ebayErr = document.getElementById('garage-sale-ebay-error');
	var shopErr = document.getElementById('shop-products-error');
	var noteEl = document.getElementById('shop-products-payment-note');
	var sortbar = document.getElementById('garage-sale-sortbar');
	var sortSelect = document.getElementById('garage-sale-sort');
	/** Labels from shop-products.json payment.hostedCheckout (set when JSON loads). */
	var shopPaymentHosted = null;
	if (!roots.garage && !roots.digital) return;

	var script = document.currentScript;
	var ebayRel = (script && script.getAttribute('data-ebay-listings')) || 'ebay-listings.json';
	var ebayUrl = new URL(ebayRel, window.location.href).href;
	var productsRel = (script && script.getAttribute('data-shop-products')) || 'shop-products.json';
	var productsUrl = new URL(productsRel, window.location.href).href;

	/** Merge: stickers → prints → custom-work (products array order within each section), then eBay rows. */
	var SHOP_SECTION_ORDER = ['stickers', 'prints', 'custom-work'];

	var dataGarage = [];
	var dataDigital = [];
	var currentSort = 'order';

	function showNodeError(node, msg) {
		if (node) {
			node.hidden = false;
			node.textContent = msg;
		}
	}

	function getJson(url, name) {
		return fetch(url).then(function (r) {
			if (!r.ok) throw new Error('Could not load ' + name);
			return r.json();
		});
	}

	function applyPaymentNote(data) {
		if (noteEl && data && data.payment && data.payment.publicNote) {
			noteEl.hidden = false;
			noteEl.textContent = data.payment.publicNote;
		}
	}

	function resolveProductUrl(url, baseHref) {
		if (!url || typeof url !== 'string') return '';
		var trimmed = url.trim();
		if (!trimmed) return '';
		if (
			/^https?:\/\//i.test(trimmed) ||
			trimmed.charAt(0) === '/' ||
			trimmed.charAt(0) === '#'
		) {
			return trimmed;
		}
		try {
			return new URL(trimmed, baseHref).href;
		} catch (_) {
			return '';
		}
	}

	/**
	 * PayPal / generic checkout URL first, then Stripe as a second hosted option when both are set.
	 * @returns {{ primary: string, alternate: string }}
	 */
	function resolveCheckoutPair(product, baseHref) {
		var paypal = resolveProductUrl(
			product && product.paypalUrl != null ? String(product.paypalUrl) : '',
			baseHref
		);
		var checkout = resolveProductUrl(
			product && product.checkoutUrl != null ? String(product.checkoutUrl) : '',
			baseHref
		);
		var buyOn = resolveProductUrl(
			product && product.buyOnSiteUrl != null ? String(product.buyOnSiteUrl) : '',
			baseHref
		);
		var stripe = resolveProductUrl(
			product && product.stripeUrl != null ? String(product.stripeUrl) : '',
			baseHref
		);

		function isHttp(u) {
			return Boolean(u && /^https?:\/\//i.test(u));
		}

		var primary = '';
		if (isHttp(paypal)) primary = paypal;
		else if (isHttp(checkout)) primary = checkout;
		else if (isHttp(buyOn)) primary = buyOn;

		var alternate = '';
		if (isHttp(stripe) && stripe !== primary) alternate = stripe;

		if (!primary && isHttp(stripe)) {
			primary = stripe;
			alternate = '';
		}
		return { primary: primary, alternate: alternate };
	}

	function shopIsCheckoutLive(product) {
		var pair = resolveCheckoutPair(product, productsUrl);
		return (
			String((product && product.status) || '').toLowerCase() === 'available' &&
			Boolean(pair.primary || pair.alternate)
		);
	}

	function shopAvailabilityLine(product) {
		if (!product) return 'Coming soon';
		if (product.availabilityLabel && String(product.availabilityLabel).trim() !== '')
			return String(product.availabilityLabel);
		var status = String((product && product.status) || '').toLowerCase();
		if (status === 'available') return 'Available';
		if (status === 'tbd') return 'TBD';
		if (status === 'sold-out') return 'Sold out';
		return 'Coming soon';
	}

	/**
	 * One shop-products.json row → garage-ebay-grid card shape.
	 * Mirrors shop-products.json fields; relative URLs resolved from JSON file URL.
	 */
	function mapShopProductToListing(product) {
		var checkoutRaw =
			(product.checkoutUrl != null ? String(product.checkoutUrl) : '') ||
			(product.buyOnSiteUrl != null ? String(product.buyOnSiteUrl) : '') ||
			(product.paypalUrl != null ? String(product.paypalUrl) : '') ||
			(product.stripeUrl != null ? String(product.stripeUrl) : '');
		var checkoutResolved = resolveProductUrl(checkoutRaw, productsUrl);
		var buyOnSite = shopIsCheckoutLive(product) ? checkoutResolved : '';

		var imgRaw = product.image ? String(product.image).trim() : '';
		var imgResolved = imgRaw ? resolveProductUrl(imgRaw, productsUrl) : '';
		var images = [];
		if (imgResolved) images.push(imgResolved);

		var detailNotes = [];
		if (Array.isArray(product.details)) {
			product.details.forEach(function (d) {
				if (d != null && String(d).trim() !== '') detailNotes.push(String(d));
			});
		}

		var secRaw = product.secondaryUrl != null ? String(product.secondaryUrl) : '';
		var secondaryResolved = resolveProductUrl(secRaw, productsUrl);
		var secondaryLabel =
			product.secondaryLabel != null ? String(product.secondaryLabel).trim() : '';

		var parsedPrice = NaN;
		if (typeof product.priceNumber === 'number' && !isNaN(product.priceNumber))
			parsedPrice = product.priceNumber;
		else {
			var p = String(product.price || '').replace(/[^0-9.]/g, '');
			if (p) {
				var n = parseFloat(p);
				if (!isNaN(n)) parsedPrice = n;
			}
		}

		var row = {
			title: product.title || 'Shop product',
			price: product.price || '',
			image: imgResolved,
			images: images,
			publishedAt: product.publishedAt || '',
			buyOnSiteUrl: buyOnSite || '',
			checkoutUrl: buyOnSite || '',
			paypalUrl: product.paypalUrl || '',
			stripeUrl: product.stripeUrl || '',
			ebayUrl: '',
			secondaryCtaUrl: secondaryResolved || '',
			secondaryCtaLabel: secondaryLabel || '',
			__shopSource: true,
			__suppressEbayHint: true,
			shopAvailabilityText: shopAvailabilityLine(product),
		};

		if (!isNaN(parsedPrice)) row.priceNumber = parsedPrice;

		if (product.eyebrow && String(product.eyebrow).trim() !== '')
			row.shopEyebrow = String(product.eyebrow).trim();
		if (product.summary && String(product.summary).trim() !== '')
			row.shopSummary = String(product.summary).trim();
		if (detailNotes.length) row.detailNotes = detailNotes;

		return row;
	}

	function orderedShopProducts(products) {
		var out = [];
		var seen = {};

		function pick(sec) {
			for (var i = 0; i < products.length; i++) {
				var p = products[i];
				if (!p || typeof p !== 'object') continue;
				if (String(p.section || '').toLowerCase() !== sec) continue;
				var id = p.id != null ? String(p.id) : 'idx-' + i;
				var key = sec + '|' + id;
				if (seen[key]) continue;
				seen[key] = true;
				out.push(mapShopProductToListing(p));
			}
		}

		for (var s = 0; s < SHOP_SECTION_ORDER.length; s++) {
			pick(SHOP_SECTION_ORDER[s]);
		}
		return out;
	}

	/** eBay: prefer ebayUrl, else url when it looks like https. */
	function getEbayUrl(item) {
		if (!item) return '';
		var u = (
			item.ebayUrl != null && String(item.ebayUrl).trim() !== ''
				? String(item.ebayUrl)
				: String(item.url || '')
		).trim();
		if (!u) return '';
		if (/^https?:\/\//i.test(u)) return u;
		return '';
	}

	/** Hosted checkout URLs (ebay-listings.json + mapped shop rows). */
	function getBuyOnSiteUrl(item) {
		if (!item) return '';
		var keys = ['buyOnSiteUrl', 'checkoutUrl', 'paypalUrl', 'stripeUrl'];
		for (var i = 0; i < keys.length; i++) {
			var raw = item[keys[i]];
			var u = raw != null ? String(raw).trim() : '';
			if (!u || u === '""') continue;
			if (/^https?:\/\//i.test(u)) return u;
		}
		return '';
	}

	function getGalleryViewHref(item) {
		var ebay = getEbayUrl(item);
		if (ebay) return ebay;
		var buy = getBuyOnSiteUrl(item);
		if (buy) return buy;
		var sec = item && item.secondaryCtaUrl != null ? String(item.secondaryCtaUrl).trim() : '';
		if (sec) return sec;
		return '';
	}

	function getPriceValue(item) {
		if (item == null) return NaN;
		if (typeof item.priceNumber === 'number' && !isNaN(item.priceNumber))
			return item.priceNumber;
		if (item.priceCents != null) {
			var c = Number(item.priceCents);
			if (!isNaN(c)) return c / 100;
		}
		var p = String(item.price || '').replace(/[^0-9.]/g, '');
		if (!p) return NaN;
		var n = parseFloat(p);
		return isNaN(n) ? NaN : n;
	}

	/** ISO 8601 strings from publishedAt or listingDate; invalid/missing → null. */
	function getPublishedTime(item) {
		if (item == null) return null;
		var s = (item.publishedAt || item.listingDate || '').toString().trim();
		if (!s) return null;
		var t = Date.parse(s);
		if (isNaN(t)) return null;
		return t;
	}

	function sortList(list) {
		var items = list.slice();
		if (currentSort === 'order') {
			return items.sort(function (a, b) {
				return (a && a.__fileOrder) - (b && b.__fileOrder);
			});
		}
		if (currentSort === 'price-asc' || currentSort === 'price-desc') {
			return items.sort(function (a, b) {
				var pa = getPriceValue(a);
				var pb = getPriceValue(b);
				var na = isNaN(pa);
				var nb = isNaN(pb);
				if (na && nb) return (a.__fileOrder || 0) - (b.__fileOrder || 0);
				if (na) return 1;
				if (nb) return -1;
				var cmp = pa - pb;
				if (cmp !== 0) return currentSort === 'price-asc' ? cmp : -cmp;
				return (a.__fileOrder || 0) - (b.__fileOrder || 0);
			});
		}
		/*
		 * Date sorts use getPublishedTime (publishedAt / listingDate, ISO 8601).
		 * Omitted dates: bottom for newest-first (date-desc), top for oldest-first (date-asc).
		 */
		if (currentSort === 'date-asc' || currentSort === 'date-desc') {
			return items.sort(function (a, b) {
				var ta = getPublishedTime(a);
				var tb = getPublishedTime(b);
				if (ta == null && tb == null) return (a.__fileOrder || 0) - (b.__fileOrder || 0);
				if (currentSort === 'date-desc') {
					if (ta == null) return 1;
					if (tb == null) return -1;
				} else {
					if (ta == null) return -1;
					if (tb == null) return 1;
				}
				var cmp = ta - tb;
				if (cmp !== 0) return currentSort === 'date-asc' ? cmp : -cmp;
				return (a.__fileOrder || 0) - (b.__fileOrder || 0);
			});
		}
		return items;
	}

	function safeExternalLabel(url, label) {
		var host = '';
		try {
			host =
				new URL(url, window.location.origin).hostname.replace(/^www\./, '') || 'checkout';
		} catch (_) {
			host = 'checkout';
		}
		if (/stripe\.com/i.test(host)) return label + ' (Stripe checkout)';
		if (/paypal\.com|paypal\./i.test(host)) return label + ' (PayPal checkout)';
		return label + ' (secure checkout)';
	}

	function renderEbayCards(container, items) {
		if (!container) return;
		while (container.firstChild) container.removeChild(container.firstChild);

		if (!items || !items.length) {
			var empty = document.createElement('p');
			empty.className = 'garage-sale-empty';
			empty.innerHTML =
				'No listings in this section right now. Check <code>Garage Sale/ebay-listings.json</code> or <a href="https://www.ebay.com/usr/owenm00" target="_blank" rel="noopener noreferrer">eBay</a>.';
			container.appendChild(empty);
			return;
		}

		var frag = document.createDocumentFragment();
		items.forEach(function (item) {
			var card = document.createElement('article');
			card.className = 'garage-sale-card garage-sale-ebay-card';

			var viewHref = getGalleryViewHref(item);
			var galleryImages = Array.isArray(item && item.images) ? item.images : [];
			var primaryImage = item && item.image ? String(item.image).trim() : '';
			if (primaryImage && galleryImages.indexOf(primaryImage) === -1) {
				galleryImages = [primaryImage].concat(galleryImages);
			}

			if (galleryImages.length) {
				var gallery = document.createElement('div');
				gallery.className = 'garage-sale-ebay-gallery';
				galleryImages.forEach(function (src, index) {
					var normalizedSrc = String(src || '').trim();
					if (!normalizedSrc) return;

					var imgWrap;
					if (viewHref) {
						imgWrap = document.createElement('a');
						imgWrap.href = viewHref;
						imgWrap.className = 'garage-sale-ebay-image-link';
						if (/^https?:\/\//i.test(viewHref)) {
							imgWrap.target = '_blank';
							imgWrap.rel = 'noopener noreferrer';
						}
					} else {
						imgWrap = document.createElement('div');
						imgWrap.className = 'garage-sale-ebay-image-link';
					}

					var img = document.createElement('img');
					img.className = 'garage-sale-ebay-image';
					img.src = normalizedSrc;
					img.alt = (item && item.title ? item.title : 'Listing') + ' photo ' + (index + 1);
					img.loading = 'lazy';
					imgWrap.appendChild(img);
					gallery.appendChild(imgWrap);
				});
				if (gallery.childNodes.length) {
					card.appendChild(gallery);
				}
			}

			var h = document.createElement('h3');
			h.className = 'garage-sale-ebay-title';
			h.textContent = (item && item.title) || 'Untitled listing';
			card.appendChild(h);

			if (item && item.__shopSource && item.shopEyebrow) {
				var eb = document.createElement('p');
				eb.className = 'garage-sale-ebay-spread-note';
				eb.textContent = item.shopEyebrow;
				card.appendChild(eb);
			}

			if (item && item.publishedAt) {
				var dateP = document.createElement('p');
				dateP.className = 'garage-sale-ebay-date';
				var d = new Date(String(item.publishedAt));
				dateP.textContent = isNaN(d.getTime())
					? 'Listed: (invalid date in JSON)'
					: 'Listed: ' +
						d.toLocaleDateString(undefined, {
							year: 'numeric',
							month: 'short',
							day: 'numeric',
						});
				card.appendChild(dateP);
			}

			if (item && item.price) {
				var listedPrice = document.createElement('p');
				listedPrice.className = 'garage-sale-ebay-price';
				listedPrice.textContent = 'Listed: ' + item.price;
				card.appendChild(listedPrice);
			}

			if (item && !item.price) {
				var unavailable = document.createElement('p');
				unavailable.className = 'garage-sale-ebay-spread-note';
				unavailable.textContent = 'Price unavailable right now.';
				card.appendChild(unavailable);
			}

			if (item && !item.__shopSource && item.condition) {
				var condition = document.createElement('p');
				condition.className = 'garage-sale-ebay-spread-note';
				condition.textContent = 'Condition: ' + item.condition;
				card.appendChild(condition);
			}
			if (item && !item.__shopSource && item.shipping) {
				var shipping = document.createElement('p');
				shipping.className = 'garage-sale-ebay-spread-note';
				shipping.textContent = 'Shipping: ' + item.shipping;
				card.appendChild(shipping);
			}

			if (item && item.__shopSource && item.shopSummary) {
				var sum = document.createElement('p');
				sum.className = 'garage-sale-ebay-spread-note';
				sum.textContent = item.shopSummary;
				card.appendChild(sum);
			}

			if (item && Array.isArray(item.detailNotes) && item.detailNotes.length) {
				item.detailNotes.forEach(function (note) {
					if (!note) return;
					var line = document.createElement('p');
					line.className = 'garage-sale-ebay-spread-note';
					line.textContent = String(note);
					card.appendChild(line);
				});
			}

			var ctaRow = document.createElement('div');
			ctaRow.className = 'garage-sale-ebay-ctas';

			var buy = getBuyOnSiteUrl(item);
			if (buy) {
				var buyA = document.createElement('a');
				buyA.className = 'modeButton garage-sale-ebay-buy';
				buyA.href = buy;
				buyA.target = '_blank';
				buyA.rel = 'noopener noreferrer';
				buyA.textContent = safeExternalLabel(buy, 'Buy on site');
				ctaRow.appendChild(buyA);
			}

			var ebay = getEbayUrl(item);
			if (ebay) {
				var cta = document.createElement('a');
				cta.className =
					'modeButton garage-sale-card-link' +
					(buy ? ' garage-sale-ebay-cta--secondary' : '');
				cta.href = ebay;
				cta.target = '_blank';
				cta.rel = 'noopener noreferrer';
				cta.textContent = 'View on eBay';
				ctaRow.appendChild(cta);
			}

			if (item && item.__shopSource && !buy) {
				var pend = document.createElement('p');
				pend.className = 'garage-sale-ebay-spread-note';
				pend.textContent = item.shopAvailabilityText || 'Coming soon';
				ctaRow.appendChild(pend);
			}

			var secUrl = item && item.secondaryCtaUrl != null ? String(item.secondaryCtaUrl).trim() : '';
			var secLabel = item && item.secondaryCtaLabel != null ? String(item.secondaryCtaLabel).trim() : '';
			var hasPrimaryShopLine = item && item.__shopSource && !buy && !ebay;
			if (secUrl && secLabel) {
				var sec = document.createElement('a');
				sec.className =
					'modeButton garage-sale-card-link' +
					(buy || ebay || hasPrimaryShopLine ? ' garage-sale-ebay-cta--secondary' : '');
				sec.href = secUrl;
				if (/^https?:\/\//i.test(secUrl)) {
					sec.target = '_blank';
					sec.rel = 'noopener noreferrer';
				}
				sec.textContent = secLabel;
				ctaRow.appendChild(sec);
			}

			if (
				!ebay &&
				!buy &&
				(!secUrl || !secLabel) &&
				!(item && item.__shopSource)
			) {
				var noLink = document.createElement('p');
				noLink.className = 'garage-sale-ebay-spread-note';
				noLink.textContent = 'Add eBay or checkout URL in ebay-listings.json.';
				ctaRow.appendChild(noLink);
			} else if (
				buy &&
				!ebay &&
				item &&
				!item.__suppressEbayHint
			) {
				var ebayOnlyNote = document.createElement('p');
				ebayOnlyNote.className = 'garage-sale-ebay-spread-note';
				ebayOnlyNote.textContent =
					'Prefer marketplace? Add an eBay itm link as url or ebayUrl.';
				ctaRow.appendChild(ebayOnlyNote);
			}

			if (ctaRow.hasChildNodes()) card.appendChild(ctaRow);

			frag.appendChild(card);
		});
		container.appendChild(frag);
	}

	function applySortAndRender() {
		if (sortSelect) {
			currentSort = sortSelect.value || 'order';
		}
		renderEbayCards(roots.garage, sortList(dataGarage));
		renderEbayCards(roots.digital, sortList(dataDigital));
	}

	function onSortChange() {
		applySortAndRender();
	}

	function initSortControls() {
		if (sortbar) sortbar.hidden = false;
		if (sortSelect) {
			sortSelect.addEventListener('change', onSortChange);
		}
	}

	function inferSection(item) {
		if (item && item.section) {
			var s = String(item.section).toLowerCase();
			if (s === 'digital' || s === 'digital-assets') return 'digital';
			return 'garage';
		}
		return 'garage';
	}

	function assignFileOrder(list) {
		return list.map(function (item, i) {
			var o = item && typeof item === 'object' ? Object.assign({}, item) : {};
			o.__fileOrder = i;
			return o;
		});
	}

	Promise.all([
		getJson(ebayUrl, ebayRel).catch(function () {
			return null;
		}),
		getJson(productsUrl, productsRel).catch(function () {
			return null;
		}),
	]).then(function (results) {
		var ebayData = results[0];
		var shopData = results[1];

		if (!ebayData) {
			showNodeError(
				ebayErr,
				'Could not load eBay items. Check that ebay-listings.json is next to this page.'
			);
		}

		if (shopData) {
			applyPaymentNote(shopData);
			if (shopErr) {
				shopErr.hidden = true;
				shopErr.textContent = '';
			}
		} else {
			showNodeError(
				shopErr,
				'Could not load shop products. Check Garage Sale/shop-products.json.'
			);
		}

		var shopItems = [];
		if (shopData && Array.isArray(shopData.products)) {
			shopItems = orderedShopProducts(shopData.products);
		}

		var ebayGarageItems = [];
		var all = (ebayData && ebayData.items) || [];
		all.forEach(function (item) {
			var s = inferSection(item);
			if (s !== 'digital' && s !== 'digital-assets') {
				ebayGarageItems.push(item);
			}
		});

		dataGarage = assignFileOrder(shopItems.concat(ebayGarageItems));

		dataDigital = [];
		all.forEach(function (item) {
			var s2 = inferSection(item);
			if (s2 === 'digital' || s2 === 'digital-assets') {
				dataDigital.push(item);
			}
		});
		dataDigital = assignFileOrder(dataDigital);

		if (dataGarage.length + dataDigital.length > 0) {
			initSortControls();
		}
		applySortAndRender();
	});
})();
