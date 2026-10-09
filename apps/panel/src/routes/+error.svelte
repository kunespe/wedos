<script lang="ts">
	import { page } from '$app/state';
	import Button from '#lib/components/Button.svelte';

	// One rack unit with an LCD: the status code on the display, a short Czech line under it.
	const copy: Record<number, { title: string; text: string }> = {
		403: { title: 'Sem nemáte přístup', text: 'Tahle část panelu patří jinému účtu nebo roli. Když jste tu čekali svá data, přihlaste se správným účtem.' },
		404: { title: 'Stránka nenalezena', text: 'Tahle adresa v panelu neexistuje, nebo položka mezitím zmizela.' },
		500: { title: 'Něco se pokazilo', text: 'Chyba je na naší straně a už o ní víme. Zkuste to za chvíli znovu.' }
	};

	const status = $derived(page.status);
	const info = $derived(copy[status] ?? (status >= 500 ? copy[500] : { title: 'Požadavek se nepovedl', text: 'Zkuste to prosím znovu.' }));
	// 4xx messages come from error(4xx, 'Czech text') in our loads and are safe to show;
	// a 5xx message is internal, so only the generic line goes out.
	// SvelteKit's own "Not Found: /path" and a message that only repeats the title are skipped.
	const detail = $derived.by(() => {
		const msg = page.error?.message?.trim();
		if (status >= 500 || !msg || /^not found/i.test(msg) || msg.replace(/\.$/, '') === info.title) return null;
		return msg;
	});
	const tone = $derived(status >= 500 ? 'bg-[#ef4444]' : 'bg-amber');
</script>

<svelte:head><title>{status} {info.title} · SERVEROS</title></svelte:head>

<div class="grid min-h-[70dvh] place-items-center bg-bg px-4 py-12">
	<div class="w-full max-w-[520px]">
		<div class="mb-6 font-extrabold tracking-[0.14em]" style="font-variation-settings: 'wdth' 118">SERVEROS</div>

		<div class="flex items-center gap-3 rounded-[6px] bg-chassis px-4 py-4 text-white shadow-[0_24px_48px_-28px_rgba(18,22,27,.6)]">
			<p
				class="mono flex flex-1 items-center gap-2.5 rounded-[3px] bg-[#140f06] px-3 py-2 text-[13px] text-amber shadow-[inset_0_0_0_1px_#000]"
				style="text-shadow: 0 0 6px rgba(255,180,59,.6)"
			>
				<span class="size-2 rounded-full {tone}" aria-hidden="true"></span>
				<span>chyba {status}</span>
			</p>
			<span class="hidden gap-1.5 sm:flex" aria-hidden="true">
				{#each Array(5) as _, j (j)}<span class="h-5 w-3 rounded-[2px] bg-chassis-2"></span>{/each}
			</span>
		</div>

		<h1 class="mt-8 text-[28px] leading-tight font-extrabold tracking-[-0.01em]">{info.title}</h1>
		<p class="mt-2 text-sm text-muted">{info.text}</p>
		{#if detail}<p class="mt-2 text-sm">{detail}</p>{/if}

		<div class="mt-6 flex flex-wrap gap-2">
			<Button href="/" variant="primary">Zpět do panelu</Button>
			<Button href="/stav">Stav služeb</Button>
		</div>
		<p class="mt-6 text-xs text-muted">
			Pomoc? Napište na <a class="underline" href="mailto:info@serveros.cz">info@serveros.cz</a>.
		</p>
	</div>
</div>
