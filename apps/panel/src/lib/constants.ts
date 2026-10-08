// Enums shared by the database schema and the UI.
export const SERVICE_KINDS = ['web', 'wp', 'app', 'vps', 'management', 'domain'] as const;
export const ORDER_STATUSES = ['new', 'contacted', 'provisioning', 'done', 'cancelled'] as const;
export const SERVICE_STATUSES = ['pending', 'active', 'suspended', 'cancelled'] as const;
export const TICKET_STATUSES = ['open', 'waiting', 'closed'] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'paid', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Structured requests a client can file instead of a free-form ticket; the team carries them out by hand.
export const TICKET_CATEGORIES = [
	'general',
	'dns',
	'database',
	'php',
	'access',
	'restore',
	'change_plan',
	'cancel',
	'billing',
	'incident'
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
