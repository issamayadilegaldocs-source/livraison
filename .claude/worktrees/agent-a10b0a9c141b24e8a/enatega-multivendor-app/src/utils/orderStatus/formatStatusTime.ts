/** Formats a status-event timestamp (ISO string, epoch ms, or Date) as a local clock time, e.g. "10:24 AM". */
export function formatStatusTime(value: string | number | Date | null | undefined): string | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
