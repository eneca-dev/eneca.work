'use client'

import { useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Mention from '@tiptap/extension-mention'
import { useUserStore } from '@/stores/useUserStore'

interface ReadOnlyTipTapEditorProps {
  content: string
  commentId: string
  authorId: string // ID автора комментария для проверки прав
  onUpdate?: (newContent: string) => void
}

export function ReadOnlyTipTapEditor({ content, commentId, authorId, onUpdate }: ReadOnlyTipTapEditorProps) {
  const currentUserId = useUserStore(state => state.id) //  Получаем ID текущего пользователя
  const isAuthor = currentUserId === authorId // Проверяем является ли пользователь автором

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // Используем ту же конфигурацию как в CommentEditor
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
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
        codeBlock: false,
        horizontalRule: false
      }),
      
      // Добавляем расширения из CommentEditor
      Underline,
      TextStyle,
      
      // Highlight как в CommentEditor
      Highlight.configure({
        multicolor: true
      }),
      
      // Link как в CommentEditor  
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:text-blue-800'
        }
      }),

      // Mention — чтобы подсвечивать @упоминания в read-only
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded text-sm font-medium',
          'data-type': 'mention',
        },
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
      }),
      
      // TaskList как в заметках - простая конфигурация
      TaskList,
      TaskItem.configure({
        nested: true
      }),
    ],
    content,
    editable: false, // ❗ Ключевое отличие - НЕ редактируем текст
    editorProps: {
      attributes: {
        // Те же CSS классы что в CommentEditor для единообразия
        class: 'prose prose-sm max-w-none dark:prose-invert ' +
               '[&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:text-gray-900 dark:[&_.ProseMirror]:text-gray-100 ' +
               '[&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h1]:mt-3 [&_.ProseMirror_h1]:text-gray-900 dark:[&_.ProseMirror_h1]:text-gray-100 ' +
               '[&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:text-gray-900 dark:[&_.ProseMirror_h2]:text-gray-100 ' +
               '[&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mb-1 [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:text-gray-900 dark:[&_.ProseMirror_h3]:text-gray-100 ' +
               '[&_.ProseMirror_strong]:font-bold [&_.ProseMirror_em]:italic [&_.ProseMirror_u]:underline [&_.ProseMirror_s]:line-through [&_.ProseMirror_s]:text-gray-500 dark:[&_.ProseMirror_s]:text-gray-400 ' +
               '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ul]:my-2 ' +
               '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_ol]:my-2 ' +
               '[&_.ProseMirror_li]:my-1 [&_.ProseMirror_li]:leading-relaxed ' +
               '[&_.ProseMirror_ul_ul]:list-[circle] [&_.ProseMirror_ul_ul]:ml-4 ' +
               '[&_.ProseMirror_ul_ul_ul]:list-[square] [&_.ProseMirror_ul_ul_ul]:ml-4 ' +
               '[&_.ProseMirror_ol_ol]:list-[lower-alpha] [&_.ProseMirror_ol_ol]:ml-4 ' +
               '[&_.ProseMirror_ol_ol_ol]:list-[lower-roman] [&_.ProseMirror_ol_ol_ol]:ml-4 ' +
               '[&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-gray-300 dark:[&_.ProseMirror_blockquote]:border-gray-600 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-gray-700 dark:[&_.ProseMirror_blockquote]:text-gray-300 ' +
               '[&_.ProseMirror_code]:bg-gray-100 dark:[&_.ProseMirror_code]:bg-gray-700 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-sm [&_.ProseMirror_code]:text-gray-800 dark:[&_.ProseMirror_code]:text-gray-200 ' +
               '[&_.ProseMirror_mark]:bg-yellow-200 dark:[&_.ProseMirror_mark]:bg-yellow-700/75 dark:[&_.ProseMirror_mark]:text-gray-100 ' +
               
               '[&_.ProseMirror_ul[data-type=\'taskList\']]:list-none [&_.ProseMirror_ul[data-type=\'taskList\']_li]:flex [&_.ProseMirror_ul[data-type=\'taskList\']_li]:items-center [&_.ProseMirror_ul[data-type=\'taskList\']_li]:gap-2 [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_label]:flex [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_label]:items-center [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_label]:gap-1 [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_label]:cursor-pointer [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_label]:min-h-[1.5rem] [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_label]:flex-shrink-0 [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_label_>_input[type=\'checkbox\']]:m-0 [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_label_>_input[type=\'checkbox\']]:!accent-[hsl(162_58%_28%)] [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_label_>_input[type=\'checkbox\']]:mt-0 [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_div]:flex-1 [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_div]:min-h-[1.5rem] [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_div]:min-w-0 [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_div]:break-words [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_div]:flex [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_div]:items-center [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_div_>_p]:break-words [&_.ProseMirror_ul[data-type=\'taskList\']_li_>_div_>_p]:my-0 [&_.ProseMirror_ul[data-type=\'taskList\']_li[data-checked=\'true\']_>_div]:!text-gray-500 dark:[&_.ProseMirror_ul[data-type=\'taskList\']_li[data-checked=\'true\']_>_div]:!text-gray-400 [&_.ProseMirror_ul[data-type=\'taskList\']_li[data-checked=\'true\']_>_div]:!line-through [&_.ProseMirror_ul[data-type=\'taskList\']_li[data-checked=\'true\']_>_div_>_p]:!text-gray-500 dark:[&_.ProseMirror_ul[data-type=\'taskList\']_li[data-checked=\'true\']_>_div_>_p]:!text-gray-400 [&_.ProseMirror_ul[data-type=\'taskList\']_li[data-checked=\'true\']_>_div_>_p]:!line-through ' +
               '[&_.ProseMirror_ul[data-type=\'taskList\']_ul[data-type=\'taskList\']]:ml-4 [&_.ProseMirror_ul[data-type=\'taskList\']_ul[data-type=\'taskList\']_ul[data-type=\'taskList\']]:ml-4',
      },
    },
    onUpdate: ({ editor }) => {
      // Автосохранение при изменении чекбоксов (только если контент действительно изменился)
      const newContent = editor.getHTML()
      if (newContent !== content) {
        onUpdate?.(newContent)
      }
    },
  })



  //  Разрешаем клики только автору комментария
  useEffect(() => {
    if (!editor) return
    
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Проверяем что кликнули именно на чекбокс в TaskList
      if (target.tagName === 'INPUT' && 
          (target as HTMLInputElement).type === 'checkbox') {
        
        const taskList = target.closest('ul[data-type="taskList"]')
        const taskItem = target.closest('li')
        
        if (taskItem && taskList) {
          //  Только автор может изменять чекбоксы
          if (!isAuthor) {
            event.preventDefault()
            event.stopPropagation()
            return false
          }

          // Временно включаем редактирование для обработки клика
          editor.setEditable(true)
          
          // Используем requestAnimationFrame для стабильного переключения после обработки клика
          requestAnimationFrame(() => {
            editor.setEditable(false)
          })
          
          return
        }
      }
    }
    
    const editorDOM = editor.view.dom
    editorDOM.addEventListener('click', handleClick, true) // capture phase
    
    return () => {
      editorDOM.removeEventListener('click', handleClick, true)
    }
  }, [editor, onUpdate, isAuthor]) //  isAuthor в зависимости

  // Обновляем контент когда props изменяется
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [editor, content])

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          /* Предотвращаем переполнение длинными строками */
          .readonly-comment {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
            max-width: 100% !important;
            overflow-x: hidden !important;
          }
          
          .readonly-comment * {
            max-width: 100% !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }
          
          /* Особо длинные слова принудительно переносим */
          .readonly-comment p,
          .readonly-comment div,
          .readonly-comment span {
            word-break: break-all !important;
            hyphens: auto !important;
            max-width: 100% !important;
          }
          
          /* Стили заголовков */
          .readonly-comment h1 {
            font-size: 1.25rem !important;
            font-weight: bold !important;
            margin-bottom: 0.5rem !important;
            margin-top: 0.75rem !important;
            color: rgb(15 23 42) !important;
            word-break: break-word !important;
          }
          .readonly-comment h2 {
            font-size: 1.125rem !important;
            font-weight: bold !important;
            margin-bottom: 0.5rem !important;
            margin-top: 0.75rem !important;
            color: rgb(15 23 42) !important;
            word-break: break-word !important;
          }
          .readonly-comment h3 {
            font-size: 1rem !important;
            font-weight: bold !important;
            margin-bottom: 0.25rem !important;
            margin-top: 0.5rem !important;
            color: rgb(15 23 42) !important;
            word-break: break-word !important;
          }
          
          /* Темная тема для заголовков — привязка к .dark, а не к prefers-color-scheme */
          .dark .readonly-comment h1,
          .dark .readonly-comment h2,
          .dark .readonly-comment h3 {
            color: rgb(241 245 249) !important;
          }
          
          /* Стили текста */
          .readonly-comment strong {
            font-weight: bold !important;
            word-break: break-all !important;
          }
          .readonly-comment em {
            font-style: italic !important;
            word-break: break-all !important;
          }
          .readonly-comment u {
            text-decoration: underline !important;
            word-break: break-all !important;
          }
          .readonly-comment mark {
            background-color: rgb(254 240 138) !important;
            color: inherit !important;
            word-break: break-all !important;
          }
          
          /* Темная тема для выделенного текста */
          @media (prefers-color-scheme: dark) {
            .readonly-comment mark {
              background-color: rgb(161 98 7 / 0.75) !important;
              color: rgb(229 231 235) !important;
            }
          }
          
          /* Стили списков */
          .readonly-comment ul:not([data-type="taskList"]) {
            list-style: disc !important;
            margin-left: 1.5rem !important;
            margin-top: 0.5rem !important;
            margin-bottom: 0.5rem !important;
            word-break: break-all !important;
          }
          .readonly-comment ol {
            list-style: decimal !important;
            margin-left: 1.5rem !important;
            margin-top: 0.5rem !important;
            margin-bottom: 0.5rem !important;
            word-break: break-all !important;
          }
          .readonly-comment li {
            margin: 0.25rem 0 !important;
            word-break: break-all !important;
          }
          
          /* Стили задач */
          .readonly-comment ul[data-type="taskList"] {
            list-style: none !important;
            margin-left: 0 !important;
            padding-left: 0 !important;
          }
          .readonly-comment ul[data-type="taskList"] li {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            margin: 2px 0 !important;
            max-width: 100% !important;
          }
          .readonly-comment ul[data-type="taskList"] li label {
            display: flex !important;
            align-items: center !important;
            cursor: pointer !important;
            flex-shrink: 0 !important;
          }
          .readonly-comment ul[data-type="taskList"] li input[type="checkbox"] {
            margin: 0 !important;
            accent-color: #1e7260 !important;
          }
          /*  Стили для недоступных чекбоксов */
          .readonly-comment.non-author ul[data-type="taskList"] li input[type="checkbox"] {
            opacity: 0.6 !important;
            cursor: not-allowed !important;
          }
          .readonly-comment.non-author ul[data-type="taskList"] li label {
            cursor: not-allowed !important;
          }
          .readonly-comment ul[data-type="taskList"] li > div {
            flex: 1 !important;
            display: flex !important;
            align-items: center !important;
            max-width: calc(100% - 32px) !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }
          .readonly-comment ul[data-type="taskList"] li > div p {
            margin: 0 !important;
            line-height: 1.5 !important;
            word-break: break-all !important;
            max-width: 100% !important;
          }

          /* Подсветка @упоминаний */
          .readonly-comment .mention {
            background-color: rgb(219 234 254) !important;
            color: rgb(30 64 175) !important;
            padding: 0.125rem 0.25rem !important;
            border-radius: 0.25rem !important;
            font-size: 0.875rem !important;
            font-weight: 500 !important;
            text-decoration: none !important;
            cursor: pointer !important;
          }
          .dark .readonly-comment .mention {
            background-color: rgb(30 58 138) !important;
            color: rgb(191 219 254) !important;
          }
          .readonly-comment .mention:hover {
            background-color: rgb(191 219 254) !important;
          }
          .dark .readonly-comment .mention:hover {
            background-color: rgb(30 64 175) !important;
          }
        `
      }} />
      <div 
        className={`readonly-comment select-text text-sm text-slate-700 dark:text-slate-300 ${!isAuthor ? 'non-author' : ''}`}
      >
        <EditorContent editor={editor} />
      </div>
    </>
  )
} 