import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Loading } from '@/types/planning'
import { LoadingBarButton, type BarRender } from './LoadingBarButton'
import { loadingsToPeriods, formatBarTooltip } from './loading-bars-utils'
import { PROSPECTIVE_LOADING_DESCRIPTION } from './prospective-loading'

const loading: Loading = {
  id: 'loading-1', projectId: 'project-1', projectName: 'Прочие работы',
  sectionId: 'section-1', stageId: 'stage-1',
  startDate: new Date('2026-10-27T00:00:00Z'), endDate: new Date('2026-11-02T00:00:00Z'),
  rate: 0.5, comment: 'Кировск', createdAt: new Date(0), updatedAt: new Date(0),
}

describe('prospective loading period', () => {
  it('preserves the flag independently for loadings of the same project without changing rates or dates', () => {
    const periods = loadingsToPeriods([loading, { ...loading, id: 'loading-2', isProspective: true }])
    expect(periods.map(p => p.isProspective)).toEqual([undefined, true])
    expect(periods[1]).toMatchObject({ rate: 0.5, startDate: loading.startDate, endDate: loading.endDate, comment: 'Кировск' })
    expect(formatBarTooltip(periods[0])).not.toContain('Перспектива')
    expect(formatBarTooltip(periods[1])).toContain(PROSPECTIVE_LOADING_DESCRIPTION)
  })
})

function makeBar(width: number, isProspective = true): BarRender {
  return {
    loading: {
      id: 'loading-1', projectId: 'project-1', projectName: 'Прочие работы',
      startDate: '2026-10-27', endDate: '2026-11-02', rate: 0.5, comment: 'Кировск', isProspective,
    },
    position: { left: 0, width }, row: 0,
  }
}

describe('monthly/weekly LoadingBarButton', () => {
  it.each([300, 100, 35])('renders an accessible marker at width %s and keeps the original rate and click target', width => {
    const onClick = vi.fn()
    render(<TooltipProvider><LoadingBarButton bar={makeBar(width)} onLoadingClick={onClick} /></TooltipProvider>)
    const marker = screen.getByRole('img', { name: `Перспектива. ${PROSPECTIVE_LOADING_DESCRIPTION}` })
    expect(marker).toHaveAttribute('title', PROSPECTIVE_LOADING_DESCRIPTION)
    expect(screen.getByText('0.5')).toBeVisible()
    if (width >= 200) expect(marker).toHaveTextContent('Перспектива')
    else expect(marker.querySelector('svg')).not.toBeNull()
    fireEvent.click(marker)
    expect(onClick).toHaveBeenCalledWith('loading-1')
  })

  it('uses the whole four-pixel bar as an accessible marker when an icon cannot fit', () => {
    render(<TooltipProvider><LoadingBarButton bar={makeBar(4)} /></TooltipProvider>)
    const bar = screen.getByRole('button', { name: `Перспектива. ${PROSPECTIVE_LOADING_DESCRIPTION}` })
    expect(bar).toHaveClass('ring-2', 'ring-amber-200')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('removes the marker when cleared without changing project colour or rate', () => {
    const { rerender } = render(<TooltipProvider><LoadingBarButton bar={makeBar(300)} /></TooltipProvider>)
    const originalColour = screen.getByRole('button').style.backgroundColor
    rerender(<TooltipProvider><LoadingBarButton bar={makeBar(300, false)} /></TooltipProvider>)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('button').style.backgroundColor).toBe(originalColour)
    expect(screen.getByText('0.5')).toBeVisible()
    expect(screen.getByText('Прочие работы')).toBeVisible()
  })
})
