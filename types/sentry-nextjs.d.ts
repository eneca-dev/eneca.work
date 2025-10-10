declare module '@sentry/nextjs' {
  import type React, { ComponentType } from 'react'
  import type { ProfilerProps } from '@sentry/react'
  export function captureException(error: any, context?: any): void
  export function addBreadcrumb(breadcrumb: any): void
  export function startSpan<T>(context: any, callback: (span: any) => Promise<T> | T): Promise<T> | T
  export function captureMessage(message: string, context?: any): void
  export function withProfiler<P>(
    component: ComponentType<P>,
    options?: Pick<Partial<ProfilerProps>, 'name' | 'disabled' | 'includeRender' | 'includeUpdates'>
  ): React.FC<P>
}


