import { Fragment } from 'react'
import { splitHighlight, HIGHLIGHT_CLASS } from '../highlight'

interface HighlightedTextProps {
  text: string
  query: string
  className?: string
}

export function HighlightedText({ text, query, className }: HighlightedTextProps) {
  const segments = splitHighlight(text, query)
  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index} className={HIGHLIGHT_CLASS}>
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </span>
  )
}
