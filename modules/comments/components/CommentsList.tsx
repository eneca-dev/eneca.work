'use client'

import { CommentItem } from './CommentItem'
import type { SectionComment } from '../types'

interface CommentsListProps {
  comments: SectionComment[]
  loading: boolean
}

/**
 * Skeleton для загрузки комментария
 */
function CommentSkeleton() {
  return (
    <div className="animate-pulse space-y-2 p-3">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16" />
      </div>
      <div className="ml-11 space-y-2">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-center text-slate-500 dark:text-slate-400">
      <div>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <svg 
            className="w-8 h-8 text-slate-400 dark:text-slate-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
          Пока нет комментариев
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Станьте первым, кто оставит комментарий к этому разделу!
        </p>
      </div>
    </div>
  )
}

export function CommentsList({ comments, loading }: CommentsListProps) {
  if (loading) {
    return (
      <div className="flex-1 space-y-1">
        {[...Array(5)].map((_, i) => (
          <CommentSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (comments.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-1">
      {comments.map((comment) => (
        <CommentItem key={comment.comment_id} comment={comment} />
      ))}
    </div>
  )
} 