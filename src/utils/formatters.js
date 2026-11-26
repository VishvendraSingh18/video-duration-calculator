const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

export function breakdownDuration(totalMs) {
  const safeMs = Number.isFinite(totalMs) && totalMs > 0 ? Math.round(totalMs) : 0;
  const roundedTotalSeconds = Math.round(safeMs / MS_PER_SECOND);

  const days = Math.floor(roundedTotalSeconds / 86400);
  const hours = Math.floor((roundedTotalSeconds % 86400) / 3600);
  const minutes = Math.floor((roundedTotalSeconds % 3600) / 60);
  const seconds = roundedTotalSeconds % 60;

  return {
    totalMs: safeMs,
    days,
    hours,
    minutes,
    seconds,
    totalHours: safeMs / MS_PER_HOUR,
    totalMinutes: safeMs / MS_PER_MINUTE,
    totalSeconds: safeMs / MS_PER_SECOND,
    isSubSecond: safeMs > 0 && safeMs < MS_PER_SECOND,
  };
}

export function formatSingleDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '—';
  }

  if (durationMs < MS_PER_SECOND) {
    return `00:00:00.${String(Math.round(durationMs)).padStart(3, '0')}`;
  }

  const totalSec = Math.round(durationMs / MS_PER_SECOND);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

export function formatHeroLine(totalMs) {
  const b = breakdownDuration(totalMs);
  if (b.isSubSecond) {
    return `0 Days : 0 Hours : 0 Minutes : ${(b.totalMs / 1000).toFixed(3)} Seconds`;
  }
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  return [
    plural(b.days, 'Day'),
    plural(b.hours, 'Hour'),
    plural(b.minutes, 'Minute'),
    plural(b.seconds, 'Second'),
  ].join(' : ');
}

export function formatCompactDuration(totalMs) {
  const b = breakdownDuration(totalMs);
  if (b.totalMs === 0) return '0s';
  if (b.isSubSecond) return `${(b.totalMs / 1000).toFixed(2)}s`;

  const parts = [];
  if (b.days > 0) parts.push(`${b.days}d`);
  if (b.hours > 0) parts.push(`${b.hours}h`);
  if (b.minutes > 0) parts.push(`${b.minutes}m`);
  parts.push(`${b.seconds}s`);
  return parts.join(' ');
}

export function formatNumber(n) {
  return new Intl.NumberFormat().format(Number.isFinite(n) ? n : 0);
}

export function formatDecimal(n, fractionDigits = 2) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(n) ? n : 0);
}
