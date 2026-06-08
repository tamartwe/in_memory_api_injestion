import express, { Application, NextFunction, Request, Response } from "express";
import { InMemoryEventRepository } from "./repositories/in-memory/event.in-memory.repository";
import { IEventRepository } from "./repositories/interfaces/event.repository.interface";
import { EventService } from "./services/event.service";
import { EventController } from "./controllers/event.controller";
import { createEventRouter } from "./routes/event.routes";

export interface AppDependencies {
  eventRepository?: IEventRepository;
}

export function createApp(deps: AppDependencies = {}): Application {
  const app = express();

  app.use(express.json());

  // ── Dependency wiring ─────────────────────────────────────────────────────
  // Production: defaults to InMemoryEventRepository (swap to Postgres here).
  // Tests: caller injects a pre-wired repository to control and inspect state.
  const eventRepository = deps.eventRepository ?? new InMemoryEventRepository();
  const eventService = new EventService(eventRepository);
  const eventController = new EventController(eventService);
  // ─────────────────────────────────────────────────────────────────────────

  app.use("/", createEventRouter(eventController));

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
