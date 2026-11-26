'use strict';

const os = require('os');
const path = require('path');
const { scanFolderRecursive } = require('./folderScanner');

const PROGRESS_THROTTLE_MS = 100;
const BATCH_FLUSH_SIZE = 40;
const BATCH_FLUSH_MS = 150;

class ScanManager {
  /**
   * @param {import('./ffprobeService').FFprobeService} ffprobeService
   */
  constructor(ffprobeService) {
    this.ffprobeService = ffprobeService;
    this.activeScan = null;
    this.lastReport = null;
    this.scanCounter = 0;
  }

  static getDefaultConcurrency() {
    const cpuCount = os.cpus()?.length || 4;
    return Math.max(2, Math.min(cpuCount, 8));
  }

  static getMaxConcurrency() {
    const cpuCount = os.cpus()?.length || 4;
    return Math.max(4, Math.min(cpuCount * 2, 16));
  }

  getLastReport() {
    return this.lastReport;
  }

  /**
   * Cancels any currently running scan and kills active FFprobe child processes.
   */
  cancelCurrentScan() {
    if (!this.activeScan) {
      return false;
    }

    this.activeScan.controller.abort();
    this.ffprobeService.killAllActive();
    return true;
  }

  /**
   * Starts a full recursive scan + concurrent FFprobe analysis.
   *
   * @param {{
   *   folderPath: string,
   *   concurrency?: number,
   *   send: (channel: string, payload: any) => void
   * }} params
   */
  async startScan({ folderPath, concurrency, send }) {
    // Cancel any prior scan safely
    if (this.activeScan) {
      this.cancelCurrentScan();
    }

    const ffprobeStatus = this.ffprobeService.getStatus();
    if (!ffprobeStatus.available) {
      throw new Error(ffprobeStatus.error || 'Bundled FFprobe is unavailable.');
    }

    const scanId = ++this.scanCounter;
    const controller = new AbortController();
    const { signal } = controller;

    const maxConc = ScanManager.getMaxConcurrency();
    const parsedConc = Number(concurrency);
    const workerLimit =
      Number.isInteger(parsedConc) && parsedConc >= 1 && parsedConc <= maxConc
        ? parsedConc
        : ScanManager.getDefaultConcurrency();

    const startedAt = Date.now();
    const folderName = path.basename(folderPath) || folderPath;

    this.activeScan = { scanId, controller };

    const state = {
      scanId,
      phase: 'discovering',
      foldersScanned: 0,
      filesDiscovered: 0,
      filesProcessed: 0,
      remainingFiles: null,
      succeededCount: 0,
      warningCount: 0,
      failedCount: 0,
      skippedDuplicates: 0,
      skippedSymlinkCycles: 0,
      totalDurationMs: 0,
      currentFile: folderName,
      percent: 0,
    };

    const allResults = [];
    let pendingBatch = [];
    let lastProgressSent = 0;
    let lastBatchSent = Date.now();

    const emitProgress = (force = false) => {
      const now = Date.now();
      if (!force && now - lastProgressSent < PROGRESS_THROTTLE_MS) return;
      lastProgressSent = now;
      send('scan:progress', { ...state });
    };

    const flushBatch = (force = false) => {
      if (pendingBatch.length === 0) return;
      const now = Date.now();
      if (!force && pendingBatch.length < BATCH_FLUSH_SIZE && now - lastBatchSent < BATCH_FLUSH_MS) {
        return;
      }
      lastBatchSent = now;
      const batchToSend = pendingBatch;
      pendingBatch = [];
      send('scan:batch', { scanId, items: batchToSend });
    };

    // Immediate initial progress event
    emitProgress(true);

    let discoveryResult = {
      files: [],
      foldersScanned: 0,
      directoryErrors: [],
      skippedDuplicates: 0,
      skippedSymlinkCycles: 0,
    };

    try {
      // Phase 1: Asynchronous recursive file discovery
      discoveryResult = await scanFolderRecursive(folderPath, {
        signal,
        onProgress: (disc) => {
          state.foldersScanned = disc.foldersScanned;
          state.filesDiscovered = disc.filesDiscovered;
          state.skippedDuplicates = disc.skippedDuplicates;
          state.skippedSymlinkCycles = disc.skippedSymlinkCycles;
          state.currentFile = disc.currentPath;
          emitProgress(false);
        },
      });

      state.foldersScanned = discoveryResult.foldersScanned;
      state.filesDiscovered = discoveryResult.files.length;
      state.skippedDuplicates = discoveryResult.skippedDuplicates;
      state.skippedSymlinkCycles = discoveryResult.skippedSymlinkCycles;
      state.remainingFiles = discoveryResult.files.length;

      // Short-circuit cleanly when zero MP4 files exist
      if (discoveryResult.files.length === 0) {
        state.phase = 'completed';
        state.percent = 100;
        state.currentFile = '';
        emitProgress(true);

        const summary = {
          scanId,
          status: 'completed',
          folderPath,
          folderName,
          foldersScanned: state.foldersScanned,
          filesDiscovered: 0,
          filesProcessed: 0,
          succeededCount: 0,
          warningCount: 0,
          failedCount: 0,
          skippedDuplicates: state.skippedDuplicates,
          skippedSymlinkCycles: state.skippedSymlinkCycles,
          totalDurationMs: 0,
          elapsedMs: Date.now() - startedAt,
          directoryErrors: discoveryResult.directoryErrors,
        };

        this.lastReport = { ...summary, files: [] };
        send('scan:complete', summary);
        return;
      }

      // Phase 2: Bounded concurrent FFprobe worker pool
      state.phase = 'processing';
      emitProgress(true);

      let nextIndex = 0;
      const totalFiles = discoveryResult.files.length;
      const actualWorkers = Math.min(workerLimit, totalFiles);

      const runWorker = async () => {
        while (true) {
          if (signal.aborted) return;

          const currentIdx = nextIndex++;
          if (currentIdx >= totalFiles) return;

          const fileEntry = discoveryResult.files[currentIdx];
          state.currentFile = fileEntry.relativePath;

          let probe;
          try {
            probe = await this.ffprobeService.probeDuration(fileEntry.fullPath, signal);
          } catch (err) {
            if (err && err.name === 'AbortError') {
              return;
            }
            probe = {
              durationMs: null,
              status: 'failed',
              source: 'none',
              message: err?.message || 'Unexpected probe failure.',
            };
          }

          if (signal.aborted) return;

          const record = {
            id: currentIdx + 1,
            fileName: fileEntry.fileName,
            relativeFolder: fileEntry.relativeFolder,
            relativePath: fileEntry.relativePath,
            fullPath: fileEntry.fullPath,
            durationMs: probe.durationMs,
            status: probe.status,
            source: probe.source,
            message: probe.message,
          };

          allResults.push(record);
          pendingBatch.push(record);

          // Exact integer-millisecond aggregation (zero pre-rounding)
          if (probe.durationMs !== null && probe.status !== 'failed') {
            state.totalDurationMs += probe.durationMs;
            state.succeededCount += 1;
            if (probe.status === 'fallback' || probe.status === 'warning') {
              state.warningCount += 1;
            }
          } else {
            state.failedCount += 1;
          }

          state.filesProcessed += 1;
          state.remainingFiles = Math.max(0, totalFiles - state.filesProcessed);
          state.percent = Math.round((state.filesProcessed / totalFiles) * 100);

          flushBatch(false);
          emitProgress(false);
        }
      };

      await Promise.all(Array.from({ length: actualWorkers }, () => runWorker()));

      flushBatch(true);

      const finalStatus = signal.aborted ? 'cancelled' : 'completed';
      state.phase = finalStatus;
      state.currentFile = '';
      if (finalStatus === 'completed') {
        state.percent = 100;
        state.remainingFiles = 0;
      }
      emitProgress(true);

      const summary = {
        scanId,
        status: finalStatus,
        folderPath,
        folderName,
        foldersScanned: state.foldersScanned,
        filesDiscovered: state.filesDiscovered,
        filesProcessed: state.filesProcessed,
        succeededCount: state.succeededCount,
        warningCount: state.warningCount,
        failedCount: state.failedCount,
        skippedDuplicates: state.skippedDuplicates,
        skippedSymlinkCycles: state.skippedSymlinkCycles,
        totalDurationMs: state.totalDurationMs,
        elapsedMs: Date.now() - startedAt,
        directoryErrors: discoveryResult.directoryErrors,
      };

      this.lastReport = { ...summary, files: allResults };
      send('scan:complete', summary);
    } catch (err) {
      flushBatch(true);

      if (err && err.name === 'AbortError') {
        state.phase = 'cancelled';
        state.currentFile = '';
        emitProgress(true);

        const summary = {
          scanId,
          status: 'cancelled',
          folderPath,
          folderName,
          foldersScanned: state.foldersScanned,
          filesDiscovered: state.filesDiscovered,
          filesProcessed: state.filesProcessed,
          succeededCount: state.succeededCount,
          warningCount: state.warningCount,
          failedCount: state.failedCount,
          skippedDuplicates: state.skippedDuplicates,
          skippedSymlinkCycles: state.skippedSymlinkCycles,
          totalDurationMs: state.totalDurationMs,
          elapsedMs: Date.now() - startedAt,
          directoryErrors: discoveryResult.directoryErrors,
        };

        this.lastReport = { ...summary, files: allResults };
        send('scan:complete', summary);
      } else {
        state.phase = 'error';
        state.currentFile = '';
        emitProgress(true);
        send('scan:error', {
          scanId,
          message: err?.message || 'An unexpected error occurred while scanning.',
        });
      }
    } finally {
      if (this.activeScan && this.activeScan.scanId === scanId) {
        this.activeScan = null;
      }
    }
  }
}

module.exports = { ScanManager };
