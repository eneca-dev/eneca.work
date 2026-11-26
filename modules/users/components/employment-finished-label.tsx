/** The source date is the inclusive last working day from employment history. */
export function EmploymentFinishedLabel({ lastWorkingDate }: { lastWorkingDate?: string }) {
  if (!lastWorkingDate) return null
  const text = `Работа завершена · последний день ${lastWorkingDate.split('-').reverse().join('.')}`
  return <p className="truncate text-[10px] leading-3 text-muted-foreground" title={text}>{text}</p>
}
