"use client"

import { useCallback } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/modals/base/Modal"
import { useOnboardingStore, TOTAL_PAGES } from "@/stores/useOnboardingStore"

interface PageConfig {
  title: string
  description: string
  // ID видео с YouTube (если есть)
  videoId?: string
  // Путь к скриншоту из папки public/ (если есть)
  imageSrc?: string
  imageAlt?: string
}

const PAGES: PageConfig[] = [
  {
    title: "Как отправить баг или предложение",
    description: "Нашли проблему или есть идея? Покажем, как быстро сообщить об этом команде прямо из приложения.",
    videoId: "vZ4IxHk2mHQ",
  },
  {
    title: "Как пользоваться канбаном",
    description: "Канбан-доска помогает визуально управлять задачами. Создавайте карточки, меняйте статусы перетаскиванием, настраивайте колонки.",
    videoId: "zSMcTr9ZmrA",
    imageSrc: "/onboarding/page-2-kanban.png",
    imageAlt: "Канбан-доска",
  },
  {
    title: "Как создать загрузку в отделах",
    description: "Загрузка позволяет распределить объём работы между сотрудниками. Узнайте, как создать новую загрузку в разделе отделов.",
    videoId: "aaNHHonGDlg",
    imageSrc: "/onboarding/page-3-department-upload.png",
    imageAlt: "Создание загрузки в отделах",
  },
  {
    title: "Как перетащить загрузку в отделах",
    description: "Загрузки можно перераспределять перетаскиванием между сотрудниками и временными слотами. Это быстро и наглядно.",
    videoId: "VmxAq0YEZuY",
  },
  {
    title: "Загрузка в отделах",
    description: "",
    imageSrc: "/onboarding/page-5-screenshot.png",
    imageAlt: "Загрузка в отделах",
  },
  {
    title: "Как поставить ёмкость на раздел",
    description: "Ёмкость раздела определяет, сколько работы может взять на себя команда. Узнайте, как её настроить.",
    videoId: "n_lCFeD_JWQ",
  },
  {
    title: "",
    description: "",
    imageSrc: "/onboarding/page-7-screenshot.png",
    imageAlt: "Скриншот",
  },
  {
    title: "Как создать загрузку на сотрудника или раздел",
    description: "Назначайте загрузку конкретному сотруднику или целому разделу — прямо из карточки в разделах.",
    videoId: "2b7HidyJmFc",
    imageSrc: "/onboarding/page-8-section-upload.png",
    imageAlt: "Загрузка на сотрудника или раздел",
  },
  {
    title: "Как настроить вкладки и пользоваться фильтром",
    description: "Персонализируйте интерфейс под себя: скрывайте ненужные вкладки и применяйте фильтры для быстрого поиска нужного.",
    videoId: "Chx8Vc35Thc",
  },
]

export function OnboardingModal() {
  const { isOpen, currentPage, close, nextPage, prevPage, goToPage } = useOnboardingStore()

  const isFirst = currentPage === 0
  const isLast = currentPage === TOTAL_PAGES - 1
  const page = PAGES[currentPage]

  const handleClose = useCallback(() => {
    close()
  }, [close])

  const hasVideo = !!page.videoId
  const hasImage = !!page.imageSrc
  const hasTitle = !!page.title
  const hasDescription = !!page.description

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl" closeOnOverlayClick={false}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
            Шаг {currentPage + 1} из {TOTAL_PAGES}
          </p>
          {hasTitle && (
            <h2 className="text-lg font-semibold text-foreground leading-tight">{page.title}</h2>
          )}
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

        {/* Видео */}
        {hasVideo && (
          <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
            <iframe
              key={`video-${currentPage}`}
              src={`https://www.youtube.com/embed/${page.videoId}?rel=0&modestbranding=1`}
              title={page.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        )}

        {/* Скриншот / фото */}
        {hasImage && (
          <div className="relative w-full rounded-lg overflow-hidden border border-border bg-muted">
            <Image
              key={`image-${currentPage}`}
              src={page.imageSrc!}
              alt={page.imageAlt || page.title}
              width={800}
              height={450}
              className="w-full h-auto object-contain"
              priority
            />
          </div>
        )}

        {/* Описание */}
        {hasDescription && (
          <p className="text-sm text-muted-foreground leading-relaxed">{page.description}</p>
        )}
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
            <Button size="sm" onClick={handleClose}>
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
