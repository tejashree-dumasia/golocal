import { z } from 'zod';

export const tripSchema = z.object({
    title: z.string().min(1, "Title is required").max(255),
    description: z.string().optional().nullable(),
    // Coerce allows strings like "5000" from FormData to be safely cast to numbers
    budget: z.coerce.number().positive("Budget must be a positive number").optional().nullable(),
});

export const locationSchema = z.object({
    name: z.string().min(1, "Location name is required").max(255),
    address: z.string().optional().nullable(),
    lat: z.coerce.number().optional().nullable(),
    lng: z.coerce.number().optional().nullable(),
    dayNumber: z.coerce.number().int().positive().default(1),
    sortOrder: z.coerce.number().int().default(0)
});

export const memberInviteSchema = z.object({
    name: z.string().min(1, "Name is required").max(255),
    // Accept valid emails, or an empty string for app-less users
    email: z.union([z.string().email("Invalid email format"), z.literal('')]).optional().nullable(),
    role: z.enum(['host', 'co_host', 'participant']).default('participant')
});

export const profileUpdateSchema = z.object({
    name: z.string().min(1, "Display name is required"),
    phone: z.string().max(20).optional().nullable(),
    altPhone: z.string().max(20).optional().nullable(),
    requireApproval: z.boolean().default(false)
});