/**
 * Affiliate Links Manager
 * Manages all affiliate links for OwenMinerCS.com
 *
 * Usage:
 *   - Add to <head>: <script src="../scripts/affiliate-links.js"></script>
 *   - In HTML: <div data-affiliate-product="pc_components.rog_swift_monitor"></div>
 *   - Manual: affiliateManager.generateLinkButtons('pc_components.rog_swift_monitor')
 */

class AffiliateLinksManager {
	constructor(jsonPath = '/affiliate-links.json') {
		this.jsonPath = jsonPath;
		this.products = {};
		this.loaded = false;
		this.init();
	}

	/**
	 * Initialize manager and load affiliate data
	 */
	async init() {
		try {
			const response = await fetch(this.jsonPath);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const data = await response.json();
			this.products = data.products;
			this.metadata = data.metadata || {};
			this.disclosure = data.disclosure || {};
			this.loaded = true;

			console.log('✓ Affiliate links loaded successfully', this.metadata);

			// Retailer shortcut buttons were removed site-wide; strip legacy placeholders only.
			this.removeAffiliateButtonPlaceholders();
		} catch (error) {
			console.warn(
				'⚠ Could not load affiliate links - serving without affiliate URLs:',
				error.message
			);
			this.loaded = false;
		}
	}

	/**
	 * Remove empty data-affiliate-product placeholders (legacy AI retailer buttons).
	 */
	removeAffiliateButtonPlaceholders() {
		document.querySelectorAll('[data-affiliate-product]').forEach((container) => {
			const hub = container.closest('.affiliate-keyboard-hub');
			if (hub) {
				hub.remove();
				return;
			}
			container.remove();
		});
	}

	/**
	 * Fetch live prices from the Amazon PA API Netlify function.
	 * Only runs for products that have an `asin` field.
	 * Silently falls back to static JSON prices on any error.
	 */
	async fetchLivePrices() {
		const asinToKey = {};
		for (const [category, products] of Object.entries(this.products)) {
			for (const [key, product] of Object.entries(products)) {
				if (product.asin) {
					asinToKey[product.asin.toUpperCase()] = `${category}.${key}`;
				}
			}
		}

		const asins = Object.keys(asinToKey);
		if (!asins.length) return;

		try {
			const res = await fetch(`/.netlify/functions/amazon-price?asins=${asins.join(',')}`);
			if (!res.ok) return;
			const data = await res.json();

			if (!data.prices || !Object.keys(data.prices).length) return;

			let updated = false;
			for (const [asin, livePrice] of Object.entries(data.prices)) {
				const key = asinToKey[asin.toUpperCase()];
				if (!key) continue;
				const product = this.getProduct(key);
				if (product) {
					product.current_price = livePrice;
					product._price_live = true;
					updated = true;
				}
			}

			if (updated) {
				this.refreshPriceDisplays();
			}
		} catch (e) {
			// Silent fail — static prices already shown
		}
	}

	/**
	 * Refresh all price displays on the page after live prices are fetched.
	 */
	refreshPriceDisplays() {
		this.removeAffiliateButtonPlaceholders();
	}

	/**
	 * Return normalized price fields with backwards compatibility.
	 * - current: live/current listing price
	 * - paid: what you paid
	 * Legacy `price` is treated as the fallback display price unless current_price is also set.
	 */
	getPriceModel(product) {
		if (!product || typeof product !== 'object') {
			return { current: '', paid: '' };
		}

		const current = String(product.current_price || '').trim();
		const paidExplicit = String(product.paid_price || '').trim();
		const legacy = String(product.price || '').trim();

		if (current) {
			return {
				current,
				paid: paidExplicit || legacy,
			};
		}

		if (paidExplicit) {
			return {
				current: '',
				paid: paidExplicit,
			};
		}

		return {
			current: '',
			paid: legacy,
		};
	}

	/**
	 * Build consistent display text for inline page price spans.
	 */
	buildInlinePriceText(product) {
		const prices = this.getPriceModel(product);
		if (prices.current) return `| Now ${prices.current}`;
		if (prices.paid) return `| ${prices.paid}`;
		return '';
	}

