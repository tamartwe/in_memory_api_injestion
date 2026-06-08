import { AppSummary, IdentityEvent } from "../../models/event.model";
import { EventFilters, Pagination } from "../../schemas/event.schema";

export interface FindManyResult {
  data: IdentityEvent[];
  total: number;
}

/**
 * The repository contract.
 * Business logic depends only on this interface —
 * never on a concrete implementation.
 * Swap InMemoryEventRepository for PostgresEventRepository
 * by changing a single line in the DI wiring (app.ts).
 */
export interface IEventRepository {
  /**
   * Persist a batch of events atomically.
   * Returns the saved events with their assigned IDs.
   */
  saveMany(events: IdentityEvent[]): Promise<IdentityEvent[]>;

  /**
   * Query events with optional filters and cursor-style pagination.
   * Returns the matching page and the total count of matched records
   * (needed to calculate totalPages on the service layer).
   */
  findMany(filters: EventFilters, pagination: Pagination): Promise<FindManyResult>;

  /**
   * Aggregate stats for a single app.
   * Returns null when no events exist for that appId.
   */
  getAppSummary(appId: string): Promise<AppSummary | null>;

  /**
   * Remove all persisted events.
   * In-memory: clears the array.
   * Postgres: would be a DELETE or TRUNCATE (test schema only).
   */
  reset(): Promise<void>;
}
