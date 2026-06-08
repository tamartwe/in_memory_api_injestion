import { IdentityEventInput } from "../../schemas/event.schema";

export const validEvent = (overrides: Partial<IdentityEventInput> = {}): IdentityEventInput => ({
  userId: "user-123",
  appId: "app-abc",
  action: "login",
  timestamp: "2026-06-08T10:00:00.000Z",
  metadata: { ip: "1.2.3.4", userAgent: "Mozilla/5.0" },
  ...overrides,
});

export const seedEvents: IdentityEventInput[] = [
  validEvent({ userId: "seed-user-1", action: "login" }),
  validEvent({ userId: "seed-user-2", action: "logout" }),
  validEvent({ userId: "seed-user-3", action: "privilege_escalation" }),
];
