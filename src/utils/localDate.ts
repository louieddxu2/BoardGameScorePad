/**
 * Calendar date of `date` in the device's own time zone, e.g. "2026-11-12".
 * `toISOString()` reports the UTC date, which is the previous day until 08:00 in UTC+8.
 */
export const formatLocalDateStamp = (date: Date = new Date(), separator = '-'): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(separator);
};
