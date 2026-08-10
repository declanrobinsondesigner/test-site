import type { APIRoute } from 'astro';
import { getShopifyStoreDomain, submitShopifyContactForm } from '../../lib/shopify';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	if (!getShopifyStoreDomain()) {
		return Response.json(
			{ ok: false, message: 'Shopify is not configured on this site yet.' },
			{ status: 503 },
		);
	}

	let suggestion = '';
	let name = '';
	let email = '';
	const contentType = request.headers.get('content-type') || '';

	try {
		if (contentType.includes('application/json')) {
			const body = (await request.json()) as {
				suggestion?: string;
				name?: string;
				email?: string;
			};
			suggestion = body.suggestion?.trim() || '';
			name = body.name?.trim() || '';
			email = body.email?.trim() || '';
		} else {
			const form = await request.formData();
			suggestion = String(form.get('suggestion') || '').trim();
			name = String(form.get('name') || '').trim();
			email = String(form.get('email') || '').trim();
		}
	} catch {
		return Response.json({ ok: false, message: 'Invalid request body.' }, { status: 400 });
	}

	if (!suggestion) {
		return Response.json({ ok: false, message: 'Please write a suggestion.' }, { status: 400 });
	}

	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return Response.json({ ok: false, message: 'Please enter a valid email so we can reply.' }, { status: 400 });
	}

	const body = [
		'Website suggestion box:',
		'',
		suggestion,
		name ? `\n— ${name}` : '',
	].join('\n');

	try {
		const result = await submitShopifyContactForm({
			email,
			name: name || undefined,
			body,
		});
		if (!result.ok) {
			return Response.json({ ok: false, message: result.message }, { status: 502 });
		}
		return Response.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not send suggestion.';
		return Response.json({ ok: false, message }, { status: 500 });
	}
};
