"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Info } from "lucide-react"
import { getStatusColor } from "@/modules/task-transfer/utils"

export function TaskTransferGuide() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <BookOpen className="h-4 w-4" />
        Инструкция
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>Передача заданий — как это работает</DialogTitle>
            <DialogDescription>
              Короткий гайд по статусам и процессу передачи/выполнения.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="flex flex-wrap gap-2">
              <TabsTrigger value="overview">Как устроено</TabsTrigger>
              <TabsTrigger value="statuses">Статусы</TabsTrigger>
              <TabsTrigger value="duration">Плановая продолжительность</TabsTrigger>
              <TabsTrigger value="flow">Процесс</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Задание создаётся в контексте раздела и имеет плановую продолжительность. Отправитель
                передаёт его участнику другого раздела. Получатель принимает и выполняет. Все ключевые
                точки фиксируются статусами и датами.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li><span className="font-medium">Исходящие</span> — вы отправили кому‑то.</li>
                <li><span className="font-medium">Входящие</span> — кто‑то отправил вам.</li>
                <li>«График передачи» показывает плановый период и фактические события по дням.</li>
              </ul>
            </TabsContent>

            <TabsContent value="statuses" className="space-y-3 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StatusItem label="Создано" description="Черновик у отправителя до передачи." />
                <StatusItem label="Передано" description="Отправитель передал задание адресату." />
                <StatusItem label="Принято" description="Получатель подтвердил получение и взял в работу." />
                <StatusItem label="Выполнено" description="Исполнитель завершил работы по заданию." />
                <StatusItem label="Согласовано" description="Работа принята и закрыта. Финальный статус." />
              </div>
            </TabsContent>

            <TabsContent value="duration" className="space-y-4 pt-4">
              <div className="space-y-3 text-sm">
                <p>
                  <span className="font-medium">Плановая продолжительность</span> — это ориентир в днях, за сколько
                  планируется выполняться задание. Используется для построения «планового периода» на графике.
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><span className="font-medium">Где задаётся</span>: при создании/редактировании задания. Диапазон: 1–365 дней.</li>
                  <li><span className="font-medium">По умолчанию</span>: 7 дней.</li>
                  <li><span className="font-medium">Единицы</span>: календарные дни (выходные не учитываются).</li>
                </ul>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="font-medium mb-2">Как рассчитывается плановый период на графике</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li><span className="font-medium">Начало</span>: дата создания задания.</li>
                    <li>
                      <span className="font-medium">Окончание</span>:
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        <li>если задание уже передано — дата передачи + продолжительность;</li>
                        <li>если ещё не передано — дата создания + продолжительность.</li>
                      </ul>
                    </li>
                  </ol>
                  <p className="text-xs text-muted-foreground mt-2">Это влияет только на визуализацию. Фактические статусы и их даты не меняются.</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="font-medium mb-2">Практические примеры</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Создано 01.09, не передано, D=5 → плановый период 01.09–06.09.</li>
                    <li>Создано 01.09, передано 03.09, D=5 → период 01.09–08.09 (конец смещается от даты передачи).</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="flow" className="space-y-4 pt-4">
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                <li>Создайте задание и при необходимости укажите плановую продолжительность(по умолчанию 7 дней).</li>
                <li>Нажмите «Передать» — у получателя появится входящее задание.</li>
                <li>Получатель нажимает «Принять» и начинает работу.</li>
                <li>Когда всё готово — устанавливает «Выполнено».</li>
                <li>Отправитель/принимающая сторона проверяет результат и ставит «Согласовано».</li>
              </ol>
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                Подсказки: статусы можно менять только последовательно; фактические даты фиксируются
                автоматически при смене статуса; плановый период строится от даты создания + плановая продолжительность и от даты
                передачи + продолжительность.
              </div>
            </TabsContent>

            {/* FAQ вкладка удалена по требованиям */}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatusItem({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 mb-1">
        <Badge className={`${getStatusColor(label as any)} text-[10px] h-5 px-2 py-0`}>{label}</Badge>
        <Info className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}


