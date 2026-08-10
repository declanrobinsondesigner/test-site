/**
 * Site navigation + collection route config.
 * Handles must match Shopify collection URL handles.
 */

export type Department = 'mens' | 'womens';

export type NavCollection = {
	label: string;
	handle: string;
};

/** Men's submenu — order matches client brief */
export const mensNavCollections: NavCollection[] = [
	{ label: 'T-Shirts', handle: 't-shirts' },
	{ label: 'Zip Up Hoodies', handle: 'zip-up-hoodies' },
	{ label: 'Jackets', handle: 'jackets' },
	{ label: 'Bowling Shirts', handle: 'bowling-shirts' },
	{ label: 'Worker Shirts', handle: 'worker-shirts' },
	{ label: 'Jumpers', handle: 'jumpers' },
	{ label: 'Tops', handle: 'tops' },
	{ label: 'Trousers', handle: 'trousers' },
	{ label: 'Shorts', handle: 'shorts' },
	{ label: 'Wallets', handle: 'wallets' },
	{ label: 'Chains', handle: 'chains' },
	{ label: 'Shoes', handle: 'shoes' },
];

/** Women's submenu — order matches client brief */
export const womensNavCollections: NavCollection[] = [
	{ label: 'Jumpsuits', handle: 'jumpsuits' },
	{ label: 'T-Shirts', handle: 't-shirts' },
	{ label: 'Zip Up Hoodies', handle: 'zip-up-hoodies' },
	{ label: 'Jackets', handle: 'jackets' },
	{ label: 'Bowling Shirts', handle: 'bowling-shirts' },
	{ label: 'Worker Shirts', handle: 'worker-shirts' },
	{ label: 'Jumpers', handle: 'jumpers' },
	{ label: 'Cardigans', handle: 'cardigans' },
	{ label: 'Skirts', handle: 'skirts' },
	{ label: 'Tops', handle: 'tops' },
	{ label: 'Leggings', handle: 'leggings' },
	{ label: 'Trousers', handle: 'trousers' },
	{ label: 'Shorts', handle: 'shorts' },
	{ label: 'Bags', handle: 'bags' },
	{ label: 'Wallets', handle: 'wallets' },
	{ label: 'Chains', handle: 'chains' },
	{ label: 'Belts', handle: 'belts' },
];

/**
 * Brands always listed under Brands nav.
 * Shopify Vendor field should match these names (or close — we slugify).
 * No brand collections required in Shopify — vendor drives this.
 */
export const knownBrands = [
	'Rusty Pistons',
	'Rumble59',
	'Hotrod Hellcat',
	'King & Queen Kerosin',
	'King Kerosin',
	'Queen Kerosin',
	'Liquorbrand',
	'Steady Clothing',
	'Killstar',
	'Hell Bunny',
	'Jawbreaker',
	'Voodoo Vixen',
	'Kreepsville 666',
	'True Blood',
	'Addiction',
	'Sourpuss',
];

export function slugifyBrand(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** Merge curated brands with live Shopify vendors for the Brands nav. */
export function buildBrandNav(liveVendors: string[] = []): NavCollection[] {
	const bySlug = new Map<string, string>();

	for (const name of knownBrands) {
		bySlug.set(slugifyBrand(name), name);
	}
	for (const name of liveVendors) {
		const trimmed = name.trim();
		if (!trimmed) continue;
		const slug = slugifyBrand(trimmed);
		// Prefer live Shopify vendor spelling when present
		bySlug.set(slug, trimmed);
	}

	return [...bySlug.entries()]
		.map(([handle, label]) => ({ handle, label }))
		.sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveBrandLabel(handle: string, liveVendors: string[] = []): string {
	const fromLive = liveVendors.find((v) => slugifyBrand(v) === handle);
	if (fromLive) return fromLive;
	const fromKnown = knownBrands.find((b) => slugifyBrand(b) === handle);
	return fromKnown ?? handle.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getNavCollections(department: Department): NavCollection[] {
	return department === 'mens' ? mensNavCollections : womensNavCollections;
}

export function getCollectionLabel(department: Department, handle: string): string | undefined {
	return getNavCollections(department).find((item) => item.handle === handle)?.label;
}

/** Shuffle and pick related category cards for product pages. */
export function getRelatedCategoryCards(
	department: Department,
	excludeHandle?: string,
	count = 3,
): Array<{ tag: string; title: string; href: string; description: string; cta: string }> {
	const pool = getNavCollections(department).filter((item) => item.handle !== excludeHandle);
	const shuffled = [...pool];

	for (let i = shuffled.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	const departmentLabel = department === 'mens' ? "Men's" : "Women's";
	const picked = shuffled.slice(0, count).map((item) => ({
		tag: item.label.split(' ')[0],
		title: item.label,
		href: `/${department}/${item.handle}`,
		description: `Shop ${departmentLabel.toLowerCase()} ${item.label.toLowerCase()} — alt attire with attitude, from standard sizes to XL+.`,
		cta: `Shop ${item.label} →`,
	}));

	while (picked.length < count) {
		if (picked.length === 0 || !picked.some((card) => card.href === `/${department}`)) {
			picked.push({
				tag: departmentLabel,
				title: departmentLabel,
				href: `/${department}`,
				description:
					department === 'mens'
						? 'Bigger fits, same edge — tees, jackets, and hot rod styles in XL and beyond.'
						: 'Dresses, tops, skirts and more — alt fashion that fits without watering down the look.',
				cta: `Shop ${departmentLabel} →`,
			});
			continue;
		}
		picked.push({
			tag: 'Range',
			title: 'Shop the Full Range',
			href: '/range',
			description: 'Browse everything in one place — new drops and alt accessories added often.',
			cta: 'Explore Range →',
		});
		break;
	}

	return picked.slice(0, count);
}

export const allCollectionHandles = [
	'mens',
	'womens',
	'accessories',
	...new Set([
		...mensNavCollections.map((item) => item.handle),
		...womensNavCollections.map((item) => item.handle),
		'jewellery',
		'hair-accessories',
		'gifts',
		'nightwear',
		'swimwear',
		'dresses',
		'playsuits-jumpsuits',
	]),
] as const;

export type SiteCollectionHandle = (typeof allCollectionHandles)[number];
