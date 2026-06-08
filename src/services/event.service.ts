import { randomUUID } from "crypto";
import { AppSummary, IdentityEvent } from "../models/event.model";
import { IEventRepository } from "../repositories/interfaces/event.repository.interface";
import { EventFilters, GetEventsQuery, IdentityEventInput, Pagination } from "../schemas/event.schema";

export interface PaginatedEvents {
  data: IdentityEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export class EventService {
  constructor(private readonly repository: IEventRepository) {}

  /**
   * Transforms raw validated inputs into domain models,
   * assigns system IDs and receivedAt timestamps, then persists.
   */
  async ingestBatch(inputs: IdentityEventInput[]): Promise<IdentityEvent[]> {
    const now = new Date().toISOString();

    const events: IdentityEvent[] = inputs.map((input) => ({
      id: randomUUID(),
      userId: input.userId,
      appId: input.appId,
      action: input.action,
      timestamp: input.timestamp,
      metadata: input.metadata,
      receivedAt: now,
    }));

    return this.repository.saveMany(events);
  }

  async queryEvents(query: GetEventsQuery): Promise<PaginatedEvents> {
    const filters: EventFilters = {
      appId: query.appId,
      userId: query.userId,
      action: query.action,
      from: query.from,
      to: query.to,
    };
    const pagination: Pagination = { page: query.page, limit: query.limit };

    const { data, total } = await this.repository.findMany(filters, pagination);
    const totalPages = Math.ceil(total / pagination.limit);

    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPrevPage: pagination.page > 1,
      },
    };
  }

  async getAppSummary(appId: string): Promise<AppSummary | null> {
    return this.repository.getAppSummary(appId);
  }
}
