const crypto = require('crypto');
const https = require('https');

const HOST = 'webservices.amazon.com';
const REGION = 'us-east-1';
const SERVICE = 'ProductAdvertisingAPI';
const PATH = '/paapi5/getitems';
const TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems';

function hmac(key, data) {
	return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256hex(data) {
	return crypto.createHash('sha256').update(data).digest('hex');
}

function getSigningKey(secretKey, dateStamp) {
	const kDate = hmac('AWS4' + secretKey, dateStamp);
	const kRegion = hmac(kDate, REGION);
	const kService = hmac(kRegion, SERVICE);
	return hmac(kService, 'aws4_request');
}

async function fetchItemPrices(accessKey, secretKey, partnerTag, itemIds) {
	const now = new Date();
	const amzDate =
		now
			.toISOString()
			.replace(/[:\-]|\.\d{3}/g, '')
			.slice(0, 15) + 'Z';
	const dateStamp = amzDate.slice(0, 8);

	const body = JSON.stringify({
		ItemIds: itemIds,
		Resources: ['Offers.Listings.Price', 'ItemInfo.Title'],
		PartnerTag: partnerTag,
		PartnerType: 'Associates',
		Marketplace: 'www.amazon.com',
	});

	const payloadHash = sha256hex(body);

	const canonicalHeaders =
		[
			'content-encoding:amz-1.0',
			'content-type:application/json; charset=UTF-8',
			`host:${HOST}`,
			`x-amz-date:${amzDate}`,
			`x-amz-target:${TARGET}`,
		].join('\n') + '\n';

	const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
	const canonicalRequest = ['POST', PATH, '', canonicalHeaders, signedHeaders, payloadHash].join(
		'\n'
	);

	const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
	const stringToSign = [
		'AWS4-HMAC-SHA256',
		amzDate,
		credentialScope,
		sha256hex(canonicalRequest),
	].join('\n');

	const signature = crypto
		.createHmac('sha256', getSigningKey(secretKey, dateStamp))
		.update(stringToSign)
		.digest('hex');

	const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

	const requestHeaders = {
		'content-encoding': 'amz-1.0',
		'content-type': 'application/json; charset=UTF-8',
		host: HOST,
		'x-amz-date': amzDate,
		'x-amz-target': TARGET,
		Authorization: authHeader,
	};

	return new Promise((resolve, reject) => {
		const req = https.request(
			{ hostname: HOST, path: PATH, method: 'POST', headers: requestHeaders },
			(res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					try {
						resolve(JSON.parse(data));
					} catch (e) {
						reject(new Error('Invalid JSON from PA API: ' + data.slice(0, 200)));
					}
				});
			}
		);
		req.on('error', reject);
		req.write(body);
		req.end();
	});
}

exports.handler = async function (event) {
	const responseHeaders = {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		// CDN caches for 1 hour, stale-while-revalidate for 10 min
		'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
	};

	if (event.httpMethod === 'OPTIONS') {
		return { statusCode: 204, headers: responseHeaders, body: '' };
	}

	const ACCESS_KEY = process.env.AMAZON_PA_ACCESS_KEY;
	const SECRET_KEY = process.env.AMAZON_PA_SECRET_KEY;
	const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || 'owenminercs-20';

	if (!ACCESS_KEY || !SECRET_KEY) {
		return {
			statusCode: 200,
			headers: responseHeaders,
			body: JSON.stringify({ prices: {}, configured: false }),
		};
	}

	const raw = (event.queryStringParameters && event.queryStringParameters.asins) || '';
	const asins = raw
		.split(',')
		.map((s) => s.trim().toUpperCase())
		.filter((s) => /^[A-Z0-9]{10}$/.test(s))
		.slice(0, 10);

	if (!asins.length) {
		return {
			statusCode: 400,
			headers: responseHeaders,
			body: JSON.stringify({ error: 'No valid ASINs provided' }),
		};
	}

	try {
		const result = await fetchItemPrices(ACCESS_KEY, SECRET_KEY, PARTNER_TAG, asins);
		const prices = {};

		if (result.ItemsResult && result.ItemsResult.Items) {
			for (const item of result.ItemsResult.Items) {
				const listing = item.Offers && item.Offers.Listings && item.Offers.Listings[0];
				const displayPrice = listing && listing.Price && listing.Price.DisplayAmount;
				if (displayPrice) {
					prices[item.ASIN] = displayPrice;
				}
			}
		}

		if (result.Errors && result.Errors.length) {
			console.warn('PA API item errors:', JSON.stringify(result.Errors));
		}

		return {
			statusCode: 200,
			headers: responseHeaders,
			body: JSON.stringify({ prices, configured: true }),
		};
	} catch (err) {
		console.error('PA API error:', err.message);
		return {
			statusCode: 200,
			headers: responseHeaders,
			body: JSON.stringify({ prices: {}, error: err.message, configured: true }),
		};
	}
};
