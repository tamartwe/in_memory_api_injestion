import request from "supertest";
import { Application } from "express";
import { createApp } from "../app";
import { InMemoryEventRepository } from "../repositories/in-memory/event.in-memory.repository";
import { IEventRepository } from "../repositories/interfaces/event.repository.interface";
import { IdentityEvent } from "../models/event.model";
import { PaginatedEvents } from "../services/event.service";

// ─── Test setup ──────────────────────────────────────────────────────────────
let app: Application;
let repository: IEventRepository;

beforeAll(() => {
  repository = new InMemoryEventRepository();
  app = createApp({ eventRepository: repository });
});

afterEach(async () => {
  await repository.reset();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const get = (query: Record<string, string | number> = {}) =>
  request(app).get("/events").query(query);

/** Seed a fixed dataset before tests that need pre-existing data */
const seedDataset = async () => {
  await request(app)
    .post("/events")
    .send({
      events: [
        { userId: "alice", appId: "app-1", action: "login",                timestamp: "2026-01-01T08:00:00.000Z" },
        { userId: "alice", appId: "app-1", action: "token_refresh",        timestamp: "2026-01-01T09:00:00.000Z" },
        { userId: "bob",   appId: "app-1", action: "login",                timestamp: "2026-01-02T08:00:00.000Z" },
        { userId: "bob",   appId: "app-2", action: "privilege_escalation", timestamp: "2026-01-02T10:00:00.000Z" },
        { userId: "carol", appId: "app-2", action: "logout",               timestamp: "2026-01-03T08:00:00.000Z" },
        { userId: "carol", appId: "app-2", action: "login",                timestamp: "2026-01-03T09:00:00.000Z" },
      ],
    });
};

// ─── Response shape ───────────────────────────────────────────────────────────
describe("GET /events — response shape", () => {
  beforeEach(seedDataset);

  it("returns 200 with data array and pagination envelope", async () => {
    const res = await get().expect(200);
    const body: PaginatedEvents = res.body;

    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
      hasNextPage: expect.any(Boolean),
      hasPrevPage: expect.any(Boolean),
    });
  });

  it("returns events sorted by timestamp descending (most recent first)", async () => {
    const res = await get().expect(200);
    const timestamps: string[] = res.body.data.map((e: IdentityEvent) => e.timestamp);

    for (let i = 1; i < timestamps.length; i++) {
      expect(new Date(timestamps[i - 1]).getTime()).toBeGreaterThanOrEqual(
        new Date(timestamps[i]).getTime()
      );
    }
  });
});

