import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Film, ShieldAlert } from 'lucide-react';
import Header from './components/Header';
import FolderControls from './components/FolderControls';
import DurationHero from './components/DurationHero';
import StatsGrid from './components/StatsGrid';
import ProgressPanel from './components/ProgressPanel';
import VideoTable from './components/VideoTable';
import ErrorReportPanel from './components/ErrorReportPanel';
import { formatHeroLine } from './utils/formatters';

const INITIAL_PROGRESS = {
  phase: 'idle',
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
  currentFile: '',
  percent: 0,
};

export default function App() {
  const [appInfo, setAppInfo] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('vdc-theme');
    return saved ? saved === 'dark' : true;
  });

  const [concurrency, setConcurrency] = useState(4);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const [files, setFiles] = useState([]);
  const [directoryErrors, setDirectoryErrors] = useState([]);
  const [elapsedMs, setElapsedMs] = useState(null);
  const [activeTab, setActiveTab] = useState('videos');
  const [bannerError, setBannerError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [copied, setCopied] = useState(false);

  const activeScanIdRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Sync Tailwind v4 class-based dark mode
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('vdc-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('vdc-theme', 'light');
    }
  }, [isDark]);

  // Load app metadata & FFprobe validation state + wire IPC event streams
  useEffect(() => {
    const api = window.videoCalcAPI;
    if (!api) {
      setBannerError('Desktop preload bridge failed to initialize.');
      return undefined;
    }

    api.getAppInfo().then((info) => {
      setAppInfo(info);
      if (info?.defaultConcurrency) {
        setConcurrency(info.defaultConcurrency);
      }
      if (!info?.ffprobe?.available) {
        setBannerError(info?.ffprobe?.error || 'Bundled FFprobe binary could not be verified.');
      }
    });

    const unsubProgress = api.onScanProgress((payload) => {
      activeScanIdRef.current = payload.scanId;
      setProgress(payload);
    });

    const unsubBatch = api.onScanBatch((payload) => {
      if (activeScanIdRef.current && payload.scanId !== activeScanIdRef.current) return;
      if (Array.isArray(payload.items) && payload.items.length > 0) {
        setFiles((prev) => [...prev, ...payload.items]);
      }
    });

    const unsubComplete = api.onScanComplete((summary) => {
      activeScanIdRef.current = summary.scanId;
      setDirectoryErrors(summary.directoryErrors || []);
      setElapsedMs(summary.elapsedMs ?? null);
      setProgress((prev) => ({
        ...prev,
        phase: summary.status,
        foldersScanned: summary.foldersScanned,
        filesDiscovered: summary.filesDiscovered,
        filesProcessed: summary.filesProcessed,
        remainingFiles: summary.status === 'completed' ? 0 : prev.remainingFiles,
        succeededCount: summary.succeededCount,
        warningCount: summary.warningCount,
        failedCount: summary.failedCount,
        skippedDuplicates: summary.skippedDuplicates,
        skippedSymlinkCycles: summary.skippedSymlinkCycles,
        totalDurationMs: summary.totalDurationMs,
        currentFile: '',
        percent: summary.status === 'completed' ? 100 : prev.percent,
      }));
    });

    const unsubError = api.onScanError((err) => {
      setBannerError(err?.message || 'Scan failed unexpectedly.');
      setProgress((prev) => ({ ...prev, phase: 'error', currentFile: '' }));
    });

    return () => {
      unsubProgress();
      unsubBatch();
      unsubComplete();
      unsubError();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const isScanning =
    progress.phase === 'discovering' ||
    progress.phase === 'processing' ||
    progress.phase === 'cancelling';

  const triggerScan = useCallback(
    async (folderPath) => {
      setBannerError(null);
      setFiles([]);
      setDirectoryErrors([]);
      setElapsedMs(null);
      setActiveTab('videos');
      setProgress({ ...INITIAL_PROGRESS, phase: 'discovering', currentFile: folderPath });

      const result = await window.videoCalcAPI.startScan(folderPath, concurrency);
      if (!result?.started) {
        setBannerError(result?.error || 'Could not start folder scan.');
        setProgress(INITIAL_PROGRESS);
      }
    },
    [concurrency]
  );

  const handleSelectFolder = useCallback(async () => {
    const result = await window.videoCalcAPI.selectFolder();
    if (result?.canceled || !result?.folderPath) return;

    setSelectedFolder({
      folderPath: result.folderPath,
      folderName: result.folderName,
    });
    await triggerScan(result.folderPath);
  }, [triggerScan]);

  const handleRescan = useCallback(async () => {
    if (!selectedFolder?.folderPath) return;
    await triggerScan(selectedFolder.folderPath);
  }, [selectedFolder, triggerScan]);

  const handleCancel = useCallback(async () => {
    setProgress((prev) => ({ ...prev, phase: 'cancelling' }));
    await window.videoCalcAPI.cancelScan();
  }, []);

  const handleCopyDuration = useCallback(async () => {
    const formatted = formatHeroLine(progress.totalDurationMs);
    const res = await window.videoCalcAPI.copyToClipboard(formatted);
    if (res?.success) {
      setCopied(true);
      showToast('Total duration copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [progress.totalDurationMs, showToast]);

  const handleExportCsv = useCallback(async () => {
    const res = await window.videoCalcAPI.exportCsv();
    if (res?.canceled) return;
    if (res?.error) {
      setBannerError(res.error);
    } else if (res?.filePath) {
      showToast(`CSV exported to ${res.filePath}`);
    }
  }, [showToast]);

  const failedFiles = useMemo(() => files.filter((f) => f.status === 'failed'), [files]);
  const warningFiles = useMemo(
    () => files.filter((f) => f.status === 'fallback' || f.status === 'warning'),
    [files]
  );
  const issueCount = failedFiles.length + warningFiles.length + directoryErrors.length;
  const hasResults = files.length > 0 || progress.phase === 'completed';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header
        appInfo={appInfo}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        concurrency={concurrency}
        onConcurrencyChange={setConcurrency}
        isScanning={isScanning}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6">
        {/* Critical Error Banner (e.g., FFprobe binary issue or unreadable root path) */}
        {bannerError && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3.5 text-sm text-rose-700 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Attention Required</p>
              <p className="mt-0.5 text-xs opacity-90">{bannerError}</p>
            </div>
            <button
              type="button"
              onClick={() => setBannerError(null)}
              className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold hover:bg-rose-500/15"
            >
              Dismiss
            </button>
          </div>
        )}

        <FolderControls
          selectedFolder={selectedFolder}
          isScanning={isScanning}
          ffprobeReady={Boolean(appInfo?.ffprobe?.available)}
          onSelectFolder={handleSelectFolder}
          onRescan={handleRescan}
          onCancel={handleCancel}
        />

        <DurationHero
          totalDurationMs={progress.totalDurationMs}
          hasResults={hasResults}
          isScanning={isScanning}
          copied={copied}
          onCopyDuration={handleCopyDuration}
          onExportCsv={handleExportCsv}
        />

        <StatsGrid progress={progress} />

        <ProgressPanel progress={progress} elapsedMs={elapsedMs} />

        {/* View Tabs: Video Details Table vs Separate Error Report */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('videos')}
              className={`inline-flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === 'videos'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Film className="h-4 w-4" />
              <span>Video Details ({files.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('errors')}
              className={`inline-flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === 'errors'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Errors & Warnings</span>
              {issueCount > 0 && (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                  {issueCount}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'videos' ? (
            <VideoTable
              files={files}
              scanPhase={progress.phase}
              hasSelectedFolder={Boolean(selectedFolder)}
            />
          ) : (
            <ErrorReportPanel
              failedFiles={failedFiles}
              warningFiles={warningFiles}
              directoryErrors={directoryErrors}
            />
          )}
        </section>
      </main>

      {/* Non-intrusive Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
