'use client'

import { useCallback, useMemo, useState } from 'react'
import type { FilterQueryParams } from '@/modules/inline-filter'
import { useHasPermission } from '@/modules/permissions'
import { EMPLOYMENT_BOARD_EDIT } from '../constants'
import { ProjectCard } from './ProjectCard'
import { SidePanel } from './SidePanel'
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

interface EmploymentBoardInternalProps {
  queryParams?: FilterQueryParams
}

export function EmploymentBoardInternal({ queryParams }: EmploymentBoardInternalProps) {
  const { data: board, isLoading, error } = useEmploymentBoard(queryParams)
  const canEdit = useHasPermission(EMPLOYMENT_BOARD_EDIT)
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
  const departmentId = board?.departmentId
  const { scheduleFallbackRefresh } = useEmploymentBoardRealtime(departmentId)
  const pinProject = usePinProject({ onMutationSuccess: scheduleFallbackRefresh })
  const unpinProject = useUnpinProject({ onMutationSuccess: scheduleFallbackRefresh })
  const placeEmployee = usePlaceEmployee({ onMutationSuccess: scheduleFallbackRefresh })
  const removePlacement = useRemovePlacement({ onMutationSuccess: scheduleFallbackRefresh })
  const { data: presenceIds = [] } = useBoardPresence(departmentId)

  const handleDropEmployee = useCallback(
    (employeeId: string, projectId: string) => {
      if (!departmentId) return
      placeEmployee.mutate({ departmentId, projectId, employeeId })
      setDropTargetId(null)
    },
    [departmentId, placeEmployee],
  )

  const handleDropProject = useCallback(
    (projectId: string) => {
      if (!departmentId) return
      pinProject.mutate({ departmentId, projectId })
    },
    [departmentId, pinProject],
  )

  const handlePinProject = useCallback(
    (project: { id: string; name: string }) => {
      if (!departmentId) return
      pinProject.mutate({ departmentId, projectId: project.id, projectName: project.name })
    },
    [departmentId, pinProject],
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Загрузка доски…
      </div>
    )
  }

  if (error || !filteredBoard) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive">
        {error instanceof Error ? error.message : 'Не удалось загрузить доску'}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-muted/20">
      <SidePanel
        employees={filteredBoard.employees}
        unassignedIds={unassignedIds}
        canEdit={canEdit}
        onDragStartEmployee={(employeeId, e) =>
          dnd.handleDragStart({ kind: 'employee', employeeId }, e)
        }
        onDragEnd={() => {
          dnd.handleDragEnd()
          setDropTargetId(null)
        }}
        onPinProject={handlePinProject}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-5 py-3">
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
        </header>

        <div
          onDragOver={dnd.handleBoardDragOver}
          onDrop={dnd.handleBoardDrop}
          className="min-h-0 flex-1 overflow-y-auto p-5"
        >
          {filteredBoard.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {selectedEmployeeId
                ? 'У выбранного сотрудника нет проектов на этой доске.'
                : canEdit
                ? 'Нет активных проектов. Добавьте проект через панель слева.'
                : 'Нет активных проектов.'}
            </p>
          ) : (
            // CSS multi-column masonry: карточки перетекают по колонкам,
            // число колонок зависит от ширины экрана
            <div className="columns-1 gap-4 lg:columns-2 2xl:columns-3">
              {filteredBoard.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  canEdit={canEdit}
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
                  onUnpin={() =>
                    unpinProject.mutate({ departmentId: filteredBoard.departmentId, projectId: project.id })
                  }
                  onRemoveEmployee={(employeeId) =>
                    removePlacement.mutate({
                      departmentId: filteredBoard.departmentId,
                      projectId: project.id,
                      employeeId,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
