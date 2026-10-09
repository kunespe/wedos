import type { Component } from 'svelte';

export type NavItem = { href: string; label: string; icon: Component; badge?: number; exact?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };
