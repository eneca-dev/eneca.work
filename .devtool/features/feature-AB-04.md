---
id: "feature-AB-04"
status: "review"
priority: "high"
assignee: "Александра Бирило"
epic: "feature"
dueDate: null
created: "2026-08-12T13:00:00.000Z"
modified: "2026-08-13T13:00:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "c05"
---
# feature-AB-04 Недельный таймлайн на странице «Разделы»

## Решения (согласованы с постановщиком)
1. Тоггл День/Неделя — нужен (по образцу `ScaleToggle` на «Отделах»), дневной вид остаётся доступен.
2. Недельный вид — компактный, покрывает примерно 3-4 месяца (~14-17 недель), а не ~300 дней как сейчас в дневном режиме.
3. Праздники/выходные внутри недели — показывать, но чисто информативно (ненавязчивый визуальный маркер, без интерактива).
4. Drag-resize баров и «ножницы» в недельном режиме **не реализуем** — редактирование дат загрузки только через клик по бару → модалка (как в месячном режиме на «Отделах»). Улучшение инструментов редактирования — отдельная будущая задача, вне объёма.
5. Ёмкость в недельном режиме — редактируется одним значением на неделю, которое заполняет все 7 дней внутри недели одинаковым значением (точная формула агрегации для отображения — сумма/среднее — не принципиальна).
6. Не затрагивает страницу «Отделы» (`modules/departments-timeline`) — новые файлы только в `sections-page`, общий хук `useTimelineResize.ts` не трогаем, т.к. drag-resize в неделях не делаем (риск регресса на «Отделах» снят).

## Технический план (уточнён 2026-08-13 — найден точный шаблон для копирования)

**Важная находка:** компоненты месячного режима на «Отделах» физически лежат не внутри `departments-timeline`, а в общих местах — `components/shared/timeline/` и `modules/resource-graph/`. Причём `MonthlyLoadingBars` уже принимает generic-тип загрузки (`MonthlyBarLoading`: id/startDate/endDate/rate/projectId?/sectionId?/...), никак не завязанный на «Отделы». Это значит — не «писать похожее по мотивам», а копировать один в один со сменой «месяц» → «неделя», с гораздо более предсказуемым результатом.

Разобрала точную схему подключения в `DepartmentsTimeline.tsx`:
```
timelineScale (store) → isMonthlyMode → monthCells = generateMonthCells(0, MONTHLY_MONTHS_BEFORE, MONTHLY_MONTHS_AFTER, calendarEvents)
timelineWidth = isMonthlyMode ? monthCells.length * MONTH_CELL_WIDTH : dayCells.length * DAY_CELL_WIDTH
currentMonthIndex = monthCells.findIndex(c => c.isCurrentMonth)  → скролл к сегодня
шапка: isMonthlyMode ? <MonthlyHeader monthCells monthCellWidth /> : <TimelineHeader ... />
columnCount={isMonthlyMode ? undefined : dayCells.length}  ← виртуализация колонок отключена в месячном режиме
EmployeeRow: isMonthlyMode ? <MonthlyLoadingBars .../> : <LoadingBarWithResize .../>
```
Для недель — тот же скелет 1:1, просто `week` вместо `month`.

### Константы — добавить туда же, где месячные (не в sections-page/constants, чтобы не плодить второй источник)
`modules/resource-graph/constants/index.ts`:
- `WEEK_CELL_WIDTH`
- `WEEKLY_WEEKS_BEFORE` / `WEEKLY_WEEKS_AFTER` — предлагаю 6/10 (~16 недель ≈ 3.7 месяца, для сравнения у месячного режима на «Отделах» `MONTHLY_MONTHS_BEFORE/AFTER = 36/36` — там расчёт совсем на другой масштаб, недельный не копируем).

