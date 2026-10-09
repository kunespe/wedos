import { applyAction, type SubmitFunction } from '$app/forms';
import { refreshAll } from '$app/navigation';

/**
 * use:enhance callback that shows the action result before reloading page data. SvelteKit 3's default
 * order (reload, then apply) loses the success message when the reload re-renders the form.
 */
export const keepResult =
	(opts: { reset?: boolean; onDone?: () => void } = {}): SubmitFunction =>
	({ formElement }) =>
	async ({ result, update }) => {
		if (result.type === 'success') {
			if (opts.reset) formElement.reset();
			await applyAction(result);
			await refreshAll();
		} else {
			await update({ reset: false });
		}
		opts.onDone?.();
	};
