/**
 * Bar Color — плавная HSL-интерполяция цвета баров загрузки по проценту (X/Y).
 *
 * Общая для дневного (AggregatedBarsOverlay) и недельного (WeeklyAggregatedBarsOverlay)
 * режимов — раньше была продублирована 1:1 в обоих файлах со ступенчатыми порогами
 * (bug-AB-07). Дизайн цвета согласован с постановщиком по итогам обсуждения:
 *
 * - Недогруз (X < Y, не хватает людей, percentage < 100) — тревожная зона: чем
 *   сильнее нехватка, тем краснее и ярче. 100% — баланс (зелёный), уже в районе
 *   90% (например 6/7, 6/8) — оранжевый, дальше плавно краснеет к 0%.
 * - Перегруз (X > Y, людей больше чем нужно, percentage > 100) — НЕ тревожный,
 *   нейтральный серо-голубой (плоский цвет, без градации — по фидбеку "пока
 *   посмотрим, как будет выглядеть").
 *
 * Раньше (первая версия bug-AB-07) было наоборот: percentage > 100 был жёстким
 * красным ("перегруз" в терминах "X>Y"), а недогруз интерполировался к красному.
 * После обсуждения с постановщиком роли поменялись местами: красный — только
 * там, где реально не хватает людей.
 */

export interface BarStyle {
  bg: string
  textColor: string
  glow?: string
}

interface ColorAnchor {
  pct: number
  hue: number
}

// Недогруз (0-100%): красно-оранжевая дуга, зелёный только у самого баланса.
const SHORTAGE_ANCHORS: ColorAnchor[] = [
  { pct: 0, hue: 0 },     // красный
  { pct: 50, hue: 20 },   // красно-оранжевый
  { pct: 90, hue: 40 },   // оранжевый (согласовано: 6/7, 6/8 — уже оранжевые)
  { pct: 100, hue: 142 }, // зелёный (баланс)
]

const SHORTAGE_BG_ALPHA_LOW = 0.75 // у 0% — ярче/насыщеннее красный
const SHORTAGE_BG_ALPHA_HIGH = 0.5 // у 100% — как обычный зелёный
const SHORTAGE_TEXT_ALPHA_LOW = 0.85
const SHORTAGE_TEXT_ALPHA_HIGH = 0.95

/** Перегруз (X > Y) — нейтральный серо-голубой, отличим от серого "нет загрузки". */
const SURPLUS_STYLE: BarStyle = {
  bg: 'rgba(96, 165, 250, 0.35)',
  textColor: 'rgba(147, 197, 253, 0.9)',
}

/** Акцентный цвет для cutoff-линии перегруза — тот же оттенок, что и SURPLUS_STYLE.bg. */
export const SURPLUS_ACCENT_COLOR = 'rgba(96, 165, 250, 0.8)'

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Плавно интерполированный hue по проценту недогруза (0-100, clamped за пределами). */
function interpolateShortageHue(percentage: number): number {
  const p = Math.min(100, Math.max(0, percentage))
  for (let i = 0; i < SHORTAGE_ANCHORS.length - 1; i++) {
    const a = SHORTAGE_ANCHORS[i]
    const b = SHORTAGE_ANCHORS[i + 1]
    if (p >= a.pct && p <= b.pct) {
      const t = b.pct === a.pct ? 0 : (p - a.pct) / (b.pct - a.pct)
      return lerp(a.hue, b.hue, t)
    }
  }
  return SHORTAGE_ANCHORS[SHORTAGE_ANCHORS.length - 1].hue
}

export function getBarStyle(percentage: number, isEmpty: boolean): BarStyle {
  // Пустая ячейка (нет загрузки) - серый приглушенный
  if (isEmpty) return {
    bg: 'rgba(148, 163, 184, 0.25)',
    textColor: 'rgba(148, 163, 184, 0.7)',
  }

  // Перегруз (X > Y) — людей больше чем нужно, нейтральный цвет, не тревожный
  if (percentage > 100) return SURPLUS_STYLE

  // Недогруз (X < Y) — не хватает людей, чем сильнее нехватка тем краснее
  const hue = interpolateShortageHue(percentage)
  const t = Math.min(100, Math.max(0, percentage)) / 100
  const bgAlpha = lerp(SHORTAGE_BG_ALPHA_LOW, SHORTAGE_BG_ALPHA_HIGH, t)
  const textAlpha = lerp(SHORTAGE_TEXT_ALPHA_LOW, SHORTAGE_TEXT_ALPHA_HIGH, t)

  return {
    bg: `hsla(${hue}, 80%, 50%, ${bgAlpha.toFixed(2)})`,
    textColor: `hsla(${hue}, 90%, 70%, ${textAlpha.toFixed(2)})`,
  }
}
