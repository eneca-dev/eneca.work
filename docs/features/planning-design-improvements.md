# Улучшения дизайна модуля планирования (UI/UX)

## Цель

Улучшить визуальное отображение и удобство использования полосок загрузки в модуле планирования путем:
- Унификации высоты загрузок для консистентности интерфейса
- Улучшения информативности (показ проекта + объекта вместо этапа)
- Вынесения комментария в отдельную строку для лучшей читаемости
- Добавления индикатора ставки в виде чипа
- Улучшения видимости индикатора "сегодня" при наведении
- Улучшения контрастности тултипов в светлой теме

---

## Этапы реализации

### Этап 1: Фиксированная высота загрузки 56px

**Описание:**
Установить фиксированную высоту полоски загрузки в 56 пикселей, независимо от значения ставки. Это обеспечит визуальную консистентность и предсказуемость интерфейса.

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/loading-bars-utils.ts:10` - константа `BASE_BAR_HEIGHT`
- `modules/planning/components/timeline/loading-bars-utils.ts:213` - функция `calculateBarTop()` (фикс наложения баров)
- `modules/planning/components/timeline/department-row.tsx:690-691` - расчет `actualRowHeight`
- `modules/planning/components/timeline/department-row.tsx:846` - рендер полоски
- `modules/planning/components/timeline/department-row.tsx:890-893` - логика `maxLines` (убрать зависимость от rate)
- `modules/planning/components/timeline/department-row.tsx:895-1120` - адаптивная логика отображения (упростить, убрать комментарии)
- `modules/planning/components/timeline/section-loading-bars.tsx:64` - рендер полоски в секции
- `modules/planning/components/timeline/section-loading-bars.tsx:231` - расчет высоты секции

**Текущая реализация:**
```typescript
export const BASE_BAR_HEIGHT = 140 // Базовая высота полоски для ставки 1.0
const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1) // Высота зависит от ставки
```

**Детальные шаги реализации:**

#### Шаг 1.1: Изменить константу BASE_BAR_HEIGHT
**Файл:** `modules/planning/components/timeline/loading-bars-utils.ts:10`

**Было:**
```typescript
export const BASE_BAR_HEIGHT = 140 // Базовая высота полоски для ставки 1.0
```

**Станет:**
```typescript
export const BASE_BAR_HEIGHT = 56 // Фиксированная высота полоски загрузки
```

---

#### Шаг 1.2: Убрать умножение на rate в расчете actualRowHeight
**Файл:** `modules/planning/components/timeline/department-row.tsx:690-691`

**Было:**
```typescript
barRenders.forEach(bar => {
  const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)
  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)
  maxBottom = Math.max(maxBottom, top + barHeight)
})
```

**Станет:**
```typescript
barRenders.forEach(bar => {
  const barHeight = BASE_BAR_HEIGHT // Фиксированная высота
  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)
  maxBottom = Math.max(maxBottom, top + barHeight)
})
```

---

#### Шаг 1.3: Убрать умножение на rate в рендере полоски
**Файл:** `modules/planning/components/timeline/department-row.tsx:846`

**Было:**
```typescript
return barRenders.map((bar, idx) => {
  const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)
  // ...
})
```

**Станет:**
```typescript
return barRenders.map((bar, idx) => {
  const barHeight = BASE_BAR_HEIGHT // Фиксированная высота
  // ...
})
```

---

#### Шаг 1.4: Убрать умножение на rate в section-loading-bars (рендер)
**Файл:** `modules/planning/components/timeline/section-loading-bars.tsx:64`

**Было:**
```typescript
const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)
```

**Станет:**
```typescript
const barHeight = BASE_BAR_HEIGHT // Фиксированная высота
```

---

#### Шаг 1.5: Убрать умножение на rate в section-loading-bars (расчет высоты)
**Файл:** `modules/planning/components/timeline/section-loading-bars.tsx:231`

**Было:**
```typescript
barRenders.forEach(bar => {
  const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)
  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 4)
  maxBottom = Math.max(maxBottom, top + barHeight)
})
```

**Станет:**
```typescript
barRenders.forEach(bar => {
  const barHeight = BASE_BAR_HEIGHT // Фиксированная высота
  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 4)
  maxBottom = Math.max(maxBottom, top + barHeight)
})
```

---

#### Шаг 1.6: Убрать умножение на rate в функции calculateBarTop
**Файл:** `modules/planning/components/timeline/loading-bars-utils.ts:213`

**Проблема:** При стаке загрузок (когда они пересекаются по времени) бары накладываются друг на друга, потому что функция `calculateBarTop()` использует переменную высоту для расчёта позиции, а реальная высота баров уже фиксированная.

**Было:**
```typescript
overlappingBars.forEach(other => {
  const otherHeight = baseBarHeight * (other.period.rate || 1)
  layersMap.set(other.layer, Math.max(layersMap.get(other.layer) || 0, otherHeight))
})
```

**Станет:**
```typescript
overlappingBars.forEach(other => {
  const otherHeight = baseBarHeight // Фиксированная высота
  layersMap.set(other.layer, Math.max(layersMap.get(other.layer) || 0, otherHeight))
})
```

---

#### Шаг 1.7: Убрать зависимость maxLines от rate
**Файл:** `modules/planning/components/timeline/department-row.tsx:893-899`

**Проблема:** Логика `maxLines` всё ещё зависит от `rate` (ставки), но теперь высота фиксированная. Это приводит к тому, что на загрузках с маленькой ставкой (< 0.5) отображается только одна строка, хотя физически места больше.

**Было:**
```typescript
// Определяем максимальное количество строк в зависимости от rate (высоты)
let maxLines = 3
if (rate < 0.5) {
  maxLines = 1 // Очень низкие бары - только одна строка
} else if (rate < 1) {
  maxLines = 2 // Средние бары - максимум 2 строки
}
```

**Станет:**
```typescript
// При фиксированной высоте 42px помещается 2 строки текста
const maxLines = 2
```

**Обоснование:**
- Высота бара фиксированная (42px)
- Размер шрифта: 10px для основного текста, 9px для второстепенного
- LineHeight: 1.2-1.3
- Отступы: 4px сверху и снизу
- **Итого:** В 42px помещается 2 строки текста + комментарий

---

#### Шаг 1.8: Обновить адаптивную логику отображения
**Файл:** `modules/planning/components/timeline/department-row.tsx:919-1120`

**Проблема:** Блоки `if (maxLines === 1)` больше не нужны, так как `maxLines` всегда = 2.

**Изменения:**
1. Удалить все блоки `if (maxLines === 1)` из режимов 'minimal', 'compact', 'full'
2. Оставить только многострочную логику с `lineCount`
3. Упростить условия отображения

**Было (пример для 'minimal' mode):**
```typescript
if (labelParts.displayMode === 'minimal') {
  const displayText = labelParts.project || labelParts.stage

  if (maxLines === 1) {
    // Одна строка для маленьких баров
    return (...)
  }

  let lineCount = 0
  return (
    <div className="flex flex-col justify-center items-start overflow-hidden w-full h-full">
      {labelParts.project && lineCount < maxLines && ...}
      {labelParts.stage && lineCount < maxLines && ...}
    </div>
  )
}
```

**Станет:**
```typescript
if (labelParts.displayMode === 'minimal') {
  let lineCount = 0
  return (
    <div className="flex flex-col justify-center items-start overflow-hidden w-full h-full" style={{ gap: "2px" }}>
      {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <FolderKanban size={9} className="text-white flex-shrink-0" />
          <span className="text-[10px] font-semibold text-white truncate">
            {labelParts.project}
          </span>
        </div>
      )})()}
      {labelParts.stage && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <Milestone size={8} className="text-white/90 flex-shrink-0" />
          <span className="text-[9px] font-medium text-white/90 truncate">
            {labelParts.stage}
          </span>
        </div>
      )})()}
    </div>
  )
}
```

Аналогично для режимов 'compact' и 'full'.

---

#### Шаг 1.9: Убрать комментарий из отображения на загрузке
**Файл:** `modules/planning/components/timeline/department-row.tsx:890-1120`

**Проблема:** Комментарии сейчас отображаются внутри полоски загрузки, занимая место для основной информации (проект, этап). Согласно Этапу 3, комментарий должен выводиться отдельной строкой **под** загрузкой.

**Изменения:**
1. Удалить переменную `const hasComment = !!bar.period.comment`
2. Удалить все блоки с `MessageSquare` иконкой и текстом комментария из всех режимов отображения ('icon-only', 'minimal', 'compact', 'full')
3. Удалить блок комментария (строки 1090-1117) из режима 'full'

**Было (примеры):**

**Icon-only mode:**
```typescript
{hasComment && (
  <MessageSquare
    className="w-3 h-3 text-white/70 flex-shrink-0"
    style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }}
  />
)}
```

**Full mode:**
```typescript
{/* Блок комментария */}
{hasComment && (
  rate >= 0.5 ? (
    <div className="flex items-start gap-1 mt-0.5" title={bar.period.comment}>
      <MessageSquare className="w-3 h-3 flex-shrink-0 text-white/70" />
      <span className="text-[9px] font-medium text-white tracking-wide leading-tight">
        {bar.period.comment}
      </span>
    </div>
  ) : (
    <div title={bar.period.comment}>
      <MessageSquare className="w-3 h-3 text-white/70" />
    </div>
  )
)}
```

**Станет:**
- Все упоминания комментария удалены
- Комментарий будет реализован в Этапе 3 как отдельная строка под загрузкой

**Обоснование:**
- Освобождается место для основной информации (проект + объект/этап)
- Комментарий не теряется — будет отображаться под загрузкой в Этапе 3
- Упрощается логика рендеринга

---

**Зависимости:** Нет

---

### Этап 2: Название проекта + объект (вместо этапа)

**Описание:**
На загрузке отображать название проекта и название объекта вместо этапа декомпозиции. Это обеспечит более высокоуровневую информацию о загрузке.

**Затрагиваемые файлы:**
- `modules/planning/types.ts:1-22` - интерфейс `Loading`
- `modules/planning/components/timeline/loading-bars-utils.ts:15-29` - интерфейс `BarPeriod`
- `modules/planning/components/timeline/loading-bars-utils.ts:273-291` - функция `loadingsToPeriods()`
- `modules/planning/components/timeline/loading-bars-utils.ts:469-504` - интерфейс `BarLabelParts` и функция `getBarLabelParts()`
- `modules/planning/components/timeline/department-row.tsx` - рендеринг текста в полоске

**Текущее отображение:**
```
Проект (FolderKanban icon)
Этап (Milestone icon)
```

**Планируемое отображение:**
```
Проект (FolderKanban icon)
Объект (Building2 icon)
```

**Детальные шаги реализации:**

#### Шаг 2.1: Добавить поля objectId и objectName в интерфейс Loading
**Файл:** `modules/planning/types.ts:1-22`

**Проблема:** В интерфейсе `Loading` отсутствуют поля `objectId` и `objectName`, которые нужны для отображения объекта на загрузке.

**Было:**
```typescript
export interface Loading {
  id: string
  projectId?: string
  projectName?: string
  projectStatus?: string
  sectionId: string | null
  sectionName?: string
  stageId: string // ОБЯЗАТЕЛЬНОЕ поле - загрузка всегда привязана к этапу
  stageName?: string // Название этапа для отображения
  employeeId?: string
  responsibleId?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
  responsibleTeamName?: string
  startDate: Date
  endDate: Date
  rate: number
  status?: string
  comment?: string
  createdAt: Date
  updatedAt: Date
}
```

**Станет:**
```typescript
export interface Loading {
  id: string
  projectId?: string
  projectName?: string
  projectStatus?: string
  objectId?: string // ID объекта
  objectName?: string // Название объекта для отображения
  sectionId: string | null
  sectionName?: string
  stageId: string // ОБЯЗАТЕЛЬНОЕ поле - загрузка всегда привязана к этапу
  stageName?: string // Название этапа для отображения
  employeeId?: string
  responsibleId?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
  responsibleTeamName?: string
  startDate: Date
  endDate: Date
  rate: number
  status?: string
  comment?: string
  createdAt: Date
  updatedAt: Date
}
```

---

#### Шаг 2.2: Добавить поля objectId и objectName в интерфейс BarPeriod
**Файл:** `modules/planning/components/timeline/loading-bars-utils.ts:15-29`

**Было:**
```typescript
export interface BarPeriod {
  id: string
  type: "loading"
  startDate: Date
  endDate: Date
  rate: number
  projectId?: string
  projectName?: string
  sectionId?: string | null
  sectionName?: string
  stageId?: string
  stageName?: string
  comment?: string
  loading?: Loading
}
```

**Станет:**
```typescript
export interface BarPeriod {
  id: string
  type: "loading"
  startDate: Date
  endDate: Date
  rate: number
  projectId?: string
  projectName?: string
  objectId?: string
  objectName?: string
  sectionId?: string | null
  sectionName?: string
  stageId?: string
  stageName?: string
  comment?: string
  loading?: Loading
}
```

---

#### Шаг 2.3: Обновить функцию loadingsToPeriods() для передачи objectName
**Файл:** `modules/planning/components/timeline/loading-bars-utils.ts:273-291`

**Было:**
```typescript
export function loadingsToPeriods(loadings: Loading[] | undefined): BarPeriod[] {
  if (!loadings || loadings.length === 0) return []

  return loadings.map((loading) => ({
    id: loading.id,
    type: "loading",
    startDate: new Date(loading.startDate),
    endDate: new Date(loading.endDate),
    rate: loading.rate || 1,
    projectId: loading.projectId,
    projectName: loading.projectName,
    sectionId: loading.sectionId,
    sectionName: loading.sectionName,
    stageId: loading.stageId,
    stageName: loading.stageName,
    comment: loading.comment,
    loading,
  }))
}
```

**Станет:**
```typescript
export function loadingsToPeriods(loadings: Loading[] | undefined): BarPeriod[] {
  if (!loadings || loadings.length === 0) return []

  return loadings.map((loading) => ({
    id: loading.id,
    type: "loading",
    startDate: new Date(loading.startDate),
    endDate: new Date(loading.endDate),
    rate: loading.rate || 1,
    projectId: loading.projectId,
    projectName: loading.projectName,
    objectId: loading.objectId,
    objectName: loading.objectName,
    sectionId: loading.sectionId,
    sectionName: loading.sectionName,
    stageId: loading.stageId,
    stageName: loading.stageName,
    comment: loading.comment,
    loading,
  }))
}
```

---

#### Шаг 2.4: Заменить stage на object в интерфейсе BarLabelParts
**Файл:** `modules/planning/components/timeline/loading-bars-utils.ts:469-474`

**Было:**
```typescript
export interface BarLabelParts {
  project?: string
  section?: string
  stage?: string
  displayMode: 'full' | 'compact' | 'minimal' | 'icon-only'
}
```

**Станет:**
```typescript
export interface BarLabelParts {
  project?: string
  section?: string
  object?: string // Заменили stage на object
  displayMode: 'full' | 'compact' | 'minimal' | 'icon-only'
}
```

---

#### Шаг 2.5: Обновить функцию getBarLabelParts() для использования object // пропали этапы
**Файл:** `modules/planning/components/timeline/loading-bars-utils.ts:476-504`

**Было:**
```typescript
export function getBarLabelParts(period: BarPeriod, barWidth: number): BarLabelParts {
  if (period.type !== "loading") {
    return { displayMode: 'full' }
  }

  // ... логика определения displayMode ...

  return {
    project: period.projectName,
    section: period.sectionName,
    stage: period.stageName,
    displayMode
  }
}
```

**Станет:**
```typescript
export function getBarLabelParts(period: BarPeriod, barWidth: number): BarLabelParts {
  if (period.type !== "loading") {
    return { displayMode: 'full' }
  }

  // ... логика определения displayMode ...

  return {
    project: period.projectName,
    section: period.sectionName,
    object: period.objectName, // Заменили stageName на objectName
    displayMode
  }
}
```

---

#### Шаг 2.6: Обновить рендеринг в department-row.tsx - заменить импорт иконки
**Файл:** `modules/planning/components/timeline/department-row.tsx:4`

**Было:**
```typescript
import { ChevronDown, ChevronRight, Building2, Users, FolderKanban, FileText, Milestone } from "lucide-react"
```

**Станет:**
```typescript
import { ChevronDown, ChevronRight, Building2, Users, FolderKanban, FileText } from "lucide-react"
```

**Обоснование:** Удаляем `Milestone` т.к. больше не будем отображать этап, а `Building2` уже импортирован для отображения объекта.

---

#### Шаг 2.7: Обновить рендеринг icon-only mode
**Файл:** `modules/planning/components/timeline/department-row.tsx:~894-902`

**Было:**
```typescript
if (labelParts.displayMode === 'icon-only') {
  return (
    <FolderKanban
      size={11}
      className="text-white"
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }}
    />
  )
}
```

**Станет:** (без изменений, т.к. показываем только иконку проекта)

---

#### Шаг 2.8: Обновить рендеринг minimal mode - заменить stage на object
**Файл:** `modules/planning/components/timeline/department-row.tsx:~904-933`

**Было:**
```typescript
if (labelParts.displayMode === 'minimal') {
  let lineCount = 0
  return (
    <div className="flex flex-col justify-center items-start overflow-hidden w-full h-full" style={{ gap: "2px" }}>
      {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <FolderKanban size={10} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
          <span
            className="text-[10px] font-semibold text-white truncate"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
            title={labelParts.project}
          >
            {labelParts.project}
          </span>
        </div>
      )})()}
      {labelParts.stage && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <Milestone size={9} className="text-white/90 flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
          <span
            className="text-[9px] font-medium text-white/90 truncate"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
            title={labelParts.stage}
          >
            {labelParts.stage}
          </span>
        </div>
      )})()}
    </div>
  )
}
```

**Станет:**
```typescript
if (labelParts.displayMode === 'minimal') {
  let lineCount = 0
  return (
    <div className="flex flex-col justify-center items-start overflow-hidden w-full h-full" style={{ gap: "2px" }}>
      {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <FolderKanban size={10} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
          <span
            className="text-[10px] font-semibold text-white truncate"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
            title={labelParts.project}
          >
            {labelParts.project}
          </span>
        </div>
      )})()}
      {labelParts.object && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <Building2 size={9} className="text-white/90 flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
          <span
            className="text-[9px] font-medium text-white/90 truncate"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
            title={labelParts.object}
          >
            {labelParts.object}
          </span>
        </div>
      )})()}
    </div>
  )
}
```

**Изменения:**
- Заменили `labelParts.stage` на `labelParts.object`
- Заменили иконку `Milestone` на `Building2`

---

#### Шаг 2.9: Обновить рендеринг compact mode - заменить stage на object
**Файл:** `modules/planning/components/timeline/department-row.tsx:~936-966`

**Было:**
```typescript
if (labelParts.displayMode === 'compact') {
  // Средние бары
  let lineCount = 0
  return (
    <div className="flex flex-col justify-center items-start overflow-hidden w-full h-full" style={{ gap: "2px" }}>
      {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <FolderKanban size={10} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
          <span
            className="text-[10px] font-semibold text-white truncate"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
            title={labelParts.project}
          >
            {labelParts.project}
          </span>
        </div>
      )})()}
      {labelParts.stage && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <Milestone size={9} className="text-white/90 flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
          <span
            className="text-[9px] font-medium text-white/90 truncate"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
            title={labelParts.stage}
          >
            {labelParts.stage}
          </span>
        </div>
      )})()}
    </div>
  )
}
```

**Станет:**
```typescript
if (labelParts.displayMode === 'compact') {
  // Средние бары
  let lineCount = 0
  return (
    <div className="flex flex-col justify-center items-start overflow-hidden w-full h-full" style={{ gap: "2px" }}>
      {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <FolderKanban size={10} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
          <span
            className="text-[10px] font-semibold text-white truncate"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
            title={labelParts.project}
          >
            {labelParts.project}
          </span>
        </div>
      )})()}
      {labelParts.object && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <Building2 size={9} className="text-white/90 flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
          <span
            className="text-[9px] font-medium text-white/90 truncate"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
            title={labelParts.object}
          >
            {labelParts.object}
          </span>
        </div>
      )})()}
    </div>
  )
}
```

**Изменения:**
- Заменили `labelParts.stage` на `labelParts.object`
- Заменили иконку `Milestone` на `Building2`

---

#### Шаг 2.10: Обновить рендеринг full mode - заменить stage на object
**Файл:** `modules/planning/components/timeline/department-row.tsx:~969-1003`

**Было:**
```typescript
// full mode - многострочное отображение с иконками
let lineCount = 0
return (
  <div className="flex flex-col justify-center overflow-hidden w-full" style={{ gap: "1px" }}>
    {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
      <div className="flex items-center gap-1 overflow-hidden">
        <FolderKanban size={9} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
        <span
          className="text-[10px] font-semibold text-white truncate"
          style={{
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            lineHeight: "1.2"
          }}
          title={labelParts.project}
        >
          {labelParts.project}
        </span>
      </div>
    )})()}
    {labelParts.stage && lineCount < maxLines && (() => { lineCount++; return (
      <div className="flex items-center gap-1 overflow-hidden">
        <Milestone size={8} className="text-white/90 flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
        <span
          className="text-[9px] font-medium text-white/90 truncate"
          style={{
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            lineHeight: "1.2"
          }}
          title={labelParts.stage}
        >
          {labelParts.stage}
        </span>
      </div>
    )})()}
  </div>
)
```

**Станет:**
```typescript
// full mode - многострочное отображение с иконками
let lineCount = 0
return (
  <div className="flex flex-col justify-center overflow-hidden w-full" style={{ gap: "1px" }}>
    {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
      <div className="flex items-center gap-1 overflow-hidden">
        <FolderKanban size={9} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
        <span
          className="text-[10px] font-semibold text-white truncate"
          style={{
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            lineHeight: "1.2"
          }}
          title={labelParts.project}
        >
          {labelParts.project}
        </span>
      </div>
    )})()}
    {labelParts.object && lineCount < maxLines && (() => { lineCount++; return (
      <div className="flex items-center gap-1 overflow-hidden">
        <Building2 size={8} className="text-white/90 flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
        <span
          className="text-[9px] font-medium text-white/90 truncate"
          style={{
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            lineHeight: "1.2"
          }}
          title={labelParts.object}
        >
          {labelParts.object}
        </span>
      </div>
    )})()}
  </div>
)
```

**Изменения:**
- Заменили `labelParts.stage` на `labelParts.object`
- Заменили иконку `Milestone` на `Building2`

---

**Зависимости:** Этап 1

**Статус:** ✅ **ЗАВЕРШЕН**

**Выполненные изменения:**

1. **Обновлены типы (`modules/planning/types.ts`):**
   - Добавлены поля `objectId` и `objectName` в интерфейс `Loading`

2. **Обновлены утилиты (`modules/planning/components/timeline/loading-bars-utils.ts`):**
   - Добавлены поля `objectId` и `objectName` в интерфейс `BarPeriod`
   - Обновлена функция `loadingsToPeriods()` для маппинга полей объекта
   - Заменено поле `stage` на `object` в интерфейсе `BarLabelParts`
   - Обновлена функция `getBarLabelParts()` для использования `objectName`
   - Обновлена функция `formatBarTooltip()` для отображения названия объекта

3. **Обновлен компонент рендеринга (`modules/planning/components/timeline/department-row.tsx`):**
   - Удалена иконка `Milestone` из импортов
   - Обновлен режим icon-only: заменен этап на объект с иконкой `Building2`
   - Обновлен минимальный режим: заменен этап на объект с иконкой `Building2`
   - Обновлен компактный режим: заменен этап на объект с иконкой `Building2`
   - Обновлен полный режим: заменен этап на объект с иконкой `Building2`

4. **Обновлен store (`modules/planning/stores/usePlanningStore.ts`):**
   - Добавлен маппинг полей `objectId` и `objectName` для загрузок сотрудников
   - Добавлен маппинг полей `objectId` и `objectName` для секций с загрузками

5. **Создана миграция базы данных:**
   - `supabase/migrations/20251216_add_object_fields_to_view_employee_workloads.sql`
   - Добавлены поля `object_id` и `object_name` в конец представления `view_employee_workloads`
   - Добавлен JOIN с таблицей `objects` через `s.section_object_id`

**Результат:**
- ✅ На загрузках теперь отображается "Объект" вместо "Этап декомпозиции"
- ✅ Используется иконка `Building2` (здание) вместо `Milestone` (флажок)
- ✅ В тултипе показывается название объекта
- ✅ Все адаптивные режимы обновлены

---

### Этап 3: Комментарий отдельной строкой

**Описание:**
Комментарий выводить дополнительной строкой **под** загрузкой. Высота загрузки остается 56px, а комментарий рендерится ниже, увеличивая общую высоту строки.

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/department-row.tsx:845-1172` - рендеринг полоски и комментария
- `modules/planning/components/timeline/department-row.tsx:683-701` - расчет `actualRowHeight`

**Текущая реализация:**
Комментарий отображается **внутри** полоски:
```tsx
{hasComment && (
  rate >= 0.5 ? (
    <div className="flex items-start gap-1 mt-0.5">
      <MessageSquare />
      <span>{bar.period.comment}</span>
    </div>
  ) : (
    <MessageSquare />
  )
)}
```

**Планируемая реализация:**
Комментарий как отдельный элемент **под** полоской:
```tsx
{/* Основная полоска - высота 56px */}
<div style={{ height: '56px' }}>
  {/* Контент полоски */}
</div>

{/* Комментарий под полоской */}
{hasComment && (
  <div style={{ height: 'auto', minHeight: '20px' }}>
    <MessageSquare />
    <span>{bar.period.comment}</span>
  </div>
)}
```

**Планируемые изменения:**
1. Вынести рендеринг комментария из блока контента полоски
2. Создать отдельный `div` для комментария, позиционированный под полоской
3. Обновить расчет `actualRowHeight`:
   - Добавить высоту комментария к высоте полоски
   - Пример: `barHeight (56px) + commentHeight (20px если есть комментарий)`
4. Стилизовать комментарий:
   - Иконка `MessageSquare` + текст
   - Фон может быть полупрозрачным
   - Выравнивание по левому краю полоски

