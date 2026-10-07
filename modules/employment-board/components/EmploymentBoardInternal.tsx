'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FilterQueryParams } from '@/modules/inline-filter'
import { useHasPermission } from '@/modules/permissions'
import { EMPLOYMENT_BOARD_EDIT } from '../constants'
import { ProjectCard } from './ProjectCard'
import { SidePanel } from './SidePanel'
import { BoardDatePicker } from './BoardDatePicker'
import { useBoardDnd } from '../hooks/useBoardDnd'
import {
  useEmploymentBoard,
  useBoardPresence,
  usePinProject,
  usePlaceEmployee,
  useRemovePlacement,
  useUnpinProject,
} from '../hooks/useEmploymentBoard'
import { useEmploymentBoardRealtime } from '../hooks/useEmploymentBoardRealtime'
import { useEmploymentBoardDate } from '../hooks/useEmploymentBoardDate'

interface EmploymentBoardInternalProps {
  queryParams?: FilterQueryParams
}

function RefreshErrorNotice({
  hasSavedData,
  onRetry,
}: {
  hasSavedData: boolean
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <span>
        {hasSavedData
          ? 'Не удалось обновить доску. Показаны последние сохранённые данные.'
          : 'Не удалось загрузить актуальные данные доски.'}
      </span>
      <button
        type="button"
        className="rounded-md border border-destructive/40 px-2.5 py-1 font-medium hover:bg-destructive/10"
        onClick={onRetry}
      >
        Повторить
      </button>
    </div>
  )
}

