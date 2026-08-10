/**
 * Shopify Storefront API client + product mapper.
 * Credentials come from .env (see .env.example).
 */

import type {
	CollectionHandle,
	Product,
	ProductImage,
	ProductMetafield,
	ProductVariant,
} from '../data/products';

type Money = { amount: string; currencyCode: string };

type ShopifyImage = {
	url: string;
	altText: string | null;
	width: number | null;
	height: number | null;
};

type ShopifyMetafield = {
	namespace: string;
	key: string;
	type: string;
	value: string;
};

type ShopifyProduct = {
	id: string;
	handle: string;
	title: string;
	description: string;
	descriptionHtml?: string;
	vendor: string;
	productType: string;
	tags: string[];
	featuredImage: ShopifyImage | null;
	images?: { nodes: ShopifyImage[] };
	options: Array<{ name: string; values: string[] }>;
	priceRange: { minVariantPrice: Money };
	compareAtPriceRange: { minVariantPrice: Money };
	collections: { nodes: Array<{ handle: string }> };
	metafields?: Array<ShopifyMetafield | null>;
	variants?: {
		nodes: Array<{
			id: string;
			title: string;
			availableForSale: boolean;
			selectedOptions: Array<{ name: string; value: string }>;
			price: Money;
			compareAtPrice: Money | null;
			image: ShopifyImage | null;
		}>;
	};
};

const KNOWN_COLLECTIONS = new Set<CollectionHandle>([
	'mens',
	'womens',
	'accessories',
	't-shirts',
	'zip-up-hoodies',
	'jackets',
	'bowling-shirts',
	'worker-shirts',
	'jumpers',
	'cardigans',
	'dresses',
	'skirts',
	'tops',
	'trousers',
	'leggings',
	'jumpsuits',
	'playsuits-jumpsuits',
	'shorts',
	'swimwear',
	'nightwear',
	'shoes',
	'bags',
	'wallets',
	'chains',
	'belts',
	'jewellery',
	'hair-accessories',
	'gifts',
	'xl-plus',
]);

const METAFIELD_IDENTIFIERS = [
	{ namespace: 'custom', key: 'material' },
	{ namespace: 'custom', key: 'condition' },
	{ namespace: 'custom', key: 'fit' },
	{ namespace: 'custom', key: 'details' },
	{ namespace: 'custom', key: 'size_guide_eyebrow' },
];

/** Card / grid fields — keep listings fast at hundreds of products. */
const PRODUCT_CARD_FIELDS = `
  id
  handle
  title
  description
  vendor
  productType
  tags
  featuredImage {
    url
    altText
    width
    height
  }
  options {
    name
    values
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  compareAtPriceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  collections(first: 20) {
    nodes {
      handle
    }
  }
`;

/** Full PDP fields — only fetched for a single product page. */
const PRODUCT_DETAIL_FIELDS = `
  ${PRODUCT_CARD_FIELDS}
  descriptionHtml
  images(first: 20) {
    nodes {
      url
      altText
      width
      height
    }
  }
  metafields(identifiers: [
    {namespace: "custom", key: "material"},
    {namespace: "custom", key: "condition"},
    {namespace: "custom", key: "fit"},
    {namespace: "custom", key: "details"},
    {namespace: "custom", key: "size_guide_eyebrow"}
  ]) {
    namespace
    key
    type
    value
  }
  variants(first: 50) {
    nodes {
      id
      title
      availableForSale
      selectedOptions {
        name
        value
      }
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
      image {
        url
        altText
        width
        height
      }
    }
  }
`;

const PRODUCTS_PAGE_QUERY = `
  query CatalogueProductsPage($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ${PRODUCT_CARD_FIELDS}
      }
    }
  }
`;

const FEATURED_PRODUCTS_QUERY = `
  query FeaturedProducts($first: Int!) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ${PRODUCT_CARD_FIELDS}
      }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      ${PRODUCT_DETAIL_FIELDS}
    }
  }
`;

const COLLECTION_PRODUCTS_PAGE_QUERY = `
  query CollectionProductsPage($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      handle
      products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ${PRODUCT_CARD_FIELDS}
        }
      }
    }
  }
`;

const PAGE_SIZE = 50;
/** Safety cap — 50 pages × 50 = 2,500 products. */
const MAX_PAGES = 50;

