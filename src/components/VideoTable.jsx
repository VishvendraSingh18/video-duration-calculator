import React, { useMemo, useState, useEffect } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Film,
} from 'lucide-react';
import { formatSingleDuration, formatNumber } from '../utils/formatters';

const STATUS_RANK = { ok: 1, fallback: 2, warning: 3, failed: 4 };

export default function VideoTable({ files, scanPhase, hasSelectedFolder }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('relativeFolder');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset pagination on search or dataset reset
  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortBy, sortDir, pageSize, files.length === 0]);

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'durationMs' ? 'desc' : 'asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? files.filter(
          (item) =>
            item.fileName.toLowerCase().includes(q) ||
            item.relativeFolder.toLowerCase().includes(q)
        )
      : files;

    const dirMultiplier = sortDir === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'durationMs') {
        const av = a.durationMs ?? -1;
        const bv = b.durationMs ?? -1;
        return (av - bv) * dirMultiplier;
      }
      if (sortBy === 'status') {
        return ((STATUS_RANK[a.status] || 99) - (STATUS_RANK[b.status] || 99)) * dirMultiplier;
      }
      const aStr = String(a[sortBy] || '').toLowerCase();
      const bStr = String(b[sortBy] || '').toLowerCase();
      return aStr.localeCompare(bStr, undefined, { numeric: true }) * dirMultiplier;
    });
  }, [files, searchQuery, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage, pageSize]);

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-indigo-500" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-indigo-500" />
    );
  };

  // Friendly empty state when scan completed with zero MP4s
  if (hasSelectedFolder && scanPhase === 'completed' && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center dark:border-slate-700/80 dark:bg-slate-900/40">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <Film className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
          No MP4 Files Found
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
          This folder and all of its nested subfolders were scanned completely, and no{' '}
          <code className="rounded bg-slate-200/80 px-1.5 py-0.5 text-xs dark:bg-slate-800">.mp4</code>{' '}
          videos were discovered. Try selecting a different parent folder.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/70">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3.5 dark:border-slate-800/80">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by filename or folder..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/80 dark:bg-slate-950/60 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing <strong className="text-slate-900 dark:text-white">{formatNumber(filteredAndSorted.length)}</strong>{' '}
            of <strong className="text-slate-900 dark:text-white">{formatNumber(files.length)}</strong> videos
          </span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={250}>250 / page</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort('fileName')}
                  className="inline-flex cursor-pointer items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>File Name</span>
                  <SortIcon col="fileName" />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort('relativeFolder')}
                  className="inline-flex cursor-pointer items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>Relative Folder</span>
                  <SortIcon col="relativeFolder" />
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => toggleSort('durationMs')}
                  className="inline-flex cursor-pointer items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>Duration</span>
                  <SortIcon col="durationMs" />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort('status')}
                  className="inline-flex cursor-pointer items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>Status</span>
                  <SortIcon col="status" />
                </button>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  {files.length === 0
                    ? 'Select a parent folder to inspect MP4 video durations.'
                    : 'No videos match your current search filter.'}
                </td>
              </tr>
            ) : (
              visibleRows.map((item) => (
                <tr
                  key={item.id}
                  className="transition hover:bg-slate-50/90 dark:hover:bg-slate-800/40"
                >
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-900 dark:text-slate-100" title={item.fileName}>
                    {item.fileName}
                  </td>
                  <td
                    className="max-w-sm truncate px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400"
                    title={item.relativeFolder}
                  >
                    {item.relativeFolder}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                    {formatSingleDuration(item.durationMs)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={item.status} message={item.message} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 text-xs text-slate-600 dark:border-slate-800/80 dark:text-slate-400">
          <span>
            Page <strong className="text-slate-900 dark:text-white">{safePage}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white">{totalPages}</strong>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, message }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Verified</span>
      </span>
    );
  }

  if (status === 'fallback' || status === 'warning') {
    return (
      <span
        title={message || ''}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>{status === 'fallback' ? 'Stream Fallback' : 'Metadata Warning'}</span>
      </span>
    );
  }

  return (
    <span
      title={message || 'Failed to read duration'}
      className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300"
    >
      <XCircle className="h-3.5 w-3.5" />
      <span>Failed</span>
    </span>
  );
}
