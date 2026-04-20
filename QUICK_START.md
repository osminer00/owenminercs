# Quick Start Guide: OwenMinerCS Affiliate Implementation

## 🚀 Get Started in 30 Minutes

### Step 1: Sign Up for Affiliate Programs (5 minutes)

1. **Amazon Associates** - https://affiliate-program.amazon.com/
   - Application usually approves within 24 hours
   - Get your tracking ID from dashboard
   - Format: `amazon.com/s?k=PRODUCT&tag=YOUR-TRACKING-ID-20`

2. **AliExpress Affiliate** - https://portals.aliexpress.com/
   - Instant approval, get tracking code immediately
   - Test a link to confirm working

3. **Optional: BestBuy Affiliate** - https://www.bestbuy.com/site/brands/best-buy-affiliate-program/
   - Submit application, wait for approval

### Step 2: Copy Your Affiliate Links (10 minutes)

For each program, get your specific affiliate URLs. Examples:

**Amazon:**
```
https://amazon.com/s?k=ASUS+ROG+Swift+OLED&tag=owenminercs-20
```

**AliExpress:**
```
https://www.aff.aliexpress.com/?key=YOUR_KEY&platpak=YOUR_PLATFORM_KEY
```

**Test each link** - Make sure you see your affiliate ID/tag in the URL.

### Step 3: Update affiliate-links.json (10 minutes)

**File:** `/affiliate-links.json`

Replace placeholder URLs with YOUR affiliate URLs:

```json
{
  "products": {
    "pc_components": {
      "rog_swift_monitor": {
        "name": "ASUS ROG Swift OLED PG27AQDP",
        "links": {
          "amazon": "https://amazon.com/s?k=ASUS+ROG+Swift+OLED&tag=YOUR-TAG-20",
          "bestbuy": "https://www.bestbuy.com/site/searchpage?st=ROG+Swift+OLED",
          ...
        }
      }
    }
  }
}
```

### Step 4: Test Integration (5 minutes)

1. Open your site locally: `http://localhost`
2. Open DevTools (F12) → Console
3. You should see:
   ```
   ✓ Affiliate links loaded successfully
   ```
4. Click an affiliate link - should go to product page with your affiliate ID in URL

### Step 5: Deploy (0 minutes)

Files are already in place:
- ✅ `/affiliate-links.json` - Product database
- ✅ `/scripts/affiliate-links.js` - Manager script
- ✅ `/css/affiliate-styles.css` - Styling
- ✅ Documents ready

Just update affiliate-links.json with real URLs and deploy!

### Required Before Every Publish: Media Accessibility Review

Run this command before each public publish:

```powershell
.\dev\publish-with-media-check.ps1 -PublishCommand "netlify deploy --prod"
```

What it does:

- Runs `dev/media-accessibility-check.mjs` to show current/suggested alt text + captions for setup/photos media.
- Prompts you to manually review.
- Requires typing `PUBLISH` before it runs your actual publish command.

If you only want the preview report (no publish command):

```powershell
node .\dev\media-accessibility-check.mjs
```

---

## 📋 Implementation Checklist

Just copy/paste this into your site where you want affiliate links.

### Option A: Auto-Populate (Easiest)

```html
<!-- Simply add this div where you want affiliate links to appear -->
<div data-affiliate-product="pc_components.rog_swift_monitor"></div>

<!-- Add this once at the top of your page -->
<link rel="stylesheet" href="../css/affiliate-styles.css">
<script src="../scripts/affiliate-links.js"></script>
```

### Option B: Manual Insert

```html
<script>
document.addEventListener('DOMContentLoaded', function() {
    const html = affiliateManager.generateLinkButtons('pc_components.rog_swift_monitor');
    document.getElementById('product-links').innerHTML = html;
});
</script>

<div id="product-links"></div>
```

### Option C: Full Product Card

```html
<script>
    insertProductCard('pc_components.rog_swift_monitor', 'product-container');
</script>

<div id="product-container"></div>
```

---

## 🎯 Immediate Impact Actions

### This Week:
- [ ] Join Amazon Associates (easiest, gets approvals fastest)
- [ ] Update affiliate-links.json with your Amazon tracking ID
- [ ] Add affiliate links to PC/pc.html (your technical audience will click)

### Expected First Month:
- [ ] 20-50 clicks from your audience
- [ ] 2-5 conversions = $10-30 commission
- [ ] Identify which products drive most clicks

### Month 2+:
- [ ] Expand to other retailers (AliExpress, BestBuy)
- [ ] Add to Desk Setup page (highest value products)
- [ ] Monitor which links convert best
- [ ] Update product prices/links monthly

---

