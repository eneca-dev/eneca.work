'use client'

import { useState } from 'react'
import {
  useProjectsWithCounts,
  useProjectStructure,
  type ProjectWithCounts,
  type ProjectStructure,
} from '../hooks/use-projects'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  AlertCircle,
  FolderKanban,
  ChevronRight,
  ChevronDown,
  Layers,
  Box,
  FileText,
  User,
  Building2,
  LayoutList,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Маппинг статусов проектов на цвета
 */
const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-500 border-green-500/20',
  completed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  paused: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  draft: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  'waiting for input data': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  'potential project': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
}

const statusLabels: Record<string, string> = {
  active: 'Активный',
  completed: 'Завершён',
  paused: 'Приостановлен',
  draft: 'Черновик',
  'waiting for input data': 'Ожидание ИД',
  'author supervision': 'Авторский надзор',
  'actual calculation': 'Актуальный расчёт',
  'customer approval': 'Согласование',
  'potential project': 'Потенциальный',
}

/**
 * Компонент карточки проекта с подсчётами
 */
function ProjectCardWithCounts({
  project,
  isSelected,
  onSelect,
}: {
  project: ProjectWithCounts
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium line-clamp-2">
            {project.project_name}
          </CardTitle>
          {project.project_status && (
            <Badge
              variant="outline"
              className={`shrink-0 ${statusColors[project.project_status] ?? ''}`}
            >
              {statusLabels[project.project_status] ?? project.project_status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Менеджер */}
        {project.manager_name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{project.manager_name}</span>
          </div>
        )}

        {/* Клиент */}
        {project.client_name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{project.client_name}</span>
          </div>
        )}

        {/* Подсчёты */}
        <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {project.stages_count} стадий
          </span>
          <span className="flex items-center gap-1">
            <Box className="h-3 w-3" />
            {project.objects_count} объектов
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {project.sections_count} разделов
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Компонент дерева структуры проекта
 */
function ProjectStructureTree({ structure }: { structure: ProjectStructure }) {
  const [openStages, setOpenStages] = useState<Set<string>>(new Set())
  const [openObjects, setOpenObjects] = useState<Set<string>>(new Set())

  const toggleStage = (stageId: string) => {
    setOpenStages((prev) => {
      const next = new Set(prev)
      if (next.has(stageId)) {
        next.delete(stageId)
      } else {
        next.add(stageId)
      }
      return next
    })
  }

  const toggleObject = (objectId: string) => {
    setOpenObjects((prev) => {
      const next = new Set(prev)
      if (next.has(objectId)) {
        next.delete(objectId)
      } else {
        next.add(objectId)
      }
      return next
    })
  }

  if (structure.stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg">Структура пуста</h3>
        <p className="text-muted-foreground mt-1">
          У этого проекта нет стадий, объектов и разделов
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Заголовок проекта */}
      <div className="p-4 bg-muted/50 rounded-lg mb-4">
        <h3 className="font-semibold text-lg">{structure.project_name}</h3>
        {structure.project_description && (
          <p className="text-sm text-muted-foreground mt-1">
            {structure.project_description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          {structure.manager_name && (
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {structure.manager_name}
            </span>
          )}
          {structure.lead_engineer_name && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              ГИП: {structure.lead_engineer_name}
            </span>
          )}
        </div>
      </div>

      {/* Дерево структуры */}
      {structure.stages.map((stage) => (
        <Collapsible
          key={stage.stage_id}
          open={openStages.has(stage.stage_id)}
          onOpenChange={() => toggleStage(stage.stage_id)}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 font-medium"
            >
              {openStages.has(stage.stage_id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Layers className="h-4 w-4 text-blue-500" />
              <span>{stage.stage_name}</span>
              <Badge variant="secondary" className="ml-auto">
                {stage.objects.length} объектов
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-6 border-l pl-4 space-y-1">
            {stage.objects.map((object) => (
              <Collapsible
                key={object.object_id}
                open={openObjects.has(object.object_id)}
                onOpenChange={() => toggleObject(object.object_id)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                  >
                    {openObjects.has(object.object_id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Box className="h-4 w-4 text-orange-500" />
                    <span>{object.object_name}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {object.sections.length} разделов
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-6 border-l pl-4 space-y-1">
                  {object.sections.map((section) => (
                    <div
                      key={section.section_id}
                      className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50"
                    >
                      <FileText className="h-4 w-4 text-green-500" />
                      <span className="flex-1 text-sm">{section.section_name}</span>

                      {/* Статус секции */}
                      {section.section_status_name && (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor: section.section_status_color ?? undefined,
                            color: section.section_status_color ?? undefined,
                          }}
                        >
                          {section.section_status_name}
                        </Badge>
                      )}

                      {/* Подсчёты */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <LayoutList className="h-3 w-3" />
                          {section.decomposition_stages_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {section.active_loadings_count}
                        </span>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}

/**
 * Панель структуры выбранного проекта
 */
function ProjectStructurePanel({ projectId }: { projectId: string }) {
  const { data: structure, isLoading, error } = useProjectStructure(projectId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="font-semibold text-lg">Ошибка загрузки</h3>
        <p className="text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Не удалось загрузить структуру'}
        </p>
      </div>
    )
  }

  if (!structure) {
    return null
  }

  return <ProjectStructureTree structure={structure} />
}

/**
 * Главный компонент - список проектов + структура выбранного
 */
export function ProjectStructureView() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const { data: projects, isLoading, error } = useProjectsWithCounts()

  if (isLoading) {
    return <ProjectStructureViewSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="font-semibold text-lg">Ошибка загрузки</h3>
        <p className="text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Не удалось загрузить проекты'}
        </p>
      </div>
    )
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg">Проекты не найдены</h3>
        <p className="text-muted-foreground mt-1">Список проектов пуст</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Левая панель - список проектов */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Проекты ({projects.length})
          </h2>
          <span className="text-sm text-muted-foreground">
            Данные из view v_cache_projects
          </span>
        </div>

        <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          {projects.map((project) => (
            <ProjectCardWithCounts
              key={project.project_id}
              project={project}
              isSelected={selectedProjectId === project.project_id}
              onSelect={() => setSelectedProjectId(project.project_id)}
            />
          ))}
        </div>
      </div>

      {/* Правая панель - структура проекта */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Структура проекта</h2>

        {selectedProjectId ? (
          <Card>
            <CardContent className="pt-4">
              <ProjectStructurePanel projectId={selectedProjectId} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Выберите проект слева для просмотра структуры
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

/**
 * Skeleton для загрузки
 */
function ProjectStructureViewSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Card>
          <CardContent className="py-12">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
