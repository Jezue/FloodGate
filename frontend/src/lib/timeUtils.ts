/**
 * Time utilities for precise timestamp handling
 */

/**
 * Format seconds ago into human-readable Polish text
 * @param seconds - Seconds since last contact
 * @returns Formatted string like "2 minuty temu" or "1 godzinę temu"
 */
export function formatTimeAgo(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)} sek. temu`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return '1 minutę temu';
    if (minutes < 5) return `${minutes} minuty temu`;
    return `${minutes} minut temu`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    if (hours === 1) return '1 godzinę temu';
    if (hours < 5) return `${hours} godziny temu`;
    return `${hours} godzin temu`;
  } else {
    const days = Math.floor(seconds / 86400);
    if (days === 1) return '1 dzień temu';
    return `${days} dni temu`;
  }
}

/**
 * Format ISO timestamp to Polish date/time
 * @param isoString - ISO 8601 timestamp
 * @returns Formatted string like "21.01.2026 11:30:45"
 */
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Calculate seconds since timestamp
 * @param isoString - ISO 8601 timestamp
 * @returns Seconds elapsed since timestamp
 */
export function secondsSince(isoString: string): number {
  const timestamp = new Date(isoString).getTime();
  const now = Date.now();
  return Math.floor((now - timestamp) / 1000);
}

/**
 * Format precise time for tooltips (with milliseconds)
 * @param isoString - ISO 8601 timestamp
 * @returns Formatted string like "21.01.2026 11:30:45.123"
 */
export function formatPreciseTime(isoString: string): string {
  const date = new Date(isoString);
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${formatTimestamp(isoString)}.${ms}`;
}