	/**
	 * Replace hardcoded `b_w_link` text next to a product with data from JSON.
	 */
	syncAdjacentPriceLabel(container, product) {
		if (!container || !product) return;
		let node = container.previousElementSibling;
		while (node) {
			if (typeof node.querySelector === 'function') {
				const span = node.querySelector('.b_w_link');
				if (span) {
					const text = this.buildInlinePriceText(product);
					if (text) span.textContent = ` ${text}`;
					return;
				}
			}
			node = node.previousElementSibling;
		}
	}

	/**
	 * Find a nearby hardcoded price row that the compact affiliate buttons can share.
	 */
	findAdjacentPriceHost(container) {
		if (!container) return null;

		let node = container.previousElementSibling;
		while (node) {
			if (typeof node.querySelector === 'function' && node.querySelector('.b_w_link')) {
				return node;
			}
			node = node.previousElementSibling;
		}

		return null;
	}

	/**
	 * Move compact affiliate buttons onto the same visual row as an existing price.
	 */
	alignCompactButtonsWithPrice(container) {
		if (!container || !container.hasAttribute('data-affiliate-compact')) return;

		const host = this.findAdjacentPriceHost(container);
		const group = container.querySelector('.product-links-group');
		if (!host || !group) return;

		const row = host.classList.contains('affiliate-price-row')
			? host
			: document.createElement('div');
		if (!host.classList.contains('affiliate-price-row')) {
			host.parentNode.insertBefore(row, host);
			row.className = 'affiliate-price-row';
			host.classList.add('affiliate-price-host');
			row.appendChild(host);
		}

		row.querySelectorAll('.affiliate-price-actions').forEach((existing) => existing.remove());
		if (group.querySelector('.affiliate-button')) {
			group.classList.add('affiliate-price-actions');
			row.appendChild(group);
		}
		container.innerHTML = '';
	}

	/**
	 * Get product by dot-notation key
	 * Example: 'pc_components.rog_swift_monitor'
	 */
	getProduct(productKey) {
		if (!productKey) return null;

		const parts = productKey.split('.');
		let current = this.products;

		for (let part of parts) {
			if (current && typeof current === 'object') {
				current = current[part];
			} else {
				return null;
			}
		}

		return current || null;
	}

	/**
	 * Clone product links so derived search/direct URLs can be layered on top safely.
	 */
	normalizeProductLinks(links) {
		if (!links || typeof links !== 'object') return links;
		const out = { ...links };
		return out;
	}

