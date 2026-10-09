import { hash, verify } from '@node-rs/argon2';

// OWASP-recommended argon2id parameters.
const OPTIONS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

export const hashPassword = (password: string) => hash(password, OPTIONS);

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
	try {
		return await verify(passwordHash, password);
	} catch {
		return false;
	}
}

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: string): string | null {
	if (password.length < 12) return 'Heslo musí mít alespoň 12 znaků.';
	if (password.length > 200) return 'Heslo je příliš dlouhé.';
	return null;
}
