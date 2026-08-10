/**
 * Product catalogue types + local fallback samples.
 *
 * Live catalogue is loaded via src/lib/shopify.ts (Storefront API).
 * Local `products` remain as offline fallback / design reference (usually empty).
 *
 * | Upload in Shopify              | Field here / UI block                          |
 * |--------------------------------|------------------------------------------------|
 * | Product title                  | title                                          |
 * | Description (HTML)             | descriptionHtml — paragraph under the title    |
 * | Short / card blurb             | description                                    |
 * | Handle (URL slug)              | handle                                         |
 * | Vendor / brand                 | vendor                                         |
 * | Product type                   | productType                                    |
 * | Tags                           | tags                                           |
 * | Collections                    | collections                                    |
 * | Media / product images         | images[]                                       |
 * | Variant price (current)        | price / variants[]                             |
 * | Compare-at price (was / sale)  | compareAtPrice                                  |
 * | Currency                       | currencyCode                                   |
 * | Size option values             | sizes / variants[]                             |
 * | Metafield custom.details       | details[] — red ✦ bullet list under Add to Cart|
 * | Metafield custom.material etc. | metafields[] — “Product Specs” rows            |
 * | Metafield custom.condition     | Product Specs → Condition                      |
 * | Metafield custom.fit           | Product Specs → Fit                            |
 *
 * Shopify Admin setup for the bullet list + specs:
 * 1. Settings → Custom data → Products → Add definition
 * 2. Create `custom.details` as List of single line text (or Multi-line text)
 * 3. Create `custom.material`, `custom.condition`, `custom.fit` as Single line text
 * 4. Fill them on each product — do NOT put bullets in the main Description
 *    unless you also want that text in the description paragraph.
 */

import type { ImageMetadata } from 'astro';

/** Shopify collection handles used for catalog filters / routing. */
export type CollectionHandle =
	| 'mens'
	| 'womens'
	| 'accessories'
	| 't-shirts'
	| 'zip-up-hoodies'
	| 'jackets'
	| 'bowling-shirts'
	| 'worker-shirts'
	| 'jumpers'
	| 'cardigans'
	| 'dresses'
	| 'skirts'
	| 'tops'
	| 'trousers'
	| 'leggings'
	| 'jumpsuits'
	| 'playsuits-jumpsuits'
	| 'shorts'
	| 'swimwear'
	| 'nightwear'
	| 'shoes'
	| 'bags'
	| 'wallets'
	| 'chains'
	| 'belts'
	| 'jewellery'
	| 'hair-accessories'
	| 'gifts'
	| 'xl-plus';

/**
 * Local Astro image OR Shopify CDN URL string.
 * Shopify media uploaded in Admin arrives as strings like
 * https://cdn.shopify.com/s/files/...
 */
export type ProductImageSource = ImageMetadata | string;

export type ProductImage = {
	src: ProductImageSource;
	alt: string;
	label?: string;
	fit?: 'cover' | 'contain';
};

export type SizeGuideRow = {
	label: string;
	values: number[];
};

/**
 * Mirrors Shopify Metafield / Storefront metafield shape.
 * Client can define any custom.* keys in Shopify Admin; they land here.
 */
export type ProductMetafield = {
	namespace: string;
	key: string;
	type: string;
	value: string;
	/** Optional human label for the product page */
	label?: string;
};

export type ProductVariant = {
	/** Shopify ProductVariant GID — required for Cart API line items. */
	id: string;
	size: string;
	price: number;
	compareAtPrice?: number | null;
	available: boolean;
	imageSrc?: string;
};

