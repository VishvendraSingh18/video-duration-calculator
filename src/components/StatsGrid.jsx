import React from 'react';
import { Film, CheckCircle2, Timer, AlertOctagon, Folder } from 'lucide-react';
import { formatCompactDuration, formatNumber } from '../utils/formatters';

export default function StatsGrid({ progress }) {
  const cards = [
    {
      label: 'MP4 Files Discovered',
      value: formatNumber(progress.filesDiscovered),
      icon: Film,
      accent: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
    },
    {
      label: 'Successfully Processed',
      value: formatNumber(progress.succeededCount),
      sub: progress.warningCount > 0 ? `${formatNumber(progress.warningCount)} w/ notes` : null,
      icon: CheckCircle2,
      accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    },
    {
      label: 'Combined Duration',
      value: formatCompactDuration(progress.totalDurationMs),
      icon: Timer,
      accent: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10',
    },
    {
      label: 'Failed Files',
      value: formatNumber(progress.failedCount),
      icon: AlertOctagon,
      accent:
        progress.failedCount > 0
          ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
          : 'text-slate-500 dark:text-slate-400 bg-slate-500/10',
    },
    {
      label: 'Folders Scanned',
      value: formatNumber(progress.foldersScanned),
      icon: Folder,
      accent: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/70 dark:hover:border-slate-700"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {card.label}
              </span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.accent}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {card.value}
              </span>
              {card.sub && (
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  {card.sub}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