function getServerConfig() {
	const domain =
		import.meta.env.SHOPIFY_STORE_DOMAIN || import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN;
	const token =
		import.meta.env.SHOPIFY_STOREFRONT_TOKEN || import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
	const version =
		import.meta.env.SHOPIFY_API_VERSION ||
		import.meta.env.PUBLIC_SHOPIFY_API_VERSION ||
		'2025-01';

	return {
		domain: typeof domain === 'string' ? domain.trim() : '',
		token: typeof token === 'string' ? token.trim() : '',
		version: typeof version === 'string' ? version.trim() : '2025-01',
	};
}

export function isShopifyConfigured(): boolean {
	const { domain, token } = getServerConfig();
	return Boolean(domain && token);
}

export async function shopifyFetch<T>(
	query: string,
	variables?: Record<string, unknown>,
): Promise<T> {
	const { domain, token, version } = getServerConfig();
	if (!domain || !token) {
		throw new Error('Shopify Storefront credentials missing in .env');
	}

	const response = await fetch(`https://${domain}/api/${version}/graphql.json`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Shopify-Storefront-Access-Token': token,
		},
		body: JSON.stringify({ query, variables }),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Shopify HTTP ${response.status}: ${body.slice(0, 300)}`);
	}

	const json = (await response.json()) as {
		data?: T;
		errors?: Array<{ message: string }>;
	};

	if (json.errors?.length) {
		throw new Error(json.errors.map((error) => error.message).join('; '));
	}

	if (!json.data) {
		throw new Error('Shopify response missing data');
	}

	return json.data;
}

export function getShopifyStoreDomain(): string {
	return getServerConfig().domain;
}

const CUSTOMER_CREATE_MUTATION = `
  mutation CustomerCreate($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer { id email }
      customerUserErrors { field message code }
    }
  }
`;

/** Subscribe an email to marketing via Storefront customerCreate. */
export async function createMarketingCustomer(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
	type Result = {
		customerCreate: {
			customer: { id: string; email: string } | null;
			customerUserErrors: Array<{ field: string[] | null; message: string; code: string }>;
		};
	};

	const data = await shopifyFetch<Result>(CUSTOMER_CREATE_MUTATION, {
		input: {
			email,
			password: `Bgs${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}!`,
			acceptsMarketing: true,
		},
	});

	const errors = data.customerCreate.customerUserErrors;
	if (errors.length) {
		const already =
			errors.some((error) => /taken|already|exists/i.test(error.message)) ||
			errors.some((error) => error.code === 'TAKEN');
		if (already) return { ok: true };
		return { ok: false, message: errors.map((error) => error.message).join('; ') };
	}

	if (!data.customerCreate.customer) {
		return { ok: false, message: 'Could not create customer' };
	}

	return { ok: true };
}

/**
 * Forward a contact/suggestion to the Shopify store contact form.
 * Lands in Admin → Settings → Notifications / customer email inbox.
 */
export async function submitShopifyContactForm(input: {
	email: string;
	name?: string;
	body: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
	const domain = getShopifyStoreDomain();
	if (!domain) {
		return { ok: false, message: 'Shopify store domain is not configured' };
	}

	const params = new URLSearchParams();
	params.set('form_type', 'contact');
	params.set('utf8', '✓');
	params.set('contact[email]', input.email);
	params.set('contact[body]', input.body);
	if (input.name) params.set('contact[name]', input.name);

	const response = await fetch(`https://${domain}/contact`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'text/html',
		},
		body: params.toString(),
		redirect: 'manual',
	});

	// Shopify responds with 302 on success; 200/422 on validation issues.
	if (response.status >= 200 && response.status < 400) {
		return { ok: true };
	}

	return {
		ok: false,
		message: `Shopify contact form returned ${response.status}`,
	};
}

function moneyToNumber(money?: Money | null): number | null {
	if (!money?.amount) return null;
	const value = Number(money.amount);
	return Number.isFinite(value) ? value : null;
}

