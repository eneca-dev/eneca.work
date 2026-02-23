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
  videoId?: string
  imageSrc?: string
  imageAlt?: string
  // true — сначала скриншот, потом видео (по умолчанию: сначала видео)
  imageFirst?: boolean
}

const PAGES: PageConfig[] = [
  {
    title: "Как отправить баг или предложение",
    description: "Нашли проблему или есть идея? Покажем, как быстро сообщить об этом команде прямо из приложения.",
    videoId: "vZ4IxHk2mHQ",
  },
  {
    title: "Как пользоваться канбаном",
    description: "Канбан-доска помогает визуально управлять задачами. Меняйте статусы перетаскиванием.",
    videoId: "zSMcTr9ZmrA",
    imageSrc: "/onboarding/kanban.png",
    imageAlt: "Канбан-доска",
    imageFirst: true,
  },
  {
    title: "Как создать загрузку в отделах",
    description: "Загрузка позволяет распределить объём работы между сотрудниками. Узнайте, как создать новую загрузку на вкладке отделы.",
    videoId: "aaNHHonGDlg",
    imageSrc: "/onboarding/departments.png",
    imageAlt: "Создание загрузки в отделах",
    imageFirst: true,
  },
  {
    title: "Как перетащить загрузку в отделах",
    description: "Можно изменять сроки загрузок перетаскиванием краев загрузки. Это быстро и наглядно.",
    videoId: "VmxAq0YEZuY",
  },
  {
    title: "Загрузка в отделах",
    description: "",
    imageSrc: "/onboarding/departments sum loadings and rate.png",
    imageAlt: "Загрузка в отделах",
  },
  {
    title: "Как поставить ёмкость на раздел",
    description: "Ёмкость раздела определяет, сколько ставок специалистов требует раздел. Узнайте, как её настроить.",
    videoId: "n_lCFeD_JWQ",
    imageSrc: "/onboarding/sections.png",
    imageAlt: "Ёмкость раздела",
    imageFirst: true,
  },
  {
    title: "",
    description: "",
    imageSrc: "/onboarding/sections - sum of loadings and capacity.png",
    imageAlt: "Разделы — сумма загрузок и ёмкость",
  },
  {
    title: "Как создать загрузку на сотрудника или раздел",
    description: "Назначайте загрузку конкретному сотруднику.",
    videoId: "2b7HidyJmFc",
  },
  {
    title: "Как настроить вкладки и пользоваться фильтром",
    description: "Персонализируйте интерфейс под себя: скрывайте ненужные вкладки и применяйте фильтры для быстрого поиска нужного.",
    videoId: "Chx8Vc35Thc",
  },
  {
    title: "Перетаскивание дат в календаре",
    description: "Можно зажать дату и перетащить её на новую — тем самым вы не выбираете новый диапазон, а сдвигаете уже существующий.",
    videoId: "2CfUxkwi4B0",
  },
]

function VideoBlock({ videoId, title, pageIndex }: { videoId: string; title: string; pageIndex: number }) {
  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
      <iframe
        key={`video-${pageIndex}`}
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}

function ImageBlock({ imageSrc, imageAlt, pageIndex }: { imageSrc: string; imageAlt: string; pageIndex: number }) {
  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border bg-muted">
      <Image
        key={`image-${pageIndex}`}
        src={imageSrc}
        alt={imageAlt}
        width={800}
        height={450}
        className="w-full h-auto object-contain"
        priority
      />
    </div>
  )
}

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

  const videoBlock = hasVideo && (
    <VideoBlock videoId={page.videoId!} title={page.title} pageIndex={currentPage} />
  )
  const imageBlock = hasImage && (
    <ImageBlock imageSrc={page.imageSrc!} imageAlt={page.imageAlt || page.title} pageIndex={currentPage} />
  )

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl" closeOnOverlayClick={false}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
            Шаг {currentPage + 1} из {TOTAL_PAGES}
          </p>
          {page.title && (
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

      {/* Body с боковыми стрелками */}
      <div className="flex flex-1 min-h-0">
        {/* Стрелка назад */}
        <button
          onClick={prevPage}
          disabled={isFirst}
          className="flex-shrink-0 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-20 disabled:cursor-default"
          aria-label="Предыдущая страница"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto py-5 space-y-4 min-w-0">
          {page.imageFirst ? (
            <>
              {imageBlock}
              {videoBlock}
            </>
          ) : (
            <>
              {videoBlock}
              {imageBlock}
            </>
          )}

          {page.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{page.description}</p>
          )}
        </div>

        {/* Стрелка вперёд */}
        <button
          onClick={isLast ? handleClose : nextPage}
          className="flex-shrink-0 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label={isLast ? "Завершить" : "Следующая страница"}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
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
