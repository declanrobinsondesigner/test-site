/**
 * Catalogue loader — Shopify products preferred; local samples only as offline fallback.
 * Listings use lightweight card payloads; PDPs fetch one full product by handle.
 */
import {
	type CollectionHandle,
	type Product,
	products as localProducts,
} from './products';
import {
	fetchShopifyCollectionProducts,
	fetchShopifyFeaturedProducts,
	fetchShopifyProductByHandle,
	fetchShopifyProducts,
	isShopifyConfigured,
} from '../lib/shopify';
import { resolveBrandLabel, slugifyBrand } from './navigation';

let cachedCatalogue: Product[] | null = null;
let cacheTimestamp = 0;
const CACHE_MS = 5 * 60 * 1000; // 5 minutes — keeps grids snappy under load

const collectionCache = new Map<string, { products: Product[]; timestamp: number }>();
const productCache = new Map<string, { product: Product; timestamp: number }>();

function isFresh(timestamp: number): boolean {
	return Date.now() - timestamp < CACHE_MS;
}

export async function getCatalogueProducts(options?: { force?: boolean }): Promise<Product[]> {
	const now = Date.now();
	if (!options?.force && cachedCatalogue && now - cacheTimestamp < CACHE_MS) {
		return cachedCatalogue;
	}

	if (isShopifyConfigured()) {
		try {
			const shopifyProducts = await fetchShopifyProducts();
			cachedCatalogue = shopifyProducts;
			cacheTimestamp = now;
			if (shopifyProducts.length === 0) {
				console.warn(
					'[catalogue] Shopify connected but returned 0 products. Publish products to the Storefront/Headless sales channel.',
				);
			}
			return shopifyProducts;
		} catch (error) {
			console.warn('[catalogue] Shopify fetch failed — using local fallback.', error);
		}
	}

	cachedCatalogue = localProducts;
	cacheTimestamp = now;
	return localProducts;
}

/** Newest products only — used by homepage showcase. */
export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
	if (isShopifyConfigured()) {
		try {
			const featured = await fetchShopifyFeaturedProducts(limit);
			if (featured.length > 0) return featured;
		} catch (error) {
			console.warn('[catalogue] Featured fetch failed — falling back to catalogue slice.', error);
		}
	}

	const catalogue = await getCatalogueProducts();
	return catalogue.slice(0, limit);
}

export async function getCatalogueProductByHandle(handle: string): Promise<Product | undefined> {
	const key = handle.trim().toLowerCase();
	if (!key) return undefined;

	const cached = productCache.get(key);
	if (cached && isFresh(cached.timestamp)) {
		return cached.product;
	}

	if (isShopifyConfigured()) {
		try {
			const product = await fetchShopifyProductByHandle(handle);
			if (product) {
				productCache.set(key, { product, timestamp: Date.now() });
				return product;
			}
		} catch (error) {
			console.warn(`[catalogue] Product "${handle}" fetch failed — trying catalogue.`, error);
		}
	}

	const catalogue = await getCatalogueProducts();
	return catalogue.find((product) => product.handle === handle);
}

export async function getCatalogueHandles(): Promise<string[]> {
	const catalogue = await getCatalogueProducts();
	return catalogue.map((product) => product.handle);
}

export async function getCatalogueByCollection(collection: CollectionHandle): Promise<Product[]> {
	const cached = collectionCache.get(collection);
	if (cached && isFresh(cached.timestamp)) {
		return cached.products;
	}

	if (isShopifyConfigured()) {
		try {
			const fromShopify = await fetchShopifyCollectionProducts(collection);
			if (fromShopify.length > 0) {
				collectionCache.set(collection, { products: fromShopify, timestamp: Date.now() });
				return fromShopify;
			}
		} catch (error) {
			console.warn(
				`[catalogue] Collection "${collection}" fetch failed — filtering full catalogue.`,
				error,
			);
		}
	}

	const catalogue = await getCatalogueProducts();
	return catalogue.filter((product) => product.collections.includes(collection));
}

/** Products in a department (mens/womens), optionally also in a type collection. */
export async function getCatalogueByDepartment(
	department: 'mens' | 'womens',
	typeHandle?: string,
): Promise<Product[]> {
	const departmentProducts = await getCatalogueByCollection(department);
	if (!typeHandle) return departmentProducts;
	return departmentProducts.filter((product) =>
		product.collections.includes(typeHandle as CollectionHandle),
	);
}

export async function getCatalogueByVendor(vendor: string): Promise<Product[]> {
	const catalogue = await getCatalogueProducts();
	const needle = vendor.trim().toLowerCase();
	return catalogue.filter((product) => product.vendor.trim().toLowerCase() === needle);
}

export async function getCatalogueByVendorSlug(
	slug: string,
): Promise<{ vendor: string; products: Product[] }> {
	const catalogue = await getCatalogueProducts();
	const products = catalogue.filter(
		(product) => product.vendor?.trim() && slugifyBrand(product.vendor) === slug,
	);
	const liveVendors = [
		...new Set(catalogue.map((p) => p.vendor?.trim()).filter(Boolean) as string[]),
	];
	const vendor = products[0]?.vendor?.trim() || resolveBrandLabel(slug, liveVendors);
	return { vendor, products };
}

export async function getCatalogueVendors(): Promise<string[]> {
	const catalogue = await getCatalogueProducts();
	const vendors = new Set<string>();
	for (const product of catalogue) {
		if (product.vendor?.trim()) vendors.add(product.vendor.trim());
	}
	return [...vendors].sort((a, b) => a.localeCompare(b));
}