// ─── Filtering ────────────────────────────────────────────────────────────────
describe("GET /events — filtering", () => {
  beforeEach(seedDataset);

  it("filters by appId", async () => {
    const res = await get({ appId: "app-1" }).expect(200);

    expect(res.body.data.every((e: IdentityEvent) => e.appId === "app-1")).toBe(true);
    expect(res.body.pagination.total).toBe(3);
  });

  it("filters by userId", async () => {
    const res = await get({ userId: "alice" }).expect(200);

    expect(res.body.data.every((e: IdentityEvent) => e.userId === "alice")).toBe(true);
    expect(res.body.pagination.total).toBe(2);
  });

  it("filters by action", async () => {
    const res = await get({ action: "login" }).expect(200);

    expect(res.body.data.every((e: IdentityEvent) => e.action === "login")).toBe(true);
    expect(res.body.pagination.total).toBe(3);
  });

  it("filters by appId + userId together", async () => {
    const res = await get({ appId: "app-1", userId: "alice" }).expect(200);

    expect(res.body.pagination.total).toBe(2);
    res.body.data.forEach((e: IdentityEvent) => {
      expect(e.appId).toBe("app-1");
      expect(e.userId).toBe("alice");
    });
  });

  it("filters by from (inclusive lower bound on timestamp)", async () => {
    const res = await get({ from: "2026-01-02T00:00:00.000Z" }).expect(200);

    res.body.data.forEach((e: IdentityEvent) => {
      expect(new Date(e.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date("2026-01-02T00:00:00.000Z").getTime()
      );
    });
    expect(res.body.pagination.total).toBe(4);
  });

  it("filters by to (inclusive upper bound on timestamp)", async () => {
    const res = await get({ to: "2026-01-01T23:59:59.000Z" }).expect(200);

    res.body.data.forEach((e: IdentityEvent) => {
      expect(new Date(e.timestamp).getTime()).toBeLessThanOrEqual(
        new Date("2026-01-01T23:59:59.000Z").getTime()
      );
    });
    expect(res.body.pagination.total).toBe(2);
  });

  it("filters by from + to time range", async () => {
    const res = await get({
      from: "2026-01-02T00:00:00.000Z",
      to:   "2026-01-02T23:59:59.000Z",
    }).expect(200);

    expect(res.body.pagination.total).toBe(2);
  });

  it("returns empty data array when filters match nothing", async () => {
    const res = await get({ userId: "nobody" }).expect(200);

    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.totalPages).toBe(0);
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────
describe("GET /events — pagination", () => {
  beforeEach(seedDataset);

  it("respects the limit param", async () => {
    const res = await get({ limit: 2 }).expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.limit).toBe(2);
  });

  it("returns correct page 1 defaults (page=1, limit=20)", async () => {
    const res = await get().expect(200);

    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(20);
    expect(res.body.pagination.hasPrevPage).toBe(false);
  });

  it("pages through results correctly", async () => {
    const page1 = await get({ limit: 2, page: 1 }).expect(200);
    const page2 = await get({ limit: 2, page: 2 }).expect(200);
    const page3 = await get({ limit: 2, page: 3 }).expect(200);

    expect(page1.body.data).toHaveLength(2);
    expect(page2.body.data).toHaveLength(2);
    expect(page3.body.data).toHaveLength(2);

    // No event appears on two pages
    const ids1 = page1.body.data.map((e: IdentityEvent) => e.id);
    const ids2 = page2.body.data.map((e: IdentityEvent) => e.id);
    const ids3 = page3.body.data.map((e: IdentityEvent) => e.id);
    const allIds = [...ids1, ...ids2, ...ids3];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("sets hasNextPage=true when more results exist", async () => {
    const res = await get({ limit: 2, page: 1 }).expect(200);

    expect(res.body.pagination.hasNextPage).toBe(true);
    expect(res.body.pagination.totalPages).toBe(3);
  });

  it("sets hasNextPage=false on the last page", async () => {
    const res = await get({ limit: 2, page: 3 }).expect(200);

    expect(res.body.pagination.hasNextPage).toBe(false);
    expect(res.body.pagination.hasPrevPage).toBe(true);
  });

  it("returns empty data for a page beyond the last", async () => {
    const res = await get({ limit: 10, page: 99 }).expect(200);

    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.hasNextPage).toBe(false);
  });

  it("calculates totalPages correctly", async () => {
    const res = await get({ limit: 4 }).expect(200);

    // 6 events / limit 4 → 2 pages
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.pagination.total).toBe(6);
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────
describe("GET /events — query param validation", () => {
  it("returns 400 for invalid action value", async () => {
    const res = await get({ action: "fly" }).expect(400);

    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "action" }),
      ])
    );
  });

  it("returns 400 for invalid from timestamp", async () => {
    const res = await get({ from: "not-a-date" }).expect(400);

    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "from",
          message: "from must be an ISO 8601 datetime string",
        }),
      ])
    );
  });

  it("returns 400 for invalid to timestamp", async () => {
    const res = await get({ to: "not-a-date" }).expect(400);

    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "to" }),
      ])
    );
  });

  it("returns 400 when limit exceeds 100", async () => {
    const res = await get({ limit: 101 }).expect(400);

    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "limit", message: "limit must be <= 100" }),
      ])
    );
  });

  it("returns 400 when page is less than 1", async () => {
    const res = await get({ page: 0 }).expect(400);

    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "page", message: "page must be >= 1" }),
      ])
    );
  });
});
