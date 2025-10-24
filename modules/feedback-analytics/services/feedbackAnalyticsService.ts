import { createClient } from "@/utils/supabase/client"

export type FeedbackAnswerHistory = {
  created_at: string
  score: number
  had_problems: boolean
  problem_text: string | null
}

export type FeedbackData = {
  id: string
  user_id: string | null
  first_name: string
  last_name: string
  score: number | null
  had_problems: boolean | null
  problem_text: string | null
  created_at: string
  updated_at: string
  completed: boolean
  answers?: FeedbackAnswerHistory[]
  next_survey_at: string | null
}

export type FeedbackStats = {
  totalResponses: number
  averageScore: number
  percentWithProblems: number
  percentWithoutProblems: number
}

export type FeedbackComment = {
  id: string
  first_name: string
  last_name: string
  score: number | null
  problem_text: string | null
  had_problems: boolean | null
  created_at: string
  answers: FeedbackAnswerHistory[]
  next_survey_at: string | null
}

/**
 * Получить агрегированную статистику по опросам
 */
export function getFeedbackStats(data: FeedbackData[]): FeedbackStats {  if (data.length === 0) {
    return {
      totalResponses: 0,
      averageScore: 0,
      percentWithProblems: 0,
      percentWithoutProblems: 0,
    }
  }

  const validScores = data.filter(item => item.score !== null)
  const totalScore = validScores.reduce((sum, item) => sum + (item.score || 0), 0)
  const averageScore = validScores.length > 0 ? totalScore / validScores.length : 0

  const withProblems = data.filter(item => item.had_problems === true).length
  const withoutProblems = data.filter(item => item.had_problems === false).length
  const totalWithAnswer = withProblems + withoutProblems

  const percentWithProblems = totalWithAnswer > 0 ? (withProblems / totalWithAnswer) * 100 : 0
  const percentWithoutProblems = totalWithAnswer > 0 ? (withoutProblems / totalWithAnswer) * 100 : 0

  return {
    totalResponses: data.length,
    averageScore: Math.round(averageScore * 10) / 10, // округляем до 1 знака
    percentWithProblems: Math.round(percentWithProblems * 10) / 10,
    percentWithoutProblems: Math.round(percentWithoutProblems * 10) / 10,
  }
}

/**
 * Получить всех пользователей, прошедших опрос
 */
export function getAllFeedbackUsers(data: FeedbackData[]): FeedbackComment[] {
  return data.map(item => ({
    id: item.id,
    first_name: item.first_name,
    last_name: item.last_name,
    score: item.score,
    problem_text: item.problem_text,
    had_problems: item.had_problems,
    created_at: item.created_at,
    answers: (item.answers || []) as FeedbackAnswerHistory[],
    next_survey_at: item.next_survey_at,
  }))
}
