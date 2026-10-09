import type { Component } from 'svelte';
import type { BrandName } from '../brands.ts';

/**
 * `soon` marks a section that is announced but not live yet; it renders a quiet "brzy" tag.
 * `brand` swaps the icon for that product's official mark, drawn in the text colour.
 */
export type NavItem = { href: string; label: string; icon: Component; badge?: number; exact?: boolean; soon?: boolean; brand?: BrandName };
export type NavGroup = { label?: string; items: NavItem[] };
