<!-- ===== AFFILIATE LINK IMPLEMENTATION GUIDE ===== -->

# OwenMinerCS Affiliate Link Implementation Guide

## Table of Contents

1. [HTML Structure](#html-structure)
2. [JavaScript Helper](#javascript-helper)
3. [CSS Integration](#css-integration)
4. [Deployment Checklist](#deployment-checklist)

---

## HTML Structure

### Option 1: Simple Direct Links (Easiest)

```html
<!-- Single Product Link -->
<a href="AFFILIATE_LINK" target="_blank" rel="noopener noreferrer" class="itemlink has-affiliate">
	<h1>ROM Swift OLED Monitor</h1>
	<span class="item-desc">ASUS ROG Swift OLED PG27AQDP - $999.00</span>
</a>

<!-- Multiple Retailer Options -->
<div class="product-card">
	<h3>ROG Swift OLED PG27AQDP Monitor</h3>
	<p><strong>480Hz 1440p OLED Monitor</strong></p>
	<p>Resolution: 2560x1440 | Refresh Rate: 480Hz</p>

	<div class="product-links-group">
		<a
			href="[AMAZON_AFFILIATE_URL]"
			class="affiliate-button amazon"
			target="_blank"
			rel="noopener noreferrer"
		>
			Amazon <span class="affiliate">(affiliate)</span>
		</a>
		<a
			href="[BESTBUY_AFFILIATE_URL]"
			class="affiliate-button bestbuy"
			target="_blank"
			rel="noopener noreferrer"
		>
			Best Buy <span class="affiliate">(affiliate)</span>
		</a>
		<a
			href="[NEWEGG_AFFILIATE_URL]"
			class="affiliate-button newegg"
			target="_blank"
			rel="noopener noreferrer"
		>
			Newegg <span class="affiliate">(affiliate)</span>
		</a>
	</div>
</div>
```

### Option 2: Dynamic Links from JSON (Recommended)

```html
<!-- Template in HTML (will be populated by JS) -->
<div class="product-card" id="product-rog-monitor">
	<h3>Loading product...</h3>
	<div class="product-links-group" id="links-rog-monitor"></div>
</div>

<script>
	// JavaScript will populate this from affiliate-links.json
</script>
```

### Option 3: Integrated in Existing Structure (For your PC page)

```html
<!-- Before: Your current structure -->
<a
	href="https://rog.asus.com/us/monitors/27-to-31-5-inches/rog-swift-oled-pg27aqdp/"
	target="_blank"
	title="ROG Swift OLED PG27AQDP"
>
	ROG Swift OLED PG27AQDP <span class="b_w_link">| $999.00</span>
</a>

<!-- After: With affiliate links -->
<div class="product-card">
	<a
		href="https://rog.asus.com/us/monitors/27-to-31-5-inches/rog-swift-oled-pg27aqdp/"
		target="_blank"
		title="ROG Swift OLED PG27AQDP"
	>
		<h4>ROG Swift OLED PG27AQDP <span class="b_w_link">| $999.00</span></h4>
	</a>

	<div class="product-links-group">
		<a
			href="[AMAZON_ASIN_LINK]"
			class="affiliate-button amazon"
			target="_blank"
			rel="noopener noreferrer"
		>
			Buy on Amazon <span class="affiliate">(affiliate)</span>
		</a>
		<a
			href="[BESTBUY_LINK]"
			class="affiliate-button bestbuy"
			target="_blank"
			rel="noopener noreferrer"
		>
			Best Buy <span class="affiliate">(affiliate)</span>
		</a>
	</div>
</div>
```

---

## JavaScript Helper

### File: `/scripts/affiliate-links.js`

```javascript
// Affiliate Links Manager
class AffiliateLinksManager {
	constructor(jsonPath = '/affiliate-links.json') {
		this.jsonPath = jsonPath;
		this.products = {};
		this.init();
	}

	async init() {
		try {
			const response = await fetch(this.jsonPath);
			const data = await response.json();
			this.products = data.products;
			console.log('Affiliate links loaded:', data.metadata);
		} catch (error) {
			console.warn('Could not load affiliate links:', error);
		}
	}

	// Get product by key
	getProduct(productKey) {
		const parts = productKey.split('.');
		let current = this.products;
		for (let part of parts) {
			current = current[part];
			if (!current) return null;
		}
		return current;
	}

	// Generate affiliate link button HTML
	generateLinkButtons(productKey, showLabel = true) {
		const product = this.getProduct(productKey);
		if (!product) return '';

		let html = '<div class="product-links-group">';

		for (const [retailer, url] of Object.entries(product.links)) {
			const buttonClass = retailer === 'official' ? 'official' : retailer;
			const retailerName = this.formatRetailerName(retailer);

			html += `
                <a href="${url}" 
                   class="affiliate-button ${buttonClass}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   data-product="${productKey}"
                   data-retailer="${retailer}"
                   onclick="trackAffiliateClick('${productKey}', '${retailer}')">
                    ${retailerName}
                    ${retailer !== 'official' ? '<span class="affiliate">(affiliate)</span>' : ''}
                </a>
            `;
		}

		html += '</div>';
		return html;
	}

	// Format retailer names nicely
	formatRetailerName(retailer) {
		const names = {
			amazon: 'Amazon',
			newegg: 'Newegg',
			bestbuy: 'Best Buy',
			microcenter: 'Micro Center',
			aliexpress: 'AliExpress',
			official: 'Official Website',
		};
		return names[retailer] || retailer.charAt(0).toUpperCase() + retailer.slice(1);
	}

	// Auto-populate affiliate links on page load
	autoPopulate() {
		const affiliateContainers = document.querySelectorAll('[data-affiliate-product]');
		affiliateContainers.forEach((container) => {
			const productKey = container.getAttribute('data-affiliate-product');
			const html = this.generateLinkButtons(productKey);
			container.innerHTML = html;
		});
	}
}

// Initialize on page load
let affiliateManager = null;
document.addEventListener('DOMContentLoaded', function () {
	affiliateManager = new AffiliateLinksManager('/affiliate-links.json');

	// Wait a bit for JSON to load, then auto-populate
	setTimeout(() => affiliateManager.autoPopulate(), 500);
});

// Tracking function (integrate with Google Analytics)
function trackAffiliateClick(productKey, retailer) {
	if (typeof gtag !== 'undefined') {
		gtag('event', 'affiliate_click', {
			product: productKey,
			retailer: retailer,
			timestamp: new Date().toISOString(),
		});
	}
	console.log(`Affiliate link clicked: ${productKey} - ${retailer}`);
}

// Simnple utility: Get featured products for a page
function getFeaturedProducts(page) {
	const featured = [];
	for (const [category, products] of Object.entries(affiliateManager.products)) {
		for (const [key, product] of Object.entries(products)) {
			if (product.pages && product.pages.includes(page)) {
				featured.push({ key: `${category}.${key}`, ...product });
			}
		}
	}
	return featured;
}
```

### Usage in HTML:

```html
<!-- Option A: Auto-populate container -->
<div data-affiliate-product="pc_components.rog_swift_monitor"></div>

<!-- Option B: Manual call in script -->
<script>
	document.addEventListener('DOMContentLoaded', function () {
		const containerID = 'links-rog-monitor';
		const html = affiliateManager.generateLinkButtons('pc_components.rog_swift_monitor');
		document.getElementById(containerID).innerHTML = html;
	});
</script>

<!-- Option C: Track clicks manually -->
<a href="[URL]" onclick="trackAffiliateClick('pc_components.rog_swift_monitor', 'amazon')">
	Buy on Amazon
</a>
```

---

## CSS Integration

### 1. Add to `<head>` of all product pages:

```html
<link rel="stylesheet" href="../css/affiliate-styles.css" />
```

### 2. Add disclosure notice to your pages:

```html
<div class="affiliate-disclosure">
	<strong>Disclosure:</strong> Some links on this page are affiliate links. If you purchase
	through them, I earn a small commission at no extra cost to you. I only recommend products I
	genuinely use and believe in.
</div>
```

### 3. Optional: Add to meta tags for transparency:

```html
<meta name="robots" content="index, follow" />
<meta name="googlebot" content="index, follow" />
<!-- Add this for affiliate compliance -->
<meta property="business:contact_data:url" content="https://www.owenminercs.com/about" />
```

---

## Deployment Checklist

### Before Going Live:

- [ ] Sign up for Amazon Associates program
- [ ] Sign up for AliExpress Affiliate program
- [ ] Get your affiliate links/API keys
- [ ] Update `affiliate-links.json` with REAL affiliate URLs
- [ ] Test all affiliate links in incognito mode
- [ ] Verify affiliate link attribution in account dashboards
- [ ] Add affiliate stylesheet to all product pages
- [ ] Add disclosure notices to all pages with affiliate links

### Files to Modify:

- [ ] `HTML//pc.html` - Add affiliate links for PC components
- [ ] `Desk Setup/setup.html` - Add affiliate links for all products
- [ ] `Keyboard/60he.html` - Add affiliate links for keyboard parts
- [ ] `index.html` - Optional: add featured products with links
- [ ] `Counter-Strike/CS.html` - Optional: add recommended products

### QA Testing:

- [ ] Click all affiliate links - ensure they go to correct products
- [ ] Check that affiliate parameters are present in URLs
- [ ] Verify disclosures are visible on each page
- [ ] Test on mobile - ensure buttons are clickable
- [ ] Check Google Analytics integration for affiliate clicks

### Monitoring:

- [ ] Track affiliate link clicks in GA4
- [ ] Monitor conversion rates by retailer
- [ ] Update product prices monthly
- [ ] Test for broken links weekly

---

## Example: Quick Implementation for PC Page

**File:** `PC/pc.html`

```html
<!-- Add to <head> -->
<link rel="stylesheet" href="../css/affiliate-styles.css" />
<script src="../scripts/affiliate-links.js"></script>

<!-- Replace or enhance current product links -->
<div class="case2">
	<!-- Motherboard -->
	<div class="product-card">
		<h1>Motherboard:</h1>
		<span class="item-desc">Gigabyte B650 GAMING X AX V2</span>
		<div data-affiliate-product="pc_components.gigabyte_motherboard"></div>
	</div>

	<!-- CPU -->
	<div class="product-card">
		<h1>CPU:</h1>
		<span class="item-desc">AMD Ryzen 7 9800X3D</span>
		<div data-affiliate-product="pc_components.ryzen_9800x3d"></div>
	</div>

	<!-- GPU -->
	<div class="product-card">
		<h1>GPU:</h1>
		<span class="item-desc">NVIDIA GeForce RTX 4090 Founders Edition</span>
		<div data-affiliate-product="pc_components.rtx_4090"></div>
	</div>

	<!-- ... etc for other components ... -->
</div>

<!-- Add disclosure near top of page -->
<div class="affiliate-disclosure">
	<strong>Affiliate Disclosure:</strong> This page contains affiliate links to Amazon, Newegg, and
	other retailers. I earn a small commission when you buy through these links, at no extra cost to
	you. I only link to products I actually use and recommend.
</div>
```

---

## Troubleshooting

**Q: Affiliate links not showing?**

- A: Check browser console for errors. Ensure `affiliate-links.json` is in root directory.

**Q: Links not tracking in Google Analytics?**

- A: Verify Google Analytics is loaded before affiliate-links.js. Check GA event in dev tools Network tab.

**Q: Links look bad on mobile?**

- A: The CSS includes mobile responsive styles. Check that affiliate-styles.css is loaded.

**Q: Affiliate parameters disappearing?**

- A: Some retailers strip parameters. Use direct product ASIN links or official retailer tracking.

---

## Next Steps

1. **Sign up for programs** - Start with Amazon Associates
2. **Get your affiliate URLs** - Extract your unique affiliate IDs
3. **Update affiliate-links.json** - Replace placeholder URLs with real ones
4. **Add to one page first** - Test on PC/pc.html
5. **Monitor results** - Track clicks and conversions for 2-4 weeks
6. **Expand to other pages** - Roll out to Desk Setup, Keyboard pages
