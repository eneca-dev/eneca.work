'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  CheckSquare,
  Undo,
  Redo,
  AtSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMentions } from '../hooks/useMentions'

interface CommentEditorProps {
  sectionId: string
  onSubmit: (content: string, mentions: string[]) => Promise<void>
  isSubmitting: boolean
  placeholder?: string
}

// Удаляет хвостовые пробелы и пустые переносы строк в HTML контенте
const trimTrailingWhitespaceFromHTML = (html: string): string => {
  if (!html) return html
  let cleaned = html
    // Пробелы/табуляции перед закрывающими блочными тегами
    .replace(/([^\S\r\n]+)(?=<\/(p|li|h[1-6]|div)>)/gi, '')
    // Хвостовые пустые параграфы/брейки/nbsp в самом конце документа
    .replace(/(?:<p>(?:\s|&nbsp;|<br\s*\/?>(\s|&nbsp;)*)*<\/p>)+$/i, '')
    .replace(/(?:<div>(?:\s|&nbsp;|<br\s*\/?>(\s|&nbsp;)*)*<\/div>)+$/i, '')
    // Финальные пробелы и переносы
    .replace(/\s+$/g, '')
  return cleaned
}

export function CommentEditor({ 
  sectionId, 
  onSubmit, 
  isSubmitting, 
  placeholder = "Добавьте комментарий..." 
}: CommentEditorProps) {
  const [content, setContent] = useState('')
  const { extractMentions, searchUsers, renderMentionSuggestion } = useMentions()

  //  Правильная инжекция CSS через useEffect с cleanup и reference counting
  useEffect(() => {
    const styleId = 'comment-editor-styles'
    let existingStyle = document.getElementById(styleId) as HTMLStyleElement | null
    
    if (!existingStyle) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = commentEditorStyles
      style.dataset.instances = '1'
      document.head.appendChild(style)
    } else {
      // Увеличиваем счетчик экземпляров
      const currentCount = parseInt(existingStyle.dataset.instances || '0')
      existingStyle.dataset.instances = (currentCount + 1).toString()
    }
    
    // Cleanup функция
    return () => {
      const style = document.getElementById(styleId) as HTMLStyleElement | null
      if (style) {
        const currentCount = parseInt(style.dataset.instances || '1')
        if (currentCount <= 1) {
          // Последний экземпляр - удаляем стили
          style.remove()
        } else {
          // Уменьшаем счетчик экземпляров
          style.dataset.instances = (currentCount - 1).toString()
        }
      }
    }
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // Используем ту же конфигурацию StarterKit как в заметках, но упрощенную
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3] // Оставляем заголовки для форматирования
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: true
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: true
        },
        // Убираем ненужные для комментариев сложные блоки
        codeBlock: false,      // Нет блоков кода
        horizontalRule: false  // Нет разделителей
      }),
      
      // Добавляем расширения из заметок (кроме сложных)
      Underline,
      TextStyle,
      
      // Highlight как в заметках
      Highlight.configure({
        multicolor: true
      }),
      
      // Link как в заметках  
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:text-blue-800'
        }
      }),
      
      // TaskList как в заметках - простая конфигурация
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      
      // Placeholder - скрывается при любом содержимом (включая списки)
      Placeholder.configure({ 
        placeholder: ({ editor }) => {
          // Проверяем действительно ли редактор пуст (только пустой параграф)
          const doc = editor.state.doc
          const isEmpty = doc.childCount === 1 && 
                         doc.firstChild?.type.name === 'paragraph' && 
                         doc.firstChild?.content.size === 0
          return isEmpty ? 'Начните писать комментарий...' : ''
        },
        emptyEditorClass: 'is-editor-empty',
        showOnlyCurrent: false
      }),
      
      // Mention
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded text-sm font-medium',
          'data-type': 'mention',
        },
        deleteTriggerWithBackspace: true,
        renderHTML({ node }) {
          return [
            'span',
            {
              class: 'mention bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded text-sm font-medium',
              'data-type': 'mention',
              'data-id': node.attrs.id,
              'data-label': node.attrs.label,
            },
            '@' + node.attrs.label,
          ]
        },
        suggestion: {
          char: '@',
          allowSpaces: false,
          startOfLine: false,
          allowedPrefixes: null,
          items: async ({ query }: { query: string }) => {
            try {
              const users = await searchUsers(query, sectionId) 
              return users
            } catch (error) {
              console.error('Ошибка поиска пользователей:', error)
              return []
            }
          },
          render: renderMentionSuggestion(),
        },
      }),
    ],
    content: '<p></p>', // Как в заметках
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      setContent(trimTrailingWhitespaceFromHTML(html))
    },
    editorProps: {
      attributes: {
        // Минимальные классы - основные стили теперь в EditorContent
        class: 'focus:outline-none',
      },
      handleKeyDown: (view, event) => {
        // Обрабатываем Ctrl+Enter ДО того, как TipTap добавит новую строку
        if (event.ctrlKey && event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          //  Получаем актуальный контент из редактора и чистим хвостовые пробелы/переносы
          const currentHtmlContent = editor?.getHTML() || ''
          const cleanedCurrent = trimTrailingWhitespaceFromHTML(currentHtmlContent)
          if (!cleanedCurrent.trim()) return true
          
          // Переиспользуем handleSubmit вместо дублирования логики
          handleSubmit()
          
          return true // Останавливаем дальнейшую обработку TipTap
        }
        return false // Позволяем TipTap обработать остальные клавиши
      },
    },
  })

  // Функция отправки для кнопки
  const handleSubmit = useCallback(async () => {
    if (!editor) return

    const cleanedHTML = trimTrailingWhitespaceFromHTML(editor.getHTML())
    if (!cleanedHTML.trim()) return

    const mentions = extractMentions(cleanedHTML)
    const plainContent = editor.getText().replace(/\s+$/g, '')

    if (plainContent.length > 3000) {
      return // Валидация уже показана в UI
    }

    try {
      await onSubmit(cleanedHTML, mentions)
      editor.commands.clearContent()
      setContent('')
    } catch (error) {
      console.error('Ошибка отправки комментария:', error)
    }
  }, [editor, onSubmit, extractMentions])

  // ✅ ОПТИМИЗАЦИЯ: Объединяем все вычисления в один useMemo
  const editorState = useMemo(() => {
    const text = editor?.getText() || ''
    const count = text.length
    const trimmedContent = content.trim()
    
    return {
      characterCount: count,
      isOverLimit: count > 3000,
      isEmpty: !trimmedContent,
      plainText: text
    }
  }, [content, editor?.state?.doc]) // Используем стабильную ссылку на doc

  const { characterCount, isOverLimit, isEmpty } = editorState

  if (!editor) {
    return null
  }

  return (
    <div 
      className="border rounded-lg border-border focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors max-w-full overflow-hidden"
    >
      {/* Панель инструментов - упрощенная версия */}
      <div className="border-b border-border bg-muted p-2 flex flex-wrap gap-1 rounded-t-lg">
        {/* Заголовки */}
        <div className="flex gap-1 mr-2">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('heading', { level: 1 }) 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Заголовок 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('heading', { level: 2 }) 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Заголовок 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('heading', { level: 3 }) 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Заголовок 3"
          >
            <Heading3 className="h-4 w-4" />
          </button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-8 bg-border mx-1 self-center" />

        {/* Форматирование текста */}
        <div className="flex gap-1 mr-2">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('bold') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Жирный (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('italic') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Курсив (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('underline') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Подчеркнутый (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('strike') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Зачеркнутый"
          >
            <Strikethrough className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('highlight') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Выделение"
          >
            <Highlighter className="h-4 w-4" />
          </button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-8 bg-border mx-1 self-center" />

        {/* Списки */}
        <div className="flex gap-1 mr-2">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('bulletList') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Маркированный список"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('orderedList') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Нумерованный список"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('taskList') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Список задач"
          >
            <CheckSquare className="h-4 w-4" />
          </button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-8 bg-border mx-1 self-center" />

        {/* Цитата и код */}
        <div className="flex gap-1 mr-2">
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('blockquote') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Цитата"
          >
            <Quote className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              editor.isActive('code') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'text-foreground'
            )}
            title="Инлайн код"
          >
            <Code className="h-4 w-4" />
          </button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-8 bg-border mx-1 self-center" />

        {/* Упоминания */}
        <div className="flex gap-1 mr-2">
          <button
            onClick={() => {
              editor.chain().focus().insertContent('@').run()
            }}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors hover:bg-accent border-0 bg-transparent',
              'text-foreground'
            )}
            title="Добавить упоминание"
          >
            <AtSign className="h-4 w-4" />
          </button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-8 bg-border mx-1 self-center" />

        {/* Отмена/Повтор */}
        <div className="flex gap-1 mr-2">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors border-0 bg-transparent',
              !editor.can().undo() 
                ? 'text-muted-foreground cursor-not-allowed' 
                : 'text-foreground hover:bg-accent'
            )}
            title="Отменить"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className={cn(
              'h-8 w-8 p-0 rounded inline-flex items-center justify-center transition-colors border-0 bg-transparent',
              !editor.can().redo() 
                ? 'text-muted-foreground cursor-not-allowed' 
                : 'text-foreground hover:bg-accent'
            )}
            title="Повторить"
          >
            <Redo className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Редактор */}
      <div className="bg-card max-h-[200px] overflow-y-auto scrollbar-hide">
        <style dangerouslySetInnerHTML={{
          __html: `
            /*Скрываем scrollbar для чистого UI */
            .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
            
            /* Предотвращаем переполнение длинными строками */
            .editor-comment .ProseMirror {
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              word-break: break-word !important;
              max-width: 100% !important;
              overflow-x: hidden !important;
            }
            
            .editor-comment .ProseMirror * {
              max-width: 100% !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
            }
            
            /* Особо длинные слова принудительно переносим */
            .editor-comment .ProseMirror p,
            .editor-comment .ProseMirror div,
            .editor-comment .ProseMirror span {
              word-break: break-all !important;
              hyphens: auto !important;
            }
            
            /* Стили task lists */
            .editor-comment ul[data-type="taskList"] {
              list-style: none !important;
              margin-left: 0 !important;
              padding-left: 0 !important;
            }
            .editor-comment ul[data-type="taskList"] li {
              display: flex !important;
              align-items: center !important;
              gap: 8px !important;
            }
            .editor-comment ul[data-type="taskList"] li label {
              display: flex !important;
              align-items: center !important;
              cursor: pointer !important;
              flex-shrink: 0 !important;
            }
            .editor-comment ul[data-type="taskList"] li input[type="checkbox"] {
              margin: 0 !important;
              accent-color: hsl(var(--primary)) !important;
              width: 16px !important;
              height: 16px !important;
            }
            .editor-comment ul[data-type="taskList"] li > div {
              flex: 1 !important;
              min-width: 0 !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
            }
            .editor-comment ul[data-type="taskList"] li > div p {
              margin: 0 !important;
              line-height: 1.5 !important;
              word-break: break-all !important;
              max-width: 100% !important;
            }
          `
        }} />
        <EditorContent 
          editor={editor}
          className="editor-comment prose prose-sm max-w-none dark:prose-invert min-h-[120px]
                     [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:p-4 [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:text-foreground
                     [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h1]:mt-3 [&_.ProseMirror_h1]:text-foreground
                     [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:text-foreground
                     [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mb-1 [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:text-foreground
                     [&_.ProseMirror_strong]:font-bold [&_.ProseMirror_em]:italic [&_.ProseMirror_u]:underline [&_.ProseMirror_s]:line-through [&_.ProseMirror_s]:text-muted-foreground
                     [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ul]:my-2
                     [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_ol]:my-2
                     [&_.ProseMirror_li]:my-1 [&_.ProseMirror_li]:leading-relaxed
                     [&_.ProseMirror_ul_ul]:list-[circle] [&_.ProseMirror_ul_ul]:ml-4
                     [&_.ProseMirror_ul_ul_ul]:list-[square] [&_.ProseMirror_ul_ul_ul]:ml-4
                     [&_.ProseMirror_ol_ol]:list-[lower-alpha] [&_.ProseMirror_ol_ol_ol]:list-[lower-roman] [&_.ProseMirror_ol_ol_ol]:ml-4
                     [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-muted-foreground
                     [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-sm [&_.ProseMirror_code]:text-foreground
                     [&_.ProseMirror_mark]:bg-yellow-200 dark:[&_.ProseMirror_mark]:bg-yellow-700/75 dark:[&_.ProseMirror_mark]:text-foreground"
        />
      </div>
      
      {/* Панель снизу с кнопкой отправки */}
      <div className="flex justify-between items-center px-3 py-2 bg-muted rounded-b-lg gap-4 border-t border-border">
        {/* Левая часть с сообщениями и подсказками */}
        {isOverLimit && (
          <span className="text-xs text-orange-500 font-medium">
            превышен лимит символов
          </span>
        )}
        
        {!isOverLimit && (
          <div className="flex items-center space-x-4">
            <span className="text-xs text-muted-foreground">
              Ctrl+Enter для отправки
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              @ для упоминаний
            </span>
          </div>
        )}
        
        <Button 
          onClick={handleSubmit}
          disabled={isEmpty || isSubmitting || isOverLimit}
          className="min-w-[80px] h-8 px-3 text-sm"
        >
          {isSubmitting ? 'Отправка...' : 'Отправить'}
        </Button>
      </div>
    </div>
  )
}

// Минимальные CSS стили только для упоминаний
const commentEditorStyles = `
.mention {
  background-color: rgb(219 234 254);
  color: rgb(30 64 175);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
}

.dark .mention {
  background-color: rgb(30 58 138);
  color: rgb(191 219 254);
}

.mention:hover {
  background-color: rgb(191 219 254);
}

.dark .mention:hover {
  background-color: rgb(30 64 175);
}

.is-editor-empty::before {
  content: attr(data-placeholder);
  color: rgb(148 163 184);
  pointer-events: none; 
  position: absolute;
}

.dark .is-editor-empty::before {
  color: rgb(100 116 139);
}

/* Стили для упоминаний в тексте */
.ProseMirror .mention {
  background-color: rgb(219 234 254);
  color: rgb(30 64 175);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.dark .ProseMirror .mention {
  background-color: rgb(30 58 138);
  color: rgb(191 219 254);
}

.ProseMirror .mention:hover {
  background-color: rgb(191 219 254);
}

.dark .ProseMirror .mention:hover {
  background-color: rgb(30 64 175);
}
`

// Модульный CSS injection удален - теперь стили инжектируются через useEffect в компоненте 