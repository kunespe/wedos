import type { Component } from 'svelte';

/** `soon` marks a section that is announced but not live yet; it renders a quiet "brzy" tag. */
export type NavItem = { href: string; label: string; icon: Component; badge?: number; exact?: boolean; soon?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };
