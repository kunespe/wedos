// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: {
				id: number;
				email: string;
				name: string;
				role: 'admin' | 'client';
				customerId: number | null;
				hasTotp: boolean;
			} | null;
			sessionToken: string | null;
		}
	}
}

export {};
