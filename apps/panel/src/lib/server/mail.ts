import nodemailer from 'nodemailer';
import { MAIL_FROM, SMTP_URL } from '$app/env/private';

const transport = SMTP_URL ? nodemailer.createTransport(SMTP_URL) : null;

/** Sends a plain-text e-mail; without SMTP configured it is printed to the log. Never throws. */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
	if (!to) return false;
	if (!transport) {
		console.info(`[mail] SMTP_URL not set; would send to ${to}: ${subject}\n${text}`);
		return false;
	}
	try {
		await transport.sendMail({ from: MAIL_FROM || 'SERVERO <info@servero.cz>', to, subject, text });
		return true;
	} catch (e) {
		console.error('[mail] sending failed', e);
		return false;
	}
}
