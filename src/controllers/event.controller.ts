import { Request, Response } from "express";
import { ZodError } from "zod";
import { EventService } from "../services/event.service";
import { BatchIngestRequestSchema, GetEventsQuerySchema } from "../schemas/event.schema";

export class EventController {
  constructor(private readonly service: EventService) {}

  /**
   * POST /events
   * Accepts a batch of identity events, validates, and ingests them.
   */
  ingestBatch = async (req: Request, res: Response): Promise<void> => {
    const parseResult = BatchIngestRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json(formatValidationError(parseResult.error));
      return;
    }

    const saved = await this.service.ingestBatch(parseResult.data.events);

    res.status(201).json({
      ingested: saved.length,
      events: saved,
    });
  };

  /**
   * GET /events
   * Returns a paginated, filtered list of identity events.
   */
  getEvents = async (req: Request, res: Response): Promise<void> => {
    const parseResult = GetEventsQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json(formatValidationError(parseResult.error));
      return;
    }

    const result = await this.service.queryEvents(parseResult.data);
    res.status(200).json(result);
  };

  /**
   * GET /apps/:appId/summary
   * Returns aggregate stats for a single app.
   */
  getAppSummary = async (req: Request, res: Response): Promise<void> => {
    const appId = req.params["appId"] as string;

    const summary = await this.service.getAppSummary(appId);

    if (!summary) {
      res.status(404).json({ error: `No events found for app "${appId}"` });
      return;
    }

    res.status(200).json(summary);
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
