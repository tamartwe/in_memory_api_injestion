import { z } from "zod";

export const ActionSchema = z.enum([
  "login",
  "logout",
  "privilege_escalation",
  "token_refresh",
]);

export const EventMetadataSchema = z.record(z.string(), z.unknown());

export const IdentityEventInputSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  appId: z.string().min(1, "appId is required"),
  action: ActionSchema,
  timestamp: z.iso.datetime({ error: "timestamp must be an ISO 8601 datetime string" }),
  metadata: EventMetadataSchema.optional().default({}),
});

export const BatchIngestRequestSchema = z.object({
  events: z
    .array(IdentityEventInputSchema)
    .min(1, "events array must contain at least one event")
    .max(1000, "events batch cannot exceed 1000 items"),
});

export const EventFiltersSchema = z.object({
  appId: z.string().optional(),
  userId: z.string().optional(),
  action: ActionSchema.optional(),
  from: z.iso.datetime({ error: "from must be an ISO 8601 datetime string" }).optional(),
  to: z.iso.datetime({ error: "to must be an ISO 8601 datetime string" }).optional(),
});

export const PaginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, "page must be >= 1")
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "limit must be >= 1")
    .max(100, "limit must be <= 100")
    .default(20),
});

export const GetEventsQuerySchema = EventFiltersSchema.merge(PaginationSchema);

// Inferred TypeScript types — single source of truth
export type Action = z.infer<typeof ActionSchema>;
export type EventMetadata = z.infer<typeof EventMetadataSchema>;
export type IdentityEventInput = z.infer<typeof IdentityEventInputSchema>;
export type BatchIngestRequest = z.infer<typeof BatchIngestRequestSchema>;
export type EventFilters = z.infer<typeof EventFiltersSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type GetEventsQuery = z.infer<typeof GetEventsQuerySchema>;
