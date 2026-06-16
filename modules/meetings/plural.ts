/** Русское склонение слова «протокол» по числу: 1 протокол, 2 протокола, 5 протоколов. */
export function pluralizeProtocols(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'протокол'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'протокола'
  return 'протоколов'
}
