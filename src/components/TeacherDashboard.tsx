import React, { useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'react-hot-toast';
import {
  Folder,
  FolderPlus,
  Search,
  Printer,
  Copy,
  Trash2,
  ExternalLink,
  UserCheck,
  Settings,
  Download,
  Upload,
  LogOut,
  FileText,
  Plus,
  CheckCircle2,
  Calendar,
  Layers,
  Grid,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileDown,
  Eye,
  X,
} from 'lucide-react';
import type {
  TeacherProfile,
  TeacherFolder,
  SavedWorksheet,
  WorksheetConfig,
} from '../types/hanzi';
import {
  downloadWorksheetAsPDF,
  printWorksheetInNewWindow,
  ensureImagesLoaded,
  PRINTABLE_SHEET_ELEMENT_ID,
} from '../services/pdfExportService';
import { PrintableSheet } from './PrintableSheet';
import { useLanguage } from '../context/LanguageContext';

interface TeacherDashboardProps {
  teacher: TeacherProfile | null;
  folders: TeacherFolder[];
  savedWorksheets: SavedWorksheet[];
  defaultConfig: WorksheetConfig;
  isCloudLoading?: boolean;
  cloudError?: string | null;
  onRefreshFromCloud?: () => Promise<void> | void;
  onOpenAuthModal: () => void;
  onLogout: () => Promise<void> | void;
  onOpenWorksheetInBuilder: (sheet: SavedWorksheet) => void;
  onQuickPrintSavedWorksheet: (sheet: SavedWorksheet) => void;
  onDuplicateWorksheet: (id: string) => Promise<void> | void;
  onDeleteWorksheet: (id: string) => Promise<void> | void;
  onCreateFolder: (name: string, color: string) => Promise<void> | void;
  onDeleteFolder: (folderId: string) => Promise<void> | void;
  onUpdateProfile: (updates: {
    name: string;
    email: string;
    schoolOrTitle?: string;
  }) => Promise<void> | void;
  onSaveDefaultConfig: (nextConfig: WorksheetConfig) => void;
  onExportBackup: () => void;
  onImportBackupFile: (
    jsonText: string
  ) => Promise<{ importedCount: number } | null> | { importedCount: number } | null;
  onNavigateToBuilder: () => void;
}

type DashboardSection = 'worksheets' | 'folders' | 'profile';

const FOLDER_COLOR_STYLES: Record<
  string,
  {
    badge: string;
    dot: string;
    labelKey: 'dashColorRose' | 'dashColorEmerald' | 'dashColorAmber' | 'dashColorIndigo' | 'dashColorSlate';
  }
> = {
  rose: {
    badge: 'bg-[#FDF2F0]/90 text-[#C83E31] border-[#F5D0C8]',
    dot: 'bg-[#C83E31]',
    labelKey: 'dashColorRose',
  },
  emerald: {
    badge: 'bg-emerald-50/90 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-600',
    labelKey: 'dashColorEmerald',
  },
  amber: {
    badge: 'bg-amber-50/90 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    labelKey: 'dashColorAmber',
  },
  indigo: {
    badge: 'bg-indigo-50/90 text-indigo-800 border-indigo-200',
    dot: 'bg-indigo-600',
    labelKey: 'dashColorIndigo',
  },
  slate: {
    badge: 'bg-white/80 text-stone-800 border-stone-200',
    dot: 'bg-stone-500',
    labelKey: 'dashColorSlate',
  },
};

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacher,
  folders,
  savedWorksheets,
  defaultConfig,
  isCloudLoading = false,
  cloudError = null,
  onRefreshFromCloud,
  onOpenAuthModal,
  onLogout,
  onOpenWorksheetInBuilder,
  onQuickPrintSavedWorksheet,
  onDuplicateWorksheet,
  onDeleteWorksheet,
  onCreateFolder,
  onDeleteFolder,
  onUpdateProfile,
  onSaveDefaultConfig,
  onExportBackup,
  onImportBackupFile,
  onNavigateToBuilder,
}) => {
  const { lang, t } = useLanguage();
  const [activeSection, setActiveSection] = useState<DashboardSection>('worksheets');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Форма создания новой папки
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderColor, setNewFolderColor] = useState<string>('rose');
  const [isMutating, setIsMutating] = useState<boolean>(false);

  // Форма редактирования профиля преподавателя
  const [profileName, setProfileName] = useState<string>(teacher?.name || '');
  const [profileEmail, setProfileEmail] = useState<string>(teacher?.email || '');
  const [profileSchool, setProfileSchool] = useState<string>(teacher?.schoolOrTitle || '');
  const [localDefaultConfig, setLocalDefaultConfig] = useState<WorksheetConfig>(defaultConfig);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportingSheetId, setExportingSheetId] = useState<string | null>(null);
  const [selectedSheetForRender, setSelectedSheetForRender] = useState<SavedWorksheet | null>(
    savedWorksheets[0] || null
  );
  const [previewSheet, setPreviewSheet] = useState<SavedWorksheet | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!selectedSheetForRender && savedWorksheets.length > 0) {
      setSelectedSheetForRender(savedWorksheets[0]);
    } else if (
      selectedSheetForRender &&
      !savedWorksheets.some((w) => w.id === selectedSheetForRender.id)
    ) {
      setSelectedSheetForRender(savedWorksheets[0] || null);
    }
    if (previewSheet && !savedWorksheets.some((w) => w.id === previewSheet.id)) {
      setPreviewSheet(null);
    }
  }, [savedWorksheets, selectedSheetForRender, previewSheet]);

  React.useEffect(() => {
    if (teacher) {
      setProfileName(teacher.name);
      setProfileEmail(teacher.email);
      setProfileSchool(teacher.schoolOrTitle || '');
    }
  }, [teacher]);

  React.useEffect(() => {
    setLocalDefaultConfig(defaultConfig);
  }, [defaultConfig]);

  const showFeedback = (msg: string) => {
    setActionError(null);
    toast.success(msg);
    setFeedbackBanner(msg);
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const waitForPrintableSheetImages = async () => {
    const printableContainer = document.getElementById(PRINTABLE_SHEET_ELEMENT_ID);
    if (!printableContainer) return;
    await ensureImagesLoaded(printableContainer);
  };

  const handleDownloadSavedSheetPdf = async (sheet: SavedWorksheet) => {
    if (exportingSheetId) return;
    setExportingSheetId(sheet.id);
    setActionError(null);
    try {
      flushSync(() => {
        setSelectedSheetForRender(sheet);
      });
      await new Promise((resolve) => setTimeout(resolve, 450));
      await waitForPrintableSheetImages();
      await downloadWorksheetAsPDF(PRINTABLE_SHEET_ELEMENT_ID, sheet.title);
      showFeedback(`${t.wsToastPdfSavedPrefix} «${sheet.title}.pdf» ${t.wsToastPdfSavedSuffix}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.wsErrorPdfFailed;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setExportingSheetId(null);
    }
  };

  const handlePrintSavedSheetInWindow = async (sheet: SavedWorksheet) => {
    setActionError(null);
    try {
      flushSync(() => {
        setSelectedSheetForRender(sheet);
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      await waitForPrintableSheetImages();
      await printWorksheetInNewWindow(PRINTABLE_SHEET_ELEMENT_ID, sheet.title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.wsErrorPrintFailed;
      setActionError(msg);
      toast.error(msg);
      onQuickPrintSavedWorksheet(sheet);
    }
  };

  if (!teacher) {
    return (
      <section
        aria-label={t.dashGuestAria}
        data-testid="teacher-dashboard-guest"
        className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-6 sm:p-14 text-center transition-all duration-300 max-w-3xl mx-auto my-4 sm:my-6"
      >
        <img
          src={`${window.location.origin}/image_0.png`}
          crossOrigin="anonymous"
          alt="MoShui 墨水"
          data-testid="dashboard-guest-logo"
          className="h-24 w-24 sm:h-28 sm:w-28 object-contain rounded-full mix-blend-multiply print:mix-blend-normal mx-auto mb-4 sm:mb-5"
          style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
        />
        <h1 className="font-display text-2xl sm:text-4xl font-bold text-stone-900 tracking-tight">
          {t.dashGuestTitle}
        </h1>
        <p className="mt-3 text-sm sm:text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed">
          {t.dashGuestDesc}
        </p>

        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onOpenAuthModal}
            data-testid="guest-open-auth-button"
            className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3 sm:py-3.5 h-12 text-sm sm:text-base font-semibold bg-gradient-to-b from-stone-800 to-stone-950 text-white rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
          >
            <UserCheck className="w-5 h-5 text-[#F5D0C8]" />
            <span>{t.dashGuestLoginBtn}</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToBuilder}
            className="inline-flex items-center justify-center gap-2.5 px-5 sm:px-6 py-3 sm:py-3.5 h-12 text-sm sm:text-base font-semibold bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <FileText className="w-5 h-5 text-[#C83E31]" />
            <span>{t.dashGuestBuilderBtn}</span>
          </button>
        </div>
      </section>
    );
  }

  const folderMap = new Map<string, TeacherFolder>();
  for (const f of folders) {
    folderMap.set(f.name, f);
  }

  const filteredWorksheets = savedWorksheets.filter((sheet) => {
    const matchesFolder =
      selectedFolderFilter === 'ALL' || sheet.folder === selectedFolderFilter;
    if (!matchesFolder) return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const inTitle = sheet.title.toLowerCase().includes(q);
    const inDesc = (sheet.description || '').toLowerCase().includes(q);
    const inFolder = sheet.folder.toLowerCase().includes(q);
    const inWords = sheet.words.some(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        w.pinyin.toLowerCase().includes(q) ||
        w.translation.toLowerCase().includes(q)
    );
    return inTitle || inDesc || inFolder || inWords;
  });

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed || isMutating) return;
    setIsMutating(true);
    setActionError(null);
    try {
      await onCreateFolder(trimmed, newFolderColor);
      setNewFolderName('');
      showFeedback(`${t.dashToastFolderSyncedPrefix} «${trimmed}» ${t.dashToastFolderSyncedSuffix}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.wsErrorCreateFolderFailed;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = profileName.trim();
    if (!trimmedName || isMutating) return;
    setIsMutating(true);
    setActionError(null);
    try {
      await onUpdateProfile({
        name: trimmedName,
        email: profileEmail.trim() || teacher.email,
        schoolOrTitle: profileSchool.trim() || undefined,
      });
      showFeedback(t.dashToastProfileUpdated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.authGenericError;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveDefaultConfigClick = () => {
    onSaveDefaultConfig(localDefaultConfig);
    showFeedback(t.dashToastDefaultsSaved);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setIsMutating(true);
      setActionError(null);
      try {
        const result = await onImportBackupFile(content);
        if (result) {
          showFeedback(
            `${t.dashToastBackupRestoredPrefix} ${result.importedCount}.`
          );
        } else {
          const msg = t.dashErrorInvalidBackupJson;
          setActionError(msg);
          toast.error(msg);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : t.dashErrorRestoreFailed;
        setActionError(msg);
        toast.error(msg);
      } finally {
        setIsMutating(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const initials = teacher.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6 print:hidden" data-testid="teacher-dashboard-view">
      {/* Верхняя карточка профиля преподавателя в эстетике Spatial Glass */}
      <div className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-4 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6">
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-b from-stone-800 to-stone-950 text-white font-bold text-lg sm:text-xl flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.15)] border border-white/20">
            {initials || 'TR'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <h1
                className="font-display text-xl sm:text-3xl font-bold text-stone-900 tracking-tight"
                data-testid="dashboard-teacher-name"
              >
                {teacher.name}
              </h1>
              {teacher.schoolOrTitle && (
                <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-semibold bg-white/80 text-[#C83E31] border border-white rounded-xl shadow-2xs">
                  {teacher.schoolOrTitle}
                </span>
              )}
              {(isCloudLoading || isMutating) && (
                <span
                  data-testid="cloud-sync-indicator"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs font-semibold bg-white/80 text-stone-600 border border-white rounded-xl shadow-2xs"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C83E31]" />
                  <span>{t.dashSyncing}</span>
                </span>
              )}
            </div>
            <p className="mt-1 sm:mt-1.5 text-xs sm:text-base text-stone-600">
              {teacher.email} · {t.dashCountWorksheets}{' '}
              <span className="font-mono-tabular font-bold text-stone-900">
                {savedWorksheets.length}
              </span>{' '}
              · {t.dashCountFolders}{' '}
              <span className="font-mono-tabular font-bold text-stone-900">{folders.length}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          {onRefreshFromCloud && (
            <button
              type="button"
              onClick={() => void onRefreshFromCloud()}
              disabled={isCloudLoading || isMutating}
              title={t.dashRefreshTitle}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md disabled:opacity-50 transition-all cursor-pointer min-h-[44px]"
            >
              <RefreshCw className={`w-4 h-4 ${isCloudLoading ? 'animate-spin' : ''}`} />
              <span>{t.dashRefreshBtn}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNavigateToBuilder}
            className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold bg-gradient-to-b from-stone-800 to-stone-950 text-white rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{t.dashCreateWorksheetBtn}</span>
          </button>

          <button
            type="button"
            onClick={onExportBackup}
            data-testid="export-workspace-backup-button"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer min-h-[44px]"
          >
            <Download className="w-4 h-4 text-stone-600" />
            <span>{t.dashBackupBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => void onLogout()}
            data-testid="logout-teacher-button"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold bg-white/70 hover:bg-white text-stone-600 hover:text-[#C83E31] border border-white rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.dashLogoutBtn}</span>
          </button>
        </div>
      </div>

      {/* Сегментированные вкладки внутри Личного кабинета (visionOS) */}
      <div className="inline-flex items-center gap-1.5 bg-stone-200/50 p-1 rounded-2xl backdrop-blur-md overflow-x-auto flex-nowrap no-scrollbar max-w-full">
        <button
          type="button"
          onClick={() => setActiveSection('worksheets')}
          data-testid="dashboard-tab-worksheets"
          className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-2.5 text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[42px] ${
            activeSection === 'worksheets'
              ? 'bg-white shadow-sm rounded-xl text-stone-900 font-medium'
              : 'rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
          }`}
        >
          <FileText className="w-4 h-4 text-[#C83E31]" />
          <span>
            {t.dashTabWorksheets} ({savedWorksheets.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('folders')}
          data-testid="dashboard-tab-folders"
          className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-2.5 text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[42px] ${
            activeSection === 'folders'
              ? 'bg-white shadow-sm rounded-xl text-stone-900 font-medium'
              : 'rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
          }`}
        >
          <Folder className="w-4 h-4 text-[#C83E31]" />
          <span>
            {t.dashTabFolders} ({folders.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('profile')}
          data-testid="dashboard-tab-profile"
          className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-2.5 text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[42px] ${
            activeSection === 'profile'
              ? 'bg-white shadow-sm rounded-xl text-stone-900 font-medium'
              : 'rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
          }`}
        >
          <Settings className="w-4 h-4 text-[#C83E31]" />
          <span>{t.dashTabProfile}</span>
        </button>
      </div>

      {(cloudError || actionError) && (
        <div
          role="alert"
          className="bg-[#FDF2F0]/90 backdrop-blur-md border border-[#F5D0C8] text-[#C83E31] rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm font-medium flex items-center gap-2.5"
        >
          <AlertCircle className="w-5 h-5 text-[#C83E31] shrink-0" />
          <span>{actionError || cloudError}</span>
        </div>
      )}

      {feedbackBanner && (
        <div
          role="status"
          data-testid="dashboard-feedback-banner"
          className="bg-emerald-50/90 backdrop-blur-md border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm font-semibold flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* СЕКЦИЯ 1: Мои прописи и уроки */}
      {activeSection === 'worksheets' && (
        <div className="space-y-6">
          {/* Фильтр по папкам и поиск */}
          <div className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 bg-stone-200/50 p-1 rounded-2xl backdrop-blur-md overflow-x-auto flex-nowrap no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedFolderFilter('ALL')}
                className={`px-3.5 py-2 text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] ${
                  selectedFolderFilter === 'ALL'
                    ? 'bg-white shadow-sm rounded-xl text-stone-900 font-medium'
                    : 'rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
                }`}
              >
                {t.dashAllFoldersFilter} ({savedWorksheets.length})
              </button>

              {folders.map((folder) => {
                const count = savedWorksheets.filter((w) => w.folder === folder.name).length;
                const isSelected = selectedFolderFilter === folder.name;
                const style = FOLDER_COLOR_STYLES[folder.color] || FOLDER_COLOR_STYLES.slate;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderFilter(folder.name)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] ${
                      isSelected
                        ? 'bg-white shadow-sm rounded-xl text-stone-900 font-medium'
                        : 'rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <span>{folder.name}</span>
                    <span className="opacity-70 font-mono-tabular">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full md:w-80 shrink-0">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.dashSearchPlaceholder}
                data-testid="dashboard-search-input"
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white/70 focus:bg-white rounded-2xl border border-white/90 shadow-inner text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/40 transition-all"
              />
            </div>
          </div>

          {/* Карточки сохраненных прописей */}
          {isCloudLoading && savedWorksheets.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-12 text-center flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#C83E31]" />
              <p className="text-base font-medium text-stone-600">
                {t.dashLoadingWorksheets}
              </p>
            </div>
          ) : filteredWorksheets.length === 0 ? (
            <div
              data-testid="dashboard-empty-worksheets"
              className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-8 sm:p-16 text-center"
            >
              <img
                src={`${window.location.origin}/image_0.png`}
                crossOrigin="anonymous"
                alt="MoShui 墨水"
                data-testid="dashboard-empty-logo"
                className="h-20 w-20 sm:h-24 sm:w-24 object-contain rounded-full mix-blend-multiply print:mix-blend-normal opacity-85 mx-auto mb-4"
                style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
              />
              <h3 className="font-display text-lg sm:text-2xl font-bold text-stone-900">
                {savedWorksheets.length === 0
                  ? t.dashEmptyNoSheetsTitle
                  : t.dashEmptyFilterTitle}
              </h3>
              <p className="mt-2 text-xs sm:text-base text-stone-600 max-w-lg mx-auto leading-relaxed">
                {savedWorksheets.length === 0
                  ? t.dashEmptyNoSheetsDesc
                  : t.dashEmptyFilterDesc}
              </p>
              {savedWorksheets.length === 0 && (
                <button
                  type="button"
                  onClick={onNavigateToBuilder}
                  className="mt-6 inline-flex items-center gap-2.5 px-6 py-3 h-12 text-sm font-semibold bg-gradient-to-b from-stone-800 to-stone-950 text-white rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
                >
                  <Plus className="w-5 h-5 text-[#F5D0C8]" />
                  <span>{t.dashOpenBuilderBtn}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {filteredWorksheets.map((sheet) => {
                const folderObj = folderMap.get(sheet.folder);
                const folderStyle =
                  FOLDER_COLOR_STYLES[folderObj?.color || 'rose'] || FOLDER_COLOR_STYLES.rose;
                const formattedDate = new Date(sheet.updatedAt).toLocaleDateString(
                  lang === 'ru' ? 'ru-RU' : 'en-US',
                  {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }
                );

                return (
                  <article
                    key={sheet.id}
                    onMouseEnter={() => setSelectedSheetForRender(sheet)}
                    onFocus={() => setSelectedSheetForRender(sheet)}
                    data-testid={`saved-worksheet-card-${sheet.id}`}
                    className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-6 flex flex-col justify-between gap-5 hover:bg-white/75 transition-all duration-300"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold border rounded-xl ${folderStyle.badge}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${folderStyle.dot}`} />
                              <span>{sheet.folder}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 font-mono-tabular">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{formattedDate}</span>
                            </span>
                          </div>

                          <h3 className="mt-2.5 font-display text-xl font-bold text-stone-900 leading-snug">
                            {sheet.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <img
                            src={`${window.location.origin}/image_0.png`}
                            crossOrigin="anonymous"
                            alt="MoShui 墨水"
                            className="h-7 w-7 object-contain rounded-full mix-blend-multiply print:mix-blend-normal opacity-90"
                            style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                          />
                          <span className="px-3 py-1 bg-white/80 border border-white text-stone-900 font-mono-tabular text-sm font-bold rounded-xl shadow-2xs">
                            {sheet.words.length} {t.dashWordsShort}
                          </span>
                        </div>
                      </div>

                      {sheet.description && (
                        <p className="text-sm text-stone-600 line-clamp-2">{sheet.description}</p>
                      )}

                      {/* Превью иероглифов и слов в сохраненном листе */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {sheet.words.slice(0, 10).map((w) => (
                          <span
                            key={w.id}
                            className="inline-flex items-baseline gap-1.5 px-3 py-1.5 bg-white/80 border border-white rounded-xl shadow-2xs"
                          >
                            <span className="font-chinese text-lg font-bold text-stone-900">
                              {w.word}
                            </span>
                            <span className="text-xs font-mono-tabular text-[#C83E31] font-semibold">
                              {w.pinyin}
                            </span>
                          </span>
                        ))}
                        {sheet.words.length > 10 && (
                          <span className="inline-flex items-center px-2.5 py-1 text-sm font-mono-tabular text-stone-500">
                            +{sheet.words.length - 10} {t.dashMoreWords}
                          </span>
                        )}
                      </div>

                      {/* Параметры сетки сохраненного листа */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 font-mono-tabular pt-1">
                        <span>
                          {sheet.config.layoutMode === 'by-character'
                            ? t.dashModeAShort
                            : t.dashModeBShort}
                        </span>
                        <span>·</span>
                        <span>
                          {sheet.config.gridType === 'mizi'
                            ? t.dashGridMizi
                            : sheet.config.gridType === 'tianzi'
                            ? t.dashGridTianzi
                            : t.dashGridKouzi}
                        </span>
                        <span>·</span>
                        <span>
                          {t.dashTraceShort} {sheet.config.traceCount} {t.wsCellCountUnit}
                        </span>
                      </div>
                    </div>

                    {/* Кнопки управления прописью */}
                    <div className="pt-4 border-t border-stone-200/60 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSheetForRender(sheet);
                            setPreviewSheet(sheet);
                          }}
                          data-testid={`preview-worksheet-${sheet.id}`}
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] text-sm font-semibold bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-[#C83E31]" />
                          <span>{t.dashPreviewBtn}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenWorksheetInBuilder(sheet)}
                          data-testid={`open-worksheet-${sheet.id}`}
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] text-sm font-semibold bg-gradient-to-b from-stone-800 to-stone-950 text-white rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>{t.dashOpenInBuilderBtn}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintSavedSheetInWindow(sheet)}
                          data-testid={`print-worksheet-${sheet.id}`}
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] text-sm font-semibold bg-white/80 hover:bg-white text-[#C83E31] border border-white rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                          <span>{t.wsPrintBtn}</span>
                        </button>

                        <button
                          type="button"
                          disabled={exportingSheetId === sheet.id}
                          onClick={() => void handleDownloadSavedSheetPdf(sheet)}
                          data-testid={`download-pdf-worksheet-${sheet.id}`}
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] text-sm font-semibold bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md disabled:opacity-60 transition-all cursor-pointer"
                        >
                          {exportingSheetId === sheet.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-[#C83E31]" />
                              <span>{t.wsCreatingPdfBtn}</span>
                            </>
                          ) : (
                            <>
                              <FileDown className="w-4 h-4 text-stone-600" />
                              <span>{t.wsDownloadPdfBtn}</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={async () => {
                            setIsMutating(true);
                            try {
                              await onDuplicateWorksheet(sheet.id);
                              showFeedback(`${t.dashToastDuplicatedPrefix} «${sheet.title}».`);
                            } finally {
                              setIsMutating(false);
                            }
                          }}
                          title={t.dashDuplicateTitle}
                          aria-label={`${t.dashDuplicateTitle} ${sheet.title}`}
                          data-testid={`duplicate-worksheet-${sheet.id}`}
                          className="p-2.5 text-stone-500 hover:text-stone-900 hover:bg-white/80 rounded-xl transition-colors cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={async () => {
                            setIsMutating(true);
                            try {
                              await onDeleteWorksheet(sheet.id);
                              showFeedback(
                                `${t.dashToastDeletedWorksheetPrefix} «${sheet.title}» ${t.dashToastDeletedSuffix}`
                              );
                            } finally {
                              setIsMutating(false);
                            }
                          }}
                          title={t.dashDeleteTitle}
                          aria-label={`${t.dashDeleteTitle} ${sheet.title}`}
                          data-testid={`delete-worksheet-${sheet.id}`}
                          className="p-2.5 text-stone-500 hover:text-[#C83E31] hover:bg-[#FDF2F0]/80 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* СЕКЦИЯ 2: Папки и учебные группы */}
      {activeSection === 'folders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-5 bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2.5">
              <FolderPlus className="w-5 h-5 text-[#C83E31]" />
              <span>{t.dashCreateFolderHeading}</span>
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              {t.dashCreateFolderDesc}
            </p>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4 pt-1">
              <div>
                <label
                  htmlFor="new-folder-name-input"
                  className="block text-sm font-semibold text-stone-900 mb-1.5"
                >
                  {t.dashFolderNameLabel}
                </label>
                <input
                  id="new-folder-name-input"
                  data-testid="new-folder-name-input"
                  type="text"
                  required
                  disabled={isMutating}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t.dashFolderNamePlaceholder}
                  className="w-full px-4 py-3 text-base bg-white/70 focus:bg-white rounded-2xl border border-white/90 shadow-inner text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400/40 transition-all"
                />
              </div>

              <div>
                <span className="block text-sm font-semibold text-stone-900 mb-2">
                  {t.dashFolderColorLabel}
                </span>
                <div className="flex flex-wrap gap-1.5 bg-stone-200/50 p-1 rounded-2xl backdrop-blur-md">
                  {Object.entries(FOLDER_COLOR_STYLES).map(([colorKey, style]) => (
                    <button
                      key={colorKey}
                      type="button"
                      disabled={isMutating}
                      onClick={() => setNewFolderColor(colorKey)}
                      className={`inline-flex items-center gap-2 px-3 py-2 text-sm transition-all cursor-pointer ${
                        newFolderColor === colorKey
                          ? 'bg-white shadow-sm rounded-xl text-stone-900 font-medium'
                          : 'rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                      <span>{t[style.labelKey]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isMutating}
                data-testid="create-folder-submit-button"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 h-12 text-sm font-semibold bg-gradient-to-b from-stone-800 to-stone-950 text-white rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 transition-all duration-200 cursor-pointer"
              >
                {isMutating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.wsSavingToCloudBtn}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-[#F5D0C8]" />
                    <span>{t.dashAddFolderBtn}</span>
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="lg:col-span-7 bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2.5">
              <Folder className="w-5 h-5 text-[#C83E31]" />
              <span>
                {t.dashActiveFoldersHeading} ({folders.length})
              </span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {folders.map((folder) => {
                const count = savedWorksheets.filter((w) => w.folder === folder.name).length;
                const style = FOLDER_COLOR_STYLES[folder.color] || FOLDER_COLOR_STYLES.slate;
                return (
                  <div
                    key={folder.id}
                    className="p-4 rounded-2xl border border-white/90 bg-white/70 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                        <span className="text-base font-bold text-stone-900 truncate">
                          {folder.name}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-stone-500 font-mono-tabular">
                        {t.dashSavedInFolderCount} {count}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFolderFilter(folder.name);
                          setActiveSection('worksheets');
                        }}
                        className="px-3 py-1.5 text-sm font-semibold bg-white/80 hover:bg-white text-stone-800 border border-white rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                      >
                        {t.dashOpenFolderBtn}
                      </button>
                      {folders.length > 1 && (
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={async () => {
                            setIsMutating(true);
                            try {
                              await onDeleteFolder(folder.id);
                              showFeedback(
                                `${t.dashToastDeletedFolderPrefix} «${folder.name}» ${t.dashToastDeletedSuffix}`
                              );
                            } finally {
                              setIsMutating(false);
                            }
                          }}
                          aria-label={`${t.dashDeleteFolderAria} ${folder.name}`}
                          className="p-2 text-stone-500 hover:text-[#C83E31] hover:bg-[#FDF2F0]/80 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* СЕКЦИЯ 3: Профиль преподавателя, настройки по умолчанию и резервное копирование */}
      {activeSection === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Редактирование профиля преподавателя */}
          <section className="lg:col-span-5 bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-[#C83E31]" />
                <span>{t.dashProfileHeading}</span>
              </h2>
              <p className="mt-1.5 text-sm text-stone-600">{t.dashProfileDesc}</p>
            </div>

            <form onSubmit={handleSaveProfileSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="profile-name-input"
                  className="block text-sm font-semibold text-stone-900 mb-1.5"
                >
                  {t.dashProfileNameLabel}
                </label>
                <input
                  id="profile-name-input"
                  data-testid="profile-name-input"
                  type="text"
                  required
                  disabled={isMutating}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-3 text-base bg-white/70 focus:bg-white rounded-2xl border border-white/90 shadow-inner text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400/40 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-email-input"
                  className="block text-sm font-semibold text-stone-900 mb-1.5"
                >
                  {t.dashProfileEmailLabel}
                </label>
                <input
                  id="profile-email-input"
                  type="email"
                  required
                  disabled
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-4 py-3 text-base bg-stone-200/50 border border-white/70 rounded-2xl text-stone-500 cursor-not-allowed shadow-inner"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-school-input"
                  className="block text-sm font-semibold text-stone-900 mb-1.5"
                >
                  {t.dashProfileSchoolLabel}
                </label>
                <input
                  id="profile-school-input"
                  type="text"
                  disabled={isMutating}
                  value={profileSchool}
                  onChange={(e) => setProfileSchool(e.target.value)}
                  placeholder={t.dashProfileSchoolPlaceholder}
                  className="w-full px-4 py-3 text-base bg-white/70 focus:bg-white rounded-2xl border border-white/90 shadow-inner text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400/40 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isMutating}
                data-testid="save-profile-button"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 h-12 text-sm font-semibold bg-gradient-to-b from-stone-800 to-stone-950 text-white rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 transition-all duration-200 cursor-pointer"
              >
                {isMutating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.dashSavingBtn}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#F5D0C8]" />
                    <span>{t.dashSaveProfileBtn}</span>
                  </>
                )}
              </button>
            </form>

            {/* Резервное копирование кабинета (JSON) */}
            <div className="pt-5 border-t border-stone-200/60 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                {t.dashBackupSectionHeading}
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                {t.dashBackupSectionDesc}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.dashDownloadBackupJsonBtn}</span>
                </button>

                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-white/80 hover:bg-white text-[#C83E31] border border-white rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{t.dashRestoreFromFileBtn}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
              </div>
            </div>
          </section>

          {/* Настройки конструктора прописей по умолчанию */}
          <section className="lg:col-span-7 bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-[#C83E31]" />
                <span>{t.dashDefaultSettingsHeading}</span>
              </h2>
              <p className="mt-1.5 text-sm text-stone-600">{t.dashDefaultSettingsDesc}</p>
            </div>

            <div className="space-y-5">
              <div>
                <span className="block text-sm font-semibold text-stone-900 mb-2.5 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-stone-500" />
                  <span>{t.dashDefaultLayoutLabel}</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      setLocalDefaultConfig({ ...localDefaultConfig, layoutMode: 'by-character' })
                    }
                    className={`p-4 rounded-2xl border text-left text-sm transition-all cursor-pointer ${
                      localDefaultConfig.layoutMode === 'by-character'
                        ? 'bg-white border-stone-900/20 ring-2 ring-[#C83E31]/40 font-bold text-stone-900 shadow-sm'
                        : 'bg-white/60 border-white/80 text-stone-600 hover:bg-white'
                    }`}
                  >
                    {t.dashDefaultModeALabel}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLocalDefaultConfig({ ...localDefaultConfig, layoutMode: 'whole-word' })
                    }
                    className={`p-4 rounded-2xl border text-left text-sm transition-all cursor-pointer ${
                      localDefaultConfig.layoutMode === 'whole-word'
                        ? 'bg-white border-stone-900/20 ring-2 ring-[#C83E31]/40 font-bold text-stone-900 shadow-sm'
                        : 'bg-white/60 border-white/80 text-stone-600 hover:bg-white'
                    }`}
                  >
                    {t.dashDefaultModeBLabel}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-stone-200/60">
                <div>
                  <span className="block text-sm font-semibold text-stone-900 mb-2.5 flex items-center gap-2">
                    <Grid className="w-4 h-4 text-stone-500" />
                    <span>{t.dashDefaultGridLabel}</span>
                  </span>
                  <div className="inline-flex flex-wrap gap-1 bg-stone-200/50 p-1 rounded-2xl backdrop-blur-md">
                    {(
                      [
                        { id: 'mizi', label: 'Mizige 米字格' },
                        { id: 'tianzi', label: 'Tianzige 田字格' },
                        { id: 'kouzi', label: 'Kouzige 口字格' },
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() =>
                          setLocalDefaultConfig({ ...localDefaultConfig, gridType: g.id })
                        }
                        className={`relative group px-3 py-2 text-xs sm:text-sm transition-all cursor-pointer ${
                          localDefaultConfig.gridType === g.id
                            ? 'bg-white shadow-sm rounded-xl text-stone-900 font-medium'
                            : 'rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
                        }`}
                      >
                        <span>{g.label}</span>

                        {/* Всплывающая CSS-миниатюра каллиграфической сетки */}
                        <span
                          aria-hidden="true"
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-14 h-14 p-1.5 bg-white/95 backdrop-blur-md shadow-md border border-stone-200/80 rounded-xl opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 pointer-events-none z-50 print:hidden flex items-center justify-center"
                        >
                          <span className="relative block w-full h-full bg-white border border-red-300/60 overflow-hidden">
                            {(g.id === 'tianzi' || g.id === 'mizi') && (
                              <>
                                <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-red-300/60" />
                                <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-dashed border-red-300/60" />
                              </>
                            )}
                            {g.id === 'mizi' && (
                              <>
                                <span className="absolute top-1/2 left-1/2 w-[150%] -translate-x-1/2 -translate-y-1/2 rotate-45 border-t border-dashed border-red-300/50" />
                                <span className="absolute top-1/2 left-1/2 w-[150%] -translate-x-1/2 -translate-y-1/2 -rotate-45 border-t border-dashed border-red-300/50" />
                              </>
                            )}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-semibold text-stone-900 mb-2.5">
                    {t.wsGridColorLabel}
                  </span>
                  <div className="inline-flex flex-wrap gap-1 bg-stone-200/50 p-1 rounded-2xl backdrop-blur-md">
                    {(
                      [
                        { id: 'red', label: t.dashDefaultColorRed },
                        { id: 'green', label: t.dashDefaultColorGreen },
                        { id: 'gray', label: t.dashDefaultColorGray },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setLocalDefaultConfig({ ...localDefaultConfig, gridColor: c.id })
                        }
                        className={`px-3.5 py-2 text-xs sm:text-sm transition-all cursor-pointer ${
                          localDefaultConfig.gridColor === c.id
                            ? 'bg-white shadow-sm rounded-xl text-stone-900 font-medium'
                            : 'rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200/60 flex items-center justify-between">
                <div className="text-sm text-stone-600">
                  {t.dashDefaultTraceLabel}{' '}
                  <strong className="font-mono-tabular text-stone-900">
                    {localDefaultConfig.traceCount} {t.wsTraceUnit}
                  </strong>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={localDefaultConfig.traceCount}
                  onChange={(e) =>
                    setLocalDefaultConfig({
                      ...localDefaultConfig,
                      traceCount: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-44 accent-[#C83E31] cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveDefaultConfigClick}
                data-testid="save-default-config-button"
                className="inline-flex items-center gap-2.5 px-6 py-3 h-12 text-sm font-semibold bg-gradient-to-b from-stone-800 to-stone-950 text-white rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-[#F5D0C8]" />
                <span>{t.dashApplyDefaultConfigBtn}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Модальное окно предпросмотра сохраненной прописи в эстетике Spatial Glass */}
      {previewSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${t.dashPreviewBtn} ${previewSheet.title}`}
          data-testid="saved-worksheet-preview-modal"
          className="fixed inset-0 z-50 bg-stone-950/35 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setPreviewSheet(null)}
        >
          <div
            className="bg-white/75 backdrop-blur-2xl rounded-3xl border border-white max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Шапка модального окна предпросмотра */}
            <div className="px-4 sm:px-6 py-3.5 bg-white/60 border-b border-stone-200/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={`${window.location.origin}/image_0.png`}
                  crossOrigin="anonymous"
                  alt="MoShui 墨水"
                  className="h-9 w-9 object-contain rounded-full mix-blend-multiply print:mix-blend-normal shrink-0"
                  style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base sm:text-lg font-bold text-stone-900 truncate">
                      {previewSheet.title}
                    </h3>
                    <span className="px-2 py-0.5 text-[11px] font-mono-tabular font-bold uppercase tracking-wider bg-white/80 text-stone-500 border border-white rounded-lg shrink-0">
                      A4
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 truncate">
                    {t.dashPreviewModalFolder} {previewSheet.folder} · {t.dashPreviewModalWords}{' '}
                    {previewSheet.words.length}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintSavedSheetInWindow(previewSheet)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold bg-white/80 hover:bg-white text-[#C83E31] border border-white rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t.wsPrintBtn}</span>
                </button>

                <button
                  type="button"
                  disabled={exportingSheetId === previewSheet.id}
                  onClick={() => void handleDownloadSavedSheetPdf(previewSheet)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md disabled:opacity-60 transition-all cursor-pointer"
                >
                  {exportingSheetId === previewSheet.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#C83E31]" />
                      <span>{t.wsCreatingPdfBtn}</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 text-stone-600" />
                      <span>{t.wsDownloadPdfBtn}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = previewSheet;
                    setPreviewSheet(null);
                    onOpenWorksheetInBuilder(target);
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold bg-gradient-to-b from-stone-800 to-stone-950 text-white rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{t.dashPreviewModalToBuilderBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewSheet(null)}
                  aria-label={t.dashPreviewModalCloseAria}
                  className="p-2 text-stone-500 hover:text-stone-900 bg-white/60 hover:bg-white rounded-full border border-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Область предпросмотра единого компонента <PrintableSheet /> */}
            <div className="p-4 sm:p-6 overflow-auto flex-1 flex justify-center bg-stone-100/50">
              <div className="w-fit mx-auto">
                <PrintableSheet
                  worksheetList={previewSheet.words}
                  config={{
                    ...previewSheet.config,
                    sheetTitle: previewSheet.title || previewSheet.config.sheetTitle,
                  }}
                  teacherName={teacher.name}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Скрытый контейнер рендеринга печатного листа А4 для мгновенного экспорта PDF и печати из кабинета */}
      {!previewSheet && selectedSheetForRender && (
        <div
          aria-hidden="true"
          className="fixed left-0 top-0 -z-50 opacity-0 w-[210mm] bg-white pointer-events-none overflow-hidden"
        >
          <PrintableSheet
            worksheetList={selectedSheetForRender.words}
            config={{
              ...selectedSheetForRender.config,
              sheetTitle:
                selectedSheetForRender.title || selectedSheetForRender.config.sheetTitle,
            }}
            teacherName={teacher.name}
          />
        </div>
      )}
    </div>
  );
};
