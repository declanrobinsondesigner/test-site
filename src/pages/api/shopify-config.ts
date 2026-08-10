import type { APIRoute } from 'astro';
import { getServerShopifyPublicConfig } from '../../lib/shopify';

export const prerender = false;

/** Storefront tokens are designed to be public — used by the browser cart checkout. */
export const GET: APIRoute = async () => {
	const config = getServerShopifyPublicConfig();
	if (!config.domain || !config.token) {
		return Response.json({ ok: false, message: 'Shopify is not configured.' }, { status: 503 });
	}
	return Response.json({
		ok: true,
		domain: config.domain,
		token: config.token,
		version: config.version,
	});
};
