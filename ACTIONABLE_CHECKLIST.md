# Action Items Checklist - Affiliate Link Implementation

## 🎯 THIS WEEK - Get First Affiliate Link Live

### DAY 1 - SETUP (30 minutes)
- [ ] **Step 1:** Read QUICK_START.md (15 min)
  - Open: `/QUICK_START.md`
  - Focus on "Step 1: Sign Up" section

- [ ] **Step 2:** Join Amazon Associates (15 min)
  - Go to: https://affiliate-program.amazon.com/
  - Fill out basic info
  - Gets approved within 24 hours usually
  - **Save your tracking ID!** Format: `owenminercs-20`

### DAY 2 - CONFIGURE (15 minutes)
- [ ] **Step 3:** Get your tracking ID from Amazon
  - Log into Amazon Associates
  - Go to "Account Settings" → "Tracking ID"
  - Copy the ID (format: `xxx-20`)

- [ ] **Step 4:** Create yourself a test URL
  - Template: `https://amazon.com/s?k=PRODUCT_NAME&tag=YOUR-TRACKING-ID-20`
  - Example: `https://amazon.com/s?k=ASUS+ROG+Swift&tag=owenminercs-20`
  - **Test this URL** in an incognito window
  - You should see your tracking ID in the URL bar

- [ ] **Step 5:** Update affiliate-links.json
  - Open: `/affiliate-links.json`
  - Find line with `"amazon": "https://amazon.com/s?k=ROG+Swift+OLED"`
  - Replace with your real URL from Step 4
  - Save file

### DAY 3 - DEPLOY (20 minutes)
- [ ] **Step 6:** Add to your PC page
  - Open: `/PC/pc.html`
  - Find the `<head>` section (first ~100 lines)
  
  - Add these 2 lines right before `</head>`:
  ```html
  <link rel="stylesheet" href="../css/affiliate-styles.css">
  <script src="../scripts/affiliate-links.js"></script>
  ```

- [ ] **Step 7:** Add affiliate links to one product
  - In `/PC/pc.html`, find the "CPU Cooler" section
  - Replace:
  ```html
  <a href="https://www.amazon.com/Noctua..." target="_blank" class="itemlink">
      <h1>CPU Cooler:</h1>
      <span class="item-desc">Noctua NH-D15S chromax.Black</span>
  </a>
  ```
  
  - With:
  ```html
  <div class="product-card">
      <a href="https://www.amazon.com/Noctua..." target="_blank" class="itemlink">
          <h1>CPU Cooler:</h1>
          <span class="item-desc">Noctua NH-D15S chromax.Black</span>
      </a>
      <div data-affiliate-product="pc_components.noctua_cooler"></div>
  </div>
  ```

- [ ] **Step 8:** Deploy to Netlify
  - Commit changes to git
  - Push to main branch
  - Wait for Netlify build to complete (~1 min)

### DAY 4 - TEST (10 minutes)
- [ ] **Step 9:** Test the affiliate link
  - Go to your site: owenminercs.com/PC/pc.html
  - Find the "CPU Cooler" section
  - Click the "Amazon" button
  - Verify URL has your tracking ID (ends with your tracking ID)
  - It worked! ✓

- [ ] **Step 10:** Share on Twitter
  - Post: "Just added affiliate links to my PC setup page! Check out my build and use my links to support the channel"
  - Link: owenminercs.com/PC/pc.html

**Status: First affiliate link LIVE!** 🎉

---

## 📈 WEEK 2 - Expand to All PC Components

### Goals
- 50+ clicks on affiliate links
- 1-2 affiliate sales = $10-30 commission

### Tasks
- [ ] Add affiliate links to remaining 9 PC components (ROG Monitor, GPU, RAM, SSD, Case, PSU, CPU, Fans, OS)
  - Each takes ~2 minutes
  - Use template from Step 7
  - Replace product key (e.g., `pc_components.rtx_4090`)

- [ ] Test each link works
  - Click each button
  - Verify tracking ID is in URL

- [ ] Monitor Google Analytics
  - Go to: GA4 Dashboard → Events → affiliate_click
  - See which products get clicks

- [ ] Update prices if needed
  - Edit affiliate-links.json
  - Update prices in "price" field

### Priority Order (do in this order, highest value first)
1. **Monitor** - $999 → $20-50 commission (#1 priority!)
2. **GPU** - $1,600 → $32 commission
3. **CPU** - $450 → $9 commission  
4. **PSU** - $150 → $5-7 commission
5. **RAM** - $130 → $4 commission
6. **Case** - $200 → $4-6 commission
7. **Cooler** - $90 → $4-5 commission (already done)
8. **SSD** - $80 → $2-3 commission
9. **Fans** - $50 → $1-2 commission (set of 3)
10. **OS** - $200 → $6 commission

---

## 🚀 WEEK 3 - Launch Desk Setup (HIGHEST VALUE!)

### Why Desk Setup Page?
- 15+ products
- Higher average price = bigger commissions
- More diverse audience = more clicks

### Products to Link (Priority Order)
1. **Flexispot Desk** - $370 → $7-11 commission
2. **DeerRun Walkpad** - $300 → $15 commission (AliExpress 5%)
3. **Beyerdynamic Headphones** - $400 → $12 commission
4. **Rode Streamer X** - $300 → $12 commission
5. **Sony ZV-E10** - $700 → $21 commission
6. **Godox Keylight** - $229 → $7 commission
7. **Wooting 60HE** - $170 → $9 commission
8. **Shure SM7B** - $399 → $12 commission
9. **Monitors** (3x 16:9, 1x ultrawide) - various → $20-50+ commission each!!

### Steps
- [ ] Open Desk Setup/setup.html
- [ ] Add same 2 lines to `<head>`:
  ```html
  <link rel="stylesheet" href="../css/affiliate-styles.css">
  <script src="../scripts/affiliate-links.js"></script>
  ```

- [ ] Update affiliate-links.json with desk product URLs
  - Get real Amazon/AliExpress links for each
  - Category: `pc_components.flexispot_desk`, etc.

- [ ] Add affiliate divs to desk page
  - Find each product section
  - Wrap in `<div class="product-card">`
  - Add `<div data-affiliate-product="desk_setup.PRODUCT_KEY"></div>`

- [ ] Test ALL links work

- [ ] Deploy and monitor clicks

**Expected outcome:** 100-200 clicks/week, $50-150 commission potential

---

## 🎮 WEEK 4 - Keyboard Page + Optimization

### Add Keyboard Page Links
- [ ] Update Keyboard/60he.html with affiliate setup
- [ ] Focus on **AliExpress** for keycaps/switches (5% commission)
- [ ] Link **Wooting official** for the 60HE keyboard
- [ ] Add Amazon as backup for all items

### Optimize Based on Data
- [ ] Check GA4 for click patterns
- [ ] Identify which products drive most clicks
- [ ] Update those links first (fresh product listing)
- [ ] Update product prices in affiliate-links.json
- [ ] Remove broken links
- [ ] Add new trending products

### Revenue Check
- [ ] Count total commissions so far
- [ ] Goal: $50-100 in month 1
- [ ] If below: boost Twitter/Discord posts
- [ ] If above: expand to more products

---

## 💰 MONTH 2 - Monetization Expansion

Beyond just affiliate links:

### Option A: Add More Retailers
- [ ] Join Newegg Affiliate (2-10% commission)
- [ ] Join BestBuy Affiliate (2-5% commission)
- [ ] Join Rakuten (cash back network)
- [ ] Update affiliate-links.json with new retailer URLs

### Option B: Contact Brands for Sponsorships
- [ ] Wooting - Direct partnership inquiry
- [ ] ASUS - Affiliate or sponsorship
- [ ] Beyerdynamic - Headphone sponsorship
- [ ] Flexispot - Desk sponsorship
- [ ] Godox - Lighting sponsorship

**Template email:**
```
Subject: Partnership Opportunity - Gaming Setup Creator

Hi [Brand],

I'm Owen Miner, a counter-strike content creator with [X followers/YouTube subs]. 
My audience heavily uses [your product category]. 

I'd love to discuss affiliate partnerships or sponsorship opportunities.

My audience: [describe them - gamers, CS2 players, etc]
My content: PC builds, desk setups, gaming guides
Traffic: [monthly visitors to setup pages]

Looking forward to working together!
-Owen
```

### Option C: Create Patreon/Ko-fi
- [ ] Set up Patreon account (optional - might not be needed yet)
- [ ] Create tier: "$5/month - Setup recommendations"
- [ ] Create tier: "$10/month - Custom build advice"
- [ ] Add Patreon link to socials page

---

## 📊 ONGOING - Monthly Maintenance

### Each Week
- [ ] Monitor affiliate clicks in GA4
- [ ] Check for broken links
- [ ] Update product prices (especially tech = frequent price drops)
- [ ] Post about affiliate links on Twitter/Discord

### Each Month
- [ ] Review earnings in affiliate dashboards
- [ ] Identify top-performing products
- [ ] Remove underperforming links
- [ ] Add new trending products
- [ ] Update affiliate-links.json

### Each Quarter
- [ ] Contact new brands for sponsorship
- [ ] Analyze conversion rates by retailer
- [ ] Optimize link placement (A/B test)
- [ ] Plan content around top-converting products

---

## 🎯 Success Metrics

### Month 1 Goals
- [ ] 50+ affiliate clicks
- [ ] 1-2 conversions
- [ ] $10-30 commission
- [ ] All 3 product pages with links

### Month 2 Goals
- [ ] 150+ clicks
- [ ] 5-10 conversions
- [ ] $50-100 commission
- [ ] Established daily traffic pattern

### Month 3 Goals
- [ ] 300+ clicks
- [ ] 15-20 conversions
- [ ] $150-300 commission
- [ ] Sponsorship inquiry received

### Month 6 Goals
- [ ] 500+ clicks/month
- [ ] 1+ brand sponsorship
- [ ] $300-500/month commission
- [ ] Repeat sponsor arrangements

---

## 📚 Reference Documents

When you get stuck, reference:
- **Quick Setup:** QUICK_START.md
- **Tech Details:** IMPLEMENTATION_GUIDE.md
- **Strategy:** MONETIZATION_STRATEGY.md
- **HTML Code:** PC_PAGE_EXAMPLE.html
- **Overview:** README_MONETIZATION.md
- **Product Data:** affiliate-links.json

---

## ❓ Common Questions

**Q: How long to first sale?**
A: Typically 2-4 weeks. You need 30+ clicks to reliably get conversions.

**Q: Which retailer is best?**
A: Amazon has highest conversion rate (3-5%). AliExpress highest commission (5-20%) but lower conversion (1-2%).

**Q: How much can I make?**
A: $300-1,000/month realistically by month 3-6, if you're consistent.

**Q: Is this against YouTube TOS?**
A: No, affiliate links are completely allowed and expected. Just disclose.

**Q: Do I need to manually update links?**
A: Prices: monthly. Links: whenever product changes. File: `/affiliate-links.json`

---

## 🚀 START HERE

1. Go to QUICK_START.md
2. Complete "Step 1: Sign Up"
3. Complete "Step 2: Copy Your Affiliate Links"
4. Update affiliate-links.json (10 minutes)
5. Deploy (2 minutes)
6. Done!

**Estimated time: 1 hour to first link live**

---

## 💬 Last Notes

- Only recommend products you actually use
- Be transparent with (affiliate) badge
- Update links every month
- Monitor what works, double down on it
- Have fun with it!

**Your monetization journey starts today.**

Let's go! 🎉
