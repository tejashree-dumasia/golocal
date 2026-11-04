import { pgTable, varchar, text, decimal, boolean, timestamp, uuid, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(), // Firebase UID
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  phone: varchar('phone', { length: 20 }),
  altPhone: varchar('alt_phone', { length: 20 }),
  requireApproval: boolean('require_approval').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const trips = pgTable('trips', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  budget: decimal('budget', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tripMembers = pgTable('trip_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  tripId: uuid('trip_id').references(() => trips.id).notNull(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id), // Nullable for placeholders
  displayName: varchar('display_name', { length: 255 }).notNull(),
  inviteEmail: varchar('invite_email', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('participant'), // host, co_host, participant
  status: varchar('status', { length: 50 }).notNull().default('accepted'), // pending, accepted, declined
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tripLocations = pgTable('trip_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tripId: uuid('trip_id').references(() => trips.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: integer('sort_order').notNull(),
  lat: decimal('lat', { precision: 10, scale: 7 }),
  lng: decimal('lng', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const photos = pgTable('photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  tripId: uuid('trip_id').references(() => trips.id).notNull(),
  uploaderId: varchar('uploader_id', { length: 128 }).references(() => users.id).notNull(),
  imageUrl: varchar('image_url', { length: 512 }).notNull(),
  visibility: text('visibility').array().notNull().default(['ALL']),
  createdAt: timestamp('created_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  tripId: uuid('trip_id').references(() => trips.id).notNull(),
  senderId: varchar('sender_id', { length: 128 }).references(() => users.id).notNull(),
  content: text('content').notNull(),
  isAlert: boolean('is_alert').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});