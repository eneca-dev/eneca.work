'use client'

import type { ReactNode } from 'react'
import { Calendar, Clock, MapPin, User, Download, FileText, FileWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type {
  MeetingReport,
  ReportPerson,
  ReportDiscussionItem,
  ReportOpenQuestion,
} from '../types'
import { formatMeetingDate, formatMeetingDateTime } from '../utils'
import { HighlightedText } from './HighlightedText'
import { FolderAssignSelect } from './FolderAssignSelect'
import { ShareDialog } from './ShareDialog'

interface ReportViewerProps {
  meeting: MeetingReport | null
  query: string
}

export function ReportViewer({ meeting, query }: ReportViewerProps) {
  if (!meeting) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <FileText className="h-10 w-10 opacity-40" />
        <p className="text-sm">Выберите созвон, чтобы открыть протокол</p>
      </div>
    )
  }

  const report = meeting.report
  const title = meeting.subject?.trim() || report?.subject?.trim() || 'Созвон без темы'

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-3 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">
          <HighlightedText text={title} query={query} />
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {meeting.meeting_started_at ? (
            <Meta icon={Calendar}>{formatMeetingDateTime(meeting.meeting_started_at)}</Meta>
          ) : (
            meeting.meeting_date && <Meta icon={Calendar}>{formatMeetingDate(meeting.meeting_date)}</Meta>
          )}
          {report?.duration && <Meta icon={Clock}>{report.duration}</Meta>}
          {report?.location && <Meta icon={MapPin}>{report.location}</Meta>}
          {meeting.invited_by_name && <Meta icon={User}>{meeting.invited_by_name}</Meta>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DownloadButton url={meeting.protocol_docx_url} label="Протокол .docx" />
          <DownloadButton url={meeting.transcript_docx_url} label="Транскрипт .docx" variant="ghost" />
          {meeting.isOwner && <ShareDialog reportId={meeting.id} />}
          <div className="ml-auto">
            <FolderAssignSelect reportId={meeting.id} />
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {!report && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileWarning className="h-4 w-4" />
            Протокол ещё не сформирован (статус: {meeting.status}).
          </div>
        )}

        {report?.preview_summary && (
          <Section title="Кратко">
            <p className="text-sm leading-relaxed text-foreground">
              <HighlightedText text={report.preview_summary} query={query} />
            </p>
          </Section>
        )}

        {report?.participants && report.participants.length > 0 && (
          <Section title="Участники">
            <ul className="flex flex-wrap gap-1.5">
              {report.participants.map((p, i) => (
                <li key={i}>
                  <Badge variant="secondary" className="font-normal">
                    <HighlightedText text={personLabel(p)} query={query} />
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {report?.discussion_items && report.discussion_items.length > 0 && (
          <Section title="Обсуждение">
            <div className="space-y-3">
              {report.discussion_items.map((item, i) => (
                <DiscussionCard key={i} item={item} query={query} />
              ))}
            </div>
          </Section>
        )}

        {report?.open_questions && report.open_questions.length > 0 && (
          <Section title="Открытые вопросы">
            <div className="space-y-3">
              {report.open_questions.map((q, i) => (
                <QuestionCard key={i} question={q} query={query} />
              ))}
            </div>
          </Section>
        )}

        {report?.risks && report.risks.length > 0 && (
          <Section title="Риски">
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {report.risks.map((r, i) => (
                <li key={i}>
                  <HighlightedText text={r.description || r.comment || '—'} query={query} />
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}

function Meta({ icon: Icon, children }: { icon: typeof Calendar; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

function DownloadButton({
  url,
  label,
  variant = 'outline',
}: {
  url: string | null
  label: string
  variant?: 'outline' | 'ghost'
}) {
  if (!url) return null
  return (
    <Button asChild size="sm" variant={variant}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Download className="mr-2 h-4 w-4" />
        {label}
      </a>
    </Button>
  )
}

function personLabel(p: ReportPerson): string {
  const extra = [p.role, p.organization].filter(Boolean).join(', ')
  return extra ? `${p.name} (${extra})` : p.name
}

function DiscussionCard({ item, query }: { item: ReportDiscussionItem; query: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          <HighlightedText text={item.topic || 'Тема'} query={query} />
        </p>
        {item.status && (
          <Badge variant="secondary" className="flex-shrink-0 font-normal">
            {item.status}
          </Badge>
        )}
      </div>
      {item.outcome && (
        <p className="mt-1 text-sm text-muted-foreground">
          <HighlightedText text={item.outcome} query={query} />
        </p>
      )}
      <ResponsibleLine responsible={item.responsible} deadline={item.deadline} />
    </div>
  )
}

function QuestionCard({ question, query }: { question: ReportOpenQuestion; query: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">
        <HighlightedText text={question.question || 'Вопрос'} query={query} />
      </p>
      {question.comment && (
        <p className="mt-1 text-sm text-muted-foreground">
          <HighlightedText text={question.comment} query={query} />
        </p>
      )}
      <ResponsibleLine responsible={question.responsible} deadline={question.deadline} />
    </div>
  )
}

function ResponsibleLine({
  responsible,
  deadline,
}: {
  responsible?: string | null
  deadline?: string | null
}) {
  if (!responsible && !deadline) return null
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      {responsible && <span>Ответственный: {responsible}</span>}
      {responsible && deadline && <span> · </span>}
      {deadline && <span>Срок: {deadline}</span>}
    </p>
  )
}