export type Product = {
	/** Shopify `handle` — also used for `/products/[handle]`. */
	handle: string;
	/** Shopify `title`. */
	title: string;
	/** Short text for cards / SEO snippets. */
	description: string;
	/** Shopify `body_html` / `descriptionHtml`. */
	descriptionHtml?: string;
	/** Shopify `vendor`. */
	vendor: string;
	/** Shopify `product_type`. */
	productType: string;
	/** Shopify `tags`. */
	tags: string[];
	/** Current sell price in major units (e.g. 73.5 = £73.50). Shopify variant `price`. */
	price: number;
	/**
	 * Original / “was” price. Shopify variant `compare_at_price`.
	 * When set and higher than `price`, UI shows a sale.
	 */
	compareAtPrice?: number | null;
	/** Shopify MoneyV2 `currencyCode`. */
	currencyCode: 'GBP';
	/** First image = featured; rest = gallery (Shopify media order). */
	images: ProductImage[];
	/** Size option values (Shopify product option / variant titles). */
	sizes: string[];
	/** Per-size Shopify variants (for cart merchandise IDs). */
	variants?: ProductVariant[];
	/** Collection membership for filters (Shopify collections). */
	collections: CollectionHandle[];
	/** Spec bullets — or map from metafield `custom.details` (JSON/list). */
	details: string[];
	/**
	 * Shopify metafields / custom fields.
	 * Example: { namespace: 'custom', key: 'material', value: '80% cotton…' }
	 */
	metafields?: ProductMetafield[];
	/** Optional external buy link until Shopify checkout is live. */
	externalUrl?: string;
	/** Where this product was loaded from. */
	source?: 'shopify' | 'local';
	/** Size chart image + rows (Shopify metafield / file later). */
	sizeGuide?: {
		image: ProductImageSource;
		imageAlt: string;
		rows: SizeGuideRow[];
		eyebrow?: string;
	};
};

export function resolveImageSrc(src: ProductImageSource): string {
	return typeof src === 'string' ? src : src.src;
}

export function resolveImageWidth(src: ProductImageSource, fallback = 800): number {
	return typeof src === 'string' ? fallback : src.width;
}

export function resolveImageHeight(src: ProductImageSource, fallback = 800): number {
	return typeof src === 'string' ? fallback : src.height;
}

export function formatMoney(amount: number, currencyCode: Product['currencyCode'] = 'GBP'): string {
	return new Intl.NumberFormat('en-GB', {
		style: 'currency',
		currency: currencyCode,
	}).format(amount);
}

export function getDisplayPrice(product: Product): string {
	return formatMoney(product.price, product.currencyCode);
}

export function getCompareAtDisplayPrice(product: Product): string | null {
	if (product.compareAtPrice == null || product.compareAtPrice <= product.price) return null;
	return formatMoney(product.compareAtPrice, product.currencyCode);
}

export function getProductHref(product: Product): string {
	return `/products/${product.handle}`;
}

export function getFeaturedImage(product: Product): ProductImage {
	return product.images[0];
}

export function getMetafield(
	product: Product,
	namespace: string,
	key: string,
): ProductMetafield | undefined {
	return product.metafields?.find((field) => field.namespace === namespace && field.key === key);
}

export function getCustomMetafields(product: Product): ProductMetafield[] {
	const hidden = new Set(['details', 'size_guide_eyebrow']);
	return (product.metafields ?? []).filter(
		(field) => field.namespace === 'custom' && !hidden.has(field.key),
	);
}

export function getBreadcrumbTrail(product: Product): Array<{ label: string; href?: string }> {
	const trail: Array<{ label: string; href?: string }> = [{ label: 'Home', href: '/' }];

	const isWomens = product.collections.includes('womens');
	const department: 'mens' | 'womens' | null = isWomens
		? 'womens'
		: product.collections.includes('mens') || product.collections.includes('xl-plus')
			? 'mens'
			: null;

	if (department) {
		trail.push({
			label: department === 'womens' ? "Women's" : "Men's",
			href: `/${department}`,
		});
	}

	const typeHandles = [
		'jumpsuits',
		't-shirts',
		'zip-up-hoodies',
		'jackets',
		'bowling-shirts',
		'worker-shirts',
		'jumpers',
		'cardigans',
		'skirts',
		'tops',
		'leggings',
		'trousers',
		'shorts',
		'bags',
		'wallets',
		'chains',
		'belts',
		'shoes',
		'dresses',
	] as const;

	const typeHandle = typeHandles.find((handle) => product.collections.includes(handle));
	if (typeHandle && department) {
		const label = typeHandle
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
		trail.push({ label, href: `/${department}/${typeHandle}` });
	}

	trail.push({ label: product.title });
	return trail;
}

