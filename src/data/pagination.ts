/** Shared product-grid pagination — keeps listing pages light at scale. */

export const PRODUCTS_PER_PAGE = 24;

export type PageResult<T> = {
	items: T[];
	page: number;
	perPage: number;
	total: number;
	totalPages: number;
	from: number;
	to: number;
	hasPrev: boolean;
	hasNext: boolean;
};

export function parsePageParam(value: string | null | undefined): number {
	const n = Number(value);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.floor(n);
}

export function paginate<T>(
	items: T[],
	page: number,
	perPage: number = PRODUCTS_PER_PAGE,
): PageResult<T> {
	const total = items.length;
	const totalPages = Math.max(1, Math.ceil(total / perPage) || 1);
	const current = Math.min(Math.max(1, page), totalPages);
	const start = (current - 1) * perPage;
	const slice = items.slice(start, start + perPage);

	return {
		items: slice,
		page: current,
		perPage,
		total,
		totalPages,
		from: total === 0 ? 0 : start + 1,
		to: start + slice.length,
		hasPrev: current > 1,
		hasNext: current < totalPages,
	};
}

/** Build a same-path URL with ?page=N (omits page=1). */
export function pageHref(pathname: string, page: number, currentSearch?: URLSearchParams): string {
	const params = new URLSearchParams(currentSearch);
	if (page <= 1) params.delete('page');
	else params.set('page', String(page));
	const query = params.toString();
	return query ? `${pathname}?${query}` : pathname;
}

/** Compact page number list with ellipses for large catalogues. */
export function visiblePageNumbers(current: number, totalPages: number): Array<number | '…'> {
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
	if (current <= 3) {
		pages.add(2);
		pages.add(3);
		pages.add(4);
	}
	if (current >= totalPages - 2) {
		pages.add(totalPages - 1);
		pages.add(totalPages - 2);
		pages.add(totalPages - 3);
	}

	const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
	const result: Array<number | '…'> = [];
	let prev = 0;
	for (const page of sorted) {
		if (prev && page - prev > 1) result.push('…');
		result.push(page);
		prev = page;
	}
	return result;
}
