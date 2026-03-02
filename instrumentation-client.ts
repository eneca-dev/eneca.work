// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://7531f4815b2ca61b2effaaaadd531c94@o4509763476717568.ingest.de.sentry.io/4509784420319312",

  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration(),
  ],

  // Traces: 10% в production (было 100% — вызывало 429 Too Many Requests на /_relay)
  tracesSampleRate: 0.1,

  // Логи Sentry: отключены (увеличивали payload и расход квоты)
  enableLogs: false,

  // Replay: 5% сессий, 50% при ошибках (снижено для экономии квоты)
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 0.5,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Не отправлять Cookie в POST /_relay 
  transportOptions: {
    fetchOptions: {
      credentials: 'omit',
    },
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;