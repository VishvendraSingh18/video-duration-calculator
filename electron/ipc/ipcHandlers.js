'use strict';

const fs = require('fs');
const path = require('path');
const { app, clipboard, dialog, ipcMain } = require('electron');
const { ScanManager } = require('../services/scanManager');
const { exportReportToCsv } = require('../services/csvExporter');

/**
 * Registers all validated IPC handlers for the application.
 *
 * @param {{
 *   getMainWindow: () => Electron.BrowserWindow|null,
 *   ffprobeService: import('../services/ffprobeService').FFprobeService,
 *   scanManager: import('../services/scanManager').ScanManager
 * }} deps
 */
function registerIpcHandlers({ getMainWindow, ffprobeService, scanManager }) {
  ipcMain.handle('app:get-info', async () => {
    const ffprobe = ffprobeService.getStatus();
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      defaultConcurrency: ScanManager.getDefaultConcurrency(),
      maxConcurrency: ScanManager.getMaxConcurrency(),
      ffprobe,
    };
  });

  ipcMain.handle('dialog:select-folder', async () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) {
      return { canceled: true };
    }

    const result = await dialog.showOpenDialog(win, {
      title: 'Select Parent Folder Containing MP4 Videos',
      properties: ['openDirectory'],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const folderPath = result.filePaths[0];
    return {
      canceled: false,
      folderPath,
      folderName: path.basename(folderPath) || folderPath,
    };
  });

  ipcMain.handle('scan:start', async (_event, payload) => {
    if (!payload || typeof payload.folderPath !== 'string' || !payload.folderPath.trim()) {
      return { started: false, error: 'A valid folder path is required.' };
    }

    const folderPath = path.resolve(payload.folderPath);

    try {
      const stats = await fs.promises.stat(folderPath);
      if (!stats.isDirectory()) {
        return { started: false, error: 'Selected path is not a valid folder.' };
      }
    } catch {
      return { started: false, error: 'Selected folder does not exist or cannot be accessed.' };
    }

    const concurrency =
      typeof payload.concurrency === 'number' && Number.isFinite(payload.concurrency)
        ? Math.floor(payload.concurrency)
        : undefined;

    const send = (channel, data) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    };

    // Run asynchronously so IPC invoke returns immediately and keeps UI non-blocking
    scanManager.startScan({ folderPath, concurrency, send }).catch((err) => {
      send('scan:error', {
        message: err?.message || 'Unable to start folder scan.',
      });
    });

    return { started: true };
  });

  ipcMain.handle('scan:cancel', async () => {
    const cancelled = scanManager.cancelCurrentScan();
    return { cancelled };
  });

  ipcMain.handle('clipboard:write', async (_event, text) => {
    if (typeof text !== 'string' || text.length > 10000) {
      return { success: false, error: 'Invalid clipboard text.' };
    }
    clipboard.writeText(text);
    return { success: true };
  });

  ipcMain.handle('export:csv', async () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) {
      return { canceled: true };
    }

    try {
      const report = scanManager.getLastReport();
      return await exportReportToCsv(win, report);
    } catch (err) {
      return {
        canceled: false,
        error: err?.message || 'Failed to write CSV file.',
      };
    }
  });
}

module.exports = { registerIpcHandlers };
