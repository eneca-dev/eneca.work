"use client"

import { useCallback } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/modals/base/Modal"
import { useOnboardingStore, TOTAL_PAGES } from "@/stores/useOnboardingStore"

const YOUTUBE_VIDEO_ID = "OWbtxdq5rvQ"

const PAGES = [
  {
    title: "Добро пожаловать в eneca.work 2.0",
    description: "Мы полностью переработали платформу. Это короткое руководство покажет вам всё самое важное.",
  },
  {
    title: "Задачи",
    description: "Управляйте задачами, назначайте исполнителей, отслеживайте статусы и дедлайны в одном месте.",
  },
  {
    title: "Заметки",
    description: "Создавайте и структурируйте заметки, привязывайте их к проектам и задачам.",
  },
  {
    title: "Календарь",
    description: "Планируйте рабочую неделю, видите события команды и личный график одновременно.",
  },
  {
    title: "Документация",
    description: "Вся проектная документация в одном месте. Быстрый поиск и удобная навигация.",
  },
  {
    title: "Уведомления",
    description: "Следите за обновлениями в реальном времени — вас не пропустят ни одного важного события.",
  },
  {
    title: "Совместная работа",
    description: "Приглашайте коллег, распределяйте роли и работайте над проектами вместе.",
  },
  {
    title: "Всё готово!",
    description: "Вы можете вернуться к этому руководству в любой момент через кнопку в боковом меню.",
  },
] as const

export function OnboardingModal() {
  const { isOpen, currentPage, close, nextPage, prevPage, goToPage } = useOnboardingStore()

  const isFirst = currentPage === 0
  const isLast = currentPage === TOTAL_PAGES - 1
  const page = PAGES[currentPage]

  const handleClose = useCallback(() => {
    close()
  }, [close])

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl" closeOnOverlayClick={false}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
            Шаг {currentPage + 1} из {TOTAL_PAGES}
          </p>
          <h2 className="text-lg font-semibold text-foreground leading-tight">{page.title}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* Video embed */}
        <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
          <iframe
            key={currentPage} // перемонтировать при смене страницы
            src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0&modestbranding=1`}
            title={page.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">{page.description}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0">
        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              className={`rounded-full transition-all duration-200 ${
                i === currentPage
                  ? "w-4 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              }`}
              aria-label={`Перейти к шагу ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={isFirst}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Назад
          </Button>

          {isLast ? (
            <Button size="sm" onClick={handleClose} className="gap-1">
              Завершить
            </Button>
          ) : (
            <Button size="sm" onClick={nextPage} className="gap-1">
              Далее
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
