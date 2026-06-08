import { AppSummary, IdentityEvent } from "../../models/event.model";
import { Action, EventFilters, Pagination } from "../../schemas/event.schema";
import { FindManyResult, IEventRepository } from "../interfaces/event.repository.interface";
import logger from "../../logger";

const log = logger.child({ module: "InMemoryEventRepository" });

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
    try {
      log.debug({ count: events.length }, "saveMany — persisting events");
      this.store.push(...events);
      log.debug({ count: events.length, storeSize: this.store.length }, "saveMany — complete");
      return events;
    } catch (err) {
      log.error({ err, count: events.length }, "saveMany — failed");
      throw err;
    }
  }

  async findMany(filters: EventFilters, pagination: Pagination): Promise<FindManyResult> {
    try {
      log.debug({ filters, pagination }, "findMany — executing query");

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

      log.debug({ total: matched.length, returned: data.length, page, limit }, "findMany — complete");
      return { data, total: matched.length };
    } catch (err) {
      log.error({ err, filters, pagination }, "findMany — failed");
      throw err;
    }
  }

  async getAppSummary(appId: string): Promise<AppSummary | null> {
    try {
      log.debug({ appId }, "getAppSummary — executing query");

      const appEvents = this.store.filter((e) => e.appId === appId);

      if (appEvents.length === 0) {
        log.debug({ appId }, "getAppSummary — no events found for app");
        return null;
      }

      const uniqueUsers = new Set(appEvents.map((e) => e.userId)).size;

      const eventCountsByType = appEvents.reduce<Record<Action, number>>(
        (acc, e) => {
          acc[e.action] = (acc[e.action] ?? 0) + 1;
          return acc;
        },
        { login: 0, logout: 0, privilege_escalation: 0, token_refresh: 0 }
      );

    const lastSeenAt = appEvents.reduce(
      (latest, e) =>
        new Date(e.timestamp).getTime() > new Date(latest).getTime() ? e.timestamp : latest,
      appEvents[0].timestamp
    );

      const summary = { appId, totalEvents: appEvents.length, uniqueUsers, eventCountsByType, lastSeenAt };
      log.debug({ appId, totalEvents: summary.totalEvents, uniqueUsers }, "getAppSummary — complete");
      return summary;
    } catch (err) {
      log.error({ err, appId }, "getAppSummary — failed");
      throw err;
    }
  }

  async reset(): Promise<void> {
    this.store.length = 0;
  }
}
