/**
 * Widget для отображения текста в Markdown формате
 *
 * @module modules/ai-dashboard/components/widgets/TextWidget
 */

'use client'

import ReactMarkdown from 'react-markdown'

interface TextWidgetProps {
  content: string
}

/**
 * Компонент для рендеринга Markdown текста
 */
export function TextWidget({ content }: TextWidgetProps) {
  return (
    <div className="bg-white dark:bg-slate-900/95
                    border border-gray-200 dark:border-slate-700/50
                    rounded-lg p-4 shadow-sm
                    prose dark:prose-invert max-w-none
                    prose-headings:text-slate-900 dark:prose-headings:text-slate-100
                    prose-p:text-slate-700 dark:prose-p:text-slate-300
                    prose-strong:text-slate-900 dark:prose-strong:text-slate-100
                    prose-code:text-primary">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
