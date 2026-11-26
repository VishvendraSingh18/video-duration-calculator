import React from 'react';
import { Copy, Check, Download, Clock } from 'lucide-react';
import { breakdownDuration, formatDecimal, formatHeroLine } from '../utils/formatters';

export default function DurationHero({
  totalDurationMs,
  hasResults,
  isScanning,
  copied,
  onCopyDuration,
  onExportCsv,
}) {
  const b = breakdownDuration(totalDurationMs);

  const segments = [
    { label: 'Days', value: b.days },
    { label: 'Hours', value: b.hours },
    { label: 'Minutes', value: b.minutes },
    {
      label: 'Seconds',
      value: b.isSubSecond ? (b.totalMs / 1000).toFixed(3) : b.seconds,
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 text-white shadow-xl shadow-indigo-950/15 dark:border-indigo-500/25">
      {/* Subtle decorative glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-6">
        {/* Top Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-indigo-300">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Total Combined Video Duration
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!hasResults}
              onClick={onCopyDuration}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Total Duration</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={!hasResults || isScanning}
              onClick={onExportCsv}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/25 px-3.5 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur transition hover:bg-indigo-500/35 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Main Segmented Duration Display */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-center backdrop-blur-sm"
            >
              <div className="font-mono text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {typeof seg.value === 'number' ? String(seg.value).padStart(2, '0') : seg.value}
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                {seg.label}
              </div>
            </div>
          ))}
        </div>

        {/* Formatted Single-Line Readout */}
        <p className="text-center font-mono text-sm font-medium text-indigo-200/90">
          {formatHeroLine(totalDurationMs)}
        </p>

        {/* Equivalent Totals Bar */}
        <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3.5 py-2.5 sm:flex-col sm:items-start sm:gap-0.5">
            <span className="text-xs text-slate-400">Total Hours</span>
            <span className="font-mono text-base font-semibold text-white">
              {formatDecimal(b.totalHours, 2)} hrs
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3.5 py-2.5 sm:flex-col sm:items-start sm:gap-0.5">
            <span className="text-xs text-slate-400">Total Minutes</span>
            <span className="font-mono text-base font-semibold text-white">
              {formatDecimal(b.totalMinutes, 2)} min
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3.5 py-2.5 sm:flex-col sm:items-start sm:gap-0.5">
            <span className="text-xs text-slate-400">Total Seconds</span>
            <span className="font-mono text-base font-semibold text-white">
              {formatDecimal(b.totalSeconds, 2)} sec
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
