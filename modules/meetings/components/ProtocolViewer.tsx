'use client'

import { useMemo } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { toast } from 'sonner'
import { Calendar, Users, Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { MeetingProtocol } from '../types'
import { formatMeetingDateTime, formatFileSize } from '../utils'
import { highlightHtml } from '../highlight'
import { HighlightedText } from './HighlightedText'

interface ProtocolViewerProps {
  protocol: MeetingProtocol | null
  projectName: string | null
  /** Активный поисковый запрос — для подсветки в названии и тексте. */
  query: string
}

export function ProtocolViewer({ protocol, projectName, query }: ProtocolViewerProps) {
  // Мок-контент доверенный, но санитизируем перед вставкой — единый паттерн безопасности.
  const sanitizedHtml = useMemo(
    () => (protocol ? DOMPurify.sanitize(protocol.contentHtml) : ''),
    [protocol],
  )
  // Подсветка совпадений поиска (добавляются только наши <mark>); не пере-санитайзит на каждый ввод.
  const html = useMemo(() => highlightHtml(sanitizedHtml, query), [sanitizedHtml, query])

  if (!protocol) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <FileText className="h-10 w-10 opacity-40" />
        <p className="text-sm">Выберите протокол, чтобы открыть его текст</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-6 py-4">
        {projectName && (
          <p className="mb-1 text-xs font-medium text-primary/80">{projectName}</p>
        )}
        <h1 className="text-lg font-semibold text-foreground">
          <HighlightedText text={protocol.title} query={query} />
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatMeetingDateTime(protocol.meetingDate)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {protocol.participants.join(', ')}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Badge variant="secondary" className="font-normal">
            {protocol.fileName} · {formatFileSize(protocol.fileSizeKb)}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.info('Скачивание .docx появится на следующем этапе')}
          >
            <Download className="mr-2 h-4 w-4" />
            Скачать .docx
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <article
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
