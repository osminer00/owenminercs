# Shop Payment Setup

Last reviewed: 2026-04-30

The shop page reads `Garage Sale/shop-products.json` via `scripts/garage-sale.js`, merges sticker / print / custom sewing rows into the **For Sale** grid (`#for-sale`) ahead of `ebay-listings.json`, applies `payment.publicNote`, then sends buyers to hosted PayPal or Stripe checkouts for payment, shipping address collection, receipts, and payment security. The standalone `scripts/shop-products.js` loader is not used on `garage-sale.html`.

## Runtime Flow

`garage-sale.html` wires `scripts/garage-sale.js` with:

```html
<script
	src="../scripts/garage-sale.js"
	data-ebay-listings="ebay-listings.json"
	data-shop-products="shop-products.json"
></script>
```

The script loads both JSON files in parallel:

1. `shop-products.json` is mapped into direct-drop cards and rendered in
   `#shop-drops-hold`.
2. `ebay-listings.json` items are split by `section`; `digital` /
   `digital-assets` can render into `#shop-ebay-digital` when that container
   exists, and everything else renders into `#shop-ebay-garage`.
3. The sort menu controls only listing-style cards (`order`, price ascending /
   descending, date ascending / descending).
4. The cart is a browser convenience stored in `localStorage` key
   `owenminercs-ebay-cart-v1`; it does not reserve inventory or process payment.
5. Detail modals and image carousels are client-only. Checkout always leaves for
   a hosted direct checkout or eBay listing.

Direct checkout is preferred when a card has a live hosted payment URL. eBay can
remain available for discovery/comparison for the same inventory.

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
4. Test the merged **For Sale** grid in `Garage Sale/garage-sale.html` (#for-sale).

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

- `coming-soon`: public preview card with disabled checkout.
- `tbd`: public placeholder for ideas that are not ready for orders.
- `available`: enables the checkout button when `checkoutUrl` is present.
- `sold-out`: keeps the card visible without allowing checkout.

## Data Fields

- `section`: `stickers`, `prints`, or `custom-work`.
- `title`: public product name.
- `price`: public price label.
- `summary`: one short customer-facing description.
- `details`: bullet points shown on the card.
- `image`: optional relative image path from the JSON file.
- `checkoutUrl`: hosted PayPal or Stripe payment link.
- `paypalUrl`, `stripeUrl`, and `buyOnSiteUrl`: optional alternate hosted
  checkout fields. `garage-sale.js` chooses PayPal first, then `checkoutUrl` /
  `buyOnSiteUrl`, with Stripe as the alternate/card-first link when present.
- `secondaryUrl` and `secondaryLabel`: optional supporting link.

## Troubleshooting

- **Direct checkout button is missing:** `status` must be `available` and at
  least one hosted checkout URL must be an absolute `http` or `https` URL.
- **Product appears as on-hold:** this is expected for `coming-soon`, `tbd`, and
  `sold-out` statuses or products without a live checkout URL.
- **Relative image or secondary link fails:** paths resolve relative to
  `Garage Sale/shop-products.json`; use `../images/...` for site images.
- **Cart count looks stale:** clear browser storage for
  `owenminercs-ebay-cart-v1`. The cart is per-browser only.
- **Sort order is unexpected:** default sort uses file order from
  `ebay-listings.json`; price/date sorts put missing values at the end where
  possible and then fall back to file order.
