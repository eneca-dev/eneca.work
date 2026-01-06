import { useEffect, useRef } from 'react'
import { useFilterStore } from '../store'

/**
 * Hook для валидации и восстановления состояния фильтров после rehydration из localStorage.
 *
 * Запускается один раз при монтировании компонента для проверки того, что сохранённые
 * значения фильтров всё ещё существуют в базе данных.
 *
 * Этот hook заменяет асинхронную логику в onRehydrateStorage для предотвращения
 * TDZ (Temporal Dead Zone) ошибок в production builds, вызванных минификацией.
 */
export function useFilterValidation() {
  const hasValidated = useRef(false)

  useEffect(() => {
    // Запускаем валидацию только один раз при монтировании
    if (hasValidated.current) return
    hasValidated.current = true

    const validateFilters = async () => {
      console.log('🔄 Восстановление фильтров из localStorage, запускаю валидацию...')

      const store = useFilterStore.getState()

      // Загружаем все справочники
      await Promise.all([
        store.loadSubdivisions(),
        store.loadManagers(),
        store.loadDepartments(),
        store.loadEmployees()
      ])

      // Получаем обновленное состояние после загрузки
      const currentState = useFilterStore.getState()
      const updates: Record<string, string | null> = {}

      // Валидация организационных фильтров
      if (currentState.selectedSubdivisionId) {
        const valid = currentState.subdivisions.some(s => s.id === currentState.selectedSubdivisionId)
        if (!valid) {
          console.warn(`⚠️ Подразделение "${currentState.selectedSubdivisionId}" не найдено, сбрасываю`)
          updates.selectedSubdivisionId = null
          updates.selectedDepartmentId = null
          updates.selectedTeamId = null
          updates.selectedEmployeeId = null
        }
      }

      if (currentState.selectedDepartmentId && !updates.selectedDepartmentId) {
        const valid = currentState.departments.some(d => d.id === currentState.selectedDepartmentId)
        if (!valid) {
          console.warn(`⚠️ Отдел "${currentState.selectedDepartmentId}" не найден, сбрасываю`)
          updates.selectedDepartmentId = null
          updates.selectedTeamId = null
          updates.selectedEmployeeId = null
        }
      }

      if (currentState.selectedTeamId && !updates.selectedTeamId) {
        const valid = currentState.teams.some(t => t.id === currentState.selectedTeamId)
        if (!valid) {
          console.warn(`⚠️ Команда "${currentState.selectedTeamId}" не найдена, сбрасываю`)
          updates.selectedTeamId = null
          updates.selectedEmployeeId = null
        }
      }

      if (currentState.selectedEmployeeId && !updates.selectedEmployeeId) {
        const valid = currentState.employees.some(e => e.id === currentState.selectedEmployeeId)
        if (!valid) {
          console.warn(`⚠️ Сотрудник "${currentState.selectedEmployeeId}" не найден, сбрасываю`)
          updates.selectedEmployeeId = null
        }
      }

      // Валидация проектных фильтров
      if (currentState.selectedManagerId) {
        const valid = currentState.managers.some(m => m.id === currentState.selectedManagerId)
        if (!valid) {
          console.warn(`⚠️ Менеджер "${currentState.selectedManagerId}" не найден, сбрасываю`)
          updates.selectedManagerId = null
          updates.selectedProjectId = null
          updates.selectedStageId = null
          updates.selectedObjectId = null
        }
      }

      // Применяем обновления если есть
      if (Object.keys(updates).length > 0) {
        console.log('🔄 Применяю валидированные фильтры после rehydration:', updates)
        useFilterStore.setState(updates)
      }

      // Загружаем зависимые данные для валидных фильтров
      const finalState = useFilterStore.getState()

      if (finalState.selectedManagerId) {
        await store.loadProjects(finalState.selectedManagerId)

        // Валидируем проект
        const afterProjects = useFilterStore.getState()
        if (afterProjects.selectedProjectId) {
          const validProject = afterProjects.projects.some(p => p.id === afterProjects.selectedProjectId)
          if (!validProject) {
            console.warn(`⚠️ Проект "${afterProjects.selectedProjectId}" не найден, сбрасываю`)
            useFilterStore.setState({
              selectedProjectId: null,
              selectedStageId: null,
              selectedObjectId: null
            })
          }
        }
      }

      const afterProjectValidation = useFilterStore.getState()
      if (afterProjectValidation.selectedProjectId) {
        await store.loadStages(afterProjectValidation.selectedProjectId)

        // Валидируем стадию
        const afterStages = useFilterStore.getState()
        if (afterStages.selectedStageId) {
          const validStage = afterStages.stages.some(s => s.id === afterStages.selectedStageId)
          if (!validStage) {
            console.warn(`⚠️ Стадия "${afterStages.selectedStageId}" не найдена, сбрасываю`)
            useFilterStore.setState({
              selectedStageId: null,
              selectedObjectId: null
            })
          }
        }
      }

      const afterStageValidation = useFilterStore.getState()
      if (afterStageValidation.selectedStageId) {
        await store.loadObjects(afterStageValidation.selectedStageId)

        // Валидируем объект
        const afterObjects = useFilterStore.getState()
        if (afterObjects.selectedObjectId) {
          const validObject = afterObjects.objects.some(o => o.id === afterObjects.selectedObjectId)
          if (!validObject) {
            console.warn(`⚠️ Объект "${afterObjects.selectedObjectId}" не найден, сбрасываю`)
            useFilterStore.setState({ selectedObjectId: null })
          }
        }
      }

      console.log('✅ Валидация фильтров после rehydration завершена')
    }

    validateFilters().catch(console.error)
  }, [])
}
