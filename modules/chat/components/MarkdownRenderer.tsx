"use client"

import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
  isUserMessage?: boolean
}

export function MarkdownRenderer({ content, className, isUserMessage = false }: MarkdownRendererProps) {
  const { resolvedTheme } = useTheme()

  return (
    <div className={cn(
      "markdown-content w-full",
      // Базовые стили для текста с принудительным переносом
      "prose prose-sm max-w-none break-words",
      // Условная темная тема для ассистента
      !isUserMessage && "dark:prose-invert",
      // Заголовки - более компактные для чата
      "prose-headings:font-medium prose-headings:leading-tight",
      "prose-h1:text-base prose-h1:mb-2 prose-h1:mt-1",
      "prose-h2:text-sm prose-h2:mb-2 prose-h2:mt-1", 
      "prose-h3:text-sm prose-h3:mb-1 prose-h3:mt-1",
      // Параграфы - более компактные отступы
      "prose-p:leading-relaxed prose-p:my-1",
      // Списки - уменьшенные отступы
      "prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
      // Цитаты - стилизация под чат
      isUserMessage 
        ? "prose-blockquote:border-l-white/30 prose-blockquote:bg-white/10 prose-blockquote:text-white/90"
        : "prose-blockquote:border-l-primary prose-blockquote:bg-muted/30",
      "prose-blockquote:px-2 prose-blockquote:py-1 prose-blockquote:my-2",
      // Код - адаптация под размер чата
      isUserMessage
        ? "prose-code:text-emerald-100 prose-code:bg-white/20"
        : "prose-code:text-primary prose-code:bg-muted/60",
      "prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs",
      "prose-pre:bg-muted/90 prose-pre:border prose-pre:border-border prose-pre:my-2",
      // Таблицы - компактный вид
      "prose-table:my-2 prose-table:text-xs",
      isUserMessage
        ? "prose-th:text-white prose-td:text-white prose-th:border-white/20 prose-td:border-white/20 prose-th:bg-white/10"
        : "prose-th:text-foreground prose-td:text-foreground prose-th:border-border prose-td:border-border prose-th:bg-muted/30",
      // Ссылки
      isUserMessage
        ? "prose-a:text-emerald-100 prose-a:underline"
        : "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
      // Разделители
      isUserMessage
        ? "prose-hr:border-white/30"
        : "prose-hr:border-border",
      "prose-hr:my-3",
      className
    )}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const {children, className, node, ...rest} = props
            const match = /language-(\w+)/.exec(className || '')
            return match ? (
                              <SyntaxHighlighter
                  PreTag="div"
                  language={match[1]}
                  style={resolvedTheme === 'dark' ? oneDark : oneLight}
                  className="rounded-md border border-border text-xs"
                  customStyle={{
                    margin: '0.5rem 0',
                    padding: '0.75rem',
                    fontSize: '0.75rem',
                    lineHeight: '1.4',
                    overflowX: 'auto',
                    maxWidth: '100%',
                    wordBreak: 'break-all'
                  }}
                  wrapLongLines={true}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            ) : (
              <code {...rest} className={cn(
                className,
                "text-xs px-1 py-0.5 rounded",
                isUserMessage 
                  ? "text-emerald-100 bg-white/20" 
                  : "text-primary bg-muted/60"
              )}>
                {children}
              </code>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2 max-w-full">
                <table className={cn(
                  "border-collapse border text-xs table-auto whitespace-nowrap",
                  isUserMessage 
                    ? "border-white/20" 
                    : "border-border"
                )}>
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className={cn(
                "border px-2 py-1 font-medium text-left text-xs whitespace-nowrap",
                isUserMessage
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-border bg-muted/30 text-foreground"
              )}>
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className={cn(
                "border px-2 py-1 text-xs whitespace-nowrap",
                isUserMessage
                  ? "border-white/20 text-white"
                  : "border-border text-foreground"
              )}>
                {children}
              </td>
            )
          },
          blockquote({ children }) {
            return (
              <blockquote className={cn(
                "border-l-4 px-2 py-1 my-2 italic text-sm",
                isUserMessage
                  ? "border-white/30 bg-white/10 text-white/90"
                  : "border-primary bg-muted/30 text-muted-foreground"
              )}>
                {children}
              </blockquote>
            )
          },
          // Обработка заголовков с учетом размера чата
          h1({ children }) {
            return (
              <h1 className={cn(
                "text-base font-medium mb-2 mt-1",
                isUserMessage ? "text-white" : "text-foreground"
              )}>
                {children}
              </h1>
            )
          },
          h2({ children }) {
            return (
              <h2 className={cn(
                "text-sm font-medium mb-2 mt-1",
                isUserMessage ? "text-white" : "text-foreground"
              )}>
                {children}
              </h2>
            )
          },
          h3({ children }) {
            return (
              <h3 className={cn(
                "text-sm font-medium mb-1 mt-1",
                isUserMessage ? "text-white" : "text-foreground"
              )}>
                {children}
              </h3>
            )
          },
          // Параграфы
          p({ children }) {
            return (
              <p className={cn(
                "leading-relaxed my-1 text-sm",
                isUserMessage ? "text-white" : "text-foreground"
              )}>
                {children}
              </p>
            )
          },
          // Списки
          ul({ children }) {
            return (
              <ul className={cn(
                "my-1 ml-4 list-disc text-sm",
                isUserMessage ? "text-white" : "text-foreground"
              )}>
                {children}
              </ul>
            )
          },
          ol({ children }) {
            return (
              <ol className={cn(
                "my-1 ml-4 list-decimal text-sm",
                isUserMessage ? "text-white" : "text-foreground"
              )}>
                {children}
              </ol>
            )
          },
          li({ children }) {
            return (
              <li className={cn(
                "my-0 text-sm",
                isUserMessage ? "text-white" : "text-foreground"
              )}>
                {children}
              </li>
            )
          },
          // Ссылки
          a({ children, href }) {
            return (
              <a 
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "underline hover:no-underline transition-all",
                  isUserMessage 
                    ? "text-emerald-100 hover:text-white" 
                    : "text-primary hover:text-primary/80"
                )}
              >
                {children}
              </a>
            )
          },
          // Горизонтальные линии
          hr() {
            return (
              <hr className={cn(
                "my-3 border-t",
                isUserMessage ? "border-white/30" : "border-border"
              )} />
            )
          }
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
