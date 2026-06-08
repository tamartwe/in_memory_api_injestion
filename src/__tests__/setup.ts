// Ensures the pino-pretty transport worker thread is never created during tests
// (avoids Jest open-handle warnings) and silences all log output.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
