import { SHOP_CATALOG } from './_shop-catalog.js';

function json(payload, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			...extraHeaders,
		},
	});
}

const MAX_BODY_BYTES = 24_000;
const MAX_LINE_QTY = 10;

function checkoutUrlsFromRequest(request, env) {
	const configuredSuccess = env?.STRIPE_CHECKOUT_SUCCESS_URL;
	const configuredCancel = env?.STRIPE_CHECKOUT_CANCEL_URL;
	if (configuredSuccess && configuredCancel) {
		return { success: configuredSuccess, cancel: configuredCancel };
	}
	let originFromReferer = '';
	const referer = request.headers.get('Referer');
	if (referer) {
		try {
			originFromReferer = new URL(referer).origin;
		} catch (_) {}
	}
	const origin =
		request.headers.get('Origin') || originFromReferer || new URL(request.url).origin;
	const path =
		env?.STRIPE_CHECKOUT_RETURN_PATH || '/Garage%20Sale/garage-sale.html';
	const safePath = path.startsWith('/') ? path : `/${path}`;
	return {
		success: `${origin}${safePath}${safePath.includes('?') ? '&' : '?'}checkout=success`,
		cancel: `${origin}${safePath}${safePath.includes('?') ? '&' : '?'}checkout=cancel`,
	};
}

function buildStripeCheckoutBody(lineItems, successUrl, cancelUrl) {
	const body = new URLSearchParams();
	body.append('mode', 'payment');
	body.append('success_url', successUrl);
	body.append('cancel_url', cancelUrl);
	body.append('client_reference_id', 'owenminercs-shop');
	body.append('shipping_address_collection[allowed_countries][0]', 'US');
	body.append('phone_number_collection[enabled]', 'true');

	lineItems.forEach((line, i) => {
		body.append(`line_items[${i}][quantity]`, String(line.quantity));
		body.append(`line_items[${i}][price_data][currency]`, 'usd');
		body.append(`line_items[${i}][price_data][unit_amount]`, String(line.unitAmountCents));
		body.append(`line_items[${i}][price_data][product_data][name]`, line.name);
		if (line.description) {
			body.append(`line_items[${i}][price_data][product_data][description]`, line.description);
		}
	});

	const metaIds = lineItems.map((l) => l.id).join(',');
	body.append('metadata[shop_line_ids]', metaIds.slice(0, 450));
	return body;
}

export async function onRequestOptions() {
	return new Response('', {
		status: 204,
		headers: {
			'access-control-allow-methods': 'POST, OPTIONS',
			'access-control-allow-headers': 'Content-Type',
			'access-control-max-age': '86400',
		},
	});
}

export async function onRequestPost(context) {
	const secret = context.env?.STRIPE_SECRET_KEY;
	if (!secret) {
		return json(
			{
				error:
					'STRIPE_SECRET_KEY is not set. Add it in Cloudflare Pages → Settings → Environment variables.',
			},
			503
		);
	}

	const len = Number(context.request.headers.get('content-length') || '0');
	if (len > MAX_BODY_BYTES) {
		return json({ error: 'Request body is too large.' }, 413);
	}

	let payload;
	try {
		payload = await context.request.json();
	} catch {
		return json({ error: 'Expected JSON body.' }, 400);
	}

	const rawItems = Array.isArray(payload?.items) ? payload.items : null;
	if (!rawItems?.length) {
		return json({ error: 'Provide items: [{ "id": "signed-sticker-pack", "quantity": 1 }]' }, 400);
	}

	const resolved = [];
	for (const row of rawItems) {
		const id = row?.id != null ? String(row.id).trim() : '';
		const qty = Number(row?.quantity ?? 1);
		if (!id || !Number.isFinite(qty) || qty < 1 || qty > MAX_LINE_QTY) {
			return json({ error: 'Each item needs a valid id and quantity (1–10).' }, 400);
		}
		const entry = SHOP_CATALOG[id];
		if (!entry || !entry.active) {
			return json({ error: `Unknown or inactive product: ${id}` }, 400);
		}
		resolved.push({
			id,
			quantity: Math.floor(qty),
			unitAmountCents: entry.unitAmountCents,
			name: entry.name,
			description: entry.description || '',
		});
	}

	const { success, cancel } = checkoutUrlsFromRequest(context.request, context.env);

	const stripeBody = buildStripeCheckoutBody(resolved, success, cancel);

	const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${secret}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: stripeBody.toString(),
	});

	const stripeData = await stripeRes.json().catch(() => ({}));
	if (!stripeRes.ok) {
		const msg = stripeData?.error?.message || `Stripe error (HTTP ${stripeRes.status}).`;
		return json({ error: msg, stripeType: stripeData?.error?.type }, 502);
	}
	if (!stripeData?.url) {
		return json({ error: 'Stripe response missing checkout URL.' }, 502);
	}

	return json({ url: stripeData.url, id: stripeData.id });
}

export async function onRequest() {
	return json({ error: 'Method not allowed. Use POST.' }, 405);
}
