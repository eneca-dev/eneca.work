// Экспорт типов
export type { TemplateListItem, TemplateStage, TemplateStageItem, TemplateDetail, Stage, Decomposition } from './types'

// Экспорт API функций
export { loadTemplatesList, loadTemplateDetail, saveTemplate, deleteTemplate, applyTemplate } from './api'

// Экспорт компонентов
export { TemplatesDialog } from './components/TemplatesDialog'
export { SaveTemplateDialog } from './components/SaveTemplateDialog'
