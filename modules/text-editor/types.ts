export interface TipTapEditorProps {
  initialTitle?: string
  initialValue: string
  onSave: (content: string) => void
  onCancel: () => void
  titlePlaceholder?: string
  showTitle?: boolean
  autoFocus?: boolean
  className?: string
  notionId?: string // Для автосохранения
  enableAutoSave?: boolean // Включить автосохранение
}

export interface TipTapEditorRef {
  save: () => Promise<void>
  focus: () => void
  getContent: () => string
}

export interface TipTapNoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notion?: {
    notion_id: string
    notion_content: string
    notion_done: boolean
    notion_created_by: string
    notion_created_at: string
    notion_updated_at: string
  }
  onSave: (content: string) => void
  mode: 'create' | 'edit'
}

export interface QuickTipTapNoteProps {
  onSave: (content: string) => void
  onCancel: () => void
  placeholder?: string
  titlePlaceholder?: string
  autoFocus?: boolean
}

// Alias for compatibility
export type EditorRef = TipTapEditorRef 