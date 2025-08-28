"use client"

import React, { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from 'next-themes'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkdownViewerProps {
  filePath: string | null
  getFileContent: (path: string) => Promise<string>
  searchQuery?: string
}

export function MarkdownViewer({ filePath, getFileContent, searchQuery }: MarkdownViewerProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  // Компонент для выделения текста
  const HighlightedText = ({ children, searchQuery }: { children: string, searchQuery?: string }) => {
    if (!searchQuery || !searchQuery.trim()) {
      return <>{children}</>
    }

    const terms = searchQuery.trim().split(/\s+/).filter(Boolean)
    let parts: (string | React.ReactElement)[] = [children]
    let globalIndex = 0 // Глобальный счетчик для уникальных ключей

    terms.forEach((term, termIndex) => {
      const newParts: (string | React.ReactElement)[] = []
      parts.forEach((part, partIndex) => {
        if (typeof part === 'string') {
          const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
          const splitParts = part.split(regex)
          splitParts.forEach((splitPart, splitIndex) => {
            if (regex.test(splitPart)) {
              newParts.push(
                <span 
                  key={`highlight-${globalIndex++}-${termIndex}-${partIndex}-${splitIndex}`}
                  className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 rounded font-medium"
                >
                  {splitPart}
                </span>
              )
            } else if (splitPart) {
              newParts.push(splitPart)
            }
          })
        } else {
          newParts.push(part)
        }
      })
      parts = newParts
    })

    return <>{parts}</>
  }

  // Безопасно извлекаем текст из React-узлов, чтобы не получать [object Object]
  const toPlainText = (node: React.ReactNode): string => {
    if (node == null) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(toPlainText).join('')
    // React элемент — забираем его детей
    // @ts-expect-error — у произвольного узла может быть props.children
    const children = node?.props?.children
    return toPlainText(children)
  }

  useEffect(() => {
    if (!filePath) return

    const loadContent = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // В реальном приложении здесь был бы fetch из API или импорт статического файла
        const fileContent = await getFileContent(filePath)
        setContent(fileContent)
      } catch (err) {
        setError('Ошибка загрузки файла')
        console.error('Error loading file:', err)
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [filePath, getFileContent, searchQuery])

  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Добро пожаловать в документацию
        </h3>
        <p className="text-muted-foreground max-w-md">
          Выберите файл из дерева навигации слева, чтобы просмотреть документацию.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div>
          <h3 className="text-lg font-medium text-destructive mb-2">Ошибка</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 py-4">
        <div className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          // Заголовки
          "prose-headings:text-foreground prose-headings:font-medium",
          "prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-6",
          "prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-5", 
          "prose-h3:text-base prose-h3:mb-2 prose-h3:mt-4",
          // Текст
          "prose-p:text-foreground prose-p:leading-snug",
          "prose-strong:text-foreground prose-strong:font-semibold",
          "prose-em:text-foreground",
          // Списки
          "prose-ul:text-foreground prose-ol:text-foreground prose-ul:my-2 prose-ol:my-2",
          "prose-li:text-foreground",
          // Цитаты
          "prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary",
          "prose-blockquote:bg-muted/50 prose-blockquote:px-3 prose-blockquote:py-2",
          // Код
          "prose-code:text-primary prose-code:bg-muted/80",
          "prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.8rem]",
          "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
          // Таблицы
          "prose-table:text-foreground prose-th:text-foreground prose-td:text-foreground prose-table:my-3",
          "prose-th:border-border prose-td:border-border prose-th:bg-muted/50",
          // Разделители
          "prose-hr:border-border prose-hr:my-6",
          // Ссылки
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
        )}>
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Обновляем компоненты для поддержки выделения
              p({ children }) {
                return (
                  <p>
                    <HighlightedText searchQuery={searchQuery}>
                      {toPlainText(children)}
                    </HighlightedText>
                  </p>
                )
              },
              h1({ children }) {
                return (
                  <h1>
                    <HighlightedText searchQuery={searchQuery}>
                      {toPlainText(children)}
                    </HighlightedText>
                  </h1>
                )
              },
              h2({ children }) {
                return (
                  <h2>
                    <HighlightedText searchQuery={searchQuery}>
                      {toPlainText(children)}
                    </HighlightedText>
                  </h2>
                )
              },
              h3({ children }) {
                return (
                  <h3>
                    <HighlightedText searchQuery={searchQuery}>
                      {toPlainText(children)}
                    </HighlightedText>
                  </h3>
                )
              },
              li({ children }) {
                return (
                  <li>
                    <HighlightedText searchQuery={searchQuery}>
                      {toPlainText(children)}
                    </HighlightedText>
                  </li>
                )
              },
            code(props) {
              const {children, className, node, ...rest} = props
              const match = /language-(\w+)/.exec(className || '')
              return match ? (
                <SyntaxHighlighter
                  PreTag="div"
                  language={match[1]}
                  style={resolvedTheme === 'dark' ? oneDark : oneLight}
                  className="rounded-md border border-border"
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code {...rest} className={cn(className, "text-foreground")}>
                  {children}
                </code>
              )
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto">
                  <table className="border-collapse border border-border">
                    {children}
                  </table>
                </div>
              )
            },
            th({ children }) {
              return (
                <th className="border border-border px-4 py-2 bg-muted font-medium text-left">
                  {children}
                </th>
              )
            },
            td({ children }) {
              return (
                <td className="border border-border px-4 py-2">
                  {children}
                </td>
              )
            }
            }}
          >
            {content}
          </Markdown>
        </div>
      </div>
    </div>
  )
}
