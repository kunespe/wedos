import { ArrowUpDown, CircleX, Code, Database, Globe, History, KeyRound, MessageSquare, Receipt, Siren } from '@lucide/svelte';
import type { Component } from 'svelte';
import type { TicketCategory } from '#lib/constants.ts';

export const REQUEST_ICON: Record<TicketCategory, Component> = {
	general: MessageSquare,
	dns: Globe,
	database: Database,
	php: Code,
	access: KeyRound,
	restore: History,
	change_plan: ArrowUpDown,
	cancel: CircleX,
	billing: Receipt,
	incident: Siren
};
