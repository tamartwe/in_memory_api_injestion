import { Action, EventMetadata } from "../schemas/event.schema";

/**
 * The persisted domain model — extends the raw input with
 * system-assigned fields set at ingestion time.
 */
export interface IdentityEvent {
  id: string;
  userId: string;
  appId: string;
  action: Action;
  timestamp: string;
  metadata: EventMetadata;
  receivedAt: string; // server-side ingestion timestamp (ISO 8601)
}

/**
 * Per-app aggregate returned by GET /apps/:appId/summary.
 */
export interface AppSummary {
  appId: string;
  totalEvents: number;
  uniqueUsers: number;
  eventCountsByType: Record<Action, number>;
  lastSeenAt: string; // ISO 8601 timestamp of the most recent event
}
