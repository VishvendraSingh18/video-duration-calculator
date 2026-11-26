import React from 'react';
import { XCircle, AlertTriangle, FolderX, CheckCircle2 } from 'lucide-react';
import { formatSingleDuration } from '../utils/formatters';

export default function ErrorReportPanel({ failedFiles, warningFiles, directoryErrors }) {
  const totalIssues = failedFiles.length + warningFiles.length + directoryErrors.length;

  if (totalIssues === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-6 py-14 text-center dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
          No Errors or Metadata Warnings
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Every scanned folder and MP4 file reported clean, consistent duration metadata.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Failed Files */}
      {failedFiles.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-rose-500/25 bg-white dark:bg-slate-900/70">
          <div className="flex items-center gap-2 border-b border-rose-500/20 bg-rose-500/5 px-4 py-3">
            <XCircle className="h-4 w-4 text-rose-500" />
            <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
              Failed Video Files ({failedFiles.length}) — Excluded from Total Duration
            </h3>
          </div>
          <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {failedFiles.map((file) => (
              <li key={file.id} className="px-4 py-3 text-sm">
                <div className="font-medium text-slate-900 dark:text-white">{file.fileName}</div>
                <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {file.relativePath}
                </div>
                <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">{file.message}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata Warnings & Stream Fallbacks */}
      {warningFiles.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-amber-500/25 bg-white dark:bg-slate-900/70">
          <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Metadata Warnings & Stream Fallbacks ({warningFiles.length})
            </h3>
          </div>
          <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {warningFiles.map((file) => (
              <li key={file.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900 dark:text-white">{file.fileName}</span>
                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {formatSingleDuration(file.durationMs)}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {file.relativePath}
                </div>
                <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">{file.message}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unreadable Folders / Permission Issues */}
      {directoryErrors.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-300/80 bg-white dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
            <FolderX className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Skipped / Unreadable Folders & Entries ({directoryErrors.length})
            </h3>
          </div>
          <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {directoryErrors.map((err, idx) => (
              <li key={`${err.fullPath}-${idx}`} className="px-4 py-3 text-sm">
                <div className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                  {err.path}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{err.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
