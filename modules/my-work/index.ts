// Экспорты модуля "Моя работа"

export { MyWorkWidget } from './components/MyWorkWidget'
export { UserLoadingsList } from './components/UserLoadingsList'
export { ResponsibilitiesBlock } from './components/ResponsibilitiesBlock'
export { WorkTasksChart } from './components/WorkTasksChart'
export { DeadlinesBlock } from './components/DeadlinesBlock'
export { ScrollableContainer } from './components/ScrollableContainer'

export { useMyWorkData } from './hooks/useMyWorkData'
export { useDecompositionData } from './hooks/useDecompositionData'
export { useTasksData } from './hooks/useTasksData'

export type {
  UserLoading,
  DecompositionItem,
  UserTask,
  UserAnalytics as UserAnalyticsType,
  ResponsibilityInfo,
  MyWorkData,
  WorkLogEntry,
  DeadlinesBlockProps
} from './types'