export function EmploymentBoardInternal({ queryParams }: EmploymentBoardInternalProps) {
  const boardDate = useEmploymentBoardDate()
  const requestEpochRef = useRef(0)
  const pendingMutationsRef = useRef(0)
  const [requiresFresh, setRequiresFresh] = useState(false)
  const [staleOnDate, setStaleOnDate] = useState<string | null>(null)
  const requireFresh = useCallback(() => setRequiresFresh(true), [])
  const markDateChangeStale = useCallback(() => setStaleOnDate(boardDate.selectedDate), [boardDate.selectedDate])
  useEffect(() => {
    if (staleOnDate !== null && staleOnDate !== boardDate.selectedDate) setRequiresFresh(true)
  }, [boardDate.selectedDate, staleOnDate])
  const { data: board, isLoading, error } = useEmploymentBoard({
    filters: queryParams,
    selectedDate: boardDate.selectedDate,
    expectedDateMode: boardDate.mode,
    cachePolicy: requiresFresh || (staleOnDate !== null && staleOnDate !== boardDate.selectedDate)
      ? 'fresh'
      : 'cache-aside',
    onDateBoundary: boardDate.refreshCurrentMinskDate,
    requestEpochRef,
  })
  const canEdit = useHasPermission(EMPLOYMENT_BOARD_EDIT)
  const canManageProjects = canEdit
  const canManagePlacements = canEdit && boardDate.mode === 'today'
  const rawEmployeeFilter = queryParams?.employee_id
  const selectedEmployeeValue = Array.isArray(rawEmployeeFilter)
    ? rawEmployeeFilter[0]
    : rawEmployeeFilter

  // InlineFilter хранит текстовое имя из подсказки. Сопоставляем его с уже
  // загруженными сотрудниками разрешённого отдела; UUID остаётся рабочим для
  // старых/ручных ссылок. Неизвестное имя даст пустой результат, а не доступ
  // к другому сотруднику.
  const selectedEmployeeId = useMemo(() => {
    if (typeof selectedEmployeeValue !== 'string' || !selectedEmployeeValue) return undefined

    const normalizedName = selectedEmployeeValue
      .trim()
      .toLocaleLowerCase('ru')
      .split(/\s+/)
      .sort()
      .join(' ')

    return board?.employees.find(
      (employee) =>
        employee.id === selectedEmployeeValue ||
        employee.name === selectedEmployeeValue ||
        employee.name
          .trim()
          .toLocaleLowerCase('ru')
          .split(/\s+/)
          .sort()
          .join(' ') === normalizedName,
    )?.id ?? selectedEmployeeValue
  }, [board?.employees, selectedEmployeeValue])

  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  useEffect(() => {
    if (!canManagePlacements) setDropTargetId(null)
  }, [canManagePlacements])
  const departmentId = board?.departmentId
  const {
    beginMutation,
    finishMutation,
    refreshError,
    retryRefresh,
  } = useEmploymentBoardRealtime({
    departmentId,
    filters: queryParams,
    selectedDate: boardDate.selectedDate,
    dateMode: boardDate.mode,
    requestEpochRef,
    onRequireFresh: requireFresh,
    onMarkDateChangeStale: markDateChangeStale,
    onDateBoundary: boardDate.refreshCurrentMinskDate,
    pendingMutationsRef,
  })
  const mutationOptions = { onMutationStart: beginMutation, onMutationSettled: finishMutation }
  const pinProject = usePinProject(mutationOptions)
  const unpinProject = useUnpinProject(mutationOptions)
  const placeEmployee = usePlaceEmployee(mutationOptions)
  const removePlacement = useRemovePlacement(mutationOptions)
  const { data: presenceIds = [] } = useBoardPresence(departmentId)

  const handleDropEmployee = useCallback(
    (employeeId: string, projectId: string) => {
      if (!departmentId || !canManagePlacements) return
      placeEmployee.mutate({
        departmentId,
        projectId,
        employeeId,
        selectedDate: boardDate.selectedDate,
      })
      setDropTargetId(null)
    },
    [boardDate.selectedDate, canManagePlacements, departmentId, placeEmployee],
  )

  const handleDropProject = useCallback(
    (projectId: string) => {
      if (!departmentId || !canManageProjects) return
      pinProject.mutate({ departmentId, projectId })
    },
    [canManageProjects, departmentId, pinProject],
  )

  const handlePinProject = useCallback(
    (project: { id: string; name: string }) => {
      if (!departmentId || !canManageProjects) return
      pinProject.mutate({ departmentId, projectId: project.id, projectName: project.name })
    },
    [canManageProjects, departmentId, pinProject],
  )

  const dnd = useBoardDnd({
    onDropEmployee: handleDropEmployee,
    onDropProject: handleDropProject,
  })

  // Это фильтр представления, а не доступа: сервер и RLS уже вернули только
  // разрешённую доску отдела. Не запускаем лишнюю сборку доски из-за выбора
  // сотрудника — локально отбираем его в панели и на карточках.
  const filteredBoard = useMemo(() => {
    if (!board || typeof selectedEmployeeId !== 'string' || !selectedEmployeeId) return board

    return {
      ...board,
      employees: board.employees.filter((employee) => employee.id === selectedEmployeeId),
      projects: board.projects
        .map((project) => ({
          ...project,
          employees: project.employees.filter((employee) => employee.id === selectedEmployeeId),
        }))
        .filter((project) => project.employees.length > 0),
      unassignedEmployeeIds: board.unassignedEmployeeIds.filter((id) => id === selectedEmployeeId),
    }
  }, [board, selectedEmployeeId])

  const unassignedIds = useMemo(
    () => new Set(filteredBoard?.unassignedEmployeeIds ?? []),
    [filteredBoard?.unassignedEmployeeIds],
  )
  const watchingCount = useMemo(
    () => new Set(presenceIds).size,
    [presenceIds],
  )

  const datePicker = (
    <BoardDatePicker
      selectedDate={boardDate.selectedDate}
      currentMinskDate={boardDate.currentMinskDate}
      followsToday={boardDate.followsToday}
      onSelectDate={boardDate.selectDate}
      onSelectToday={boardDate.selectToday}
    />
  )

  if (isLoading && !refreshError) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-muted/20">
        <header className="flex shrink-0 justify-end border-b bg-card px-3 py-2">
          {datePicker}
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          Загрузка доски…
        </div>
      </div>
    )
  }

  if (error || !filteredBoard) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-muted/20">
        <header className="flex shrink-0 justify-end border-b bg-card px-3 py-2">
          {datePicker}
        </header>
        {refreshError ? (
          <div className="flex min-h-0 flex-1 items-center">
            <RefreshErrorNotice hasSavedData={false} onRetry={retryRefresh} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : 'Не удалось загрузить доску'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-[calc(100vw-5rem)] max-w-full self-start flex-col overflow-hidden bg-muted/20 md:w-full md:flex-row">
      <SidePanel
        employees={filteredBoard.employees}
        unassignedIds={unassignedIds}
        canManageProjects={canManageProjects}
        canManagePlacements={canManagePlacements}
        onDragStartEmployee={(employeeId, e) =>
          dnd.handleDragStart({ kind: 'employee', employeeId }, e)
        }
        onDragEnd={() => {
          dnd.handleDragEnd()
          setDropTargetId(null)
        }}
        onPinProject={handlePinProject}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-card px-3 py-2">
          <h1 className="mr-1 text-base font-semibold tracking-tight">{filteredBoard.departmentName}</h1>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            Проектов: <span className="font-medium text-foreground">{filteredBoard.projects.length}</span>
          </span>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs text-primary">
            Свободны: <span className="font-semibold">{unassignedIds.size}</span>
          </span>
          {watchingCount > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              На доске: <span className="font-medium text-foreground">{watchingCount}</span>
            </span>
          )}
          <div className="ml-auto">{datePicker}</div>
        </header>
        {refreshError && <RefreshErrorNotice hasSavedData onRetry={retryRefresh} />}

        <div
          data-testid="employment-board-projects"
          onDragOver={dnd.handleBoardDragOver}
          onDrop={dnd.handleBoardDrop}
          className="min-h-0 flex-1 overflow-y-auto p-3"
        >
          {filteredBoard.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {selectedEmployeeId
                ? 'У выбранного сотрудника нет проектов на этой доске.'
                : canManageProjects
                ? 'Нет активных проектов. Добавьте проект через панель слева.'
                : 'Нет активных проектов.'}
            </p>
          ) : (
            // CSS multi-column masonry: карточки перетекают по колонкам,
            // число колонок зависит от ширины экрана
            <div data-testid="employment-board-columns" className="columns-1 gap-3 lg:columns-2 2xl:columns-3">
              {filteredBoard.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  canManageProjects={canManageProjects}
                  canManagePlacements={canManagePlacements}
                  isDropTarget={dropTargetId === project.id}
                  onDragOver={(e) => {
                    dnd.handleProjectDragOver(e)
                    if (dnd.dragged?.kind === 'employee') setDropTargetId(project.id)
                  }}
                  onDragLeave={(e) => {
                    // Только реальный выход за пределы карточки, а не переход
                    // на вложенный элемент внутри неё
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setDropTargetId((current) => (current === project.id ? null : current))
                    }
                  }}
                  onDrop={(e) => dnd.handleProjectDrop(project.id, e)}
                  onUnpin={() => {
                    if (!canManageProjects) return
                    unpinProject.mutate({ departmentId: filteredBoard.departmentId, projectId: project.id })
                  }}
                  onRemoveEmployee={(employeeId) => {
                    if (!canManagePlacements) return
                    removePlacement.mutate({
                      departmentId: filteredBoard.departmentId,
                      projectId: project.id,
                      employeeId,
                      selectedDate: boardDate.selectedDate,
                    })
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
