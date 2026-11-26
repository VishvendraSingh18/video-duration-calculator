import React from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Activity } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

const STATUS_META = {
  idle: {
    label: 'Ready',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    icon: Activity,
  },
  discovering: {
    label: 'Discovering MP4 Files...',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    icon: Loader2,
    spin: true,
  },
  processing: {
    label: 'Calculating Durations...',
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    icon: Loader2,
    spin: true,
  },
  cancelling: {
    label: 'Cancelling Scan...',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    icon: Loader2,
    spin: true,
  },
  completed: {
    label: 'Scan Completed',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Scan Cancelled',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
  },
  error: {
    label: 'Scan Error',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    icon: XCircle,
  },
};

export default function ProgressPanel({ progress, elapsedMs }) {
  const meta = STATUS_META[progress.phase] || STATUS_META.idle;
  const Icon = meta.icon;
  const isDiscovering = progress.phase === 'discovering';
  const percent = Math.max(0, Math.min(100, progress.percent || 0));

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}
          >
            <Icon className={`h-3.5 w-3.5 ${meta.spin ? 'animate-spin' : ''}`} />
            <span>{meta.label}</span>
          </span>
          {elapsedMs !== null && progress.phase === 'completed' && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Completed in {(elapsedMs / 1000).toFixed(2)}s
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span>
            Discovered:{' '}
            <strong className="font-mono text-slate-900 dark:text-white">
              {formatNumber(progress.filesDiscovered)}
            </strong>
          </span>
          <span>
            Processed:{' '}
            <strong className="font-mono text-slate-900 dark:text-white">
              {formatNumber(progress.filesProcessed)}
            </strong>
          </span>
          <span>
            Remaining:{' '}
            <strong className="font-mono text-slate-900 dark:text-white">
              {progress.remainingFiles === null ? 'Calculating...' : formatNumber(progress.remainingFiles)}
            </strong>
          </span>
          <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
            {isDiscovering ? '...' : `${percent}%`}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-200 ${
            isDiscovering
              ? 'w-1/3 animate-pulse bg-gradient-to-r from-indigo-500 to-cyan-400'
              : progress.phase === 'cancelled'
              ? 'bg-amber-500'
              : progress.phase === 'error'
              ? 'bg-rose-500'
              : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400'
          }`}
          style={isDiscovering ? undefined : { width: `${percent}%` }}
        />
      </div>

      {/* Active File + Deduplication Info */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <p className="min-w-0 flex-1 truncate font-mono" title={progress.currentFile || ''}>
          {progress.currentFile ? `Current: ${progress.currentFile}` : 'Idle — select a folder to begin.'}
        </p>
        {(progress.skippedDuplicates > 0 || progress.skippedSymlinkCycles > 0) && (
          <div className="flex items-center gap-3 text-[11px]">
            {progress.skippedDuplicates > 0 && (
              <span>Duplicates skipped: {formatNumber(progress.skippedDuplicates)}</span>
            )}
            {progress.skippedSymlinkCycles > 0 && (
              <span>Symlink cycles avoided: {formatNumber(progress.skippedSymlinkCycles)}</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
