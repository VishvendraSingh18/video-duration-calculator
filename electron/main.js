'use strict';

const path = require('path');
const { app, BrowserWindow, Menu } = require('electron');
const { FFprobeService } = require('./services/ffprobeService');
const { ScanManager } = require('./services/scanManager');
const { registerIpcHandlers } = require('./ipc/ipcHandlers');

const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged;

let mainWindow = null;
const ffprobeService = new FFprobeService();
const scanManager = new ScanManager(ffprobeService);

// Enforce single instance to avoid conflicting scans
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#020617',
    title: 'Video Duration Calculator',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Remove default browser-like menu bar for a clean desktop utility feel
  Menu.setApplicationMenu(null);

  // Security hardening: prevent navigation or popup windows
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isDev || !url.startsWith('http://127.0.0.1:5173')) {
      event.preventDefault();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    scanManager.cancelCurrentScan();
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  await ffprobeService.validate();

  registerIpcHandlers({
    getMainWindow: () => mainWindow,
    ffprobeService,
    scanManager,
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  scanManager.cancelCurrentScan();
  ffprobeService.killAllActive();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