export const products: Product[] = [];

export function getProductByHandle(handle: string): Product | undefined {
	return products.find((product) => product.handle === handle);
}

export function getAllProductHandles(): string[] {
	return products.map((product) => product.handle);
}

export function getProductsByCollection(collection: CollectionHandle): Product[] {
	return products.filter((product) => product.collections.includes(collection));
}

/** @deprecated Prefer `getProductsByCollection` — kept for existing catalog pages. */
export function getProductsByCategory(category: CollectionHandle) {
	return getProductsByCollection(category);
}

export function getVariantForSize(product: Product, size: string): ProductVariant | undefined {
	return product.variants?.find((variant) => variant.size === size);
}

/** Normalize a size string for ranking (lower = smaller). */
function sizeSortKey(raw: string): number {
	const s = raw.trim().toLowerCase().replace(/[\s_\-]+/g, '');
	const named: Record<string, number> = {
		xxs: 10,
		xs: 20,
		s: 30,
		small: 30,
		m: 40,
		medium: 40,
		l: 50,
		large: 50,
		xl: 60,
		xlarge: 60,
		extralarge: 60,
		'1x': 60,
		xxl: 70,
		'2xl': 70,
		'2x': 70,
		xxxl: 80,
		'3xl': 80,
		'3x': 80,
		xxxxl: 90,
		'4xl': 90,
		'4x': 90,
		'5xl': 100,
		'5x': 100,
		'6xl': 110,
		'7xl': 120,
		'8xl': 130,
		onesize: 999,
		os: 999,
	};
	if (named[s] != null) return named[s];
	const match = s.match(/^(\d+)x(?:l)?$/);
	if (match) return 50 + Number(match[1]) * 10;
	return 500;
}

/** Compact label for badges: Small → S, XXL → 2XL, etc. */
function formatSizeBadgeLabel(raw: string): string {
	const s = raw.trim().toLowerCase().replace(/[\s_\-]+/g, '');
	const map: Record<string, string> = {
		xxs: 'XXS',
		xs: 'XS',
		s: 'S',
		small: 'S',
		m: 'M',
		medium: 'M',
		l: 'L',
		large: 'L',
		xl: 'XL',
		xlarge: 'XL',
		extralarge: 'XL',
		'1x': 'XL',
		xxl: '2XL',
		'2xl': '2XL',
		'2x': '2XL',
		xxxl: '3XL',
		'3xl': '3XL',
		'3x': '3XL',
		xxxxl: '4XL',
		'4xl': '4XL',
		'4x': '4XL',
		'5xl': '5XL',
		'5x': '5XL',
		'6xl': '6XL',
		'7xl': '7XL',
		'8xl': '8XL',
	};
	if (map[s]) return map[s];
	const match = s.match(/^(\d+)x(?:l)?$/);
	if (match) return `${match[1]}XL`;
	return raw.trim().toUpperCase();
}

/**
 * Smallest available size with a "+" — e.g. S/M/L → "S+", XL/2XL → "XL+".
 * Returns null when there are no real size options.
 */
export function getSizeBadgeLabel(sizes: string[]): string | null {
	const usable = sizes.filter((size) => {
		const key = size.trim().toLowerCase().replace(/[\s_\-]+/g, '');
		return key && key !== 'onesize' && key !== 'os' && key !== 'defaulttitle';
	});
	if (usable.length === 0) return null;

	const smallest = [...usable].sort((a, b) => sizeSortKey(a) - sizeSortKey(b))[0];
	return `${formatSizeBadgeLabel(smallest)}+`;
}
