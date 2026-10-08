import { relations } from 'drizzle-orm';
import {
	bigint,
	boolean,
	date,
	datetime,
	index,
	int,
	json,
	mysqlEnum,
	mysqlTable,
	text,
	uniqueIndex,
	varchar
} from 'drizzle-orm/mysql-core';
import { ORDER_STATUSES, SERVICE_KINDS, SERVICE_STATUSES, TICKET_STATUSES } from '../../constants.ts';

const id = () => int('id').primaryKey().autoincrement();
const createdAt = () => datetime('created_at', { mode: 'date' }).notNull().$defaultFn(() => new Date());
const updatedAt = () =>
	datetime('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date());

export const customers = mysqlTable('customers', {
	id: id(),
	name: varchar('name', { length: 160 }).notNull(),
	company: varchar('company', { length: 160 }).notNull().default(''),
	ico: varchar('ico', { length: 16 }).notNull().default(''),
	dic: varchar('dic', { length: 20 }).notNull().default(''),
	address: varchar('address', { length: 255 }).notNull().default(''),
	email: varchar('email', { length: 254 }).notNull(),
	phone: varchar('phone', { length: 32 }).notNull().default(''),
	note: text('note'),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const users = mysqlTable(
	'users',
	{
		id: id(),
		email: varchar('email', { length: 254 }).notNull(),
		name: varchar('name', { length: 160 }).notNull(),
		role: mysqlEnum('role', ['admin', 'client']).notNull(),
		customerId: int('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
		// Null until the invite has been accepted.
		passwordHash: varchar('password_hash', { length: 255 }),
		totpSecret: varchar('totp_secret', { length: 64 }),
		disabled: boolean('disabled').notNull().default(false),
		lastLoginAt: datetime('last_login_at', { mode: 'date' }),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('users_email').on(t.email)]
);

export const sessions = mysqlTable(
	'sessions',
	{
		// SHA-256 of the cookie token, hex.
		id: varchar('id', { length: 64 }).primaryKey(),
		userId: int('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: datetime('expires_at', { mode: 'date' }).notNull(),
		// False while the user still has to pass the TOTP step.
		verified: boolean('verified').notNull().default(false),
		ip: varchar('ip', { length: 64 }).notNull().default(''),
		createdAt: createdAt()
	},
	(t) => [index('sessions_user').on(t.userId)]
);

export const invites = mysqlTable('invites', {
	// SHA-256 of the invite token, hex.
	id: varchar('id', { length: 64 }).primaryKey(),
	userId: int('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	purpose: mysqlEnum('purpose', ['invite', 'reset']).notNull().default('invite'),
	expiresAt: datetime('expires_at', { mode: 'date' }).notNull(),
	usedAt: datetime('used_at', { mode: 'date' }),
	createdAt: createdAt()
});

export const loginFailures = mysqlTable(
	'login_failures',
	{
		id: id(),
		ip: varchar('ip', { length: 64 }).notNull(),
		email: varchar('email', { length: 254 }).notNull().default(''),
		at: datetime('at', { mode: 'date' }).notNull().$defaultFn(() => new Date())
	},
	(t) => [index('login_failures_ip_at').on(t.ip, t.at)]
);

export const plans = mysqlTable('plans', {
	code: varchar('code', { length: 40 }).primaryKey(),
	category: varchar('category', { length: 40 }).notNull(),
	kind: mysqlEnum('kind', SERVICE_KINDS).notNull(),
	name: varchar('name', { length: 80 }).notNull(),
	// Price in CZK excl. VAT; null means individual quote.
	monthly: int('monthly'),
	priceFrom: boolean('price_from').notNull().default(false),
	features: json('features').$type<string[]>().notNull(),
	active: boolean('active').notNull().default(true),
	sort: int('sort').notNull().default(0)
});

export const nodes = mysqlTable('nodes', {
	id: id(),
	name: varchar('name', { length: 80 }).notNull(),
	host: varchar('host', { length: 120 }).notNull(),
	provider: varchar('provider', { length: 40 }).notNull().default('Hetzner'),
	location: varchar('location', { length: 40 }).notNull().default(''),
	// Only the node the panel runs on can be operated through the local broker.
	local: boolean('local').notNull().default(false),
	note: text('note'),
	createdAt: createdAt()
});

export const orders = mysqlTable(
	'orders',
	{
		id: id(),
		status: mysqlEnum('status', ORDER_STATUSES).notNull().default('new'),
		planCode: varchar('plan_code', { length: 40 }).notNull(),
		period: mysqlEnum('period', ['month', 'year']).notNull(),
		domain: varchar('domain', { length: 253 }).notNull().default(''),
		domainMode: mysqlEnum('domain_mode', ['own', 'register', 'none']).notNull().default('none'),
		name: varchar('name', { length: 160 }).notNull(),
		email: varchar('email', { length: 254 }).notNull(),
		phone: varchar('phone', { length: 32 }).notNull().default(''),
		company: varchar('company', { length: 160 }).notNull().default(''),
		ico: varchar('ico', { length: 16 }).notNull().default(''),
		dic: varchar('dic', { length: 20 }).notNull().default(''),
		address: varchar('address', { length: 255 }).notNull().default(''),
		note: text('note'),
		// Price at the time of ordering, so later catalog changes do not rewrite history.
		priceMonthly: int('price_monthly'),
		assigneeId: int('assignee_id').references(() => users.id, { onDelete: 'set null' }),
		customerId: int('customer_id').references(() => customers.id, { onDelete: 'set null' }),
		ip: varchar('ip', { length: 64 }).notNull().default(''),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('orders_status').on(t.status)]
);

export const orderNotes = mysqlTable('order_notes', {
	id: id(),
	orderId: int('order_id')
		.notNull()
		.references(() => orders.id, { onDelete: 'cascade' }),
	authorId: int('author_id').references(() => users.id, { onDelete: 'set null' }),
	body: text('body').notNull(),
	createdAt: createdAt()
});

export const services = mysqlTable(
	'services',
	{
		id: id(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'restrict' }),
		planCode: varchar('plan_code', { length: 40 }).references(() => plans.code),
		kind: mysqlEnum('kind', SERVICE_KINDS).notNull(),
		label: varchar('label', { length: 160 }).notNull(),
		domain: varchar('domain', { length: 253 }).notNull().default(''),
		nodeId: int('node_id').references(() => nodes.id, { onDelete: 'set null' }),
		status: mysqlEnum('status', SERVICE_STATUSES).notNull().default('pending'),
		period: mysqlEnum('period', ['month', 'year']).notNull().default('year'),
		priceMonthly: int('price_monthly'),
		// CloudPanel site domain the broker operates on; empty for services outside CloudPanel.
		cloudpanelSite: varchar('cloudpanel_site', { length: 253 }).notNull().default(''),
		fakturorSubscriptionId: int('fakturor_subscription_id'),
		expiresAt: date('expires_at', { mode: 'string' }),
		manualHold: boolean('manual_hold').notNull().default(false),
		// Probe this service's URL from blackbox monitoring.
		monitored: boolean('monitored').notNull().default(true),
		orderId: int('order_id').references(() => orders.id, { onDelete: 'set null' }),
		note: text('note'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('services_customer').on(t.customerId), index('services_status').on(t.status)]
);

export const domains = mysqlTable(
	'domains',
	{
		id: id(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'restrict' }),
		name: varchar('name', { length: 253 }).notNull(),
		registrar: varchar('registrar', { length: 60 }).notNull().default('Subreg'),
		// True when we pay the registry; false when the customer keeps the domain elsewhere.
		managedByUs: boolean('managed_by_us').notNull().default(true),
		expiresAt: date('expires_at', { mode: 'string' }),
		note: text('note'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('domains_name').on(t.name)]
);

export const tickets = mysqlTable(
	'tickets',
	{
		id: id(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'cascade' }),
		serviceId: int('service_id').references(() => services.id, { onDelete: 'set null' }),
		subject: varchar('subject', { length: 200 }).notNull(),
		status: mysqlEnum('status', TICKET_STATUSES).notNull().default('open'),
		createdById: int('created_by_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('tickets_customer').on(t.customerId), index('tickets_status').on(t.status)]
);

export const ticketMessages = mysqlTable('ticket_messages', {
	id: id(),
	ticketId: int('ticket_id')
		.notNull()
		.references(() => tickets.id, { onDelete: 'cascade' }),
	authorId: int('author_id').references(() => users.id, { onDelete: 'set null' }),
	// Internal notes are visible to admins only.
	internal: boolean('internal').notNull().default(false),
	body: text('body').notNull(),
	createdAt: createdAt()
});

export const auditLog = mysqlTable(
	'audit_log',
	{
		id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
		actorId: int('actor_id').references(() => users.id, { onDelete: 'set null' }),
		action: varchar('action', { length: 60 }).notNull(),
		subject: varchar('subject', { length: 120 }).notNull().default(''),
		details: text('details'),
		ip: varchar('ip', { length: 64 }).notNull().default(''),
		createdAt: createdAt()
	},
	(t) => [index('audit_created').on(t.createdAt)]
);

export const customersRelations = relations(customers, ({ many }) => ({
	users: many(users),
	services: many(services),
	domains: many(domains),
	tickets: many(tickets)
}));
export const usersRelations = relations(users, ({ one }) => ({
	customer: one(customers, { fields: [users.customerId], references: [customers.id] })
}));
export const servicesRelations = relations(services, ({ one }) => ({
	customer: one(customers, { fields: [services.customerId], references: [customers.id] }),
	plan: one(plans, { fields: [services.planCode], references: [plans.code] }),
	node: one(nodes, { fields: [services.nodeId], references: [nodes.id] })
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
	plan: one(plans, { fields: [orders.planCode], references: [plans.code] }),
	assignee: one(users, { fields: [orders.assigneeId], references: [users.id] }),
	customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
	notes: many(orderNotes)
}));
export const orderNotesRelations = relations(orderNotes, ({ one }) => ({
	order: one(orders, { fields: [orderNotes.orderId], references: [orders.id] }),
	author: one(users, { fields: [orderNotes.authorId], references: [users.id] })
}));
export const ticketsRelations = relations(tickets, ({ one, many }) => ({
	customer: one(customers, { fields: [tickets.customerId], references: [customers.id] }),
	service: one(services, { fields: [tickets.serviceId], references: [services.id] }),
	messages: many(ticketMessages)
}));
export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
	ticket: one(tickets, { fields: [ticketMessages.ticketId], references: [tickets.id] }),
	author: one(users, { fields: [ticketMessages.authorId], references: [users.id] })
}));
export const domainsRelations = relations(domains, ({ one }) => ({
	customer: one(customers, { fields: [domains.customerId], references: [customers.id] })
}));
export const auditRelations = relations(auditLog, ({ one }) => ({
	actor: one(users, { fields: [auditLog.actorId], references: [users.id] })
}));
