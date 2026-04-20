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

            // Render with static prices first, then overlay live prices
            this.autoPopulate();
            this.fetchLivePrices();
        } catch (error) {
            console.warn('⚠ Could not load affiliate links - serving without affiliate URLs:', error.message);
            this.loaded = false;
        }
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
        const containers = document.querySelectorAll('[data-affiliate-product]');
        containers.forEach(container => {
            const productKey = container.getAttribute('data-affiliate-product');
            if (!productKey) return;
            const product = this.getProduct(productKey);
            const compact = container.hasAttribute('data-affiliate-compact');
            const hasAdjacentPrice = compact && !!this.findAdjacentPriceHost(container);
            const html = this.generateLinkButtons(productKey, {
                showLabel: !compact,
                showPrice: !hasAdjacentPrice
            });
            container.innerHTML = html;
            this.syncAdjacentPriceLabel(container, product);
            this.alignCompactButtonsWithPrice(container);
        });
        this.decorateStandaloneAmazonPriceLinks();
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
                paid: paidExplicit || legacy
            };
        }

        if (paidExplicit) {
            return {
                current: '',
                paid: paidExplicit
            };
        }

        return {
            current: '',
            paid: legacy
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
     * Keep Amazon price rows as one anchor: product text + styled Amazon label.
     */
    mergeAmazonButtonIntoHostLink(host, group) {
        if (!host || !group) return;

        let hostLink = host.matches && host.matches('a[href]')
            ? host
            : host.querySelector && host.querySelector('a[href]');
        const amazonButton = group.querySelector('.affiliate-button.amazon');
        if (!amazonButton) return;

        if (!hostLink) {
            hostLink = document.createElement('a');
            while (host.firstChild) {
                hostLink.appendChild(host.firstChild);
            }
            host.appendChild(hostLink);
        }

        hostLink.classList.add('affiliate-price-link');
        hostLink.href = amazonButton.href;
        hostLink.target = amazonButton.target || '_blank';
        hostLink.rel = amazonButton.rel || 'noopener noreferrer';
        hostLink.title = amazonButton.title || hostLink.title || 'Buy on Amazon';
        if (amazonButton.dataset.product) {
            hostLink.dataset.product = amazonButton.dataset.product;
        }
        if (amazonButton.dataset.retailer) {
            hostLink.dataset.retailer = amazonButton.dataset.retailer;
        }
        const tracking = amazonButton.getAttribute('onclick');
        if (tracking) {
            hostLink.setAttribute('onclick', tracking);
        }
        hostLink.querySelectorAll('.affiliate-inline-button').forEach(existing => existing.remove());

        const inlineButton = document.createElement('span');
        inlineButton.className = 'affiliate-inline-button amazon';
        inlineButton.innerHTML = 'Amazon <span class="affiliate">(affiliate)</span>';
        hostLink.appendChild(inlineButton);

        amazonButton.remove();
    }

    /**
     * Add the same inline Amazon label to static setup-card links that do not use a widget.
     */
    decorateStandaloneAmazonPriceLinks() {
        const selector = [
            '.keep-card__affiliate a[href*="amazon."]',
            '.item-title-row h4 a[href*="amazon."]',
            '.setup-detail-page h4 a[href*="amazon."]'
        ].join(',');

        document.querySelectorAll(selector).forEach(link => {
            if (!link.querySelector('.b_w_link')) return;
            if (link.querySelector('.affiliate-inline-button')) return;

            link.classList.add('affiliate-price-link');

            const inlineButton = document.createElement('span');
            inlineButton.className = 'affiliate-inline-button amazon';
            inlineButton.innerHTML = 'Amazon <span class="affiliate">(affiliate)</span>';
            link.appendChild(inlineButton);
        });
    }

    /**
     * Move compact affiliate buttons onto the same visual row as an existing price.
     */
    alignCompactButtonsWithPrice(container) {
        if (!container || !container.hasAttribute('data-affiliate-compact')) return;

        const host = this.findAdjacentPriceHost(container);
        const group = container.querySelector('.product-links-group');
        if (!host || !group) return;

        this.mergeAmazonButtonIntoHostLink(host, group);

        const row = host.classList.contains('affiliate-price-row') ? host : document.createElement('div');
        if (!host.classList.contains('affiliate-price-row')) {
            host.parentNode.insertBefore(row, host);
            row.className = 'affiliate-price-row';
            host.classList.add('affiliate-price-host');
            row.appendChild(host);
        }

        row.querySelectorAll('.affiliate-price-actions').forEach(existing => existing.remove());
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
     * Merge optional AliExpress Portals deeplink (links.aliexpress_portals) into links.aliexpress.
     */
    normalizeProductLinks(links) {
        if (!links || typeof links !== 'object') return links;
        const out = { ...links };
        const portal = out.aliexpress_portals;
        if (portal && String(portal).trim()) {
            out.aliexpress = String(portal).trim();
        }
        delete out.aliexpress_portals;
        return out;
    }

    /**
     * Badge next to retailer: Amazon etc. use (affiliate). AliExpress depends on URL type.
     */
    retailerBadgeHtml(retailer, url) {
        if (retailer === 'official') return '';
        if (retailer === 'aliexpress') {
            const u = url || '';
            if (u.includes('s.click.aliexpress.com') || u.includes('click.aliexpress.com')) {
                return '<span class="affiliate">(affiliate)</span>';
            }
            if (u.includes('/wholesale') || u.includes('SearchText=')) {
                return '<span class="affiliate-note" title="Generic AliExpress search—not a Portals commission link until you set links.aliexpress_portals or a product link in affiliate-links.json">(search)</span>';
            }
            return '<span class="affiliate-note" title="Product page on AliExpress. Add your Portals deeplink in links.aliexpress_portals to earn commission.">(AliExpress)</span>';
        }
        return '<span class="affiliate">(affiliate)</span>';
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
            html += `<p class="product-name"><strong>${product.name}</strong></p>`;
        }
        
        if (showPrice) {
            const prices = this.getPriceModel(product);
            if (prices.current) {
                const liveTag = product._price_live
                    ? ' <span class="price-live-badge" title="Price fetched live from Amazon">live</span>'
                    : '';
                html += `<p class="product-price">Now: <span class="price-highlight">${prices.current}</span>${liveTag}</p>`;
            } else if (prices.paid) {
                html += `<p class="product-price">Price: <span class="price-highlight">${prices.paid}</span></p>`;
            }
        }

        html += `<div class="product-links-group ${containerClass}">`;
        
        const links = this.normalizeProductLinks(product.links);
        for (const [retailer, url] of Object.entries(links)) {
            const buttonClass = retailer === 'official' ? 'official' : retailer;
            const retailerName = this.formatRetailerName(retailer);
            const badge = this.retailerBadgeHtml(retailer, url);
            
            html += `
                <a href="${url}" 
                   class="affiliate-button ${buttonClass}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   data-product="${productKey}"
                   data-retailer="${retailer}"
                   onclick="if(window.trackAffiliateClick) trackAffiliateClick('${productKey}', '${retailer}');"
                   title="Buy ${product.name} on ${retailerName}">
                    ${retailerName}
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
        let html = `<div class="product-card" data-product="${productKey}">`;

        // Header
        html += `<h3>${product.name}</h3>`;

        // Specs
        if (showSpecs && product.specs) {
            html += `<p><strong>Specs:</strong> ${product.specs}</p>`;
        }

        // Description (if provided)
        if (showDescription && product.description) {
            html += `<p>${product.description}</p>`;
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
            'amazon': 'Amazon',
            'newegg': 'Newegg',
            'bestbuy': 'Best Buy',
            'microcenter': 'Micro Center',
            'aliexpress': 'AliExpress',
            'official': 'Official Website'
        };
        return names[retailer] || retailer.charAt(0).toUpperCase() + retailer.slice(1);
    }

    /**
     * Auto-populate elements with data-affiliate-product attribute
     */
    autoPopulate() {
        if (!this.loaded) return;

        const containers = document.querySelectorAll('[data-affiliate-product]');
        containers.forEach(container => {
            const productKey = container.getAttribute('data-affiliate-product');
            if (!productKey) return;
            const compact = container.hasAttribute('data-affiliate-compact');
            const product = this.getProduct(productKey);
            const hasAdjacentPrice = compact && !!this.findAdjacentPriceHost(container);
            const html = this.generateLinkButtons(productKey, {
                showLabel: !compact,
                showPrice: !hasAdjacentPrice
            });
            container.innerHTML = html;
            this.syncAdjacentPriceLabel(container, product);
            this.alignCompactButtonsWithPrice(container);
        });
        this.decorateStandaloneAmazonPriceLinks();
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
                        ...product 
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
            <div class="affiliate-disclosure">
                <strong>Disclosure:</strong> ${text}
            </div>
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
                    'event_category': 'affiliate',
                    'event_label': retailer,
                    'product_key': productKey,
                    'timestamp': new Date().toISOString()
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
                        ...product 
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
        const productCount = Object.values(this.products).reduce((sum, cat) => sum + Object.keys(cat).length, 0);
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
    document.addEventListener('DOMContentLoaded', function() {
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
