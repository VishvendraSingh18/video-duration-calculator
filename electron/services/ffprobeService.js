'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { app } = require('electron');
const { parseDurationToMs } = require('../utils/durationUtils');
const { formatFfprobeError } = require('../utils/errorHandler');

const PROBE_TIMEOUT_MS = 20000;
const MAX_BUFFER_BYTES = 2 * 1024 * 1024; // 2 MB JSON ceiling
const INCONSISTENCY_MIN_DIFF_MS = 5000;   // 5 seconds
const INCONSISTENCY_RATIO = 0.1;          // 10% divergence
const MVHD_TAIL_SCAN_BYTES = 8 * 1024 * 1024; // Last 8 MB
const MVHD_HEAD_SCAN_BYTES = 2 * 1024 * 1024; // First 2 MB

class FFprobeService {
  constructor() {
    this.binaryPath = null;
    this.versionInfo = null;
    this.validationError = null;
    this.activeProcesses = new Set();
  }

  resolveBinaryPath() {
    const exeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    const candidates = [];

    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'bin', process.platform, exeName));
      candidates.push(path.join(process.resourcesPath, 'bin', exeName));
    }

    try {
      const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
      if (ffprobeInstaller && ffprobeInstaller.path) {
        const unpackedPath = ffprobeInstaller.path.replace(
          /app\.asar([\\/])/i,
          'app.asar.unpacked$1'
        );
        candidates.push(unpackedPath);
        if (unpackedPath !== ffprobeInstaller.path) {
          candidates.push(ffprobeInstaller.path);
        }
      }
    } catch {
      // Handled below if no candidate resolves
    }

    if (!app.isPackaged) {
      candidates.push(path.join(process.cwd(), 'resources', 'bin', process.platform, exeName));
    }

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  async validate() {
    const resolved = this.resolveBinaryPath();

    if (!resolved) {
      this.binaryPath = null;
      this.versionInfo = null;
      this.validationError =
        'Bundled FFprobe binary was not found for this operating system. Please reinstall the application.';
      return this.getStatus();
    }

    if (process.platform !== 'win32') {
      try {
        await fs.promises.access(resolved, fs.constants.X_OK);
      } catch {
        try {
          await fs.promises.chmod(resolved, 0o755);
        } catch (chmodErr) {
          this.binaryPath = resolved;
          this.validationError = `FFprobe binary is not executable and permissions could not be updated: ${chmodErr.message}`;
          return this.getStatus();
        }
      }
    }

    try {
      const versionLine = await new Promise((resolve, reject) => {
        execFile(
          resolved,
          ['-version'],
          { windowsHide: true, timeout: 10000, maxBuffer: 512 * 1024 },
          (err, stdout, stderr) => {
            if (err) {
              reject(new Error(formatFfprobeError(err, stderr)));
              return;
            }
            const firstLine = String(stdout || '').split(/\r?\n/)[0]?.trim() || 'FFprobe ready';
            resolve(firstLine);
          }
        );
      });

      this.binaryPath = resolved;
      this.versionInfo = versionLine;
      this.validationError = null;
      return this.getStatus();
    } catch (err) {
      this.binaryPath = resolved;
      this.versionInfo = null;
      this.validationError = `Bundled FFprobe failed validation: ${err.message}`;
      return this.getStatus();
    }
  }

  getStatus() {
    return {
      available: Boolean(this.binaryPath && !this.validationError),
      path: this.binaryPath,
      version: this.versionInfo,
      error: this.validationError,
    };
  }

  killAllActive() {
    for (const child of this.activeProcesses) {
      try {
        child.kill('SIGTERM');
        if (process.platform !== 'win32') {
          setTimeout(() => {
            try {
              if (!child.killed) child.kill('SIGKILL');
            } catch {
              // Process already exited
            }
          }, 1500).unref();
        }
      } catch {
        // Ignore already-closed child processes
      }
    }
    this.activeProcesses.clear();
  }

  /**
   * Parses a strictly validated ISO 14496-12 `mvhd` box from a Buffer slice.
   * Returns exact integer milliseconds or null if no valid `mvhd` header exists.
   *
   * @param {Buffer} buf
   * @returns {number|null}
   */
  findValidatedMvhdDurationMs(buf) {
    let offset = 0;

    while (offset < buf.length) {
      const idx = buf.indexOf('mvhd', offset, 'ascii');
      if (idx === -1) return null;

      offset = idx + 4;
      const boxStart = idx - 4;
      if (boxStart < 0 || boxStart + 108 > buf.length) continue;

      const boxSize = buf.readUInt32BE(boxStart);
      const version = buf[boxStart + 8];
      const flags =
        (buf[boxStart + 9] << 16) | (buf[boxStart + 10] << 8) | buf[boxStart + 11];

      if (flags !== 0) continue;

      if (version === 0 && boxSize === 108) {
        const timescale = buf.readUInt32BE(boxStart + 20);
        const duration = buf.readUInt32BE(boxStart + 24);
        const rate = buf.readUInt32BE(boxStart + 28);

        if (rate !== 0x00010000 || timescale === 0 || duration === 0 || duration === 0xffffffff) {
          continue;
        }

        // Verify 10 reserved zero bytes (offsets 34..43) to eliminate false matches
        let reservedValid = true;
        for (let i = 34; i < 44; i += 1) {
          if (buf[boxStart + i] !== 0) {
            reservedValid = false;
            break;
          }
        }
        if (!reservedValid) continue;

        const ms = Math.round((duration / timescale) * 1000);
        if (Number.isSafeInteger(ms) && ms > 0) return ms;
      } else if (version === 1 && boxSize === 120 && boxStart + 120 <= buf.length) {
        const timescale = buf.readUInt32BE(boxStart + 28);
        const durationBig = buf.readBigUInt64BE(boxStart + 32);
        const rate = buf.readUInt32BE(boxStart + 40);

        if (
          rate !== 0x00010000 ||
          timescale === 0 ||
          durationBig === 0n ||
          durationBig === 0xffffffffffffffffn
        ) {
          continue;
        }

        let reservedValid = true;
        for (let i = 46; i < 56; i += 1) {
          if (buf[boxStart + i] !== 0) {
            reservedValid = false;
            break;
          }
        }
        if (!reservedValid) continue;

        const seconds = Number(durationBig) / timescale;
        const ms = Math.round(seconds * 1000);
        if (Number.isSafeInteger(ms) && ms > 0) return ms;
      }
    }

    return null;
  }

  /**
   * Scans the tail and head of an MP4 file for a misaligned `mvhd` box
   * when FFprobe fails due to an invalid box size before `moov`.
   *
   * @param {string} filePath
   * @param {AbortSignal} signal
   * @returns {Promise<number|null>}
   */
  async extractDurationFromMisalignedMvhd(filePath, signal) {
    if (signal && signal.aborted) return null;

    let fh;
    try {
      fh = await fs.promises.open(filePath, 'r');
      const { size } = await fh.stat();
      if (size < 108) return null;

      // 1. Check tail (most recorders write `moov` at the end)
      const tailLen = Math.min(size, MVHD_TAIL_SCAN_BYTES);
      const tailBuf = Buffer.allocUnsafe(tailLen);
      const tailRead = await fh.read(tailBuf, 0, tailLen, size - tailLen);
      const tailDuration = this.findValidatedMvhdDurationMs(
        tailBuf.subarray(0, tailRead.bytesRead)
      );
      if (tailDuration !== null) return tailDuration;

      if (signal && signal.aborted) return null;

      // 2. Check head if file is larger than tail window
      if (size > tailLen) {
        const headLen = Math.min(size - tailLen, MVHD_HEAD_SCAN_BYTES);
        const headBuf = Buffer.allocUnsafe(headLen);
        const headRead = await fh.read(headBuf, 0, headLen, 0);
        return this.findValidatedMvhdDurationMs(headBuf.subarray(0, headRead.bytesRead));
      }

      return null;
    } catch {
      return null;
    } finally {
      if (fh) {
        try {
          await fh.close();
        } catch {
          // Ignore close error
        }
      }
    }
  }

  probeDuration(filePath, signal) {
    if (signal && signal.aborted) {
      const abortErr = new Error('Scan cancelled');
      abortErr.name = 'AbortError';
      return Promise.reject(abortErr);
    }

    if (!this.binaryPath || this.validationError) {
      return Promise.resolve({
        durationMs: null,
        status: 'failed',
        source: 'none',
        message: this.validationError || 'FFprobe binary is unavailable.',
      });
    }

    return new Promise((resolve, reject) => {
      const args = [
        '-v',
        'error',
        '-show_entries',
        'format=duration:stream=index,codec_type,duration',
        '-of',
        'json',
        filePath,
      ];

      let settled = false;

      const child = execFile(
        this.binaryPath,
        args,
        {
          windowsHide: true,
          timeout: PROBE_TIMEOUT_MS,
          maxBuffer: MAX_BUFFER_BYTES,
        },
        async (err, stdout, stderr) => {
          this.activeProcesses.delete(child);
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }

          if (settled) return;
          settled = true;

          if (signal && signal.aborted) {
            const abortErr = new Error('Scan cancelled');
            abortErr.name = 'AbortError';
            reject(abortErr);
            return;
          }

          if (err) {
            // Fallback: check for a valid but misaligned MP4 `mvhd` box
            if (/moov atom not found/i.test(String(stderr || ''))) {
              const recoveredMs = await this.extractDurationFromMisalignedMvhd(filePath, signal);
              if (signal && signal.aborted) {
                const abortErr = new Error('Scan cancelled');
                abortErr.name = 'AbortError';
                reject(abortErr);
                return;
              }
              if (recoveredMs !== null) {
                resolve({
                  durationMs: recoveredMs,
                  status: 'fallback',
                  source: 'mp4-mvhd',
                  message:
                    'FFprobe reported missing moov atom; recovered exact duration from misaligned MP4 mvhd header.',
                });
                return;
              }
            }

            resolve({
              durationMs: null,
              status: 'failed',
              source: 'none',
              message: formatFfprobeError(err, stderr),
            });
            return;
          }

          resolve(this.interpretProbeJson(stdout));
        }
      );

      this.activeProcesses.add(child);

      const onAbort = () => {
        if (settled) return;
        settled = true;
        this.activeProcesses.delete(child);
        try {
          child.kill('SIGTERM');
        } catch {
          // Ignore
        }
        const abortErr = new Error('Scan cancelled');
        abortErr.name = 'AbortError';
        reject(abortErr);
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  interpretProbeJson(rawStdout) {
    let parsed;
    try {
      parsed = JSON.parse(rawStdout || '{}');
    } catch {
      return {
        durationMs: null,
        status: 'failed',
        source: 'none',
        message: 'FFprobe returned malformed JSON metadata.',
      };
    }

    const formatMs = parseDurationToMs(parsed?.format?.duration);
    const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];

    const videoStreamDurations = streams
      .filter((s) => s && s.codec_type === 'video')
      .map((s) => parseDurationToMs(s.duration))
      .filter((ms) => ms !== null);

    const otherStreamDurations = streams
      .filter((s) => s && s.codec_type !== 'video')
      .map((s) => parseDurationToMs(s.duration))
      .filter((ms) => ms !== null);

    const maxVideoMs = videoStreamDurations.length > 0 ? Math.max(...videoStreamDurations) : null;
    const maxOtherMs = otherStreamDurations.length > 0 ? Math.max(...otherStreamDurations) : null;

    if (formatMs !== null) {
      if (maxVideoMs !== null) {
        const diffMs = Math.abs(formatMs - maxVideoMs);
        const baseline = Math.max(formatMs, maxVideoMs);
        if (diffMs > INCONSISTENCY_MIN_DIFF_MS && diffMs / baseline > INCONSISTENCY_RATIO) {
          return {
            durationMs: formatMs,
            status: 'warning',
            source: 'format',
            message: `Inconsistent metadata: container duration (${(formatMs / 1000).toFixed(2)}s) differs from video stream (${(maxVideoMs / 1000).toFixed(2)}s).`,
          };
        }
      }

      return {
        durationMs: formatMs,
        status: 'ok',
        source: 'format',
        message: null,
      };
    }

    if (maxVideoMs !== null) {
      return {
        durationMs: maxVideoMs,
        status: 'fallback',
        source: 'stream-video',
        message: 'Container duration missing; used validated video stream duration fallback.',
      };
    }

    if (maxOtherMs !== null) {
      return {
        durationMs: maxOtherMs,
        status: 'fallback',
        source: 'stream-audio',
        message:
          'Container and video stream durations missing; used validated audio stream duration fallback.',
      };
    }

    return {
      durationMs: null,
      status: 'failed',
      source: 'none',
      message: 'Missing or unreadable duration metadata in both container and streams.',
    };
  }
}

module.exports = { FFprobeService };
