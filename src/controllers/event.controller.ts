import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { EventService } from "../services/event.service";
import { BatchIngestRequestSchema, GetEventsQuerySchema } from "../schemas/event.schema";
import logger from "../logger";

const log = logger.child({ module: "EventController" });

export class EventController {
  constructor(private readonly service: EventService) {}

  /**
   * POST /events
   * Accepts a batch of identity events, validates, and ingests them.
   */
  ingestBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = BatchIngestRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        log.info({ validationErrors: parseResult.error.issues }, "POST /events — validation failed");
        res.status(400).json(formatValidationError(parseResult.error));
        return;
      }

      const { events } = parseResult.data;
      log.info({ batchSize: events.length }, "POST /events — ingesting batch");

      const saved = await this.service.ingestBatch(events);

      res.status(201).json({
        ingested: saved.length,
        events: saved,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /events
   * Returns a paginated, filtered list of identity events.
   */
  getEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = GetEventsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        log.info({ validationErrors: parseResult.error.issues }, "GET /events — validation failed");
        res.status(400).json(formatValidationError(parseResult.error));
        return;
      }

      const query = parseResult.data;
      log.info(
        {
          filters: { appId: query.appId, userId: query.userId, action: query.action, from: query.from, to: query.to },
          pagination: { page: query.page, limit: query.limit },
        },
        "GET /events — querying events"
      );

      const result = await this.service.queryEvents(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /apps/:appId/summary
   * Returns aggregate stats for a single app.
   */
  getAppSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appId = req.params["appId"] as string;

      log.info({ appId }, "GET /apps/:appId/summary — fetching summary");

      const summary = await this.service.getAppSummary(appId);

      if (!summary) {
        log.info({ appId }, "GET /apps/:appId/summary — app not found");
        res.status(404).json({ error: `No events found for app "${appId}"` });
        return;
      }

      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  };
}

function formatValidationError(error: ZodError) {
  return {
    error: "Validation failed",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
