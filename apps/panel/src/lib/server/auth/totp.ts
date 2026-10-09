import { createTOTPKeyURI, verifyTOTPWithGracePeriod } from '@oslojs/otp';
import { decodeBase64, encodeBase64 } from '@oslojs/encoding';

export function newTotpSecret(): string {
	const key = new Uint8Array(20);
	crypto.getRandomValues(key);
	return encodeBase64(key);
}

export const totpUri = (secret: string, email: string) =>
	createTOTPKeyURI('SERVERO', email, decodeBase64(secret), 30, 6);

/** Accepts the previous and next 30 s window to tolerate clock drift. */
export function verifyTotp(secret: string, code: string): boolean {
	if (!/^\d{6}$/.test(code)) return false;
	return verifyTOTPWithGracePeriod(decodeBase64(secret), 30, 6, code, 30);
}
