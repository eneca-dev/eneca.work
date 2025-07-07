"use client"

import { useMemo } from "react"
import { useTaskTransferStore } from "../store"
import { getFilteredAssignments } from "../utils"
import type { TaskFilters } from "../types"

export const useFilteredData = (filters: TaskFilters, currentUserSectionId?: string) => {
  const { 
    assignments, 
    projects, 
    stages, 
    objects, 
    departments, 
    teams, 
    specialists,
    sections,
    isLoadingAssignments 
  } = useTaskTransferStore()

  // Фильтрованные задания
  const filteredAssignments = useMemo(() => {
    return getFilteredAssignments(filters, currentUserSectionId)
  }, [filters, assignments, currentUserSectionId])

  // Статистика
  const stats = useMemo(() => {
    return {
      total: filteredAssignments.length,
      created: filteredAssignments.filter(a => a.status === "Создано").length,
      transferred: filteredAssignments.filter(a => a.status === "Передано").length,
      accepted: filteredAssignments.filter(a => a.status === "Принято").length,
      completed: filteredAssignments.filter(a => a.status === "Выполнено").length,
      approved: filteredAssignments.filter(a => a.status === "Согласовано").length,
    }
  }, [filteredAssignments])

  return {
    // Данные
    assignments: filteredAssignments,
    allAssignments: assignments,
    projects,
    stages,
    objects,
    departments,
    teams,
    specialists,
    sections,
    
    // Статистика
    stats,
    
    // Состояние загрузки
    isLoading: isLoadingAssignments
  }
}
