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
    <div className="rounded-lg border bg-card p-4
                    prose dark:prose-invert max-w-none
                    prose-headings:font-semibold
                    prose-code:text-primary">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
