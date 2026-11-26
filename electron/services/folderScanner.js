'use strict';

const fs = require('fs');
const path = require('path');
const { formatFsError } = require('../utils/errorHandler');

/**
 * Normalizes relative directory paths using forward slashes for consistent UI/CSV output.
 *
 * @param {string} rootPath
 * @param {string} targetPath
 * @returns {string}
 */
function toDisplayRelative(rootPath, targetPath) {
  const rel = path.relative(rootPath, targetPath);
  if (!rel) return '.';
  return rel.split(path.sep).join('/');
}

/**
 * Generates a canonical deduplication key for a file or directory using realpath
 * and filesystem device/inode numbers when available.
 *
 * @param {string} realPath
 * @param {fs.BigIntStats} stats
 * @returns {string}
 */
function buildIdentityKey(realPath, stats) {
  const normalizedPath = process.platform === 'win32' ? realPath.toLowerCase() : realPath;
  if (stats && typeof stats.ino === 'bigint' && stats.ino > 0n) {
    return `ino:${stats.dev.toString()}:${stats.ino.toString()}`;
  }
  return `path:${normalizedPath}`;
}

/**
 * Recursively discovers all MP4 files within `rootFolder` at unlimited nesting depth.
 *
 * @param {string} rootFolder
 * @param {{
 *   signal?: AbortSignal,
 *   onProgress?: (stats: {
 *     foldersScanned: number,
 *     filesDiscovered: number,
 *     currentPath: string,
 *     skippedDuplicates: number,
 *     skippedSymlinkCycles: number
 *   }) => void
 * }} options
 */
async function scanFolderRecursive(rootFolder, options = {}) {
  const { signal, onProgress } = options;

  const files = [];
  const directoryErrors = [];
  const visitedDirs = new Set();
  const seenFiles = new Set();

  let foldersScanned = 0;
  let skippedDuplicates = 0;
  let skippedSymlinkCycles = 0;
  let lastReportTime = 0;

  // Validate and canonicalize root directory
  const rootRealPath = await fs.promises.realpath(rootFolder);
  const rootStats = await fs.promises.stat(rootRealPath, { bigint: true });
  if (!rootStats.isDirectory()) {
    throw new Error('Selected path is not a directory.');
  }

  visitedDirs.add(buildIdentityKey(rootRealPath, rootStats));

  // Iterative queue avoids recursion stack overflow on deeply nested folder trees
  const dirQueue = [rootFolder];

  const emitProgress = (currentPath, force = false) => {
    if (!onProgress) return;
    const now = Date.now();
    if (!force && now - lastReportTime < 100) return;
    lastReportTime = now;
    onProgress({
      foldersScanned,
      filesDiscovered: files.length,
      currentPath,
      skippedDuplicates,
      skippedSymlinkCycles,
    });
  };

  while (dirQueue.length > 0) {
    if (signal && signal.aborted) {
      const abortErr = new Error('Scan cancelled');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const currentDir = dirQueue.shift();
    foldersScanned += 1;
    emitProgress(toDisplayRelative(rootFolder, currentDir));

    let dirHandle;
    try {
      dirHandle = await fs.promises.opendir(currentDir);
    } catch (err) {
      directoryErrors.push({
        path: toDisplayRelative(rootFolder, currentDir),
        fullPath: currentDir,
        reason: formatFsError(err),
      });
      continue;
    }

    try {
      for await (const dirent of dirHandle) {
        if (signal && signal.aborted) {
          const abortErr = new Error('Scan cancelled');
          abortErr.name = 'AbortError';
          throw abortErr;
        }

        const entryPath = path.join(currentDir, dirent.name);

        let isDir = dirent.isDirectory();
        let isFile = dirent.isFile();
        let isSymlink = dirent.isSymbolicLink();

        // Resolve symbolic links or unknown entry types safely
        if (isSymlink || (!isDir && !isFile)) {
          try {
            const targetStats = await fs.promises.stat(entryPath, { bigint: true });
            isDir = targetStats.isDirectory();
            isFile = targetStats.isFile();
          } catch (err) {
            // Broken symlink or restricted target — record only if it looks like an MP4 or directory
            if (path.extname(dirent.name).toLowerCase() === '.mp4' || isSymlink) {
              directoryErrors.push({
                path: toDisplayRelative(rootFolder, entryPath),
                fullPath: entryPath,
                reason: `Unreadable link or entry: ${formatFsError(err)}`,
              });
            }
            continue;
          }
        }

        if (isDir) {
          try {
            const realDir = await fs.promises.realpath(entryPath);
            const dirStats = await fs.promises.stat(realDir, { bigint: true });
            const dirKey = buildIdentityKey(realDir, dirStats);

            if (visitedDirs.has(dirKey)) {
              skippedSymlinkCycles += 1;
              continue;
            }

            visitedDirs.add(dirKey);
            dirQueue.push(entryPath);
          } catch (err) {
            directoryErrors.push({
              path: toDisplayRelative(rootFolder, entryPath),
              fullPath: entryPath,
              reason: formatFsError(err),
            });
          }
          continue;
        }

        if (isFile) {
          // Case-insensitive .mp4 detection (.mp4, .MP4, .Mp4, etc.)
          if (path.extname(dirent.name).toLowerCase() !== '.mp4') {
            continue;
          }

          try {
            const realFile = await fs.promises.realpath(entryPath);
            const fileStats = await fs.promises.stat(realFile, { bigint: true });
            const fileKey = buildIdentityKey(realFile, fileStats);

            if (seenFiles.has(fileKey)) {
              skippedDuplicates += 1;
              continue;
            }
            seenFiles.add(fileKey);

            files.push({
              fileName: dirent.name,
              fullPath: entryPath,
              relativeFolder: toDisplayRelative(rootFolder, currentDir),
              relativePath: toDisplayRelative(rootFolder, entryPath),
            });

            emitProgress(toDisplayRelative(rootFolder, entryPath));
          } catch (err) {
            directoryErrors.push({
              path: toDisplayRelative(rootFolder, entryPath),
              fullPath: entryPath,
              reason: formatFsError(err),
            });
          }
        }
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw err;
      }
      directoryErrors.push({
        path: toDisplayRelative(rootFolder, currentDir),
        fullPath: currentDir,
        reason: formatFsError(err),
      });
    }
  }

  emitProgress(toDisplayRelative(rootFolder, rootFolder), true);

  return {
    files,
    foldersScanned,
    directoryErrors,
    skippedDuplicates,
    skippedSymlinkCycles,
  };
}

module.exports = { scanFolderRecursive };
