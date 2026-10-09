<script lang="ts">
	// The landing's drive lights, shrunk to a status dot.
	type State = 'ok' | 'act' | 'warn' | 'bad' | 'off';
	let { state = 'off', pulse = false, label }: { state?: State; pulse?: boolean; label?: string } = $props();
</script>

<span class="led led--{state}" class:pulse role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}></span>

<style>
	.led {
		display: inline-block;
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--line);
	}
	.led--ok {
		background: var(--color-led);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-led) 22%, transparent);
	}
	.led--act {
		background: var(--color-cable);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-cable) 22%, transparent);
	}
	.led--warn {
		background: var(--color-amber);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-amber) 25%, transparent);
	}
	.led--bad {
		background: #ef4444;
		box-shadow: 0 0 0 3px color-mix(in srgb, #ef4444 22%, transparent);
	}
	.pulse {
		animation: blink 1.6s steps(2, jump-none) infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0.35;
		}
	}
</style>
