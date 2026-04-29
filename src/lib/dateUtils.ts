export function formatDate(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!dateStr) return '—';
  // Slice to date-only part in case column is timestamp ("2026-04-24T00:00:00+00:00")
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('el-GR', options);
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('el-GR');
}
