// Минимальные типы для модуля шаблонов декомпозиции

export type TemplateListItem = {
  id: string
  name: string
  departmentId: string
  departmentName: string
  creatorName: string
  createdAt: string
}

export type TemplateStageItem = {
  description: string
  workCategoryId: string
  workCategoryName: string
  difficultyId: string | null
  difficultyName: string | null
  plannedHours: number
}

export type TemplateStage = {
  name: string
  order: number
  items: TemplateStageItem[]
}

export type TemplateDetail = {
  id: string
  name: string
  stages: TemplateStage[]
}

// Тип для Stage из stages-management (для возврата из applyTemplate)
export type Stage = {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  description: string | null
  statusId: string | null
  decompositions: Decomposition[]
}

export type Decomposition = {
  id: string
  description: string
  typeOfWork: string
  difficulty: string
  responsible: string
  plannedHours: number
  progress: number
  status: string
  completionDate: string | null
}
