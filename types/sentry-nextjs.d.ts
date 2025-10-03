declare module '@sentry/nextjs' { 
  export function init(options: any): void 
  export function captureException(error: any, context?: any): void 
  export function addBreadcrumb(breadcrumb: any): void 
  export function startSpan<T>(context: any, callback: (span: any) => Promise<T> | T): Promise<T> | T 
  export function captureMessage(message: string, context?: any): void 
  export function replayIntegration(): any
  export const captureRouterTransitionStart: () => void
}


