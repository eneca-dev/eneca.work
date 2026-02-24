"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Search, ChevronDown, ChevronRight, Filter } from "lucide-react"
import type { FeedbackComment } from "../services/feedbackAnalyticsService"

interface FeedbackCommentsListProps {
  comments: FeedbackComment[]
  isLoading: boolean
}

export function FeedbackCommentsList({ comments, isLoading }: FeedbackCommentsListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())

  // Фильтры
  const [filterDeclined, setFilterDeclined] = useState(false)
  const [filterWithProblems, setFilterWithProblems] = useState(false)
  const [filterWithoutProblems, setFilterWithoutProblems] = useState(false)
  const [minScore, setMinScore] = useState<number>(1)
  const [maxScore, setMaxScore] = useState<number>(10)

  const toggleExpanded = useCallback((commentId: string) => {
    setExpandedComments((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(commentId)) {
        newSet.delete(commentId)
      } else {
        newSet.add(commentId)
      }
      return newSet
    })
  }, [])

  // Фильтрация комментариев по всем критериям
  const filteredComments = useMemo(() => {
    let result = comments

    // Фильтр по статусу отказа
    if (filterDeclined) {
      result = result.filter((comment) =>
        typeof comment.next_survey_at === 'string' && 
        comment.next_survey_at.toLowerCase() === 'infinity'
      )
    }
    // Фильтр по наличию проблем
    if (filterWithProblems) {
      result = result.filter((comment) => comment.had_problems === true)
    }

    // Фильтр по отсутствию проблем
    if (filterWithoutProblems) {
      result = result.filter((comment) => comment.had_problems === false)
    }

    // Фильтр по диапазону оценок
    result = result.filter((comment) => {
      if (comment.score === null) return true
      return comment.score >= minScore && comment.score <= maxScore
    })

    // Фильтр по поисковому запросу
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((comment) => {
        const fullName = `${comment.first_name} ${comment.last_name}`.toLowerCase()
        const text = (comment.problem_text || "").toLowerCase()
        return fullName.includes(query) || text.includes(query)
      })
    }

    return result
  }, [comments, searchQuery, filterDeclined, filterWithProblems, filterWithoutProblems, minScore, maxScore])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Комментарии пользователей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-1/4" />
                <div className="h-3 bg-muted rounded animate-pulse w-full" />
                <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-sm bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ответы пользователей</CardTitle>

          {/* Выпадающее меню фильтров */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-popover border-border"
              >
                <Filter className="h-4 w-4 mr-2" />
                Фильтры
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 rounded-sm bg-popover border-border" align="end">
              <div className="space-y-4">
                <div className="font-semibold text-sm">Фильтры</div>

                {/* Чекбоксы */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="declined"
                      checked={filterDeclined}
                      onCheckedChange={(checked) => setFilterDeclined(checked as boolean)}
                    />
                    <Label htmlFor="declined" className="text-sm cursor-pointer">
                      Отказались от опроса
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="withProblems"
                      checked={filterWithProblems}
                      onCheckedChange={(checked) => {
                        setFilterWithProblems(checked as boolean)
                        if (checked) setFilterWithoutProblems(false)
                      }}
                    />
                    <Label htmlFor="withProblems" className="text-sm cursor-pointer">
                      С проблемами
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="withoutProblems"
                      checked={filterWithoutProblems}
                      onCheckedChange={(checked) => {
                        setFilterWithoutProblems(checked as boolean)
                        if (checked) setFilterWithProblems(false)
                      }}
                    />
                    <Label htmlFor="withoutProblems" className="text-sm cursor-pointer">
                      Без проблем
                    </Label>
                  </div>
                </div>

                {/* Диапазон оценок */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Диапазон оценок</Label>
                    <span className="text-xs text-muted-foreground">{minScore} - {maxScore}</span>
                  </div>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[minScore, maxScore]}
                    onValueChange={([min, max]) => {
                      setMinScore(min)
                      setMaxScore(max)
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или тексту комментария..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-sm bg-popover border-border"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredComments.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {searchQuery ? "Ничего не найдено" : "Нет комментариев"}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredComments.map((comment) => {
              const isExpanded = expandedComments.has(comment.id)
              const hasHistory = comment.answers && comment.answers.length > 1
              const isDeclined = typeof comment.next_survey_at === 'string' && 
                comment.next_survey_at.toLowerCase() === 'infinity'
              return (
                <div
                  key={comment.id}
                  className="border rounded-sm p-4 space-y-2 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {hasHistory && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(comment.id)}
                          className="h-4 w-4 p-0 mr-1"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      <span className="font-semibold text-foreground dark:text-white">
                        {comment.first_name} {comment.last_name}
                      </span>
                      {comment.score !== null && (
                        <Badge
                          variant={comment.score >= 7 ? "default" : comment.score >= 4 ? "secondary" : "destructive"}
                          className="ml-1"
                        >
                          {comment.score}
                        </Badge>
                      )}
                      {comment.had_problems !== null && (
                        <Badge
                          variant={comment.had_problems ? "destructive" : "default"}
                          className="text-xs"
                        >
                          {comment.had_problems ? "С проблемами" : "Без проблем"}
                        </Badge>
                      )}
                      {isDeclined && (
                        <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                          Отказался от опроса
                        </Badge>
                      )}
                      {hasHistory && (
                        <Badge variant="outline" className="text-xs">
                          История: {comment.answers.length}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {comment.next_survey_at && comment.next_survey_at !== 'infinity' ? (
                        <>
                          Следующий показ:{" "}
                          {new Date(comment.next_survey_at).toLocaleDateString("ru-RU", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </>
                      ) : comment.next_survey_at === 'infinity' ? (
                        <span className="text-muted-foreground">Отказался</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </div>
                  {comment.problem_text && (
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {comment.problem_text}
                    </p>
                  )}

                  {/* История ответов */}
                  {isExpanded && hasHistory && (
                    <div className="mt-4 pl-8 space-y-3 border-l-2 border-primary/20">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">
                        История ответов ({comment.answers.length})
                      </div>
                      {comment.answers
                        .slice()
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((answer, index) => (
                          <div
                            key={`${comment.id}-${answer.created_at}-${index}`}                            className="bg-accent/30 rounded-sm p-3 space-y-1"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant={answer.score >= 7 ? "default" : answer.score >= 4 ? "secondary" : "destructive"}
                                className="text-xs"
                              >
                                {answer.score}
                              </Badge>
                              <Badge
                                variant={answer.had_problems ? "destructive" : "default"}
                                className="text-xs"
                              >
                                {answer.had_problems ? "С проблемами" : "Без проблем"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(answer.created_at).toLocaleDateString("ru-RU", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {answer.problem_text && (
                              <p className="text-xs text-foreground whitespace-pre-wrap mt-2">
                                {answer.problem_text}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
