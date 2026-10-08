<script lang="ts">
	import { Globe, Layers, LayoutDashboard, LifeBuoy, Receipt, UserRound } from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import type { NavGroup } from '#lib/components/nav.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const groups: NavGroup[] = $derived([
		{
			items: [
				{ href: '/app', label: 'Přehled', icon: LayoutDashboard, exact: true },
				{ href: '/app/sluzby', label: 'Služby', icon: Layers },
				{ href: '/app/domeny', label: 'Domény', icon: Globe },
				{ href: '/app/faktury', label: 'Faktury', icon: Receipt },
				{ href: '/app/podpora', label: 'Podpora', icon: LifeBuoy, badge: data.badges.waiting },
				{ href: '/app/ucet', label: 'Účet', icon: UserRound }
			]
		}
	]);
</script>

<AppShell {groups} user={data.user} area="klient">
	{@render children()}
</AppShell>
