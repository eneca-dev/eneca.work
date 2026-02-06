// modules/checkpoints/index.ts

export * from './types'
export * from './hooks'
export { CheckpointMarkers } from './components/CheckpointMarker'
export { CheckpointVerticalLinks } from './components/CheckpointVerticalLinks'
export { CheckpointLinksProvider, useCheckpointLinks } from './context/CheckpointLinksContext'

// MOCK DATA - prototype exports
export { CheckpointFilters } from './components/CheckpointFilters'
export { ResolveProblemModal } from './components/ResolveProblemModal'
export { useCheckpointFilters } from './stores/checkpoint-filter-store'
export { getMockCheckpointsForSection, isDemoProject1 } from './mocks/mock-checkpoint-data'
