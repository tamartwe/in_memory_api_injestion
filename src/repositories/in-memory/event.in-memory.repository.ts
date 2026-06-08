import { AppSummary, IdentityEvent } from "../../models/event.model";
import { Action, EventFilters, Pagination } from "../../schemas/event.schema";
import { FindManyResult, IEventRepository } from "../interfaces/event.repository.interface";

/**
 * In-memory implementation of IEventRepository.
 *
 * Swap this out for a PostgresEventRepository without
 * touching any service or controller code.
 */
export class InMemoryEventRepository implements IEventRepository {
  // Central in-memory store — replace with a DB connection in a real implementation
  private readonly store: IdentityEvent[] = [];

  async saveMany(events: IdentityEvent[]): Promise<IdentityEvent[]> {
    this.store.push(...events);
    return events;
  }

  async findMany(filters: EventFilters, pagination: Pagination): Promise<FindManyResult> {
    const { appId, userId, action, from, to } = filters;
    const fromMs = from ? new Date(from).getTime() : undefined;
    const toMs = to ? new Date(to).getTime() : undefined;

    const matched = this.store.filter((e) => {
      if (appId && e.appId !== appId) return false;
      if (userId && e.userId !== userId) return false;
      if (action && e.action !== action) return false;
      const ts = new Date(e.timestamp).getTime();
      if (fromMs !== undefined && ts < fromMs) return false;
      if (toMs !== undefined && ts > toMs) return false;
      return true;
    });

    // Most recent events first
    matched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    const data = matched.slice(offset, offset + limit);

    return { data, total: matched.length };
  }

  async getAppSummary(appId: string): Promise<AppSummary | null> {
    const appEvents = this.store.filter((e) => e.appId === appId);
    if (appEvents.length === 0) return null;

    const uniqueUsers = new Set(appEvents.map((e) => e.userId)).size;

    const eventCountsByType = appEvents.reduce<Record<Action, number>>(
      (acc, e) => {
        acc[e.action] = (acc[e.action] ?? 0) + 1;
        return acc;
      },
      { login: 0, logout: 0, privilege_escalation: 0, token_refresh: 0 }
    );

    const lastSeenAt = appEvents.reduce(
      (latest, e) => (e.timestamp > latest ? e.timestamp : latest),
      appEvents[0].timestamp
    );

    return { appId, totalEvents: appEvents.length, uniqueUsers, eventCountsByType, lastSeenAt };
  }

  async reset(): Promise<void> {
    this.store.length = 0;
  }

  getStore(): Readonly<IdentityEvent[]> {
    return this.store;
  }
}