**Зависимости:** Этап 1, Этап 2

---

### Этап 4: Ставка чипом в начале загрузки

**Описание:**
Вывести числовое значение ставки (например, "0.5", "1.0") в виде чипа в начало полоски загрузки.

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/department-row.tsx:884-1131` - рендеринг контента полоски

**Планируемое отображение:**
```
[0.5] Проект • Объект
```

Чип со ставкой должен быть:
- В начале полоски (слева)
- Контрастного цвета (например, белый фон с темным текстом, или обратное для темной темы)
- Компактным (не занимать много места)
- С округлением (например, `rounded-md`)

**Планируемые изменения:**
1. Добавить рендеринг чипа ставки в начало контента полоски:
```tsx
<div className="flex items-center gap-1">
  {/* Чип ставки */}
  <span className="px-1.5 py-0.5 bg-white/90 text-slate-800 text-[10px] font-bold rounded">
    {bar.period.rate || 1}
  </span>

  {/* Остальной контент */}
  ...
</div>
```
2. Адаптировать стили чипа для темной/светлой темы
3. Учесть адаптивное отображение (для узких полосок чип может быть единственным элементом)

**Зависимости:** Этап 1, Этап 2, Этап 3

---

### Этап 5: Зеленая полоска "сегодня" не исчезает при hover

**Описание:**
При наведении на строку сотрудника зеленая полоска текущего дня должна оставаться видимой. Сейчас она перекрывается hover-эффектом.

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/department-row.tsx:1176-1214` - ячейки таймлайна

