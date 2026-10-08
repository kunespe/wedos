<script lang="ts">
	import { Moon, Sun, SunMoon } from '@lucide/svelte';
	type Theme = 'system' | 'light' | 'dark';
	let theme = $state<Theme>('system');

	$effect(() => {
		try {
			const t = localStorage.getItem('servero-theme');
			if (t === 'light' || t === 'dark') theme = t;
		} catch {}
	});

	function cycle() {
		theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
		const root = document.documentElement;
		if (theme === 'system') delete root.dataset.theme;
		else root.dataset.theme = theme;
		try {
			if (theme === 'system') localStorage.removeItem('servero-theme');
			else localStorage.setItem('servero-theme', theme);
		} catch {}
	}
	const label = $derived({ system: 'Motiv podle systému', light: 'Světlý motiv', dark: 'Tmavý motiv' }[theme]);
</script>

<button
	type="button"
	onclick={cycle}
	title={label}
	aria-label={label}
	class="grid size-8 place-items-center rounded-[6px] text-white/60 hover:bg-white/10 hover:text-white"
>
	{#if theme === 'light'}<Sun size={16} />{:else if theme === 'dark'}<Moon size={16} />{:else}<SunMoon size={16} />{/if}
</button>
