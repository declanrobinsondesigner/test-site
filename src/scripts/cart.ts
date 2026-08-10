/**
 * Client-side cart store (localStorage) + Shopify Cart checkout handoff.
 * Line items keep merchandiseId (Shopify variant GID) when available.
 */

export type CartLine = {
	id: string;
	handle: string;
	title: string;
	size: string;
	price: number;
	currencyCode: 'GBP';
	quantity: number;
	imageSrc: string;
	imageAlt: string;
	/** Shopify ProductVariant GID for Storefront Cart API */
	merchandiseId?: string;
};

const STORAGE_KEY = 'bgs-cart-v1';

function readCart(): CartLine[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as CartLine[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeCart(lines: CartLine[]) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
	window.dispatchEvent(new CustomEvent('bgs:cart-updated', { detail: { lines } }));
}

export function getCart(): CartLine[] {
	return readCart();
}

export function getCartCount(): number {
	return readCart().reduce((sum, line) => sum + line.quantity, 0);
}

export function getCartSubtotal(): number {
	return readCart().reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function addToCart(input: Omit<CartLine, 'id' | 'quantity'> & { quantity?: number }): CartLine[] {
	const lines = readCart();
	const quantity = input.quantity ?? 1;
	const existing = lines.find((line) => line.handle === input.handle && line.size === input.size);

	if (existing) {
		existing.quantity += quantity;
		if (input.merchandiseId) existing.merchandiseId = input.merchandiseId;
	} else {
		lines.push({
			...input,
			id: `${input.handle}__${input.size}`,
			quantity,
		});
	}

	writeCart(lines);
	return lines;
}

export function updateCartQuantity(id: string, quantity: number): CartLine[] {
	let lines = readCart();
	if (quantity <= 0) {
		lines = lines.filter((line) => line.id !== id);
	} else {
		lines = lines.map((line) => (line.id === id ? { ...line, quantity } : line));
	}
	writeCart(lines);
	return lines;
}

export function removeFromCart(id: string): CartLine[] {
	const lines = readCart().filter((line) => line.id !== id);
	writeCart(lines);
	return lines;
}

export function clearCart(): void {
	writeCart([]);
}

function getShopifyPublicConfig() {
	return {
		domain: import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN as string | undefined,
		token: import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN as string | undefined,
		version: (import.meta.env.PUBLIC_SHOPIFY_API_VERSION as string | undefined) || '2025-01',
	};
}

export function isShopifyCheckoutReady(): boolean {
	const { domain, token } = getShopifyPublicConfig();
	const lines = readCart();
	return Boolean(domain && token && lines.some((line) => line.merchandiseId));
}

async function shopifyCartFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
	const { domain, token, version } = getShopifyPublicConfig();
	if (!domain || !token) throw new Error('Shopify is not configured');

	const response = await fetch(`https://${domain}/api/${version}/graphql.json`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Shopify-Storefront-Access-Token': token,
		},
		body: JSON.stringify({ query, variables }),
	});

	const json = (await response.json()) as {
		data?: T;
		errors?: Array<{ message: string }>;
	};

	if (json.errors?.length) {
		throw new Error(json.errors.map((error) => error.message).join('; '));
	}
	if (!json.data) throw new Error('Shopify cart response missing data');
	return json.data;
}

/**
 * Creates a Shopify cart from local lines and returns the hosted checkout URL.
 */
export async function createShopifyCheckoutUrl(): Promise<string> {
	const lines = readCart().filter((line) => line.merchandiseId);
	if (!lines.length) {
		throw new Error('Add Shopify products to the cart before checkout.');
	}

	const data = await shopifyCartFetch<{
		cartCreate: {
			cart: { checkoutUrl: string } | null;
			userErrors: Array<{ message: string }>;
		};
	}>(
		`mutation CartCreate($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart { checkoutUrl }
        userErrors { message }
      }
    }`,
		{
			lines: lines.map((line) => ({
				merchandiseId: line.merchandiseId,
				quantity: line.quantity,
			})),
		},
	);

	if (data.cartCreate.userErrors?.length) {
		throw new Error(data.cartCreate.userErrors.map((error) => error.message).join('; '));
	}

	const url = data.cartCreate.cart?.checkoutUrl;
	if (!url) throw new Error('Shopify did not return a checkout URL');
	return url;
}
