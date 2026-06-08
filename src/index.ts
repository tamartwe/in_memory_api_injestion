import { createApp } from "./app";
import logger from "./logger";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = createApp();

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Identity Ingestion API listening");
});
