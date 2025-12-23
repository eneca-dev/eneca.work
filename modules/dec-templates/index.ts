// Экспорт типов
export type {
  TemplateListItem,
  TemplateStage,
  TemplateStageItem,
  TemplateDetail,
  Stage,
  Decomposition,
} from './types'

// Экспорт Server Actions
export {
  getTemplatesList,
  getTemplateDetail,
  createTemplate,
  removeTemplate,
  applyTemplateToSection,
} from './actions/templates'

// Экспорт хуков
export {
  useTemplatesList,
  useTemplateDetail,
  useCreateTemplate,
  useDeleteTemplate,
  useApplyTemplate,
} from './hooks'

// Экспорт компонентов
export { TemplatesDialog } from './components/TemplatesDialog'
export { SaveTemplateDialog } from './components/SaveTemplateDialog'
