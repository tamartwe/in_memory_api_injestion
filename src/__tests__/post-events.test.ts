import request from "supertest";
import { Application } from "express";
import { createApp } from "../app";
import { InMemoryEventRepository } from "../repositories/in-memory/event.in-memory.repository";
import { IEventRepository } from "../repositories/interfaces/event.repository.interface";
import { IdentityEvent } from "../models/event.model";
import { seedEvents, validEvent } from "./fixtures/event.fixtures";

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
const post = (body: object | string) =>
  request(app).post("/events").send(body);

const seedDataset = async () => {
  await request(app)
    .post("/events")
    .send({ events: seedEvents })
    .expect(201);
};

// ─── Happy path ──────────────────────────────────────────────────────────────
describe("POST /events — success", () => {
  beforeEach(seedDataset);

  it("ingests a single valid event and returns 201 with the saved event", async () => {
    const res = await post({ events: [validEvent()] }).expect(201);

    expect(res.body.ingested).toBe(1);
    expect(res.body.events).toHaveLength(1);

    const saved: IdentityEvent = res.body.events[0];
    expect(saved.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(saved.userId).toBe("user-123");
    expect(saved.appId).toBe("app-abc");
    expect(saved.action).toBe("login");
    expect(saved.timestamp).toBe("2026-06-08T10:00:00.000Z");
    expect(saved.receivedAt).toBeDefined();
    expect(new Date(saved.receivedAt).toISOString()).toBe(saved.receivedAt);
  });

  it("ingests a batch of multiple events and returns correct count", async () => {
    const batch = [
      validEvent({ userId: "u1", action: "login" }),
      validEvent({ userId: "u2", action: "logout" }),
      validEvent({ userId: "u3", action: "token_refresh" }),
    ];

    const res = await post({ events: batch }).expect(201);

    expect(res.body.ingested).toBe(3);
    expect(res.body.events).toHaveLength(3);
    expect(res.body.events.map((e: IdentityEvent) => e.userId)).toEqual(["u1", "u2", "u3"]);
  });

  it("accepts all four valid action types", async () => {
    const actions = ["login", "logout", "privilege_escalation", "token_refresh"] as const;

    for (const action of actions) {
      const res = await post({ events: [validEvent({ action })] }).expect(201);
      expect(res.body.events[0].action).toBe(action);
    }
  });

  it("defaults metadata to an empty object when omitted", async () => {
    const { metadata: _omitted, ...eventWithoutMeta } = validEvent();

    const res = await post({ events: [eventWithoutMeta] }).expect(201);

    expect(res.body.events[0].metadata).toEqual({});
  });

  it("persists events independently from the seed data", async () => {
    const before = await request(app).get("/events").expect(200);
    const totalBefore: number = before.body.pagination.total; // 3 from beforeEach

    await post({ events: [validEvent({ userId: "new-user" })] }).expect(201);

    const after = await request(app).get("/events").expect(200);
    expect(after.body.pagination.total).toBe(totalBefore + 1);
  });

  it("assigns a unique id to every event in the batch", async () => {
    const batch = [validEvent({ userId: "u1" }), validEvent({ userId: "u2" })];

    const res = await post({ events: batch }).expect(201);

    const ids = res.body.events.map((e: IdentityEvent) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Validation errors ───────────────────────────────────────────────────────
describe("POST /events — validation errors", () => {
  it("returns 400 when events array is missing", async () => {
    const res = await post({}).expect(400);

    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "events" }),
      ])
    );
  });

  it("returns 400 when events array is empty", async () => {
    const res = await post({ events: [] }).expect(400);

    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details[0].path).toBe("events");
  });

  it("returns 400 with field-level error for invalid action", async () => {
    const res = await post({
      events: [validEvent({ action: "fly" as never })],
    }).expect(400);

    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "events.0.action" }),
      ])
    );
  });

  it("returns 400 with field-level error for invalid timestamp", async () => {
    const res = await post({
      events: [validEvent({ timestamp: "not-a-date" })],
    }).expect(400);

    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "events.0.timestamp",
          message: "timestamp must be an ISO 8601 datetime string",
        }),
      ])
    );
  });

  it("returns 400 when userId is empty string", async () => {
    const res = await post({
      events: [validEvent({ userId: "" })],
    }).expect(400);

    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "events.0.userId",
          message: "userId is required",
        }),
      ])
    );
  });

  it("returns 400 when appId is missing", async () => {
    const { appId: _omitted, ...eventWithoutAppId } = validEvent();

    const res = await post({ events: [eventWithoutAppId] }).expect(400);

    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "events.0.appId" }),
      ])
    );
  });

  it("reports all field errors in a single response for a malformed event", async () => {
    const res = await post({
      events: [{ userId: "", appId: "", action: "invalid", timestamp: "bad" }],
    }).expect(400);

    const paths = res.body.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "events.0.userId",
        "events.0.action",
        "events.0.timestamp",
      ])
    );
  });

  it("returns 400 when body is not JSON (empty body)", async () => {
    const res = await request(app)
      .post("/events")
      .set("Content-Type", "application/json")
      .send("")
      .expect(400);

    expect(res.body.error).toBe("Validation failed");
  });
});
