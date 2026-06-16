export interface MockStage {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
}

export interface MockSection {
  id: string
  name: string
  stages: MockStage[]
}

export interface MockObject {
  id: string
  name: string
  sections: MockSection[]
}

export interface MockProject {
  id: string
  name: string
  color: string
  objects: MockObject[]
}

export type GanttScale = 'day' | 'week' | 'month'
