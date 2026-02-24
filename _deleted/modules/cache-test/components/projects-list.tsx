'use client'

import { useState } from 'react'
import { useProjects, useUpdateProject } from '../hooks/use-projects'
import type { ProjectListItem } from '../hooks/use-projects'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertCircle,
  FolderKanban,
  User,
  Building2,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

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

/**
 * Русские названия статусов
 */
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
 * Компонент карточки проекта с редактированием
 */
function ProjectCard({ project }: { project: ProjectListItem }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(project.project_name)
  const updateProject = useUpdateProject()

  const handleSave = () => {
    if (editedName.trim() && editedName !== project.project_name) {
      updateProject.mutate({
        project_id: project.project_id,
        project_name: editedName.trim(),
      })
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedName(project.project_name)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          {isEditing ? (
            <div className="flex-1 flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-base font-medium"
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={handleSave}
                disabled={updateProject.isPending}
              >
                {updateProject.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 text-green-500" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={handleCancel}
                disabled={updateProject.isPending}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <>
              <CardTitle className="text-base font-medium line-clamp-2 flex-1">
                {project.project_name}
              </CardTitle>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          )}
          {project.project_status && !isEditing && (
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

        {/* Дата создания */}
        {project.project_created && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Создан{' '}
            {formatDistanceToNow(new Date(project.project_created), {
              addSuffix: true,
              locale: ru,
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Компонент списка проектов
 */
export function ProjectsList() {
  const { data: projects, isLoading, error, isFetching } = useProjects()

  if (isLoading) {
    return <ProjectsListSkeleton />
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
    <div className="space-y-4">
      {/* Информация о загрузке */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Всего проектов: {projects.length}</span>
        {isFetching && (
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 bg-primary rounded-full animate-pulse" />
            Обновление...
          </span>
        )}
      </div>

      {/* Подсказка про редактирование */}
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        💡 Наведите на карточку и нажмите на иконку карандаша для редактирования названия.
        Изменения применяются мгновенно (optimistic update).
      </div>

      {/* Список проектов */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.project_id} project={project} />
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton для загрузки
 */
function ProjectsListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-16" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
