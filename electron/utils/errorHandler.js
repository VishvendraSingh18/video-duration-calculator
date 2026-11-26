'use strict';

/**
 * Converts low-level Node.js filesystem errors into clear, actionable messages.
 *
 * @param {Error & { code?: string }} err
 * @returns {string}
 */
function formatFsError(err) {
  if (!err) return 'Unknown filesystem error';

  switch (err.code) {
    case 'EACCES':
    case 'EPERM':
      return 'Permission denied — insufficient rights to read this location.';
    case 'ENOENT':
      return 'Path no longer exists or was moved during scan.';
    case 'EBUSY':
      return 'File or folder is currently locked by another process.';
    case 'ELOOP':
      return 'Too many levels of symbolic links encountered.';
    case 'ENOTDIR':
      return 'Expected a directory but encountered a different entry type.';
    case 'EMFILE':
      return 'Too many open files simultaneously. Try lowering concurrency.';
    default:
      return err.message || 'Unexpected filesystem error.';
  }
}

/**
 * Converts FFprobe execution failures into clean user-facing explanations.
 *
 * @param {Error & { code?: string|number, killed?: boolean, signal?: string }} err
 * @param {string} stderr
 * @returns {string}
 */
function formatFfprobeError(err, stderr = '') {
  const cleanStderr = String(stderr || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-2)
    .join(' | ');

  if (err && err.killed && err.signal === 'SIGTERM') {
    return 'FFprobe timed out while inspecting this file.';
  }

  if (err && err.code === 'ENOENT') {
    return 'FFprobe executable could not be found.';
  }

  if (err && err.code === 'EACCES') {
    return 'FFprobe binary lacks execute permission.';
  }

  if (/moov atom not found/i.test(cleanStderr)) {
    return 'Corrupted or incomplete MP4 (moov atom not found).';
  }

  if (/Invalid data found when processing input/i.test(cleanStderr)) {
    return 'Invalid or corrupted media file (not a readable MP4 container).';
  }

  if (/Permission denied/i.test(cleanStderr)) {
    return 'Permission denied when reading file.';
  }

  if (cleanStderr) {
    return `Unreadable media metadata: ${cleanStderr}`;
  }

  return (err && err.message) || 'Failed to read video duration with FFprobe.';
}

module.exports = {
  formatFsError,
  formatFfprobeError,
};