**Текущая проблема:**
```tsx
className={cn(
  isToday ? "bg-teal-600/30" : "",
  "group-hover/employee:bg-slate-700/50", // ← Этот класс перекрывает bg-teal
)}
```

**Решения (выбрать одно):**

**Вариант 1: Условный hover (предпочтительный)**
```tsx
className={cn(
  isToday ? "bg-teal-600/30" : "",
  !isToday && "group-hover/employee:bg-slate-700/50", // Hover только для НЕ сегодняшних дней
)}
```

**Вариант 2: Более насыщенный цвет для "сегодня"**
```tsx
className={cn(
  isToday ? "bg-teal-500/60" : "", // Более яркий, чтобы пробивался через hover
  "group-hover/employee:bg-slate-700/30",
)}
```

**Вариант 3: Z-index подход**
Создать отдельный overlay для индикатора "сегодня" поверх ячеек с более высоким z-index.

**Планируемые изменения:**
1. Использовать **Вариант 1** (условный hover)
2. Проверить визуально в обеих темах (dark/light)
3. Убедиться, что индикатор "сегодня" четко виден при hover

**Зависимости:** Нет

---

### Этап 6: Светлый тултип в светлой теме

**Описание:**
Заменить нативный браузерный тултип (`title`) на Radix UI Tooltip с адаптивными стилями. Сейчас используется атрибут `title`, который не стилизуется и всегда темный, что создает низкий контраст в светлой теме.

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/department-row.tsx:876` - атрибут `title` на полоске загрузки
- `modules/planning/components/timeline/loading-bars-utils.ts:532-543` - функция `formatBarTooltip()`
- `components/ui/tooltip.tsx` - готовый компонент Radix Tooltip

**Текущее состояние:**
В коде используется нативный атрибут `title` для тултипов:
```tsx
// department-row.tsx:876
<div
  title={formatBarTooltip(bar.period)}
  onClick={() => { /* ... */ }}
