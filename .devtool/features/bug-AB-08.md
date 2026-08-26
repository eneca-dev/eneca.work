---
id: "bug-AB-08"
status: "review"
priority: "medium"
assignee: "Александра Бирило"
epic: "bug"
dueDate: null
created: "2026-08-24T13:15:00.000Z"
modified: "2026-08-24T17:20:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "c09"
---
# bug-AB-08 Названия загрузок не сдвигаются при горизонтальном скролле в недельном и месячном режимах

## Проблема
В дневном режиме подпись бара сдвигается вместе со скроллом и остаётся видимой, даже когда левый край длинного бара ушёл за пределы экрана. Логика продублирована в двух местах — `sections-page/components/rows/EmployeeRow.tsx` и `departments-timeline/components/timeline/EmployeeRow.tsx`.

В `components/shared/timeline/WeeklyLoadingBars.tsx` и `MonthlyLoadingBars.tsx` эффекта нет: подпись закреплена у левого края и пропадает при скролле длинных загрузок. Затрагивает обе страницы — «Разделы» (неделя) и «Отделы» (месяц).

## Решение
Вынести логику дневного режима в переиспользуемый хук и подключить в оба компонента широкой сетки.

## Реализация
- `components/shared/timeline/useStickyBarLabel.ts` (новый) — слушает `scroll` на ближайшем `.overflow-auto`, возвращает ref с `translateX(overlap)`, ограниченным шириной бара.
- `components/shared/timeline/LoadingBarButton.tsx` (новый) — бар вынесен в отдельный компонент, т.к. хук нельзя вызвать внутри `.map()`. `WeeklyLoadingBars` и `MonthlyLoadingBars` рендерили идентичный JSX (`WeeklyBarLoading = MonthlyBarLoading`), поэтому объединены в один компонент вместо двух копий.
- `WeeklyLoadingBars.tsx`, `MonthlyLoadingBars.tsx` — используют `LoadingBarButton`; общие константы и типы позиционирования перенесены туда же.

## На что обратить внимание
1. Вручную: скролл длинной загрузки (2–3 месяца) на «Разделах» (неделя) и «Отделах» (месяц) — подпись должна оставаться видимой.
2. Плавность скролла при большом числе баров — listener навешивается на каждый бар, как и в дневном режиме.
3. `LoadingBarButton` типизирован через `MonthlyBarLoading` (type-only импорт) — циклической зависимости в рантайме нет.