### Новые файлы (все — по прямому образцу Monthly*-аналога)
- `modules/resource-graph/utils/weekly-cell-utils.ts` — `generateWeekCells(offset, weeksBefore, weeksAfter, calendarEvents)` → `WeekCell[]`, копия `generateMonthCells()` (`monthly-cell-utils.ts:58-102`) с шагом 7 дней вместо месяца. Плюс то, чего нет в `MonthCell` — список праздничных дат внутри недели (нужно для информационных маркеров, см. решение №3 выше).
- `components/shared/timeline/WeeklyHeader.tsx` — копия `MonthlyHeader.tsx`, проп `weekCells`/`weekCellWidth` вместо `monthCells`/`monthCellWidth`, плюс ненавязчивые маркеры праздников (единственное отличие от шаблона).
- `components/shared/timeline/WeeklyLoadingBars.tsx` — копия `MonthlyLoadingBars.tsx`, `calculateWeeklyBarPosition()` — та же день-доля математика, но `daysInMonth` → фиксированные 7. Использует тот же generic-тип загрузки (`MonthlyBarLoading` подходит как есть, либо тонкий алиас `WeeklyBarLoading = MonthlyBarLoading`). Без resize-хендлов, клик по бару → модалка (решение №4).
- `modules/sections-page/components/WeeklyAggregatedBarsOverlay.tsx` — единственный файл без готового шаблона (у X/Y мини-баров + инлайн-редактора ёмкости нет месячного аналога нигде в проекте). Переиспользует цветовую логику `getBarStyle` и `computeDailyAggregation()` из `aggregate-bars.ts`, сгруппированные по неделям. **Сохранение ёмкости — не новая логика:** после AB-03 у `AggregatedBarsOverlay` уже есть проп-колбэк `onSaveCapacity(startDate, endDate, value)`, и `ObjectSectionRow`/`ProjectRow` уже умеют его обрабатывать через `useUpsertSectionCapacityBatch` + `expandDateRange`. Недельный редактор просто вызывает тот же колбэк с границами недели — переиспользуется без изменений.

### Изменяемые файлы
- `modules/sections-page/components/SectionsPageInternal.tsx` — `timelineScale` из стора, `isWeeklyMode`, `weekCells`, `timelineWidth`/`currentWeekIndex`/скролл к сегодня, условный рендер шапки, `columnCount={isWeeklyMode ? undefined : dayCells.length}`.
- `modules/sections-page/stores/useSectionsPageUIStore.ts` — поле `timelineScale: 'day' | 'week'` + `setTimelineScale`, персист как остальной UI-стейт (по образцу `departments-timeline/stores/index.ts:98-99`).
- `components/shared/timeline/ScaleToggle.tsx` — сейчас жёстко 2 кнопки (день/месяц) под тип `TimelineScaleMode = 'day' | 'month'`. Предлагаю расширить тип до `'day' | 'week' | 'month'` и добавить опциональный проп `modes?: TimelineScaleMode[]` (по умолчанию `['day','month']` — «Отделы» не меняются), сections-page передаёт `['day','week']`. Небольшая правка общего компонента, обратно совместимая.
- `modules/sections-page/components/rows/DepartmentRow.tsx`, `ProjectRow.tsx`, `ObjectSectionRow.tsx`, `EmployeeRow.tsx` — проп `isWeeklyMode`/`weekCells` сверху вниз, ветка рендера `Weekly*` вместо дневных аналогов (для капасити-редакторов — тот же `onSaveCapacity`, уже подключённый в AB-03).