>
  {/* Контент полоски */}
</div>
```

Функция `formatBarTooltip()` возвращает строку с переносами `\n`:
```typescript
// loading-bars-utils.ts:532-543
export function formatBarTooltip(period: BarPeriod): string {
  const lines: string[] = []
  if (period.projectName) lines.push(`Проект: ${period.projectName}`)
  if (period.objectName) lines.push(`Объект: ${period.objectName}`)
  if (period.sectionName) lines.push(`Раздел: ${period.sectionName}`)
  if (period.stageName) lines.push(`Этап декомпозиции: ${period.stageName}`)
  lines.push(`Период: ${formatDate(period.startDate)} — ${formatDate(period.endDate)}`)
  lines.push(`Ставка: ${period.rate}`)
  if (period.comment) lines.push(`Комментарий: ${period.comment}`)

  return lines.join("\n")
}
```

**Проблема:**
- Нативные браузерные тултипы (`title`) **не стилизуются** через CSS
- Всегда отображаются темными (или системными цветами)
- Низкий контраст в светлой теме
- Не поддерживают многострочный текст (переносы `\n` работают плохо)

---

**Решение: Использовать Radix UI Tooltip**

**Вариант 1: Использовать Radix Tooltip (ВЫБРАН)**

Преимущества:
- ✅ Полный контроль над стилями
- ✅ Адаптивность к теме (светлый/тёмный)
- ✅ Поддержка многострочного текста
- ✅ Консистентность с остальным UI приложения
- ✅ Готовый компонент уже есть в `components/ui/tooltip.tsx`

---

**Детальные шаги реализации:**

#### Шаг 6.1: Создать компонент LoadingBarTooltipContent

**Файл:** `modules/planning/components/timeline/loading-bar-tooltip.tsx` (новый файл)

**Создать специализированный компонент для рендеринга содержимого тултипа:**

```tsx
import React from "react"
import type { BarPeriod } from "./loading-bars-utils"