function stripHtml(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function mapCollections(product: ShopifyProduct): CollectionHandle[] {
	/** Shopify often auto-suffixes handles (mens-1) or singularises (t-shirt). */
	const handleAliases: Record<string, CollectionHandle> = {
		mens: 'mens',
		'mens-1': 'mens',
		'mens-2': 'mens',
		men: 'mens',
		womens: 'womens',
		'womens-1': 'womens',
		'womens-2': 'womens',
		women: 'womens',
		't-shirt': 't-shirts',
		't-shirts': 't-shirts',
		tee: 't-shirts',
		tees: 't-shirts',
		'zip-up-hoodie': 'zip-up-hoodies',
		'zip-up-hoodies': 'zip-up-hoodies',
		hoodie: 'zip-up-hoodies',
		hoodies: 'zip-up-hoodies',
		jacket: 'jackets',
		jackets: 'jackets',
		'bowling-shirt': 'bowling-shirts',
		'bowling-shirts': 'bowling-shirts',
		'worker-shirt': 'worker-shirts',
		'worker-shirts': 'worker-shirts',
		jumper: 'jumpers',
		jumpers: 'jumpers',
		cardigan: 'cardigans',
		cardigans: 'cardigans',
		dress: 'dresses',
		dresses: 'dresses',
		skirt: 'skirts',
		skirts: 'skirts',
		top: 'tops',
		tops: 'tops',
		trouser: 'trousers',
		trousers: 'trousers',
		legging: 'leggings',
		leggings: 'leggings',
		jumpsuit: 'jumpsuits',
		jumpsuits: 'jumpsuits',
		'playsuits-jumpsuits': 'playsuits-jumpsuits',
		short: 'shorts',
		shorts: 'shorts',
		swimwear: 'swimwear',
		nightwear: 'nightwear',
		shoe: 'shoes',
		shoes: 'shoes',
		bag: 'bags',
		bags: 'bags',
		wallet: 'wallets',
		wallets: 'wallets',
		chain: 'chains',
		chains: 'chains',
		belt: 'belts',
		belts: 'belts',
		jewellery: 'jewellery',
		jewelry: 'jewellery',
		'hair-accessories': 'hair-accessories',
		gifts: 'gifts',
		accessories: 'accessories',
		'xl-plus': 'xl-plus',
	};

	const fromCollections = product.collections.nodes
		.map((node) => handleAliases[node.handle.toLowerCase()])
		.filter((handle): handle is CollectionHandle => Boolean(handle));

	const tagMap: Record<string, CollectionHandle> = {
		mens: 'mens',
		"men's": 'mens',
		men: 'mens',
		womens: 'womens',
		"women's": 'womens',
		women: 'womens',
		accessories: 'accessories',
		't-shirts': 't-shirts',
		't-shirt': 't-shirts',
		tee: 't-shirts',
		tees: 't-shirts',
		'zip-up-hoodies': 'zip-up-hoodies',
		'zip up hoodies': 'zip-up-hoodies',
		hoodie: 'zip-up-hoodies',
		hoodies: 'zip-up-hoodies',
		jackets: 'jackets',
		jacket: 'jackets',
		'bowling-shirts': 'bowling-shirts',
		'bowling shirts': 'bowling-shirts',
		'worker-shirts': 'worker-shirts',
		'worker shirts': 'worker-shirts',
		jumpers: 'jumpers',
		jumper: 'jumpers',
		cardigans: 'cardigans',
		cardigan: 'cardigans',
		dresses: 'dresses',
		dress: 'dresses',
		skirts: 'skirts',
		skirt: 'skirts',
		tops: 'tops',
		top: 'tops',
		trousers: 'trousers',
		trouser: 'trousers',
		leggings: 'leggings',
		legging: 'leggings',
		jumpsuits: 'jumpsuits',
		jumpsuit: 'jumpsuits',
		'playsuits-jumpsuits': 'playsuits-jumpsuits',
		playsuit: 'playsuits-jumpsuits',
		shorts: 'shorts',
		short: 'shorts',
		swimwear: 'swimwear',
		nightwear: 'nightwear',
		shoes: 'shoes',
		bags: 'bags',
		bag: 'bags',
		wallets: 'wallets',
		wallet: 'wallets',
		chains: 'chains',
		chain: 'chains',
		belts: 'belts',
		belt: 'belts',
		jewellery: 'jewellery',
		jewelry: 'jewellery',
		'hair-accessories': 'hair-accessories',
		gifts: 'gifts',
		'xl-plus': 'xl-plus',
		'xl+': 'xl-plus',
		xl: 'xl-plus',
	};

	const fromTags = product.tags
		.map((tag) => tagMap[tag.trim().toLowerCase()])
		.filter((handle): handle is CollectionHandle => Boolean(handle));

	const type = product.productType.toLowerCase();
	const fromType: CollectionHandle[] = [];
	if (type.includes('hoodie') || type.includes('zip')) fromType.push('zip-up-hoodies');
	else if (type.includes('jacket')) fromType.push('jackets');
	else if (type.includes('t-shirt') || type.includes('tee')) fromType.push('t-shirts');
	else if (type.includes('bowling')) fromType.push('bowling-shirts');
	else if (type.includes('worker')) fromType.push('worker-shirts');
	else if (type.includes('jumper') || type.includes('sweater')) fromType.push('jumpers');
	else if (type.includes('cardigan')) fromType.push('cardigans');
	else if (type.includes('dress')) fromType.push('dresses');
	else if (type.includes('skirt')) fromType.push('skirts');
	else if (type.includes('legging')) fromType.push('leggings');
	else if (type.includes('trouser') || type.includes('jean')) fromType.push('trousers');
	else if (type.includes('jumpsuit') || type.includes('playsuit')) fromType.push('jumpsuits');
	else if (type.includes('short')) fromType.push('shorts');
	else if (type.includes('swim')) fromType.push('swimwear');
	else if (type.includes('shoe') || type.includes('pump')) fromType.push('shoes');
	else if (type.includes('bag')) fromType.push('bags');
	else if (type.includes('top') || type.includes('shirt')) fromType.push('tops');

	const merged = [...new Set([...fromCollections, ...fromTags, ...fromType])];
	if (
		merged.includes('mens') ||
		merged.includes('womens') ||
		product.tags.some((tag) => /xl|plus/i.test(tag))
	) {
		merged.push('xl-plus');
	}

	return [...new Set(merged)];
}

function mapSizes(product: ShopifyProduct): string[] {
	const sizeOption = product.options.find((option) => /size/i.test(option.name));
	if (sizeOption?.values?.length) return sizeOption.values;

	const fromVariants = (product.variants?.nodes || [])
		.map((variant) => {
			const size = variant.selectedOptions.find((option) => /size/i.test(option.name));
			return size?.value || (variant.title !== 'Default Title' ? variant.title : null);
		})
		.filter((value): value is string => Boolean(value));

	return [...new Set(fromVariants)];
}

function mapImages(product: ShopifyProduct): ProductImage[] {
	const nodes = product.images?.nodes?.length
		? product.images.nodes
		: product.featuredImage
			? [product.featuredImage]
			: [];

	return nodes.map((image, index) => ({
		src: image.url,
		alt: image.altText || `${product.title} image ${index + 1}`,
		label: index === 0 ? 'Front' : `View ${index + 1}`,
		fit: index === 0 ? 'cover' : 'contain',
	}));
}

function mapMetafields(product: ShopifyProduct): ProductMetafield[] {
	const labels: Record<string, string> = {
		material: 'Material',
		condition: 'Condition',
		fit: 'Fit',
		details: 'Details',
		size_guide_eyebrow: 'Size guide',
	};

	return (product.metafields || [])
		.filter((field): field is ShopifyMetafield => Boolean(field))
		.map((field) => ({
			namespace: field.namespace,
			key: field.key,
			type: field.type,
			value: field.value,
			label: labels[field.key] || field.key.replace(/_/g, ' '),
		}));
}

function mapDetails(product: ShopifyProduct, metafields: ProductMetafield[]): string[] {
	const detailsField = metafields.find(
		(field) => field.namespace === 'custom' && field.key === 'details',
	);

	if (detailsField?.value) {
		try {
			const parsed = JSON.parse(detailsField.value);
			if (Array.isArray(parsed)) return parsed.map(String);
		} catch {
			return detailsField.value
				.split(/\r?\n|•/g)
				.map((line) => line.trim())
				.filter(Boolean);
		}
	}

	const bullets: string[] = [];
	if (product.vendor) bullets.push(`Brand · ${product.vendor}`);
	if (product.productType) bullets.push(product.productType);
	const material = metafields.find((field) => field.key === 'material');
	if (material) bullets.push(`Material: ${material.value}`);
	return bullets;
}

function mapVariants(product: ShopifyProduct): ProductVariant[] {
	return (product.variants?.nodes || []).map((variant) => {
		const size =
			variant.selectedOptions.find((option) => /size/i.test(option.name))?.value ||
			(variant.title !== 'Default Title' ? variant.title : 'One Size');

		return {
			id: variant.id,
			size,
			price: moneyToNumber(variant.price) ?? 0,
			compareAtPrice: moneyToNumber(variant.compareAtPrice),
			available: variant.availableForSale,
			imageSrc: variant.image?.url,
		};
	});
}

export function mapShopifyProduct(product: ShopifyProduct): Product {
	const metafields = mapMetafields(product);
	const variants = mapVariants(product);
	const images = mapImages(product);
	const price = moneyToNumber(product.priceRange.minVariantPrice) ?? variants[0]?.price ?? 0;
	const compareAt = moneyToNumber(product.compareAtPriceRange.minVariantPrice);
	const currency = (product.priceRange.minVariantPrice.currencyCode || 'GBP') as Product['currencyCode'];
	const description =
		product.description?.trim() ||
		stripHtml(product.descriptionHtml || '').slice(0, 220) ||
		product.title;

	return {
		handle: product.handle,
		title: product.title,
		description,
		descriptionHtml: product.descriptionHtml || `<p>${description}</p>`,
		vendor: product.vendor || 'Bad Girls Should',
		productType: product.productType || 'Apparel',
		tags: product.tags || [],
		price,
		compareAtPrice: compareAt && compareAt > price ? compareAt : null,
		currencyCode: currency === 'GBP' ? 'GBP' : 'GBP',
		images:
			images.length > 0
				? images
				: [
						{
							src: 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png',
							alt: product.title,
							label: 'Front',
							fit: 'cover',
						},
					],
		sizes: mapSizes(product),
		collections: mapCollections(product),
		details: mapDetails(product, metafields),
		metafields,
		variants,
		source: 'shopify',
	};
}

type ProductsConnection = {
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
	nodes: ShopifyProduct[];
};

async function fetchAllProductPages(
	fetchPage: (after: string | null) => Promise<ProductsConnection | null>,
): Promise<Product[]> {
	const all: Product[] = [];
	let after: string | null = null;

	for (let page = 0; page < MAX_PAGES; page += 1) {
		const connection = await fetchPage(after);
		if (!connection) break;

		all.push(...connection.nodes.map(mapShopifyProduct));
		if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) break;
		after = connection.pageInfo.endCursor;
	}

	return all;
}

