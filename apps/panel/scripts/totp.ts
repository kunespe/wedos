// Prints the current TOTP code for the dev admin (or a base64 secret given as argument).
import { generateTOTP } from '@oslojs/otp';
import { decodeBase64 } from '@oslojs/encoding';

console.log(generateTOTP(decodeBase64(process.argv[2] ?? 'c2VydmVyby1kZXYtdG90cC1rZXk='), 30, 6));
