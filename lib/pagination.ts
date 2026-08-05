export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100

export function parsePositiveInteger(
  value: string | number | null | undefined,
  fallback: number
) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.trunc(parsed)
}

export function parsePage(value: string | number | null | undefined) {
  return parsePositiveInteger(value, 1)
}

export function parsePageSize(
  value: string | number | null | undefined,
  fallback = DEFAULT_PAGE_SIZE,
  max = MAX_PAGE_SIZE
) {
  return Math.min(parsePositiveInteger(value, fallback), max)
}

export function pageRange(page: number, pageSize: number) {
  const from = Math.max(0, (page - 1) * pageSize)
  return { from, to: from + pageSize - 1 }
}

export function totalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)))
}
