'use strict';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Parses a raw FFprobe duration string/number into exact integer milliseconds.
 * Rejects NaN, Infinity, "N/A", negative, or zero values.
 *
 * @param {string|number|undefined|null} rawValue
 * @returns {number|null}
 */
function parseDurationToMs(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const trimmed = String(rawValue).trim();
  if (!trimmed || trimmed.toUpperCase() === 'N/A') {
    return null;
  }

  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const ms = Math.round(seconds * MS_PER_SECOND);
  return Number.isSafeInteger(ms) && ms > 0 ? ms : null;
}

/**
 * Breaks down an aggregated integer millisecond total into days, hours, minutes,
 * seconds, and exact floating-point total hours/minutes/seconds.
 * Rounding happens ONLY after summing all raw millisecond durations.
 *
 * @param {number} totalMs
 */
function breakdownDuration(totalMs) {
  const safeMs = Number.isFinite(totalMs) && totalMs > 0 ? Math.round(totalMs) : 0;

  const roundedTotalSeconds = Math.round(safeMs / MS_PER_SECOND);
  const days = Math.floor(roundedTotalSeconds / 86400);
  const hours = Math.floor((roundedTotalSeconds % 86400) / 3600);
  const minutes = Math.floor((roundedTotalSeconds % 3600) / 60);
  const seconds = roundedTotalSeconds % 60;

  const totalHours = safeMs / MS_PER_HOUR;
  const totalMinutes = safeMs / MS_PER_MINUTE;
  const totalSeconds = safeMs / MS_PER_SECOND;

  return {
    totalMs: safeMs,
    days,
    hours,
    minutes,
    seconds,
    totalHours,
    totalMinutes,
    totalSeconds,
    isSubSecond: safeMs > 0 && safeMs < MS_PER_SECOND,
  };
}

/**
 * Formats an individual video duration in integer milliseconds.
 * Supports >24-hour videos and sub-second videos accurately.
 *
 * @param {number|null} durationMs
 * @returns {string}
 */
function formatSingleDuration(durationMs) {
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

/**
 * Formats aggregated duration into human-readable summary string.
 *
 * @param {number} totalMs
 * @returns {string}
 */
function formatSummaryDuration(totalMs) {
  const b = breakdownDuration(totalMs);
  if (b.isSubSecond) {
    return `0 Days : 0 Hours : 0 Minutes : ${(b.totalMs / 1000).toFixed(3)} Seconds`;
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [
    plural(b.days, 'Day'),
    plural(b.hours, 'Hour'),
    plural(b.minutes, 'Minute'),
    plural(b.seconds, 'Second'),
  ].join(' : ');
}

module.exports = {
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  parseDurationToMs,
  breakdownDuration,
  formatSingleDuration,
  formatSummaryDuration,
};
