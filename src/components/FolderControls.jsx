import React from 'react';
import { FolderOpen, RefreshCw, Square, FolderTree } from 'lucide-react';

export default function FolderControls({
  selectedFolder,
  isScanning,
  ffprobeReady,
  onSelectFolder,
  onRescan,
  onCancel,
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/70">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Selected Folder Display */}
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <FolderTree className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Target Parent Folder (Recursive Scan)
            </p>
            {selectedFolder ? (
              <>
                <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">
                  {selectedFolder.folderName}
                </h2>
                <p
                  className="truncate font-mono text-xs text-slate-500 dark:text-slate-400"
                  title={selectedFolder.folderPath}
                >
                  {selectedFolder.folderPath}
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                Choose a folder to recursively scan all MP4 videos across every nested subfolder.
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!ffprobeReady || isScanning}
            onClick={onSelectFolder}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen className="h-4 w-4" />
            <span>{selectedFolder ? 'Select Another Folder' : 'Select Folder'}</span>
          </button>

          <button
            type="button"
            disabled={!selectedFolder || !ffprobeReady || isScanning}
            onClick={onRescan}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Rescan</span>
          </button>

          {isScanning && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Cancel Scan</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