interface LoadingBarTooltipContentProps {
  period: BarPeriod
}

/**
 * Форматирует дату в формате ДД.ММ.ГГГГ
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

/**
 * Компонент содержимого тултипа для полоски загрузки
 */
export function LoadingBarTooltipContent({ period }: LoadingBarTooltipContentProps) {
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      {period.projectName && (
        <div>
          <span className="font-medium">Проект:</span> {period.projectName}
        </div>
      )}
      {period.objectName && (
        <div>
          <span className="font-medium">Объект:</span> {period.objectName}
        </div>
      )}
      {period.sectionName && (
        <div>
          <span className="font-medium">Раздел:</span> {period.sectionName}
        </div>
      )}
      {period.stageName && (
        <div>
          <span className="font-medium">Этап декомпозиции:</span> {period.stageName}
        </div>
      )}
      <div>
        <span className="font-medium">Период:</span> {formatDate(period.startDate)} — {formatDate(period.endDate)}
      </div>
      <div>
        <span className="font-medium">Ставка:</span> {period.rate}
      </div>
      {period.comment && (
        <div>
          <span className="font-medium">Комментарий:</span> {period.comment}
        </div>
      )}
    </div>
  )
}
```

**Обоснование создания отдельного компонента:**
- Разделение ответственности: логика форматирования отделена от логики рендеринга
- Легче тестировать и модифицировать
- Можно переиспользовать в других местах

**Визуальный результат:**
На этом шаге визуального изменения нет — создаётся только компонент. Тултип пока не отображается, так как он ещё не подключён к полоскам загрузки.

---

#### Шаг 6.2: Обновить TooltipContent для адаптации к теме

**Файл:** `components/ui/tooltip.tsx:14-28`

**Текущая реализация:**
```tsx
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
))
```

**Проблема:** `bg-popover` и `text-popover-foreground` настроены в `globals.css` и могут быть тёмными в обеих темах.

**Решение:** Не нужно менять базовый компонент! Вместо этого передадим кастомный `className` при использовании.

**Визуальный результат:**
На этом шаге визуального изменения нет — базовый компонент `TooltipContent` остаётся без изменений. Стили будут переопределены на следующем шаге.

---

#### Шаг 6.3: Заменить `title` на Radix Tooltip в department-row.tsx

**Файл:** `modules/planning/components/timeline/department-row.tsx`

**Шаг 6.3.1: Добавить импорты**

**Было (строка ~1-5):**
```tsx
import { ChevronDown, ChevronRight, Building2, Users, FolderKanban, FileText } from "lucide-react"
```

**Станет:**
```tsx
import { ChevronDown, ChevronRight, Building2, Users, FolderKanban, FileText } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { LoadingBarTooltipContent } from "./loading-bar-tooltip"
import { useTheme } from "next-themes"
```

**Визуальный результат:**
На этом шаге визуального изменения нет — только добавляются необходимые импорты.

---

**Шаг 6.3.2: Получить текущую тему**

**Место:** В начале компонента `DepartmentRow` (после хуков)

**Добавить:**
```tsx
const { theme } = useTheme()
```

**Визуальный результат:**
На этом шаге визуального изменения нет — только добавляется доступ к текущей теме.

---

**Шаг 6.3.3: Обернуть рендеринг полосок в TooltipProvider**

**Было (строка ~845):**
```tsx
return barRenders.map((bar, idx) => {
  const barHeight = BASE_BAR_HEIGHT // Фиксированная высота
  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)

  return (
    <div
      key={bar.period.id}
      className="absolute cursor-pointer rounded-md overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      style={{
        left: `${bar.left}px`,
        width: `${bar.width}px`,
        top: `${top}px`,
        height: `${barHeight}px`,
        backgroundColor: bar.color,
        paddingLeft: "6px",
        paddingRight: "6px",
        paddingTop: "4px",
        paddingBottom: "4px",
        overflow: "hidden",
        filter: "brightness(1.1)",
      }}
      title={formatBarTooltip(bar.period)} // ← УДАЛИТЬ ЭТУ СТРОКУ
      onClick={() => {
        if (bar.period.type === "loading" && bar.period.loading) {
          setEditingLoading(bar.period.loading)
        }
      }}
    >
      {/* Контент полоски */}
    </div>
  )
})
```

**Станет:**
```tsx
return (
  <TooltipProvider delayDuration={300}>
    {barRenders.map((bar, idx) => {
      const barHeight = BASE_BAR_HEIGHT
      const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)

      return (
        <Tooltip key={bar.period.id}>
          <TooltipTrigger asChild>
            <div
              className="absolute cursor-pointer rounded-md overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              style={{
                left: `${bar.left}px`,
                width: `${bar.width}px`,
                top: `${top}px`,
                height: `${barHeight}px`,
                backgroundColor: bar.color,
                paddingLeft: "6px",
                paddingRight: "6px",
                paddingTop: "4px",
                paddingBottom: "4px",
                overflow: "hidden",
                filter: "brightness(1.1)",
              }}
              onClick={() => {
                if (bar.period.type === "loading" && bar.period.loading) {
                  setEditingLoading(bar.period.loading)
                }
              }}
            >
              {/* Контент полоски (без изменений) */}
              {/* ... весь существующий код рендеринга контента ... */}
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className={cn(
              "max-w-sm z-[100]",
              theme === "dark"
                ? "bg-slate-800 text-white border-slate-700"
                : "bg-white text-slate-900 border-slate-200"
            )}
          >
            <LoadingBarTooltipContent period={bar.period} />
          </TooltipContent>
        </Tooltip>
      )
    })}
  </TooltipProvider>
)
```

---

**Ключевые изменения:**
1. **Обернули весь `map`** в `<TooltipProvider>` — это обязательно для работы Radix Tooltip
2. **Каждую полоску обернули в `<Tooltip>`** с `<TooltipTrigger>` и `<TooltipContent>`
3. **Использовали `asChild`** в `TooltipTrigger` — чтобы не создавать дополнительный wrapper
4. **Удалили атрибут `title`**
5. **Настроили стили `TooltipContent`:**
   - `side="top"` — тултип сверху
   - `max-w-sm` — максимальная ширина
   - `z-[100]` — высокий z-index для отображения поверх всего
   - Условные стили для светлой/тёмной темы

**Визуальный результат:**

✅ **ДО (с нативным `title`):**
```
При наведении на полоску загрузки:
┌─────────────────────────────────┐
│ [Тёмный системный тултип]       │ ← Всегда тёмный, плохая читаемость
│ Проект: Название проекта        │
│ Объект: Название объекта Раздел │ ← Переносы строк работают плохо
│ : ...                           │
└─────────────────────────────────┘
```

✅ **ПОСЛЕ (с Radix Tooltip):**

**В тёмной теме:**
```
При наведении на полоску загрузки:
┌────────────────────────────────────────┐
│ ╔════════════════════════════════════╗ │
│ ║ Проект: Жилой комплекс "Сосны"    ║ │ ← Тёмный фон (slate-800)
│ ║ Объект: Корпус 1                  ║ │   Белый текст
│ ║ Раздел: АР                        ║ │   Чёткие переносы строк
│ ║ Этап декомпозиции: Эскизный проект║ │
│ ║ Период: 15.01.2025 — 31.01.2025   ║ │
│ ║ Ставка: 1                         ║ │
│ ║ Комментарий: Срочно               ║ │
│ ╚════════════════════════════════════╝ │
└────────────────────────────────────────┘
  Хороший контраст, легко читается
