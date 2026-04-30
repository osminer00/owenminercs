# Shop Payment Setup

Last reviewed: 2026-04-29

The shop page reads `Garage Sale/shop-products.json` via `scripts/garage-sale.js`, merges sticker / print / custom sewing rows into the **For Sale** grid (`#for-sale`) ahead of `ebay-listings.json`, applies `payment.publicNote`, then sends buyers to hosted PayPal or Stripe checkouts for payment, shipping address collection, receipts, and payment security. The standalone `scripts/shop-products.js` loader is not used on `garage-sale.html`.

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
- `priceNumber`: optional numeric value for sorting when `price` is not easy to parse.
- `status`: `coming-soon`, `tbd`, `available`, or `sold-out`.
- `availabilityLabel`: optional customer-facing text that overrides the default status label.
- `paymentProvider`: expected provider for the primary checkout link (`paypal` or `stripe` today).
- `paypalUrl`, `checkoutUrl`, `buyOnSiteUrl`, `stripeUrl`: optional hosted checkout URLs. `scripts/garage-sale.js` prefers PayPal/generic checkout first and exposes Stripe as an alternate card payment when both are present.
- `summary`: one short customer-facing description.
- `details`: bullet points shown on the card.
- `image`: optional relative image path from the JSON file.
- `imageAlt`: alt text for the product image. Keep this accurate when a real product photo replaces a placeholder.
- `secondaryUrl` and `secondaryLabel`: optional supporting link.

Only set `status` to `available` when at least one public hosted checkout URL is ready. Empty checkout URLs with `coming-soon`, `tbd`, or `sold-out` keep the card visible without enabling purchase.
