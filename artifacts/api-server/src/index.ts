import app, { initSession } from "./app";
import { logger } from "./lib/logger";
import { warmEntityCache } from "./services/entityCache";
import { validatePasswordConfig } from "./auth/service";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Validate password configuration at startup — logs a warning if admin password
// is not a bcrypt hash without printing the actual value.
validatePasswordConfig();

warmEntityCache().catch((err) => {
  logger.warn({ err }, "Entity cache pre-warm failed; will retry lazily on first request");
});

initSession()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize session store");
    process.exit(1);
  });