	escapeHtml(value) {
		return String(value || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	getSearchTerms(product, retailer) {
		if (!product || typeof product !== 'object') return '';
		return String(product.name || '').trim();
	}

	encodeSearchTerms(terms) {
		return encodeURIComponent(String(terms || '').trim()).replace(/%20/g, '+');
	}

	buildAmazonSearchUrl(product, links = {}) {
		if (
			links.disable_marketplaces === true ||
			links.disable_amazon === true ||
			links.amazon_search === false ||
			links.amazon === false
		) {
			return '';
		}

		const explicit = typeof links.amazon_search === 'string' ? links.amazon_search.trim() : '';
		if (explicit) return this.safeHttpUrl(explicit);

		const terms = this.getSearchTerms(product, 'amazon');
		if (!terms) return '';
		return `https://www.amazon.com/s?k=${this.encodeSearchTerms(terms)}&tag=owenminercs-20`;
	}

	buildAliExpressSearchUrl(product, links = {}) {
		if (
			links.disable_marketplaces === true ||
			links.disable_aliexpress === true ||
			links.aliexpress_search === false ||
			links.aliexpress === false
		) {
			return '';
		}

		const explicit =
			typeof links.aliexpress_search === 'string' ? links.aliexpress_search.trim() : '';
		if (explicit) return this.safeHttpUrl(explicit);

		const terms = this.getSearchTerms(product, 'aliexpress');
		if (!terms) return '';
		return `https://www.aliexpress.com/wholesale?SearchText=${this.encodeSearchTerms(terms)}`;
	}

	isSafeHttpUrl(url) {
		const value = String(url || '').trim();
		if (!value) return false;
		try {
			const parsed = new URL(value, window.location.origin);
			return parsed.protocol === 'https:' || parsed.protocol === 'http:';
		} catch (_) {
			return false;
		}
	}

	safeHttpUrl(url) {
		const value = String(url || '').trim();
		return this.isSafeHttpUrl(value) ? value : '';
	}

	isAmazonDirectUrl(url) {
		const value = String(url || '').trim();
		return /amazon\.com\/(?:gp\/product|dp|[^/?#]+\/dp)\//i.test(value);
	}

	isAliExpressDirectUrl(url) {
		const value = String(url || '').trim();
		return /aliexpress\.[^/]+\/item\//i.test(value);
	}

	buildAmazonDirectUrl(product, links = {}) {
		const explicit = String(links.amazon_direct || '').trim();
		if (explicit) return this.safeHttpUrl(explicit);

		const amazon = String(links.amazon || '').trim();
		if (this.isAmazonDirectUrl(amazon)) return this.safeHttpUrl(amazon);

		const asin = String(product?.asin || '').trim();
		if (!asin) return '';
		return `https://www.amazon.com/dp/${encodeURIComponent(asin)}?tag=owenminercs-20`;
	}

	getDirectLink(product, links = {}) {
		const candidates = [
			links.direct,
			links.official,
			links.amazon_direct,
			this.buildAmazonDirectUrl(product, links),
			this.isAliExpressDirectUrl(links.aliexpress_portals) ? links.aliexpress_portals : '',
			this.isAliExpressDirectUrl(links.aliexpress) ? links.aliexpress : '',
		];

		for (const candidate of candidates) {
			const url = String(candidate || '').trim();
			if (url) {
				const safeUrl = this.safeHttpUrl(url);
				if (safeUrl) return safeUrl;
			}
		}
		return '';
	}

	getPrimaryProductUrl(product, links = {}) {
		return this.safeHttpUrl(
			this.getDirectLink(product, links) || this.buildAmazonSearchUrl(product, links)
		);
	}

	getButtonDefinitions(productKey, product) {
		const links = this.normalizeProductLinks(product?.links);
		if (!product || !links) return [];

		const buttons = [];
		const amazonSearchUrl = this.buildAmazonSearchUrl(product, links);
		const aliexpressSearchUrl = this.buildAliExpressSearchUrl(product, links);

		if (amazonSearchUrl) {
			buttons.push({
				retailer: 'amazon_search',
				label: 'Amazon',
				url: amazonSearchUrl,
				className: 'amazon amazon-search',
				title: `Search Amazon for ${product.name}`,
			});
		}

		if (aliexpressSearchUrl) {
			buttons.push({
				retailer: 'aliexpress_search',
				label: 'AliExpress',
				url: aliexpressSearchUrl,
				className: 'aliexpress aliexpress-search',
				title: `Search AliExpress for ${product.name}`,
			});
		}

		return buttons;
	}

	syncAdjacentPrimaryLink(container, product) {
		if (!container || !product) return;

		const links = this.normalizeProductLinks(product.links) || {};
		const primaryUrl = this.getPrimaryProductUrl(product, links);
		if (!primaryUrl) return;

		let node = container.previousElementSibling;
		while (node) {
			if (typeof node.querySelector === 'function') {
				const anchor = node.querySelector('a[href]');
				if (anchor) {
					anchor.href = primaryUrl;
					anchor.title = this.getDirectLink(product, links)
						? `${product.name} direct link`
						: `Search Amazon for ${product.name}`;
					anchor.target = '_blank';
					anchor.rel = 'noopener noreferrer';
					return;
				}
			}
			node = node.previousElementSibling;
		}
	}

	/**
	 * Badge next to retailer.
	 */
	retailerBadgeHtml(retailer, url) {
		if (retailer === 'official' || retailer === 'direct') {
			const directUrl = String(url || '');
			if (directUrl.includes('amazon.')) {
				return '<span class="affiliate">Affiliate</span>';
			}
			if (
				directUrl.includes('s.click.aliexpress.com') ||
				directUrl.includes('click.aliexpress.com')
			) {
				return '<span class="affiliate">Affiliate</span>';
			}
			if (this.isAliExpressDirectUrl(directUrl)) {
				return '<span class="affiliate-note" title="Direct AliExpress product page. Add your Portals deeplink in affiliate-links.json if you want this button to earn commission.">(AliExpress)</span>';
			}
			return '';
		}

		if (retailer === 'amazon' || retailer === 'amazon_search') {
			return '<span class="affiliate">Affiliate</span>';
		}

		if (retailer === 'aliexpress' || retailer === 'aliexpress_search') {
			return '<span class="affiliate">Affiliate</span>';
		}

		return '<span class="affiliate">Affiliate</span>';
	}

	/**
	 * Generate HTML for affiliate link buttons
	 */
	generateLinkButtons(productKey, options = {}) {
		const product = this.getProduct(productKey);
		if (!product || !product.links) return '';

		const { showLabel = true, showPrice = true, containerClass = '' } = options;
		let html = '';

		if (showLabel && product.name) {
			html += `<p class="product-name"><strong>${this.escapeHtml(product.name)}</strong></p>`;
		}

		if (showPrice) {
			const prices = this.getPriceModel(product);
			if (prices.current) {
				const liveTag = product._price_live
					? ' <span class="price-live-badge" title="Price fetched live from Amazon">live</span>'
					: '';
				html += `<p class="product-price">Now: <span class="price-highlight">${this.escapeHtml(prices.current)}</span>${liveTag}</p>`;
			} else if (prices.paid) {
				html += `<p class="product-price">Price: <span class="price-highlight">${this.escapeHtml(prices.paid)}</span></p>`;
			}
		}

		html += `<div class="product-links-group ${this.escapeHtml(containerClass)}">`;

		const buttons = this.getButtonDefinitions(productKey, product);
		for (const button of buttons) {
			if (!this.isSafeHttpUrl(button.url)) continue;
			const badge = this.retailerBadgeHtml(button.retailer, button.url);

			html += `
                <a href="${this.escapeHtml(button.url)}" 
                   class="affiliate-button ${button.className}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   data-product="${this.escapeHtml(productKey)}"
                   data-retailer="${this.escapeHtml(button.retailer)}"
                   title="${this.escapeHtml(button.title)}">
                    ${this.escapeHtml(button.label)}
                    ${badge}
                </a>
            `;
		}

		html += '</div>';
		return html;
	}

	/**
	 * Generate a complete product card
	 */
	generateProductCard(productKey, options = {}) {
		const product = this.getProduct(productKey);
		if (!product) return '';

		const { showSpecs = true, showDescription = false } = options;
		const links = this.normalizeProductLinks(product.links) || {};
		const primaryUrl = this.getPrimaryProductUrl(product, links);
		let html = `<div class="product-card" data-product="${this.escapeHtml(productKey)}">`;

		// Header
		if (primaryUrl) {
			html += `<h3><a href="${this.escapeHtml(primaryUrl)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(product.name)}</a></h3>`;
		} else {
			html += `<h3>${this.escapeHtml(product.name)}</h3>`;
		}

		// Specs
		if (showSpecs && product.specs) {
			html += `<p><strong>Specs:</strong> ${this.escapeHtml(product.specs)}</p>`;
		}

		// Description (if provided)
		if (showDescription && product.description) {
			html += `<p>${this.escapeHtml(product.description)}</p>`;
		}

		// Links
		html += this.generateLinkButtons(productKey, { showLabel: false, showPrice: false });

		html += '</div>';
		return html;
	}

	/**
	 * Format retailer names nicely
	 */
	formatRetailerName(retailer) {
		const names = {
			amazon: 'Amazon',
			amazon_search: 'Amazon',
			newegg: 'Newegg',
			bestbuy: 'Best Buy',
			microcenter: 'Micro Center',
			aliexpress: 'AliExpress',
			aliexpress_search: 'AliExpress',
			direct: 'Direct Link',
			official: 'Official Website',
		};
		return names[retailer] || retailer.charAt(0).toUpperCase() + retailer.slice(1);
	}

	/**
	 * Legacy hook — retailer shortcut buttons are no longer rendered.
	 */
	autoPopulate() {
		if (!this.loaded) return;
		this.removeAffiliateButtonPlaceholders();
	}

	wireTracking(root) {
		if (!root || typeof root.querySelectorAll !== 'function') return;
		root.querySelectorAll('.affiliate-button[data-product][data-retailer]').forEach((link) => {
			if (link.dataset.affiliateTrackingBound === '1') return;
			link.dataset.affiliateTrackingBound = '1';
			link.addEventListener('click', () => {
				this.trackClick(link.dataset.product || '', link.dataset.retailer || '');
			});
		});
	}

	/**
	 * Get all products for a specific page
	 */
	getProductsForPage(pagePath) {
		const featured = [];

		for (const [category, products] of Object.entries(this.products)) {
			for (const [key, product] of Object.entries(products)) {
				if (product.pages && product.pages.includes(pagePath)) {
					featured.push({
						key: `${category}.${key}`,
						...product,
					});
				}
			}
		}

		return featured;
	}

	/**
	 * Get disclosure text
	 */
	getDisclosure(language = 'en') {
		return this.disclosure[language] || this.disclosure.en || '';
	}

	/**
	 * Generate affiliate disclosure box
	 */
	generateDisclosureBox() {
		const text = this.getDisclosure();
		if (!text) return '';

		return `
            <p class="affiliate-disclosure" role="note">
                <span class="affiliate-disclosure__label">Disclosure:</span> ${text}
            </p>
        `;
	}

	/**
	 * Track affiliate link clicks for analytics
	 */
	trackClick(productKey, retailer) {
		// Google Analytics tracking
		if (typeof gtag !== 'undefined') {
			try {
				gtag('event', 'affiliate_click', {
					event_category: 'affiliate',
					event_label: retailer,
					product_key: productKey,
					timestamp: new Date().toISOString(),
				});
			} catch (e) {
				console.warn('GA tracking error:', e);
			}
		}

		// Console log for debugging
		console.log(`📊 Affiliate Link Clicked: ${productKey} → ${retailer}`);
	}

	/**
	 * Get all products in a category
	 */
	getCategory(categoryKey) {
		return this.products[categoryKey] || {};
	}

	/**
	 * Search products by name or specs
	 */
	searchProducts(query) {
		const results = [];
		const lowerQuery = query.toLowerCase();

		for (const [category, products] of Object.entries(this.products)) {
			for (const [key, product] of Object.entries(products)) {
				if (
					product.name.toLowerCase().includes(lowerQuery) ||
					(product.specs && product.specs.toLowerCase().includes(lowerQuery))
				) {
					results.push({
						key: `${category}.${key}`,
						...product,
					});
				}
			}
		}

		return results;
	}

	/**
	 * Get metadata about affiliate programs
	 */
	getMetadata() {
		return this.metadata;
	}

	/**
	 * Log statistics
	 */
	logStats() {
		const productCount = Object.values(this.products).reduce(
			(sum, cat) => sum + Object.keys(cat).length,
			0
		);
		const programCount = this.metadata.affiliate_programs?.length || 0;

		console.log(`
📱 Affiliate Links Manager Stats:
   • Total Products: ${productCount}
   • Affiliate Programs: ${programCount}
   • Loaded: ${this.loaded ? '✓' : '✗'}
   • Last Updated: ${this.metadata.last_updated || 'Unknown'}
        `);
	}
}

/**
 * Global tracking function
 */
function trackAffiliateClick(productKey, retailer) {
	if (window.affiliateManager) {
		window.affiliateManager.trackClick(productKey, retailer);
	}
}

/**
 * Initialize on page load
 */
let affiliateManager = null;

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', function () {
		affiliateManager = new AffiliateLinksManager('/affiliate-links.json');

		// Log to console for debugging
		if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
			setTimeout(() => affiliateManager.logStats(), 1000);
		}
	});
} else {
	// DOM already loaded
	affiliateManager = new AffiliateLinksManager('/affiliate-links.json');
}

/**
 * Convenience functions for HTML
 */

/**
 * Insert product card by ID
 */
function insertProductCard(productKey, elementId) {
	if (!affiliateManager || !affiliateManager.loaded) return;

	const element = document.getElementById(elementId);
	if (element) {
		element.innerHTML = affiliateManager.generateProductCard(productKey);
		affiliateManager.wireTracking(element);
	}
}

/**
 * Insert affiliate links by ID
 */
function insertAffiliateLinks(productKey, elementId) {
	if (!affiliateManager || !affiliateManager.loaded) return;

	const element = document.getElementById(elementId);
	if (element) {
		element.innerHTML = affiliateManager.generateLinkButtons(productKey);
		affiliateManager.wireTracking(element);
	}
}

/**
 * Insert disclosure box
 */
function insertDisclosureBox(elementId) {
	if (!affiliateManager || !affiliateManager.loaded) return;

	const element = document.getElementById(elementId);
	if (element) {
		element.innerHTML = affiliateManager.generateDisclosureBox();
	}
}
