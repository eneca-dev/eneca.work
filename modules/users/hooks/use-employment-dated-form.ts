'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { employmentDateSchema } from '../lib/employment-dated'
import { getEmploymentEditContext, type EmploymentDatedCommand } from '../lib/employment-client'

type EditContext = Awaited<ReturnType<typeof getEmploymentEditContext>>
type FormState = { scope: string; context: EditContext | null; date: string; error: string | null }

// A form holds one concurrency token until it closes. Focus/realtime must not
// silently replace that token underneath unsaved personnel changes.
export function useEmploymentDatedForm(open: boolean, employeeId: string | undefined, operation: 'update' | 'finish') {
  const scope = open && employeeId ? `${operation}:${employeeId}` : ''
  const [state, setState] = useState<FormState>({ scope, context: null, date: '', error: null })
  if (state.scope !== scope) setState({ scope, context: null, date: '', error: null })

  useEffect(() => {
    if (!open || !employeeId) return
    let cancelled = false
    getEmploymentEditContext(createClient(), employeeId, operation).then(
      context => {
        if (!cancelled) setState({ scope, context, date: context.today, error: null })
      },
      error => {
        if (!cancelled) setState({ scope, context: null, date: '', error: error instanceof Error ? error.message : 'Не удалось проверить кадровый период' })
      },
    )
    return () => { cancelled = true }
  }, [open, employeeId, operation, scope])

  const context = state.scope === scope ? state.context : null
  const error = state.scope === scope ? state.error : null
  const date = state.scope === scope ? state.date : ''
  const validDate = !!context && employmentDateSchema.safeParse(date).success && !!context.minDate
    && date >= context.minDate && date <= context.today
  const ready = !!scope && !!context && (!context.enabled || (validDate && !!context.periodId && !!context.periodUpdatedAt))

  function getCommand(): EmploymentDatedCommand | undefined {
    if (!ready || !context) throw new Error(error || 'Проверьте дату и обновите кадровые данные: закройте и снова откройте форму.')
    if (!context.enabled) return undefined
    return { effectiveDate: date, expectedPeriodId: context.periodId!, expectedUpdatedAt: context.periodUpdatedAt! }
  }

  return {
    context, date, error, ready, loading: !!scope && !context && !error,
    setDate: (date: string) => setState(previous => ({ ...previous, date })),
    getCommand,
  }
}

export type EmploymentDatedForm = ReturnType<typeof useEmploymentDatedForm>
