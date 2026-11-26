import React from 'react';
import { Sun, Moon, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Header({
  appInfo,
  isDark,
  onToggleTheme,
  concurrency,
  onConcurrencyChange,
  isScanning,
}) {
  const maxConc = appInfo?.maxConcurrency || 16;
  const ffprobeOk = appInfo?.ffprobe?.available;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3.5">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 shadow-lg shadow-indigo-500/20">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <polygon points="10 8.5 16 12 10 15.5 10 8.5" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                Video Duration Calculator
              </h1>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-300">
                v{appInfo?.version || '1.0.0'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              High-precision offline MP4 folder analyzer
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* FFprobe Engine Indicator */}
          <div
            title={
              ffprobeOk
                ? `${appInfo.ffprobe.version || 'FFprobe ready'}\n${appInfo.ffprobe.path}`
                : appInfo?.ffprobe?.error || 'Validating FFprobe...'
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              ffprobeOk
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            {ffprobeOk ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{ffprobeOk ? 'FFprobe Ready' : 'FFprobe Error'}</span>
          </div>

          {/* Concurrency Selector */}
          <label
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            title="Maximum simultaneous FFprobe worker processes"
          >
            <Cpu className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>Workers:</span>
            <select
              value={concurrency}
              disabled={isScanning}
              onChange={(e) => onConcurrencyChange(Number(e.target.value))}
              className="cursor-pointer bg-transparent font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
            >
              {Array.from({ length: maxConc }, (_, idx) => idx + 1).map((val) => (
                <option key={val} value={val} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                  {val}
                </option>
              ))}
            </select>
          </label>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-indigo-400/50 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
