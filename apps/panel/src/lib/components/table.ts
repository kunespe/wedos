export type Column<R> = {
	label: string;
	sort?: (row: R) => string | number | null;
	align?: 'right';
	class?: string;
};
