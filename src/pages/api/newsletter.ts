import type { APIRoute } from 'astro';
import { createMarketingCustomer, isShopifyConfigured } from '../../lib/shopify';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	if (!isShopifyConfigured()) {
		return Response.json(
			{ ok: false, message: 'Shopify is not configured on this site yet.' },
			{ status: 503 },
		);
	}

	let email = '';
	const contentType = request.headers.get('content-type') || '';

	try {
		if (contentType.includes('application/json')) {
			const body = (await request.json()) as { email?: string };
			email = body.email?.trim() || '';
		} else {
			const form = await request.formData();
			email = String(form.get('email') || '').trim();
		}
	} catch {
		return Response.json({ ok: false, message: 'Invalid request body.' }, { status: 400 });
	}

	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return Response.json({ ok: false, message: 'Please enter a valid email.' }, { status: 400 });
	}

	try {
		const result = await createMarketingCustomer(email);
		if (!result.ok) {
			return Response.json({ ok: false, message: result.message }, { status: 400 });
		}
		return Response.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Newsletter signup failed.';
		return Response.json({ ok: false, message }, { status: 500 });
	}
};
