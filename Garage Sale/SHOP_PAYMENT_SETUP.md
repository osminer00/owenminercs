# Shop Payment Setup

Last reviewed: 2026-09-14

Public shop: `Garage Sale/garage-sale.html` (pretty URLs `/garage-sale` and `/Garage Sale/garage-sale`). Loader: `scripts/garage-sale.js`. The standalone `scripts/shop-products.js` file is **not** used on this page.

## Page architecture (current shipping)

`#for-sale` contains two grids, loaded in parallel:

| Mount | Data | Renderer |
| --- | --- | --- |
| `#shop-ebay-garage` | `Garage Sale/ebay-listings.json` `items` whose `section` is not `digital` / `digital-assets` | `renderEbayInstaCard` — Add to cart, optional **Checkout** + **On eBay** |
| `#shop-drops-hold` | `Garage Sale/shop-products.json` `products` (stickers, prints, custom-work, in that order) | `renderHoldCard` — always badge **On hold — not sold here yet** |

Direct checkout CTAs on **eBay cards** appear when a listing object has an http(s) `buyOnSiteUrl`, `checkoutUrl`, `paypalUrl`, or `stripeUrl`. PayPal wins over generic checkout/buy-on-site; Stripe is the alternate when it differs from the primary.

**Hold cards never render a Checkout button**, even if a shop product is `status: "available"` with a filled `checkoutUrl`. Paste PayPal/Stripe URLs into `shop-products.json` as prep, but visitors cannot buy those rows until the hold renderer (or a merge into the eBay-card path) grows a live CTA.

`#shop-ebay-digital` is queried in JS but **does not exist** in `garage-sale.html`. Listings with `section: "digital"` are parsed into `dataDigital` and then dropped on the floor.

`payment.publicNote` from `shop-products.json` is copied into `#shop-products-payment-note` when present.

## Photography and retired routes

Photography is a section on this same page (`#photography`), not a standalone gallery. `Photography/scripts/photography.js` reads `Photography/photos.json` via `window.OWEN_PHOTOS_JSON`. `years` is currently `[]`, so the empty-state copy shows.

Redirects in `_redirects` (and a meta refresh on `Photography/photography.html`):

- `/Photography/photography` → `/Garage Sale/garage-sale#photography`
- `/referrals`, `/Referrals/referrals` → `/Garage Sale/garage-sale`

## eBay listings sync

Committed file: `Garage Sale/ebay-listings.json`. Default seller id `owenm00`.

```bash
node scripts/sync-ebay-listings.mjs
# optional: --user owenm00 --limit 24 --out "Garage Sale/ebay-listings.json" --paid "Garage Sale/ebay-price-paid.json"
```

The script fetches `https://www.ebay.com/sch/i.html?_ssn=<user>&rt=nc&_rss=1`, keeps the first `--limit` items (default 24), and copies `paidPrice` from `ebay-price-paid.json` or the previous listings file when titles match (case-insensitive).

Related helpers (offline, not called by the page):

- `scripts/import-ebay-listings-export.mjs` — normalize a local `ebay-export.json` into `ebay-listings.json`
- `scripts/merge-ebay-images.mjs --source <file>` — merge extra images onto existing rows
- `scripts/enrich-ebay-images.mjs` — fetch/normalize listing image URLs

## Browser cart

`localStorage` key `owenminercs-ebay-cart-v1`. Line ids prefer the eBay `/itm/<id>/` number; otherwise a hash of direct checkout URL + title. Add to cart is disabled when a row has neither a direct checkout URL nor an `/itm/` eBay URL.

Cart checkout is still hosted (PayPal/Stripe/eBay) in a new tab. There is no in-site payment capture.

## Current Launch Prices

U.S. shipping is included in these public prices.

- Signed sticker pack, 3-pack: `$6 shipped`
- Signed 5x7 photo print: `$16 shipped`
- Signed 8x10 art print: `$24 shipped`

Fulfillment model:

- Stickers: print and pack at home, ship in a USPS stamped envelope. Cheapest option, no tracking.
- Prints: print at home, pack in a protective sleeve/backer plus rigid mailer, ship with USPS Ground Advantage tracking.
- UPS: keep as a manual backup by request. It is not the default for these small drops because it starts much higher than USPS envelope/parcel options.

Rate basis checked on 2026-04-28:

- USPS Notice 123, effective 2026-04-26: 1 oz First-Class letter is `$0.78`; 1 oz commercial flat is `$1.520`; 4 oz USPS Ground Advantage commercial starts at `$5.50`.
- UPS Simple Rate: Extra Small starts at `$12.20`, so it is not the cheap default for sticker/print drops.

Sources:

- USPS Notice 123: https://pe.usps.com/text/dmm300/Notice123.htm
- UPS Simple Rate: https://www.ups.com/us/en/support/shipping-support/shipping-costs-rates/flat-rate-shipping

## Recommended Launch Path

Start with PayPal Payment Links because Owen prefers PayPal and the first drops are small physical items.

Create one PayPal payment link for each live product:

- `signed-sticker-pack`: product price `$6.00`, shipping `$0`, collect U.S. shipping address, include description "USPS stamped envelope, no tracking."
- `signed-photo-print-5x7`: product price `$16.00`, shipping `$0`, collect U.S. shipping address, include description "USPS Ground Advantage tracking included."
- `signed-art-print-8x10`: product price `$24.00`, shipping `$0`, collect U.S. shipping address, include description "USPS Ground Advantage tracking included."

For signed items, add a buyer note, gift message, or clear checkout instruction for "name for signature / short note."

After creating each hosted PayPal link:

1. Paste the live URL into that product's `checkoutUrl` in `Garage Sale/shop-products.json`.
2. Change `status` from `coming-soon` to `available`.
3. Keep `paymentProvider` as `paypal`.
4. Confirm a Checkout CTA is actually visible. Today `renderHoldCard()` will still show the on-hold badge; either teach that renderer to use `shopIsCheckoutLive()` or put the same URL on the matching eBay listing row (`buyOnSiteUrl` / `checkoutUrl` / `paypalUrl`).

## Stripe Option

Use Stripe Payment Links if a product needs stronger card-first checkout, required custom fields, cleaner limited-inventory controls, or automatic tax workflows.

- Create the product and price in Stripe.
- Create a Payment Link.
- Collect shipping address for physical goods.
- Set shipping to `$0` because the public price already includes shipping.
- Add a custom field for "name for signature / short note" when needed.
- Limit completed sessions for small batches or one-off pieces.
- Paste the live URL into `checkoutUrl`, set `status` to `available`, and set `paymentProvider` to `stripe`.

## Product Statuses

Statuses and labels are stored on the JSON and shown as `shopAvailabilityText` on hold cards. They do **not** currently switch the hold renderer to a live Checkout button.

- `coming-soon`: public preview (default copy “Coming soon”).
- `tbd`: public placeholder for ideas that are not ready for orders.
- `available`: intended live checkout; `shopIsCheckoutLive()` also requires an http(s) PayPal/checkout/buy-on-site/Stripe URL.
- `sold-out`: keeps the card visible without allowing checkout.

## Data Fields

- `section`: `stickers`, `prints`, or `custom-work`.
- `title`: public product name.
- `price`: public price label.
- `summary`: one short customer-facing description.
- `details`: bullet points shown on the card.
- `image`: optional relative image path from the JSON file.
- `checkoutUrl`, `paypalUrl`, `stripeUrl`, `buyOnSiteUrl`: hosted payment links. Hold cards ignore these for CTAs; eBay cards use them via `getBuyOnSiteUrl()`.
- `secondaryUrl` and `secondaryLabel`: optional supporting link on the hold card.
- `availabilityLabel`: overrides the status-derived availability line.
