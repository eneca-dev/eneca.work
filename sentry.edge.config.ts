// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://7531f4815b2ca61b2effaaaadd531c94@o4509763476717568.ingest.de.sentry.io/4509784420319312",

  // Traces: 10% в production (было 100% — вызывало 429 Too Many Requests)
  tracesSampleRate: 0.1,

  // Логи Sentry: отключены (увеличивали payload и расход квоты)
  enableLogs: false,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
