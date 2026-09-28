export function getHourOfDay(timestamp: string): number {
  return new Date(timestamp).getUTCHours();
}

export function getCalendarDayKey(timestamp: string): string {
  return timestamp.slice(0, 10); // 'YYYY-MM-DD' (UTC, formato ISO 8601)
}
