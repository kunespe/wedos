// Enums shared by the database schema and the UI.
export const SERVICE_KINDS = ['web', 'wp', 'app', 'vps', 'management', 'domain'] as const;
export const ORDER_STATUSES = ['new', 'contacted', 'provisioning', 'done', 'cancelled'] as const;
export const SERVICE_STATUSES = ['pending', 'active', 'suspended', 'cancelled'] as const;
export const TICKET_STATUSES = ['open', 'waiting', 'closed'] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