/** Lightweight paginated catalogue for grids / filters (scales past 100 products). */
export async function fetchShopifyProducts(): Promise<Product[]> {
	if (!isShopifyConfigured()) return [];

	return fetchAllProductPages(async (after) => {
		const data = await shopifyFetch<{ products: ProductsConnection }>(PRODUCTS_PAGE_QUERY, {
			first: PAGE_SIZE,
			after,
		});
		return data.products;
	});
}

/** Homepage showcase — only the newest N card payloads. */
export async function fetchShopifyFeaturedProducts(limit = 4): Promise<Product[]> {
	if (!isShopifyConfigured()) return [];

	const data = await shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>(
		FEATURED_PRODUCTS_QUERY,
		{ first: Math.max(1, Math.min(limit, 24)) },
	);

	return data.products.nodes.map(mapShopifyProduct);
}

/** Full product for PDP — one product, not the whole catalogue. */
export async function fetchShopifyProductByHandle(handle: string): Promise<Product | null> {
	if (!isShopifyConfigured() || !handle) return null;

	const data = await shopifyFetch<{ product: ShopifyProduct | null }>(PRODUCT_BY_HANDLE_QUERY, {
		handle,
	});

	return data.product ? mapShopifyProduct(data.product) : null;
}

/** Products in a Shopify collection (paginated, card fields). */
export async function fetchShopifyCollectionProducts(handle: string): Promise<Product[]> {
	if (!isShopifyConfigured() || !handle) return [];

	return fetchAllProductPages(async (after) => {
		const data = await shopifyFetch<{
			collection: { products: ProductsConnection } | null;
		}>(COLLECTION_PRODUCTS_PAGE_QUERY, {
			handle,
			first: PAGE_SIZE,
			after,
		});
		return data.collection?.products ?? null;
	});
}

export type ShopifyPage = {
	handle: string;
	title: string;
	body: string;
	bodySummary: string;
};

/** Fetch a Shopify Online Store / Content page by handle (e.g. "events"). */
export async function fetchShopifyPage(handle: string): Promise<ShopifyPage | null> {
	if (!isShopifyConfigured()) return null;

	try {
		const data = await shopifyFetch<{
			page: { handle: string; title: string; body: string; bodySummary: string } | null;
		}>(
			`
      query PageByHandle($handle: String!) {
        page(handle: $handle) {
          handle
          title
          body
          bodySummary
        }
      }
    `,
			{ handle },
		);

		return data.page;
	} catch (error) {
		console.warn(`[shopify] Failed to load page "${handle}"`, error);
		return null;
	}
}

/** Unused but documents which metafields we request. */
export const requestedMetafields = METAFIELD_IDENTIFIERS;
