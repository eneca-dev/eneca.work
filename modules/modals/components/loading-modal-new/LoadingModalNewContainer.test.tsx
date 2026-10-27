import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoadingModalNewEditData } from '../../types'
import type { LoadingResult } from '../../actions/loadings'
import type { ActionResult } from '@/modules/cache'
import { LoadingModalNewContainer } from './LoadingModalNewContainer'

const mocks = vi.hoisted(() => ({
  modalData: null as Partial<LoadingModalNewEditData> | null,
  getLoadingById: vi.fn(),
  closeModal: vi.fn(),
}))

vi.mock('@/stores/useUserStore', () => ({
  useUserStore: (select: (state: { id: string }) => unknown) => select({ id: 'user-1' }),
}))
vi.mock('../../stores/modal-store', () => ({
  useIsModalOpen: (name: string) => name === 'loading-new-edit',
  useModalStore: (select: (state: { modalData: typeof mocks.modalData }) => unknown) => select({ modalData: mocks.modalData }),
  closeModal: mocks.closeModal,
}))
vi.mock('../../actions/loadings', () => ({ getLoadingById: mocks.getLoadingById }))
vi.mock('@/modules/permissions', () => ({ useCanEditLoading: () => true }))
vi.mock('@/modules/users/hooks/use-loading-access-grants', () => ({
  useEmployeeGrantedDepartmentIds: () => ({ data: [] }),
}))
vi.mock('./LoadingModalNew', () => ({
  LoadingModalNew: ({ editData }: { editData: LoadingModalNewEditData }) => (
    <div data-testid="edit-form">
      {editData.loadingId}:{String(editData.loading.isProspective)}:{editData.loading.section_id}
    </div>
  ),
}))

const suppliedLoading: LoadingModalNewEditData['loading'] = {
  id: 'loading-1', section_id: 'section-1', employee_id: 'employee-1',
  start_date: '2026-10-27', end_date: '2026-10-30', rate: 0.5, comment: null,
}

function fullResult(id = 'loading-1', stageId = 'stage-1'): ActionResult<LoadingResult> {
  return {
    success: true,
    data: {
      id, stageId, employeeId: 'employee-1',
      startDate: '2026-10-27', endDate: '2026-10-30', rate: 0.5,
      comment: null, isProspective: true, status: 'active', createdAt: '', updatedAt: null,
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('LoadingModalNewContainer: complete prospective state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Older consumers may supply only the nested loading and omit the new flag.
    mocks.modalData = { loading: suppliedLoading }
  })

  it('fetches a missing flag before allowing editing, using nested ID fallbacks', async () => {
    const request = deferred<ActionResult<LoadingResult>>()
    mocks.getLoadingById.mockReturnValue(request.promise)
    render(<LoadingModalNewContainer />)
    expect(mocks.getLoadingById).toHaveBeenCalledWith('loading-1')
    expect(screen.queryByTestId('edit-form')).not.toBeInTheDocument()

    await act(async () => request.resolve(fullResult()))
    expect(screen.getByTestId('edit-form')).toHaveTextContent('loading-1:true')
  })

  it('closes after a failed read instead of presenting a false default', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getLoadingById.mockResolvedValue({ success: false, error: 'Недоступно' })
    try {
      render(<LoadingModalNewContainer />)
      await waitFor(() => expect(mocks.closeModal).toHaveBeenCalledOnce())
      expect(screen.queryByTestId('edit-form')).not.toBeInTheDocument()
    } finally {
      log.mockRestore()
    }
  })

  it('uses an explicitly known false flag without an additional request', () => {
    mocks.modalData = { loading: { ...suppliedLoading, isProspective: false } }
    render(<LoadingModalNewContainer />)
    expect(screen.getByTestId('edit-form')).toHaveTextContent('loading-1:false')
    expect(mocks.getLoadingById).not.toHaveBeenCalled()
  })

  it('keeps the section for a direct loading without a decomposition stage', async () => {
    mocks.getLoadingById.mockResolvedValue(fullResult('loading-1', ''))
    render(<LoadingModalNewContainer />)
    expect(await screen.findByTestId('edit-form')).toHaveTextContent('loading-1:true:section-1')
  })

  it('does not show the previous loading or accept its late response after switching records', async () => {
    const oldRequest = deferred<ActionResult<LoadingResult>>()
    const nextRequest = deferred<ActionResult<LoadingResult>>()
    mocks.getLoadingById.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(nextRequest.promise)
    const { rerender } = render(<LoadingModalNewContainer />)
    mocks.modalData = { loading: { ...suppliedLoading, id: 'loading-2' } }
    rerender(<LoadingModalNewContainer />)

    await act(async () => oldRequest.resolve(fullResult('loading-1')))
    expect(screen.queryByTestId('edit-form')).not.toBeInTheDocument()
    await act(async () => nextRequest.resolve(fullResult('loading-2')))
    expect(screen.getByTestId('edit-form')).toHaveTextContent('loading-2:true')
  })
})
