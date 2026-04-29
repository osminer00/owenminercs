(function () {
	'use strict';

	var roots = Array.prototype.slice.call(document.querySelectorAll('[data-shop-section]'));
	var errEl = document.getElementById('shop-products-error');
	var noteEl = document.getElementById('shop-products-payment-note');
	if (!roots.length) return;

	var script = document.currentScript;
	var productsRel = (script && script.getAttribute('data-shop-products')) || 'shop-products.json';
	var productsUrl = new URL(productsRel, window.location.href).href;

	function showError(msg) {
		if (!errEl) return;
		errEl.hidden = false;
		errEl.textContent = msg;
	}

	function resolveUrl(url) {
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
		return new URL(trimmed, productsUrl).href;
	}

	function providerLabel(item) {
		var provider = String((item && item.paymentProvider) || '').toLowerCase();
		if (provider === 'stripe') return 'Stripe';
		if (provider === 'paypal') return 'PayPal';
		return 'Secure';
	}

	function statusText(item) {
		if (item && item.availabilityLabel) return String(item.availabilityLabel);
		var status = String((item && item.status) || '').toLowerCase();
		if (status === 'available') return 'Available';
		if (status === 'tbd') return 'TBD';
		if (status === 'sold-out') return 'Sold out';
		return 'Coming soon';
	}

	function isAvailable(item) {
		return (
			item &&
			String(item.status || '').toLowerCase() === 'available' &&
			resolveUrl(item.checkoutUrl || item.buyOnSiteUrl || item.paypalUrl || item.stripeUrl)
		);
	}

	function trackCheckout(item) {
		if (typeof window.gtag !== 'function') return;
		window.gtag('event', 'shop_checkout_click', {
			product_id: item.id || '',
			product_name: item.title || '',
			payment_provider: providerLabel(item),
		});
	}

	function appendDetails(card, details) {
		if (!Array.isArray(details) || !details.length) return;
		var list = document.createElement('ul');
		list.className = 'shop-product-card__details';
		details.forEach(function (detail) {
			if (!detail) return;
			var li = document.createElement('li');
			li.textContent = String(detail);
			list.appendChild(li);
		});
		if (list.hasChildNodes()) card.appendChild(list);
	}

	function appendActions(card, item) {
		var actions = document.createElement('div');
		actions.className = 'shop-product-card__actions';

		var checkoutUrl = resolveUrl(
			item.checkoutUrl || item.buyOnSiteUrl || item.paypalUrl || item.stripeUrl
		);

		if (isAvailable(item)) {
			var buy = document.createElement('a');
			buy.className = 'modeButton shop-product-card__button';
			buy.href = checkoutUrl;
			buy.target = '_blank';
			buy.rel = 'noopener noreferrer';
			buy.textContent = 'Buy with ' + providerLabel(item);
			buy.addEventListener('click', function () {
				trackCheckout(item);
			});
			actions.appendChild(buy);
		} else {
			var pending = document.createElement('span');
			pending.className =
				'modeButton shop-product-card__button shop-product-card__button--disabled';
			pending.setAttribute('aria-disabled', 'true');
			pending.textContent = statusText(item);
			actions.appendChild(pending);
		}

		var secondaryUrl = resolveUrl(item.secondaryUrl);
		if (secondaryUrl && item.secondaryLabel) {
			var secondary = document.createElement('a');
			secondary.className = 'shop-product-card__secondary';
			secondary.href = secondaryUrl;
			if (/^https?:\/\//i.test(secondaryUrl)) {
				secondary.target = '_blank';
				secondary.rel = 'noopener noreferrer';
			}
			secondary.textContent = String(item.secondaryLabel);
			actions.appendChild(secondary);
		}

		card.appendChild(actions);
	}

	function renderProduct(item) {
		var card = document.createElement('article');
		card.className = 'shop-product-card shop-product-card--' + (item.status || 'coming-soon');

		var media = document.createElement('div');
		media.className = 'shop-product-card__media';
		var image = resolveUrl(item.image);
		if (image) {
			var img = document.createElement('img');
			img.src = image;
			img.alt = item.imageAlt || item.title || 'Shop product image';
			img.loading = 'lazy';
			media.appendChild(img);
		} else {
			var placeholder = document.createElement('span');
			placeholder.className = 'shop-product-card__placeholder';
			placeholder.textContent = item.eyebrow || item.title || 'Shop';
			media.appendChild(placeholder);
		}
		card.appendChild(media);

		var body = document.createElement('div');
		body.className = 'shop-product-card__body';

		var top = document.createElement('div');
		top.className = 'shop-product-card__topline';

		var eyebrow = document.createElement('span');
		eyebrow.className = 'shop-product-card__eyebrow';
		eyebrow.textContent = item.eyebrow || statusText(item);
		top.appendChild(eyebrow);

		var status = document.createElement('span');
		status.className = 'shop-product-card__status';
		status.textContent = statusText(item);
		top.appendChild(status);

		body.appendChild(top);

		var title = document.createElement('h3');
		title.className = 'shop-product-card__title';
		title.textContent = item.title || 'Untitled product';
		body.appendChild(title);

		var meta = document.createElement('p');
		meta.className = 'shop-product-card__meta';
		meta.textContent = item.price || 'Price TBD';
		body.appendChild(meta);

		if (item.summary) {
			var summary = document.createElement('p');
			summary.className = 'shop-product-card__summary';
			summary.textContent = item.summary;
			body.appendChild(summary);
		}

		appendDetails(body, item.details);
		appendActions(body, item);
		card.appendChild(body);
		return card;
	}

	function renderSection(root, products) {
		while (root.firstChild) root.removeChild(root.firstChild);

		if (!products.length) {
			var empty = document.createElement('p');
			empty.className = 'shop-products-empty';
			empty.textContent = 'No products in this section yet.';
			root.appendChild(empty);
			return;
		}

		var frag = document.createDocumentFragment();
		products.forEach(function (item) {
			frag.appendChild(renderProduct(item));
		});
		root.appendChild(frag);
	}

	fetch(productsUrl)
		.then(function (response) {
			if (!response.ok) throw new Error('Could not load ' + productsRel);
			return response.json();
		})
		.then(function (data) {
			if (noteEl && data.payment && data.payment.publicNote) {
				noteEl.hidden = false;
				noteEl.textContent = data.payment.publicNote;
			}

			var products = Array.isArray(data.products) ? data.products : [];
			roots.forEach(function (root) {
				var section = String(root.getAttribute('data-shop-section') || '').toLowerCase();
				renderSection(
					root,
					products.filter(function (item) {
						return String((item && item.section) || '').toLowerCase() === section;
					})
				);
			});
		})
		.catch(function () {
			showError('Could not load shop products. Check Garage Sale/shop-products.json.');
		});
})();