## Риски (обновлено после AB-03)
1. Разрыв позиционирования баров при смешивании день-точной и неделя-пропорциональной математики — `WeeklyLoadingBars` изолирован от `useTimelineResize.ts`, копия проверенного `calculateMonthlyBarPosition()`, риск низкий.
2. `WeeklyAggregatedBarsOverlay` — единственный файл без прямого шаблона, но логика простая (группировка по 7 дней + переиспользование цвета/сохранения из AB-03).
3. Поле `dailyWorkloads` в `sections-page` всегда пустое (`actions/index.ts` — не переиспользовать `aggregateMonthlyWorkload`-подобный путь из `departments-timeline`, он не заполнен данными в этом модуле.
4. ~~Ёмкость не сохраняется на сервер~~ — **снято**, AB-03 подключила реальное сохранение (`useUpsertSectionCapacityBatch`), недельный редактор переиспользует готовый путь.
5. Правка `ScaleToggle.tsx` — общий компонент, используется на «Отделах». Делать строго обратно совместимой (новый проп опциональный, дефолт сохраняет текущее поведение).

## Оценка масштаба
4 новых файла + ~7 изменяемых (из них 1 — общий `ScaleToggle`, с осторожностью). Без миграций БД. Риск ниже первоначальной оценки: три из четырёх новых файлов — копии проверенных шаблонов с известной механикой, а не разработка с нуля; сохранение ёмкости уже готово с AB-03.

---

## Как решено (итог реализации)

### Новые файлы
- `modules/resource-graph/utils/weekly-cell-utils.ts` — `generateWeekCells()` + тип `WeekCell` (номер недели, границы Пн-Вс, `workingDays`, `holidayDates` для маркеров). Копия `generateMonthCells()`, импортирует `buildCalendarMap`/`getDayInfo` напрямую из `./index` (не через барrel) — по той же причине, что и `monthly-cell-utils.ts` (см. коммент в `resource-graph/utils/index.ts:619-625` про циклическую зависимость).
- `components/shared/timeline/WeeklyHeader.tsx` — шапка недель (копия `MonthlyHeader`), плюс маленькая точка-маркер под названием недели при наличии праздников (`title` с перечислением дат — чисто информативно, без интерактива).
- `components/shared/timeline/WeeklyLoadingBars.tsx` — бары загрузок (копия `MonthlyLoadingBars`), день-доля позиционирование с фиксированным делителем 7 вместо переменного числа дней в месяце. Без resize-хендлов, клик по бару → та же модалка редактирования, что и в дневном режиме.
- `modules/sections-page/components/WeeklyAggregatedBarsOverlay.tsx` — недельный аналог `AggregatedBarsOverlay`. Один мини-бар на неделю (среднедневная загрузка/ёмкость по рабочим дням недели — `computeWeeklyAggregation()` в `utils/aggregate-bars.ts`). Редактирование — один клик на неделю (без drag-resize через несколько недель, как и решили), сохранение — тот же `onSaveCapacity(startDate, endDate, value)`, что и в дневном режиме, поэтому `ObjectSectionRow`/`ProjectRow` переиспользуют свои обработчики из AB-03 без изменений.

### Изменённые файлы
- `modules/resource-graph/constants/index.ts` — `WEEK_CELL_WIDTH = 110`, `WEEKLY_WEEKS_BEFORE = 6`, `WEEKLY_WEEKS_AFTER = 10` (~16 недель ≈ 3.7 месяца).
- `components/shared/timeline/ScaleToggle.tsx` — `TimelineScaleMode` расширен до `'day' | 'week' | 'month'`, добавлен опциональный проп `modes` (по умолчанию `['day', 'month']` — поведение на «Отделах» не изменилось). «Разделы» передают `modes={['day', 'week']}`.
- `modules/sections-page/stores/useSectionsPageUIStore.ts` — `timelineScale`/`setTimelineScale`, персист как остальной UI-стейт.
- `modules/sections-page/components/SectionsPageInternal.tsx` — `isWeeklyMode`, `weekCells`, `timelineWidth`/`currentWeekIndex`/скролл к сегодня, условный рендер шапки (`WeeklyHeader` vs `TimelineHeader`), `columnCount={isWeeklyMode ? undefined : dayCells.length}` (виртуализация колонок отключена — по образцу месячного режима на «Отделах»), тоггл в шапке (ножницы скрыты в недельном режиме, там нечего резать).
- `modules/sections-page/components/rows/{DepartmentRow,ProjectRow,ObjectSectionRow,EmployeeRow}.tsx` — новый опциональный проп `weekCells?`, `isWeeklyMode = weekCells !== undefined`, ветка рендера `Weekly*`-компонентов вместо дневных. Мок-данные (`MockProjectDateBars`, `MockSectionPeriodBar`, `MockCapacityPlanBar`) в недельном режиме не рендерятся — они завязаны на дневную сетку.
- `modules/sections-page/utils/aggregate-bars.ts` — `computeWeeklyAggregation()`.

### Не потребовалось
- Правок `useTimelineResize.ts`/`useScissorsInteraction` — недельный режим их не использует вообще (по плану — drag-resize и ножницы туда не идут).
- Новой логики сохранения ёмкости — недельный редактор вызывает тот же путь, что построен в AB-03 (`useUpsertSectionCapacityBatch` + `expandDateRange`).
- Миграций БД.

## На что обратить внимание ревьюеру
1. **Обязательно вручную:** переключение День ⇄ Неделя на странице «Разделы» — шапка, скролл к сегодня, ёмкость (клик на неделю → значение проставляется на все 7 дней), клик по бару загрузки в неделе → открывается модалка редактирования. Проверить также «Отделы» — тоггл там должен остаться Day/Month как был, без регрессий.
2. Числа X/Y на неделе — среднедневные по рабочим дням недели, не сумма за 7 дней. Может быть неочевидно на глаз — если разработчику/пользователю ожидание другое (например, сумма), формула в `computeWeeklyAggregation()` меняется в одном месте.
3. `npm run build` не запускала (см. правило проекта) — учитывая объём (11 файлов, 4 новых), стоит прогнать перед мержем.
4. Мелкая находка не по теме задачи: проп `capacityHint` в `AggregatedBarsOverlay.tsx` стал мёртвым после AB-03 (ни один вызывающий компонент его больше не передаёт) — не трогала, чтобы не смешивать с этой задачей, можно почистить отдельно.
