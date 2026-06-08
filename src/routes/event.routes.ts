import { Router } from "express";
import { EventController } from "../controllers/event.controller";

export function createEventRouter(controller: EventController): Router {
  const router = Router();

  router.post("/events", controller.ingestBatch);
  router.get("/events", controller.getEvents);
  router.get("/apps/:appId/summary", controller.getAppSummary);

  return router;
}
