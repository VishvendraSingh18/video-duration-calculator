'use strict';

const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');
const {
  breakdownDuration,
  formatSingleDuration,
  formatSummaryDuration,
} = require('../utils/durationUtils');

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRow(cells) {
  return cells.map(escapeCsvCell).join(',');
}

function sanitizeFilename(name) {
  return String(name || 'scan')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'scan';
}

/**
 * Opens a native Save Dialog and writes the complete scan report as CSV.
 *
 * @param {Electron.BrowserWindow} parentWindow
 * @param {object} report
 */
async function exportReportToCsv(parentWindow, report) {
  if (!report) {
    return { canceled: false, error: 'No scan results are available to export.' };
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const defaultName = `video-durations-${sanitizeFilename(report.folderName)}-${dateStamp}.csv`;

  const saveResult = await dialog.showSaveDialog(parentWindow, {
    title: 'Export Video Duration Report (CSV)',
    defaultPath: path.join(report.folderPath || '', defaultName),
    filters: [{ name: 'CSV Spreadsheet', extensions: ['csv'] }],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { canceled: true };
  }

  const b = breakdownDuration(report.totalDurationMs);
  const lines = [];

  // Section 1: Summary Metadata
  lines.push(buildCsvRow(['Video Duration Calculator - Scan Report']));
  lines.push(buildCsvRow(['Scanned Folder', report.folderPath]));
  lines.push(buildCsvRow(['Scan Status', report.status]));
  lines.push(buildCsvRow(['Exported At', new Date().toISOString()]));
  lines.push(buildCsvRow(['Total Combined Duration', formatSummaryDuration(report.totalDurationMs)]));
  lines.push(buildCsvRow(['Total Hours', b.totalHours.toFixed(4)]));
  lines.push(buildCsvRow(['Total Minutes', b.totalMinutes.toFixed(4)]));
  lines.push(buildCsvRow(['Total Seconds', b.totalSeconds.toFixed(3)]));
  lines.push(buildCsvRow(['Total Milliseconds', b.totalMs]));
  lines.push(buildCsvRow(['Folders Scanned', report.foldersScanned]));
  lines.push(buildCsvRow(['MP4 Files Discovered', report.filesDiscovered]));
  lines.push(buildCsvRow(['Successfully Processed', report.succeededCount]));
  lines.push(buildCsvRow(['Warnings / Stream Fallbacks', report.warningCount]));
  lines.push(buildCsvRow(['Failed Files', report.failedCount]));
  lines.push(buildCsvRow(['Duplicates Skipped', report.skippedDuplicates]));
  lines.push(buildCsvRow(['Symlink Cycles Avoided', report.skippedSymlinkCycles]));
  lines.push('');

  // Section 2: Individual Video Table
  lines.push(
    buildCsvRow([
      'Index',
      'File Name',
      'Relative Folder',
      'Formatted Duration (HH:MM:SS)',
      'Duration (Seconds)',
      'Duration (Milliseconds)',
      'Status',
      'Metadata Source',
      'Notes / Error Details',
      'Full Path',
    ])
  );

  for (const item of report.files || []) {
    const durationSec = item.durationMs !== null ? (item.durationMs / 1000).toFixed(3) : '';
    lines.push(
      buildCsvRow([
        item.id,
        item.fileName,
        item.relativeFolder,
        formatSingleDuration(item.durationMs),
        durationSec,
        item.durationMs ?? '',
        item.status,
        item.source,
        item.message || '',
        item.fullPath,
      ])
    );
  }

  // Section 3: Unreadable Folders / Access Errors
  if (Array.isArray(report.directoryErrors) && report.directoryErrors.length > 0) {
    lines.push('');
    lines.push(buildCsvRow(['Unreadable Folders / Entry Errors']));
    lines.push(buildCsvRow(['Relative Path', 'Full Path', 'Reason']));
    for (const dirErr of report.directoryErrors) {
      lines.push(buildCsvRow([dirErr.path, dirErr.fullPath, dirErr.reason]));
    }
  }

  // Prepend UTF-8 BOM for Excel compatibility on Windows
  const csvContent = '\uFEFF' + lines.join('\r\n') + '\r\n';
  await fs.promises.writeFile(saveResult.filePath, csvContent, 'utf8');

  return { canceled: false, filePath: saveResult.filePath };
}

module.exports = { exportReportToCsv };
