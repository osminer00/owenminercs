(function () {
	'use strict';

	var rootEbay = document.getElementById('shop-ebay-garage');
	var rootHold = document.getElementById('shop-drops-hold');
	var rootDigital = document.getElementById('shop-ebay-digital');
	var ebayErr = document.getElementById('garage-sale-ebay-error');
	var shopErr = document.getElementById('shop-products-error');
	var noteEl = document.getElementById('shop-products-payment-note');
	var sortbar = document.getElementById('garage-sale-sortbar');
	var sortSelect = document.getElementById('garage-sale-sort');
	var cartFab = document.getElementById('shop-cart-fab');
	var cartCountEl = document.getElementById('shop-cart-count');
	var cartDialog = document.getElementById('shop-cart-dialog');
	var cartListEl = document.getElementById('shop-cart-list');
	var cartDialogClose = document.getElementById('shop-cart-dialog-close');
	var detailDialog = document.getElementById('ebay-detail-dialog');
	var detailClose = document.getElementById('ebay-detail-close');
	var detailGallery = document.getElementById('ebay-detail-gallery');
	var detailTitle = document.getElementById('ebay-detail-title');
	var detailBody = document.getElementById('ebay-detail-body');

	if (!rootEbay && !rootHold && !rootDigital) return;

	var script = document.currentScript;
	var ebayRel = (script && script.getAttribute('data-ebay-listings')) || 'ebay-listings.json';
	var ebayUrl = new URL(ebayRel, window.location.href).href;
	var productsRel = (script && script.getAttribute('data-shop-products')) || 'shop-products.json';
	var productsUrl = new URL(productsRel, window.location.href).href;
	var shopStripeEndpoint =
		(script && script.getAttribute('data-shop-stripe-checkout')) || '';

	var PLACEHOLDER_IMG = new URL('../images/owenminercs-logo.png', window.location.href).href;
	var CART_KEY = 'owenminercs-ebay-cart-v1';

	var SHOP_SECTION_ORDER = ['stickers', 'prints', 'custom-work'];

	var dataEbay = [];
	var dataShopLive = [];
	var dataShopHold = [];
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
		var stripeBackend =
			String((product && product.checkoutBackend) || '')
				.toLowerCase()
				.trim() === 'stripe';
		var stripeReady = !stripeBackend || Boolean(resolveStripeCheckoutEndpoint());
		return (
			String((product && product.status) || '').toLowerCase() === 'available' &&
			stripeReady &&
			(Boolean(pair.primary || pair.alternate) || stripeBackend)
		);
	}

	function shopAvailabilityLine(product) {
		if (!product) return 'Coming soon';
		if (product.availabilityLabel && String(product.availabilityLabel).trim() !== '')
			return String(product.availabilityLabel);
		var status = String((product && product.status) || '').toLowerCase();
		var stripeBackend =
			String((product && product.checkoutBackend) || '')
				.toLowerCase()
				.trim() === 'stripe';
		if (status === 'available' && stripeBackend && !resolveStripeCheckoutEndpoint())
			return 'Checkout unavailable (add Stripe on the server)';
		if (status === 'available') return 'Available';
		if (status === 'tbd') return 'TBD';
		if (status === 'sold-out') return 'Sold out';
		return 'Coming soon';
	}

	function mapShopProductToListing(product) {
		var pair = resolveCheckoutPair(product, productsUrl);
		var checkoutBackend =
			product && product.checkoutBackend != null
				? String(product.checkoutBackend).toLowerCase().trim()
				: '';
		var stripeBackend = checkoutBackend === 'stripe';
		var live = shopIsCheckoutLive(product);
		var buyOnSite =
			live && !stripeBackend ? pair.primary || pair.alternate || '' : '';
		var alternateCheckout =
			live && !stripeBackend && pair.primary && pair.alternate ? pair.alternate : '';

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

		var imageAltTrim =
			product.imageAlt != null && String(product.imageAlt).trim() !== ''
				? String(product.imageAlt).trim()
				: '';

		var row = {
			title: product.title || 'Shop product',
			price: product.price || '',
			image: imgResolved,
			images: images,
			publishedAt: product.publishedAt || '',
			buyOnSiteUrl: buyOnSite || '',
			checkoutUrl: buyOnSite || '',
			alternateCheckoutUrl: alternateCheckout || '',
			paypalUrl: product.paypalUrl || '',
			stripeUrl: product.stripeUrl || '',
			ebayUrl: '',
			secondaryCtaUrl: secondaryResolved || '',
			secondaryCtaLabel: secondaryLabel || '',
			__shopSource: true,
			__saleHold: !live,
			__suppressEbayHint: true,
			shopAvailabilityText: shopAvailabilityLine(product),
			shopImageAlt: imageAltTrim,
			checkoutBackend: checkoutBackend,
			dynamicStripeCheckout: Boolean(live && stripeBackend),
			shopProductId: product.id != null ? String(product.id) : '',
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

	function enrichEbayListingRow(raw, source) {
		var o = raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
		var ship =
			o.shipping != null && String(o.shipping).trim() !== ''
				? String(o.shipping).trim()
				: '';
		if (!ship && o.shippingCost != null && String(o.shippingCost).trim() !== '') {
			ship = String(o.shippingCost).trim();
		}
		if (!ship && source && source.defaultShipping != null && String(source.defaultShipping).trim() !== '') {
			ship = String(source.defaultShipping).trim();
		}
		if (!ship) {
			ship = 'See live listing on eBay for shipping cost.';
		}
		o.shipping = ship;
		return o;
	}

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

	function ebayItemId(item) {
		var u = getEbayUrl(item);
		var m = u.match(/\/itm\/(\d+)/i);
		return m ? m[1] : u || item.title || 'unknown';
	}

	/** Stable cart line id: eBay item id when present, else hash of direct checkout URL + title. */
	function stableCartId(item) {
		if (!item) return '';
		var u = getEbayUrl(item);
		var m = u && u.match(/\/itm\/(\d+)/i);
		if (m) return m[1];
		if (item.shopProductId && String(item.shopProductId).trim() !== '')
			return 'shop-' + String(item.shopProductId).trim();
		var d = getBuyOnSiteUrl(item);
		if (!d) return '';
		var s = d + '\n' + String(item.title || '');
		var h = 0;
		for (var i = 0; i < s.length; i++) {
			h = (h << 5) - h + s.charCodeAt(i);
			h |= 0;
		}
		return 'd' + (h < 0 ? -h : h);
	}

	function normalizeEbayImages(item) {
		var base = ebayUrl;
		var out = [];
		var gallery = Array.isArray(item.images) ? item.images.slice() : [];
		var primary = item.image ? String(item.image).trim() : '';
		if (primary && gallery.indexOf(primary) === -1) gallery.unshift(primary);
		gallery.forEach(function (src) {
			var s = String(src || '').trim();
			if (!s) return;
			var abs = resolveProductUrl(s, base);
			if (abs) out.push(abs);
		});
		if (!out.length) out.push(PLACEHOLDER_IMG);
		return out;
	}

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

	function getPublishedTime(item) {
		if (item == null) return null;
		var s = (item.publishedAt || item.listingDate || '').toString().trim();
		if (!s) return null;
		var t = Date.parse(s);
		if (isNaN(t)) return null;
		return t;
	}

	function sortEbayList(list) {
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

	function readCart() {
		try {
			var raw = localStorage.getItem(CART_KEY);
			if (!raw) return [];
			var parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch (_) {
			return [];
		}
	}

	function writeCart(items) {
		try {
			localStorage.setItem(CART_KEY, JSON.stringify(items));
		} catch (_) {}
		updateCartUi();
	}

	function updateCartUi() {
		var items = readCart();
		if (cartCountEl) cartCountEl.textContent = String(items.length);
	}

	function resolveStripeCheckoutEndpoint() {
		var raw = shopStripeEndpoint;
		if (!raw || typeof raw !== 'string') return '';
		var t = raw.trim();
		if (!t) return '';
		if (/^https?:\/\//i.test(t)) return t;
		try {
			return new URL(t, window.location.origin).href;
		} catch (_) {
			return '';
		}
	}

	function startStripeSession(items) {
		var endpoint = resolveStripeCheckoutEndpoint();
		if (!endpoint || !items.length) return;
		fetch(endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ items: items }),
		})
			.then(function (r) {
				return r.json().then(function (data) {
					return { ok: r.ok, data: data };
				});
			})
			.then(function (result) {
				if (result.ok && result.data && result.data.url) {
					window.location.href = result.data.url;
					return;
				}
				var msg =
					(result.data && result.data.error) ||
					'Checkout could not start. Verify Stripe is configured on the server.';
				window.alert(msg);
			})
			.catch(function () {
				window.alert('Checkout could not start. Check your connection.');
			});
	}

	function cartPayloadFromItem(item) {
		var imgs = normalizeEbayImages(item);
		var id = stableCartId(item);
		if (!id) id = String(ebayItemId(item));
		return {
			id: id,
			title: item.title || 'Listing',
			price: item.price || '',
			shipping: item.shipping || '',
			url: getEbayUrl(item),
			checkoutUrl: getBuyOnSiteUrl(item) || '',
			dynamicStripe: Boolean(item.dynamicStripeCheckout),
			shopProductId: item.shopProductId || '',
			image: imgs[0] || PLACEHOLDER_IMG,
		};
	}

	function addToCart(item) {
		if (!stableCartId(item)) return;
		var stripeOk =
			item.dynamicStripeCheckout &&
			item.shopProductId &&
			resolveStripeCheckoutEndpoint();
		if (
			!getBuyOnSiteUrl(item) &&
			!stripeOk &&
			(!getEbayUrl(item) || !/\/itm\//i.test(getEbayUrl(item)))
		)
			return;
		var payload = cartPayloadFromItem(item);
		var cart = readCart();
		var exists = cart.some(function (x) {
			return x.id === payload.id;
		});
		if (!exists) {
			cart.push(payload);
			writeCart(cart);
		}
	}

	function removeFromCart(id) {
		var cart = readCart().filter(function (x) {
			return x.id !== id;
		});
		writeCart(cart);
		renderCartDialog();
	}

	function renderCartDialog() {
		if (!cartListEl) return;
		while (cartListEl.firstChild) cartListEl.removeChild(cartListEl.firstChild);
		var items = readCart();
		if (!items.length) {
			var p = document.createElement('p');
			p.className = 'shop-cart-empty';
			p.textContent = 'Your cart is empty. Add items from the for-sale listings above.';
			cartListEl.appendChild(p);
			return;
		}
		items.forEach(function (line) {
			var row = document.createElement('div');
			row.className = 'shop-cart-line';
			var main = document.createElement('div');
			main.className = 'shop-cart-line-main';
			var title = document.createElement('strong');
			title.className = 'shop-cart-line-title';
			title.textContent = line.title || 'Item';
			var price = document.createElement('span');
			price.className = 'shop-cart-line-price';
			price.textContent =
				(line.checkoutUrl || line.dynamicStripe
					? 'Price (direct): ' + (line.price || '—')
					: 'Price (eBay): ' + (line.price || '—'));
			var ship = document.createElement('span');
			ship.className = 'shop-cart-line-ship';
			if (line.checkoutUrl) {
				ship.textContent = line.url
					? 'Prefer direct checkout — eBay is optional for the same item.'
					: 'Pay on the seller checkout page.';
			} else if (line.dynamicStripe) {
				ship.textContent = 'Checkout opens Stripe (cards and wallets). U.S. shipping collected at checkout.';
			} else {
				ship.textContent = 'Shipping: ' + (line.shipping || '—') + ' · U.S. only';
			}
			main.appendChild(title);
			main.appendChild(price);
			main.appendChild(ship);
			row.appendChild(main);

			var actions = document.createElement('div');
			actions.className = 'shop-cart-line-actions';
			if (line.checkoutUrl) {
				var ck = document.createElement('a');
				ck.className = 'modeButton shop-cart-checkout-direct';
				ck.href = line.checkoutUrl;
				ck.target = '_blank';
				ck.rel = 'noopener noreferrer';
				ck.textContent = 'Checkout direct';
				actions.appendChild(ck);
			} else if (line.dynamicStripe && line.shopProductId && resolveStripeCheckoutEndpoint()) {
				var ckSt = document.createElement('button');
				ckSt.type = 'button';
				ckSt.className = 'modeButton shop-cart-checkout-direct';
				ckSt.textContent = 'Checkout';
				ckSt.addEventListener('click', function () {
					startStripeSession([{ id: line.shopProductId, quantity: 1 }]);
				});
				actions.appendChild(ckSt);
			}
			if (line.url && /\/itm\//i.test(line.url)) {
				var eb = document.createElement('a');
				eb.className =
					'modeButton shop-cart-open-ebay' + (line.checkoutUrl ? ' shop-cart-ebay-alt' : '');
				eb.href = line.url;
				eb.target = '_blank';
				eb.rel = 'noopener noreferrer';
				eb.textContent =
					line.checkoutUrl || line.dynamicStripe ? 'View on eBay' : 'Buy on eBay';
				actions.appendChild(eb);
			}
			var rm = document.createElement('button');
			rm.type = 'button';
			rm.className = 'modeButton shop-cart-remove';
			rm.textContent = 'Remove';
			rm.addEventListener('click', function () {
				removeFromCart(line.id);
			});
			actions.appendChild(rm);
			row.appendChild(actions);
			cartListEl.appendChild(row);
		});
	}

	function openCartDialog() {
		renderCartDialog();
		if (cartDialog && typeof cartDialog.showModal === 'function') cartDialog.showModal();
	}

	function buildIgCarousel(wrap, images, title) {
		var n = images.length;
		var idx = 0;
		var stage = document.createElement('div');
		stage.className = 'shop-ig-stage';
		var img = document.createElement('img');
		img.className = 'shop-ig-img';
		img.alt = title || '';
		img.loading = 'lazy';
		function show(i) {
			idx = (i + n) % n;
			img.src = images[idx];
		}
		show(0);
		stage.appendChild(img);
		if (n > 1) {
			var prev = document.createElement('button');
			prev.type = 'button';
			prev.className = 'shop-ig-nav shop-ig-prev';
			prev.setAttribute('aria-label', 'Previous photo');
			prev.textContent = '‹';
			var next = document.createElement('button');
			next.type = 'button';
			next.className = 'shop-ig-nav shop-ig-next';
			next.setAttribute('aria-label', 'Next photo');
			next.textContent = '›';
			prev.addEventListener('click', function () {
				show(idx - 1);
			});
			next.addEventListener('click', function () {
				show(idx + 1);
			});
			stage.appendChild(prev);
			stage.appendChild(next);
			var dots = document.createElement('div');
			dots.className = 'shop-ig-dots';
			for (var d = 0; d < n; d++) {
				(function (di) {
					var dot = document.createElement('button');
					dot.type = 'button';
					dot.className = 'shop-ig-dot';
					dot.setAttribute('aria-label', 'Photo ' + (di + 1));
					dot.addEventListener('click', function () {
						show(di);
					});
					dots.appendChild(dot);
				})(d);
			}
			wrap.appendChild(stage);
			wrap.appendChild(dots);
		} else {
			wrap.appendChild(stage);
		}
		return wrap;
	}

	function openDetailModal(item) {
		if (!detailDialog || !detailTitle || !detailBody || !detailGallery) return;
		detailTitle.textContent = item.title || 'Listing';
		while (detailGallery.firstChild) detailGallery.removeChild(detailGallery.firstChild);
		var imgs = normalizeEbayImages(item);
		var carouselHost = document.createElement('div');
		carouselHost.className = 'shop-ig-wrap shop-ig-wrap--modal';
		var modalAlt =
			item.shopImageAlt && String(item.shopImageAlt).trim() !== ''
				? String(item.shopImageAlt).trim()
				: item.title || '';
		buildIgCarousel(carouselHost, imgs, modalAlt);
		detailGallery.appendChild(carouselHost);

		var direct = getBuyOnSiteUrl(item);
		var stripeBtn =
			item.dynamicStripeCheckout &&
			item.shopProductId &&
			resolveStripeCheckoutEndpoint();
		var ebay = getEbayUrl(item);

		while (detailBody.firstChild) detailBody.removeChild(detailBody.firstChild);
		var priceP = document.createElement('p');
		priceP.className = 'ebay-detail-price';
		if (item.price) {
			priceP.textContent =
				direct || stripeBtn ? 'Price: ' + item.price : 'Price (eBay): ' + item.price;
		} else {
			priceP.textContent =
				direct || stripeBtn ? 'See checkout for price.' : 'See eBay for price.';
		}
		detailBody.appendChild(priceP);
		var shipP = document.createElement('p');
		shipP.className = 'ebay-detail-ship';
		if (direct || stripeBtn) {
			shipP.textContent = stripeBtn
				? 'Stripe checkout collects name, phone, and U.S. shipping address. Totals are confirmed before you pay.'
				: ebay
					? 'Prefer buying direct when checkout is available — marketplace fees on eBay add up. Shipping may differ between checkout and eBay.'
					: 'Shipping and totals are shown on the direct checkout page.';
		} else {
			shipP.textContent =
				'Shipping (eBay): ' + (item.shipping || 'See listing') + ' · U.S. only';
		}
		detailBody.appendChild(shipP);
		if (item.condition) {
			var c = document.createElement('p');
			c.textContent = 'Condition: ' + item.condition;
			detailBody.appendChild(c);
		}
		if (item.shopSummary && String(item.shopSummary).trim() !== '') {
			var sumP = document.createElement('p');
			sumP.className = 'ebay-detail-desc';
			sumP.textContent = String(item.shopSummary).trim();
			detailBody.appendChild(sumP);
		}
		if (Array.isArray(item.detailNotes) && item.detailNotes.length) {
			var ul = document.createElement('ul');
			ul.className = 'ebay-detail-desc ebay-detail-notes';
			item.detailNotes.forEach(function (note) {
				var li = document.createElement('li');
				li.textContent = note;
				ul.appendChild(li);
			});
			detailBody.appendChild(ul);
		}
		if (item.description) {
			var desc = document.createElement('div');
			desc.className = 'ebay-detail-desc';
			desc.textContent = String(item.description);
			detailBody.appendChild(desc);
		} else if (!item.__shopSource) {
			var hint = document.createElement('p');
			hint.className = 'garage-sale-ebay-spread-note';
			hint.textContent = direct
				? 'Details may also appear on the eBay listing when linked. Complete payment on checkout or eBay — whichever you choose.'
				: 'Full item specifics, returns, and exact shipping options are on the eBay listing. Purchases complete on eBay.';
			detailBody.appendChild(hint);
		} else if (
			(!item.shopSummary || String(item.shopSummary).trim() === '') &&
			!(Array.isArray(item.detailNotes) && item.detailNotes.length)
		) {
			var hintShop = document.createElement('p');
			hintShop.className = 'garage-sale-ebay-spread-note';
			hintShop.textContent =
				direct || stripeBtn
					? 'Totals and shipping details are confirmed at checkout.'
					: 'Checkout for this drop is not live yet.';
			detailBody.appendChild(hintShop);
		}

		var actionsHost = detailDialog.querySelector('.photo-dialog-actions');
		if (actionsHost) {
			while (actionsHost.firstChild) actionsHost.removeChild(actionsHost.firstChild);
			if (direct) {
				var aChk = document.createElement('a');
				aChk.id = 'ebay-detail-buy';
				aChk.className = 'modeButton photography-action-btn garage-sale-direct-checkout';
				aChk.href = direct;
				aChk.target = '_blank';
				aChk.rel = 'noopener noreferrer';
				aChk.textContent = 'Checkout (direct)';
				actionsHost.appendChild(aChk);
				var altD =
					item.alternateCheckoutUrl != null ? String(item.alternateCheckoutUrl).trim() : '';
				if (/^https?:\/\//i.test(altD) && altD !== direct) {
					var aAlt = document.createElement('a');
					aAlt.className =
						'modeButton photography-action-btn garage-sale-direct-checkout garage-sale-direct-checkout--alt';
					aAlt.href = altD;
					aAlt.target = '_blank';
					aAlt.rel = 'noopener noreferrer';
					aAlt.textContent = 'Pay with card';
					actionsHost.appendChild(aAlt);
				}
			}
			if (stripeBtn) {
				var stBtn = document.createElement('button');
				stBtn.type = 'button';
				if (!direct) stBtn.id = 'ebay-detail-buy';
				stBtn.className = 'modeButton photography-action-btn garage-sale-direct-checkout';
				stBtn.textContent = 'Checkout';
				stBtn.addEventListener('click', function () {
					startStripeSession([{ id: item.shopProductId, quantity: 1 }]);
				});
				actionsHost.appendChild(stBtn);
			}
			if (ebay) {
				var aEb = document.createElement('a');
				if (!direct && !stripeBtn) aEb.id = 'ebay-detail-buy';
				aEb.className =
					'modeButton photography-action-btn' +
					(direct || stripeBtn ? ' garage-sale-ebay-secondary-cta' : '');
				aEb.href = ebay;
				aEb.target = '_blank';
				aEb.rel = 'noopener noreferrer';
				aEb.textContent =
					direct || stripeBtn ? 'Also on eBay' : 'Open listing on eBay';
				actionsHost.appendChild(aEb);
			}
		}
		if (typeof detailDialog.showModal === 'function') detailDialog.showModal();
	}

	function renderEbayInstaCard(item) {
		var card = document.createElement('article');
		card.className = 'garage-sale-card garage-sale-ebay-card shop-ebay-sale-card';
		if (item && item.__shopSource) card.classList.add('garage-sale-card--shop-drop');

		var imgs = normalizeEbayImages(item);
		var ig = document.createElement('div');
		ig.className = 'shop-ig-wrap';
		var carouselAlt =
			item.shopImageAlt && String(item.shopImageAlt).trim() !== ''
				? String(item.shopImageAlt).trim()
				: item.title || '';
		buildIgCarousel(ig, imgs, carouselAlt);
		card.appendChild(ig);

		var h = document.createElement('h3');
		h.className = 'garage-sale-ebay-title';
		h.textContent = item.title || 'Untitled listing';
		card.appendChild(h);

		if (item.shopEyebrow && String(item.shopEyebrow).trim() !== '') {
			var eyeb = document.createElement('p');
			eyeb.className = 'garage-sale-ebay-spread-note';
			eyeb.textContent = String(item.shopEyebrow).trim();
			card.appendChild(eyeb);
		}

		var direct = getBuyOnSiteUrl(item);
		var stripeBtn =
			item.dynamicStripeCheckout &&
			item.shopProductId &&
			resolveStripeCheckoutEndpoint();

		if (item.price) {
			var priceEl = document.createElement('p');
			priceEl.className = 'garage-sale-ebay-price';
			priceEl.textContent =
				direct || stripeBtn ? 'Price: ' + item.price : 'Price (eBay): ' + item.price;
			card.appendChild(priceEl);
		} else {
			var np = document.createElement('p');
			np.className = 'garage-sale-ebay-spread-note';
			np.textContent =
				direct || stripeBtn ? 'Price — see checkout.' : 'Price — open eBay listing.';
			card.appendChild(np);
		}

		if (item.publishedAt) {
			var dateP = document.createElement('p');
			dateP.className = 'garage-sale-ebay-date';
			var d = new Date(String(item.publishedAt));
			dateP.textContent = isNaN(d.getTime())
				? ''
				: 'Listed: ' +
					d.toLocaleDateString(undefined, {
						year: 'numeric',
						month: 'short',
						day: 'numeric',
					});
			if (dateP.textContent) card.appendChild(dateP);
		}

		var cta = document.createElement('div');
		cta.className = 'garage-sale-ebay-ctas shop-ebay-cta-stack';
		var ebay = getEbayUrl(item);
		var canBuy = ebay && /\/itm\//i.test(ebay);

		var addBtn = document.createElement('button');
		addBtn.type = 'button';
		addBtn.className = 'modeButton shop-ebay-add-cart';
		addBtn.textContent = 'Add to cart';
		addBtn.disabled =
			!stableCartId(item) || (!direct && !stripeBtn && !canBuy);
		addBtn.addEventListener('click', function () {
			addToCart(item);
		});

		if (direct || stripeBtn) {
			var primaryRowDir = document.createElement('div');
			primaryRowDir.className = 'shop-ebay-cta-primary-row';
			if (direct) {
				var chk = document.createElement('a');
				chk.className = 'modeButton garage-sale-direct-checkout';
				chk.href = direct;
				chk.target = '_blank';
				chk.rel = 'noopener noreferrer';
				chk.textContent = 'Checkout';
				primaryRowDir.appendChild(chk);
				var altDirect =
					item.alternateCheckoutUrl != null ? String(item.alternateCheckoutUrl).trim() : '';
				if (/^https?:\/\//i.test(altDirect) && altDirect !== direct) {
					var altChk = document.createElement('a');
					altChk.className =
						'modeButton garage-sale-direct-checkout garage-sale-direct-checkout--alt';
					altChk.href = altDirect;
					altChk.target = '_blank';
					altChk.rel = 'noopener noreferrer';
					altChk.textContent = 'Pay with card';
					primaryRowDir.appendChild(altChk);
				}
			}
			if (stripeBtn) {
				var stChk = document.createElement('button');
				stChk.type = 'button';
				stChk.className = 'modeButton garage-sale-direct-checkout';
				stChk.textContent = 'Checkout';
				stChk.addEventListener('click', function () {
					startStripeSession([{ id: item.shopProductId, quantity: 1 }]);
				});
				primaryRowDir.appendChild(stChk);
			}
			if (canBuy) {
				var ebaySecond = document.createElement('a');
				ebaySecond.className = 'modeButton garage-sale-ebay-secondary-cta';
				ebaySecond.href = ebay;
				ebaySecond.target = '_blank';
				ebaySecond.rel = 'noopener noreferrer';
				ebaySecond.textContent = 'On eBay';
				primaryRowDir.appendChild(ebaySecond);
			}
			cta.appendChild(primaryRowDir);
			var addRow = document.createElement('div');
			addRow.className = 'shop-ebay-cta-add-row';
			addRow.appendChild(addBtn);
			cta.appendChild(addRow);
		} else {
			var primaryRow = document.createElement('div');
			primaryRow.className = 'shop-ebay-cta-primary-row';
			primaryRow.appendChild(addBtn);
			if (canBuy) {
				var buyBtn = document.createElement('a');
				buyBtn.className = 'modeButton garage-sale-ebay-buy';
				buyBtn.href = ebay;
				buyBtn.target = '_blank';
				buyBtn.rel = 'noopener noreferrer';
				buyBtn.textContent = 'Buy now';
				primaryRow.appendChild(buyBtn);
			}
			cta.appendChild(primaryRow);
		}

		var moreBtn = document.createElement('button');
		moreBtn.type = 'button';
		moreBtn.className = 'modeButton garage-sale-card-link garage-sale-ebay-cta--secondary';
		moreBtn.textContent = 'More details';
		moreBtn.addEventListener('click', function () {
			openDetailModal(item);
		});
		cta.appendChild(moreBtn);

		if (!canBuy && ebay) {
			var storeA = document.createElement('a');
			storeA.className = 'modeButton garage-sale-card-link';
			storeA.href = ebay;
			storeA.target = '_blank';
			storeA.rel = 'noopener noreferrer';
			storeA.textContent = 'View seller listings';
			cta.appendChild(storeA);
		}

		card.appendChild(cta);
		return card;
	}

	function renderHoldCard(item) {
		var card = document.createElement('article');
		card.className = 'garage-sale-card garage-sale-ebay-card shop-hold-card';

		var badge = document.createElement('p');
		badge.className = 'shop-hold-badge';
		var availLower = String((item && item.shopAvailabilityText) || '').toLowerCase();
		badge.textContent =
			availLower === 'sold out' ? 'Sold out here' : 'On hold — not sold here yet';
		card.appendChild(badge);

		var galleryImages = Array.isArray(item.images) ? item.images.slice() : [];
		var primaryImage = item.image ? String(item.image).trim() : '';
		if (primaryImage && galleryImages.indexOf(primaryImage) === -1) {
			galleryImages = [primaryImage].concat(galleryImages);
		}
		if (galleryImages.length) {
			var ig = document.createElement('div');
			ig.className = 'shop-ig-wrap shop-ig-wrap--dim';
			buildIgCarousel(
				ig,
				galleryImages.map(function (u) {
					return resolveProductUrl(String(u), productsUrl) || PLACEHOLDER_IMG;
				}),
				item.title
			);
			card.appendChild(ig);
		}

		var h = document.createElement('h3');
		h.className = 'garage-sale-ebay-title';
		h.textContent = item.title || 'Product';
		card.appendChild(h);

		if (item.shopEyebrow) {
			var eb = document.createElement('p');
			eb.className = 'garage-sale-ebay-spread-note';
			eb.textContent = item.shopEyebrow;
			card.appendChild(eb);
		}

		if (item.price) {
			var lp = document.createElement('p');
			lp.className = 'garage-sale-ebay-price';
			lp.textContent = 'Planned price: ' + item.price;
			card.appendChild(lp);
		}

		if (item.shopSummary) {
			var sum = document.createElement('p');
			sum.className = 'garage-sale-ebay-spread-note';
			sum.textContent = item.shopSummary;
			card.appendChild(sum);
		}

		var pend = document.createElement('p');
		pend.className = 'garage-sale-ebay-spread-note';
		pend.textContent = item.shopAvailabilityText || 'Coming soon';
		card.appendChild(pend);

		var row = document.createElement('div');
		row.className = 'garage-sale-ebay-ctas';
		var secUrl = item.secondaryCtaUrl != null ? String(item.secondaryCtaUrl).trim() : '';
		var secLabel = item.secondaryCtaLabel != null ? String(item.secondaryCtaLabel).trim() : '';
		if (secUrl && secLabel) {
			var sec = document.createElement('a');
			sec.className = 'modeButton garage-sale-card-link';
			sec.href = secUrl;
			if (/^https?:\/\//i.test(secUrl)) {
				sec.target = '_blank';
				sec.rel = 'noopener noreferrer';
			}
			sec.textContent = secLabel;
			row.appendChild(sec);
		}
		card.appendChild(row);
		return card;
	}

	function renderDigitalCards(container, items) {
		if (!container) return;
		while (container.firstChild) container.removeChild(container.firstChild);
		if (!items || !items.length) return;
		var frag = document.createDocumentFragment();
		items.forEach(function (item) {
			frag.appendChild(renderEbayInstaCard(item));
		});
		container.appendChild(frag);
	}

	function applySortAndRender() {
		if (sortSelect) {
			currentSort = sortSelect.value || 'order';
		}
		if (rootEbay) {
			while (rootEbay.firstChild) rootEbay.removeChild(rootEbay.firstChild);
			var sorted = sortEbayList(dataEbay);
			var sortedLiveShop = sortEbayList(dataShopLive);
			var frag = document.createDocumentFragment();
			sortedLiveShop.forEach(function (item) {
				frag.appendChild(renderEbayInstaCard(item));
			});
			sorted.forEach(function (item) {
				frag.appendChild(renderEbayInstaCard(item));
			});
			if (!frag.childNodes.length) {
				var empty = document.createElement('p');
				empty.className = 'garage-sale-empty';
				empty.innerHTML =
					'No live shop drops or eBay listings. Add PayPal/Stripe links in <code>Garage Sale/shop-products.json</code> or sync <code>Garage Sale/ebay-listings.json</code>.';
				rootEbay.appendChild(empty);
			} else {
				rootEbay.appendChild(frag);
			}
		}
		if (rootHold) {
			while (rootHold.firstChild) rootHold.removeChild(rootHold.firstChild);
			if (!dataShopHold.length) {
				var e2 = document.createElement('p');
				e2.className = 'garage-sale-empty';
				e2.textContent = 'No upcoming direct-drop previews in shop-products.json.';
				rootHold.appendChild(e2);
			} else {
				var f2 = document.createDocumentFragment();
				dataShopHold.forEach(function (item) {
					f2.appendChild(renderHoldCard(item));
				});
				rootHold.appendChild(f2);
			}
		}
		renderDigitalCards(rootDigital, sortEbayList(dataDigital));
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

	if (cartFab) {
		cartFab.addEventListener('click', openCartDialog);
	}
	if (cartDialogClose && cartDialog) {
		cartDialogClose.addEventListener('click', function () {
			cartDialog.close();
		});
	}
	if (detailClose && detailDialog) {
		detailClose.addEventListener('click', function () {
			detailDialog.close();
		});
	}

	updateCartUi();

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

		if (!ebayData) {
			showNodeError(
				ebayErr,
				'Could not load eBay items. Check that ebay-listings.json is next to this page.'
			);
		}

		var ebaySource = (ebayData && ebayData.source) || {};

		var scriptStripeAttr = script && script.getAttribute('data-shop-stripe-checkout');
		if (shopData && shopData.payment && shopData.payment.checkoutApi) {
			var stripeEp = shopData.payment.checkoutApi.stripeEndpoint;
			if (stripeEp && !scriptStripeAttr) {
				shopStripeEndpoint = String(stripeEp).trim();
			}
		}

		var shopRows = [];
		if (shopData && Array.isArray(shopData.products)) {
			shopRows = orderedShopProducts(shopData.products);
		}
		var shopLiveRows = [];
		var shopHoldRows = [];
		for (var si = 0; si < shopRows.length; si++) {
			var sr = shopRows[si];
			if (
				sr &&
				(sr.buyOnSiteUrl ||
					(sr.dynamicStripeCheckout && resolveStripeCheckoutEndpoint()))
			)
				shopLiveRows.push(sr);
			else shopHoldRows.push(sr);
		}
		dataShopLive = assignFileOrder(shopLiveRows);
		dataShopHold = assignFileOrder(shopHoldRows);

		var all = (ebayData && ebayData.items) || [];
		var ebayGarage = [];
		dataDigital = [];
		all.forEach(function (item) {
			var s = inferSection(item);
			var enriched = enrichEbayListingRow(item, ebaySource);
			if (s === 'digital' || s === 'digital-assets') {
				dataDigital.push(enriched);
			} else {
				ebayGarage.push(enriched);
			}
		});
		dataEbay = assignFileOrder(ebayGarage);
		dataDigital = assignFileOrder(dataDigital);

		if (dataEbay.length + dataShopLive.length + dataShopHold.length + dataDigital.length > 0) {
			initSortControls();
		}
		applySortAndRender();
	});
})();
