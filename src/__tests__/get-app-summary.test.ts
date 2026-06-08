import request from "supertest";
import { Application } from "express";
import { createApp } from "../app";
import { InMemoryEventRepository } from "../repositories/in-memory/event.in-memory.repository";
import { IEventRepository } from "../repositories/interfaces/event.repository.interface";
import { AppSummary } from "../models/event.model";

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
const getSummary = (appId: string) =>
  request(app).get(`/apps/${appId}/summary`);

const seedDataset = async () => {
  await request(app)
    .post("/events")
    .send({
      events: [
        { userId: "alice", appId: "app-1", action: "login",                timestamp: "2026-01-01T08:00:00.000Z" },
        { userId: "alice", appId: "app-1", action: "token_refresh",        timestamp: "2026-01-01T09:00:00.000Z" },
        { userId: "alice", appId: "app-1", action: "logout",               timestamp: "2026-01-01T10:00:00.000Z" },
        { userId: "bob",   appId: "app-1", action: "login",                timestamp: "2026-01-02T08:00:00.000Z" },
        { userId: "bob",   appId: "app-1", action: "privilege_escalation", timestamp: "2026-01-02T09:00:00.000Z" },
        { userId: "carol", appId: "app-2", action: "login",                timestamp: "2026-01-03T08:00:00.000Z" },
        { userId: "carol", appId: "app-2", action: "logout",               timestamp: "2026-01-03T09:00:00.000Z" },
      ],
    });
};

// ─── Response shape ───────────────────────────────────────────────────────────
describe("GET /apps/:appId/summary — response shape", () => {
  beforeEach(seedDataset);

  it("returns 200 with all expected fields", async () => {
    const res = await getSummary("app-1").expect(200);
    const body: AppSummary = res.body;

    expect(body.appId).toBe("app-1");
    expect(typeof body.totalEvents).toBe("number");
    expect(typeof body.uniqueUsers).toBe("number");
    expect(typeof body.lastSeenAt).toBe("string");
    expect(body.eventCountsByType).toBeDefined();
    expect(typeof body.eventCountsByType.login).toBe("number");
    expect(typeof body.eventCountsByType.logout).toBe("number");
    expect(typeof body.eventCountsByType.privilege_escalation).toBe("number");
    expect(typeof body.eventCountsByType.token_refresh).toBe("number");
  });
});

// ─── Aggregation correctness ──────────────────────────────────────────────────
describe("GET /apps/:appId/summary — aggregation", () => {
  beforeEach(seedDataset);

  it("counts total events for the app correctly", async () => {
    const res = await getSummary("app-1").expect(200);
    expect(res.body.totalEvents).toBe(5); // alice×3 + bob×2
  });

  it("counts unique users correctly", async () => {
    const res = await getSummary("app-1").expect(200);
    expect(res.body.uniqueUsers).toBe(2); // alice + bob
  });

  it("counts events by type correctly", async () => {
    const res = await getSummary("app-1").expect(200);
    expect(res.body.eventCountsByType).toEqual({
      login:                2, // alice + bob
      logout:               1, // alice
      privilege_escalation: 1, // bob
      token_refresh:        1, // alice
    });
  });

  it("returns zero for action types with no occurrences", async () => {
    const res = await getSummary("app-2").expect(200);
    expect(res.body.eventCountsByType.privilege_escalation).toBe(0);
    expect(res.body.eventCountsByType.token_refresh).toBe(0);
  });

  it("returns the most recent event timestamp as lastSeenAt", async () => {
    const res = await getSummary("app-1").expect(200);
    // bob's privilege_escalation at 09:00 is the latest for app-1
    expect(res.body.lastSeenAt).toBe("2026-01-02T09:00:00.000Z");
  });

  it("summarises a different app independently", async () => {
    const res = await getSummary("app-2").expect(200);
    expect(res.body.totalEvents).toBe(2);
    expect(res.body.uniqueUsers).toBe(1); // only carol
    expect(res.body.lastSeenAt).toBe("2026-01-03T09:00:00.000Z");
  });

  it("reflects newly ingested events immediately", async () => {
    const before = await getSummary("app-1").expect(200);
    expect(before.body.totalEvents).toBe(5);

    await request(app).post("/events").send({
      events: [
        { userId: "dave", appId: "app-1", action: "login", timestamp: "2026-01-04T08:00:00.000Z" },
      ],
    });

    const after = await getSummary("app-1").expect(200);
    expect(after.body.totalEvents).toBe(6);
    expect(after.body.uniqueUsers).toBe(3); // alice, bob, dave
    expect(after.body.lastSeenAt).toBe("2026-01-04T08:00:00.000Z");
  });
});

// ─── 404 handling ─────────────────────────────────────────────────────────────
describe("GET /apps/:appId/summary — 404", () => {
  it("returns 404 when the appId has no events", async () => {
    const res = await getSummary("unknown-app").expect(404);
    expect(res.body.error).toMatch(/unknown-app/);
  });

  it("returns 404 after all events for that app are cleared", async () => {
    await seedDataset();
    await repository.reset();

    await getSummary("app-1").expect(404);
  });
});
