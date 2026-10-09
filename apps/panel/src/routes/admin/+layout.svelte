<script lang="ts">
	import {
		Activity,
		Archive,
		Banknote,
		ClipboardList,
		CreditCard,
		Gauge,
		Globe,
		HardDrive,
		History,
		LayoutDashboard,
		LifeBuoy,
		Layers,
		Server,
		ShieldCheck,
		Tags,
		Users
	} from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import type { NavGroup } from '#lib/components/nav.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const groups: NavGroup[] = $derived([
		{
			items: [
				{ href: '/admin', label: 'Přehled', icon: LayoutDashboard, exact: true },
				{ href: '/admin/objednavky', label: 'Objednávky', icon: ClipboardList, badge: data.badges.orders },
				{ href: '/admin/tikety', label: 'Podpora', icon: LifeBuoy, badge: data.badges.tickets },
				{ href: '/admin/platby', label: 'Platby', icon: Banknote, badge: data.badges.overduePayments }
			]
		},
		{
			label: 'Zákazníci',
			items: [
				{ href: '/admin/zakaznici', label: 'Zákazníci', icon: Users },
				{ href: '/admin/sluzby', label: 'Služby', icon: Layers },
				{ href: '/admin/domeny', label: 'Domény', icon: Globe }
			]
		},
		{
			label: 'Server',
			items: [
				{ href: '/admin/server', label: 'Uzel a služby', icon: Server },
				{ href: '/admin/weby', label: 'Weby a aplikace', icon: HardDrive },
				{ href: '/admin/wordpress', label: 'WordPress', icon: ShieldCheck },
				{ href: '/admin/zalohy', label: 'Zálohy', icon: Archive }
			]
		},
		{
			label: 'Provoz',
			items: [
				{ href: '/admin/fakturace', label: 'Fakturace', icon: CreditCard },
				{ href: '/admin/monitoring', label: 'Monitoring', icon: Gauge },
				{ href: '/admin/cenik', label: 'Ceník', icon: Tags },
				{ href: '/admin/spravci', label: 'Správci', icon: Activity },
				{ href: '/admin/audit', label: 'Historie', icon: History }
			]
		}
	]);
</script>

<AppShell {groups} user={data.user} area="admin" searchUrl="/admin/hledat">
	{@render children()}
</AppShell>