```

**В светлой теме:**
```
При наведении на полоску загрузки:
┌────────────────────────────────────────┐
│ ╔════════════════════════════════════╗ │
│ ║ Проект: Жилой комплекс "Сосны"    ║ │ ← Белый фон (white)
│ ║ Объект: Корпус 1                  ║ │   Тёмный текст (slate-900)
│ ║ Раздел: АР                        ║ │   Светлая рамка (slate-200)
│ ║ Этап декомпозиции: Эскизный проект║ │   Чёткие переносы строк
│ ║ Период: 15.01.2025 — 31.01.2025   ║ │
│ ║ Ставка: 1                         ║ │
│ ║ Комментарий: Срочно               ║ │
│ ╚════════════════════════════════════╝ │
└────────────────────────────────────────┘
  Отличный контраст, комфортное чтение
```

**Визуальные улучшения:**
- ✅ **Адаптивные цвета:** тултип меняет цвет в зависимости от темы
- ✅ **Многострочность:** каждое поле на отдельной строке с правильными отступами
- ✅ **Читаемость:** жирный текст для меток ("Проект:", "Ставка:"), обычный для значений
- ✅ **Контраст:** высокий контраст в обеих темах
- ✅ **Плавная анимация:** появление/исчезновение с fade-in/fade-out
- ✅ **Позиционирование:** тултип появляется над полоской (не перекрывает её)
- ✅ **Задержка:** 300ms перед появлением (не раздражает при быстром наведении)

---

#### Шаг 6.4: (Опционально) Удалить функцию formatBarTooltip

**Файл:** `modules/planning/components/timeline/loading-bars-utils.ts:532-543`

Теперь `formatBarTooltip()` не используется нигде, можно удалить или пометить как deprecated:

```typescript
/**
 * @deprecated Используйте компонент LoadingBarTooltipContent вместо этой функции
 * Форматирует tooltip для полоски
 */