## 💰 Revenue Breakdown by Channel

### PC Components (Highest Revenue Potential)
- **Monitor**: $999 → 2-5% commission = $20-50 per sale
- **GPU**: $1,600 → 2% commission = $32 per sale
- **CPU**: $450 → 2% commission = $9 per sale

**Strategy:** Target these first. Monitor buyers = high commission.

### Desk Setup (Broad Appeal)
- **Keyboard**: $170 → 4-5% = $7-8 per sale
- **Mic**: $300 → 3-5% = $9-15 per sale
- **Desk**: $370 → 2-3% = $7-11 per sale

**Strategy:** Multiple products = multiple commission opportunities.

### Keyboard/AliExpress (High Volume, Low Value)
- **Keycaps**: $15 → 5% = $0.75 per sale
- **Switches**: $20 → 5% = $1.00 per sale

**Strategy:** High click volume but low commission. Good for brand building.

---

## 📊 Tracking Your Performance

### Google Analytics Setup (Optional but Recommended)

Already added to your code! When someone clicks: 

```javascript
gtag('event', 'affiliate_click', {
    'event_category': 'affiliate',
    'event_label': 'amazon',  // or 'aliexpress', 'newegg', etc
    'product_key': 'pc_components.rog_swift_monitor'
});
```

**View in GA4:**
1. Go to Analytics
2. Events → affiliate_click
3. See which products get most clicks

### Month 1 Goals:
- **Clicks:** 20+
- **Conversions:** 2+ sales
- **Revenue:** $15+

---

## 🔗 Product Linking Quick Reference

### PC Page Products
```
rog_swift_monitor      → $999    → 2-5%  = $20-50
ryzen_9800x3d         → $479    → 2%    = $10
rtx_4090              → $1,600  → 2%    = $32
corsair_psu           → $150    → 3-5%  = $5-7
noctua_cooler         → $90     → 4-5%  = $4-5
lian_li_case          → $200    → 2-3%  = $4-6
gskill_ram            → $130    → 3%    = $4
```

**Quick Win:** Monitor gets most clicks due to high price + gaming focus.

### Desk Setup Products (HIGHEST PRIORITY)
```
beyerdynamic_headphones → $400   → 3%    = $12
rode_streamer_x         → $300   → 4%    = $12
wooting_60he            → $170   → 5%    = $9
flexispot_desk          → $370   → 2-3%  = $7-11
godox_keylight          → $229   → 3%    = $7
deerrun_walkpad         → $300   → 5%    = $15
```

**Quick Win:** Multiple medium-price items = multiple commission opportunities.

---

## ⚡ Common Mistakes to Avoid

❌ **Don't:**
- Recommend products just for commission
- Hide affiliate status
- Use bad/outdated affiliate links
- Update links inconsistently

✅ **Do:**
- Only link products you genuinely use
- Show clear "affiliate" badge
- Test all links monthly
- Update prices when they change
- Track which links work best

---

## 🆘 Troubleshooting

**Q: "Affiliate links not showing on my site?"**
A: 
1. Check browser console (F12) for errors
2. Verify `/affiliate-links.json` is in root directory
3. Check that script tag is in your HTML: `<script src="../scripts/affiliate-links.js"></script>`

**Q: "Affiliate tracking ID not in URLs?"**
A: 
1. Double-check your tracking ID is correct
2. Test the URL in incognito mode
3. Verify affiliate dashboard shows the click

**Q: "Links work in browser but not after deploy?"**
A: 
1. Check Netlify deployment logs
2. Verify `/affiliate-links.json` was uploaded
3. Clear browser cache (Ctrl+Shift+R)

**Q: "Making no sales?"**
A: 
1. First month is normal - need 30+ clicks to see conversions
2. Monitor higher-price items (monitors, desks) for better ROI
3. Share affiliate page links on social media/YouTube

---

## 📞 Next Steps

1. **Join one program** - Amazon Associates recommended
2. **Get your affiliate ID/URL** - Takes 5 minutes
3. **Update affiliate-links.json** - Replace example URLs
4. **Test one page** - PC/pc.html (your tech audience will click)
5. **Monitor for 1 week** - Track clicks in console/GA
6. **Expand** - Add to other pages based on performance

---

## 🎓 Additional Resources

- **Amazon Associates Guide:** https://affiliate-program.amazon.com/help/node/topic/A2GDHLQJNCMQFN
- **Google Analytics Events:** https://support.google.com/analytics/answer/9964734
- **FTC Affiliate Disclosure:** https://www.ftc.gov/business-guidance/guides/ftcs-endorsement-guides

---

**Good luck!** 🚀

Track your first click this week!
