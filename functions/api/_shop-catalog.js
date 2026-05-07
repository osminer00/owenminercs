/**
 * Server-side prices for dynamic checkout (Stripe).
 * Keep IDs in sync with Garage Sale/shop-products.json.
 * Unit amounts are USD cents (includes shipping per public pricing).
 */
export const SHOP_CATALOG = {
	'signed-sticker-pack': {
		unitAmountCents: 600,
		name: 'Signed Sticker Pack (3-pack)',
		description: 'U.S. shipping included · USPS stamped envelope',
		active: true,
	},
	'signed-photo-print-5x7': {
		unitAmountCents: 1600,
		name: 'Signed Photo Print (5×7)',
		description: 'U.S. shipping included · USPS Ground Advantage',
		active: true,
	},
	'signed-art-print-8x10': {
		unitAmountCents: 2400,
		name: 'Signed Art Print (8×10)',
		description: 'U.S. shipping included · USPS Ground Advantage',
		active: true,
	},
};
