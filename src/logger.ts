import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const isTest = process.env.NODE_ENV === "test";

/**
 * Root logger — shared across the entire application.
 * In development: pretty-prints with colours via pino-pretty.
 * In production: outputs raw JSON (structured, machine-readable).
 * In test: no transport is created (avoids leaving a worker thread open
 *          after the Jest suite finishes, which causes open-handle warnings).
 *
 * Each module creates a child logger via logger.child({ module: '...' })
 * so every log line carries the originating layer.
 */
const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(!isTest && isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
    },
  }),
});

export default logger;
