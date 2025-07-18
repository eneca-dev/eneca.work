// Основные компоненты
export { NotesBlock } from '@/modules/notions/components/NotesBlock'
export { NoteCard } from '@/modules/notions/components/NoteCard'
export { BulkDeleteConfirm } from '@/modules/notions/components/BulkDeleteConfirm'

// Store, хуки, типы и утилиты
export { useNotionsStore } from '@/modules/notions/store'
export { useAutoSave } from '@/modules/notions/hooks/useAutoSave'
export type * from '@/modules/notions/types'
export { 
  parseNotionContent, 
  combineNotionContent, 
  markdownToHtml, 
  htmlToMarkdown, 
  markdownToTipTapHTML,
  getNotionDisplayTitle,
  splitTableRow,
  analyzeAndFixTableStructure,
  preprocessMarkdownTables
} from '@/modules/notions/utils' 