export function formatBarTooltip(period: BarPeriod): string {
  // ... существующий код ...
}
```

**Визуальный результат:**
На этом шаге визуального изменения нет — удаляется или помечается как deprecated неиспользуемая функция. Это опциональный шаг для чистоты кода.

---

**Зависимости:** Нет

**Итоговый результат этапа:**
- ✅ Тултипы адаптируются к теме (светлый фон в светлой теме)
- ✅ Многострочный текст отображается корректно
- ✅ Улучшенная читаемость и контрастность
- ✅ Консистентность с остальным UI приложения

**Финальный визуальный результат Этапа 6:**

После завершения всех шагов пользователь увидит:

**Поведение при наведении на полоску загрузки:**
1. **Задержка 300ms** — тултип не появляется мгновенно (предотвращает спам при быстром движении мыши)
2. **Плавное появление** — анимация fade-in + zoom-in (200ms)
3. **Позиционирование сверху** — тултип над полоской, не перекрывает её
4. **Адаптивная ширина** — максимум `max-w-sm` (~384px), подстраивается под контент

**Сравнение ДО/ПОСЛЕ:**

| Параметр | ДО (title) | ПОСЛЕ (Radix Tooltip) |
|----------|------------|----------------------|
| **Цвет фона (светлая тема)** | Тёмный (системный) ❌ | Белый ✅ |
| **Цвет фона (тёмная тема)** | Тёмный (системный) ✅ | Тёмный slate-800 ✅ |
| **Контраст (светлая тема)** | Низкий ❌ | Высокий ✅ |
| **Многострочность** | Плохая поддержка ❌ | Отличная ✅ |
| **Форматирование текста** | Нет ❌ | Жирные метки ✅ |
| **Анимация** | Нет ❌ | Плавная ✅ |
| **Стилизация** | Невозможна ❌ | Полный контроль ✅ |
| **Читаемость** | Средняя | Отличная ✅ |

**Пример итогового вида в светлой теме:**
```
     [Полоска загрузки — синий цвет]
              ↓ (при наведении)
┌──────────────────────────────────────────┐
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ ← Белый фон
│ ┃ Проект: Жилой комплекс "Сосны"     ┃ │   Светло-серая рамка
│ ┃ Объект: Корпус 1                   ┃ │   Тёмный текст (slate-900)
│ ┃ Раздел: АР                         ┃ │   Жирные метки
│ ┃ Этап декомпозиции: Эскизный проект ┃ │
│ ┃ Период: 15.01.2025 — 31.01.2025    ┃ │
│ ┃ Ставка: 1                          ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
└──────────────────────────────────────────┘
```

**Пример итогового вида в тёмной теме:**
```
     [Полоска загрузки — синий цвет]
              ↓ (при наведении)
┌──────────────────────────────────────────┐
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ ← Тёмный фон (slate-800)
│ ┃ Проект: Жилой комплекс "Сосны"     ┃ │   Тёмная рамка (slate-700)
│ ┃ Объект: Корпус 1                   ┃ │   Белый текст
│ ┃ Раздел: АР                         ┃ │   Жирные метки
│ ┃ Этап декомпозиции: Эскизный проект ┃ │
│ ┃ Период: 15.01.2025 — 31.01.2025    ┃ │
│ ┃ Ставка: 1                          ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
└──────────────────────────────────────────┘
```

---

### Этап 7: Изменить отображение выходных на загрузке

**Описание:**
*Отложено на уточнение.*

Возможные варианты:
- Изменить стиль overlay (цвет, паттерн)
- Изменить тип границы (solid вместо dashed)
- Убрать overlay полностью
- Другое

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/department-row.tsx:1134-1168` - overlay для нерабочих дней

**Зависимости:** TBD

---

## Критерии готовности

- [ ] Высота всех загрузок = 56px (независимо от ставки)
- [ ] На загрузке отображается: название проекта + название объекта (вместо этапа)
- [ ] Комментарий выводится отдельной строкой **под** загрузкой (высота загрузки 56px + высота комментария)
- [ ] Числовое значение ставки отображается чипом в начале загрузки
- [ ] Зеленая полоска "сегодня" не исчезает при наведении на строку
- [ ] Тултип в светлой теме имеет светлый фон
- [ ] ~~Выходные дни (отложено)~~
- [ ] Нет ошибок в консоли
- [ ] `npm run build` проходит успешно
- [ ] Ручное тестирование пройдено

---

## Технические детали

### Связанные файлы
- `modules/planning/components/timeline/department-row.tsx` - основной компонент отображения строки сотрудника
- `modules/planning/components/timeline/loading-bars-utils.ts` - утилиты для работы с полосками загрузки
- `modules/planning/types.ts` - типы модуля планирования

### Архитектурные решения
1. **Фиксированная высота:** упрощает расчеты позиционирования, улучшает визуальную консистентность
2. **Комментарий под полоской:** улучшает читаемость, не загромождает основную информацию
3. **Чип ставки:** быстрая визуальная идентификация загрузки сотрудника
4. **Условный hover:** сохраняет важную информацию о текущем дне

### Риски и edge-cases
- **Фиксированная высота:** при большом количестве пересекающихся загрузок строка может стать очень высокой
- **Комментарий под полоской:** длинные комментарии могут сильно увеличить высоту строки
- **Проект + объект:** убедиться, что данные всегда доступны в `Loading` объекте

---

## История изменений

### v1 (текущая версия)
- Создан план улучшений дизайна модуля планирования
- Определены 7 этапов реализации
- Зафиксированы критерии готовности
