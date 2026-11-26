'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('videoCalcAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  startScan: (folderPath, concurrency) =>
    ipcRenderer.invoke('scan:start', { folderPath, concurrency }),
  cancelScan: () => ipcRenderer.invoke('scan:cancel'),
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  exportCsv: () => ipcRenderer.invoke('export:csv'),

  onScanProgress: (callback) => subscribe('scan:progress', callback),
  onScanBatch: (callback) => subscribe('scan:batch', callback),
  onScanComplete: (callback) => subscribe('scan:complete', callback),
  onScanError: (callback) => subscribe('scan:error', callback),
});
