import React, { useState, useRef } from 'react';
import { flushSync } from 'react-dom';
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
  PRINTABLE_SHEET_ELEMENT_ID,
} from '../services/pdfExportService';
import { PrintableSheet } from './PrintableSheet';
import { MOSHUI_LOGO_SRC } from './Navbar';

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
  { badge: string; dot: string; label: string }
> = {
  rose: {
    badge: 'bg-[#FDF2F0] text-[#C83E31] border-[#F5D0C8]',
    dot: 'bg-[#C83E31]',
    label: 'Киноварь',
  },
  emerald: {
    badge: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
    dot: 'bg-[#15803D]',
    label: 'Нефрит',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Янтарь',
  },
  indigo: {
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    dot: 'bg-indigo-600',
    label: 'Индиго',
  },
  slate: {
    badge: 'bg-[#FAF7F2] text-[#18181B] border-[#EAE3D5]',
    dot: 'bg-[#52525B]',
    label: 'Тушь',
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
  }, [savedWorksheets, selectedSheetForRender]);

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
    setFeedbackBanner(msg);
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const handleDownloadSavedSheetPdf = async (sheet: SavedWorksheet) => {
    if (exportingSheetId) return;
    setExportingSheetId(sheet.id);
    setActionError(null);
    try {
      flushSync(() => {
        setSelectedSheetForRender(sheet);
      });
      // Даем HanziWriter время подгрузить SVG-контуры черт в #printable-sheet-area
      await new Promise((resolve) => setTimeout(resolve, 450));
      await downloadWorksheetAsPDF(PRINTABLE_SHEET_ELEMENT_ID, sheet.title);
      showFeedback(`Файл «${sheet.title}.pdf» успешно сформирован и скачан.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Не удалось скачать PDF-пропись.'
      );
    } finally {
      setExportingSheetId(null);
    }
  };

  const handlePrintSavedSheetInWindow = (sheet: SavedWorksheet) => {
    setActionError(null);
    try {
      flushSync(() => {
        setSelectedSheetForRender(sheet);
      });
      printWorksheetInNewWindow(PRINTABLE_SHEET_ELEMENT_ID, sheet.title);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Не удалось открыть окно печати.'
      );
      onQuickPrintSavedWorksheet(sheet);
    }
  };

  if (!teacher) {
    return (
      <section
        aria-label="Приглашение в Личный кабинет преподавателя"
        data-testid="teacher-dashboard-guest"
        className="bg-white border border-[#EAE3D5] rounded-2xl p-6 sm:p-14 text-center shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] transition-all duration-300 max-w-3xl mx-auto my-4 sm:my-6"
      >
        <img
          src={MOSHUI_LOGO_SRC}
          alt="MoShui 墨水"
          data-testid="dashboard-guest-logo"
          className="h-24 w-24 sm:h-28 sm:w-28 object-contain rounded-full mix-blend-multiply mx-auto mb-4 sm:mb-5"
        />
        <h1 className="font-display text-2xl sm:text-4xl font-bold text-[#18181B] tracking-tight">
          Личный кабинет преподавателя MoShui (墨水)
        </h1>
        <p className="mt-3 text-sm sm:text-lg text-[#52525B] max-w-2xl mx-auto leading-relaxed">
          Войдите или создайте бесплатный аккаунт преподавателя в облаке Supabase, чтобы сохранять
          готовые прописи по учебным группам (HSK 1, Детская группа, Индивидуальные уроки),
          автоматически подписывать листы А4 своим именем и синхронизировать уроки между
          устройствами.
        </p>

        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onOpenAuthModal}
            data-testid="guest-open-auth-button"
            className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3 sm:py-3.5 h-12 text-sm sm:text-base font-semibold text-white bg-[#18181B] hover:bg-[#27272A] rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <UserCheck className="w-5 h-5 text-[#F5D0C8]" />
            <span>Войти или зарегистрироваться</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToBuilder}
            className="inline-flex items-center justify-center gap-2.5 px-5 sm:px-6 py-3 sm:py-3.5 h-12 text-sm sm:text-base font-semibold text-[#18181B] bg-[#FAF7F2] border border-[#EAE3D5] hover:bg-[#F3EFE6] rounded-xl transition-colors cursor-pointer"
          >
            <FileText className="w-5 h-5 text-[#C83E31]" />
            <span>Перейти в конструктор без входа</span>
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
      showFeedback(`Папка «${trimmed}» синхронизирована с облаком.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Ошибка при создании папки в облаке Supabase.'
      );
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
      showFeedback('Профиль преподавателя обновлен в облаке. Ваше имя отобразится в шапке А4.');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Не удалось обновить профиль преподавателя.'
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveDefaultConfigClick = () => {
    onSaveDefaultConfig(localDefaultConfig);
    showFeedback('Настройки сетки по умолчанию сохранены для новых прописей.');
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
            `Резервная копия успешно восстановлена в облако. Загружено прописей: ${result.importedCount}.`
          );
        } else {
          setActionError('Не удалось прочитать файл резервной копии JSON. Проверьте формат файла.');
        }
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Ошибка восстановления резервной копии.'
        );
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
      {/* Верхняя карточка профиля преподавателя */}
      <div className="bg-white border border-[#EAE3D5] rounded-2xl p-4 sm:p-8 shadow-[0_8px_30px_rgb(24,24,27,0.04)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6">
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#18181B] text-[#FAF7F2] font-bold text-lg sm:text-xl flex items-center justify-center shrink-0 shadow-xs border border-[#C83E31]/50">
            {initials || 'ПР'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <h1
                className="font-display text-xl sm:text-3xl font-bold text-[#18181B] tracking-tight"
                data-testid="dashboard-teacher-name"
              >
                {teacher.name}
              </h1>
              {teacher.schoolOrTitle && (
                <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-semibold bg-[#FDF2F0] text-[#C83E31] border border-[#F5D0C8] rounded-lg">
                  {teacher.schoolOrTitle}
                </span>
              )}
              {(isCloudLoading || isMutating) && (
                <span
                  data-testid="cloud-sync-indicator"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs font-semibold bg-[#FAF7F2] text-[#52525B] border border-[#EAE3D5] rounded-lg"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C83E31]" />
                  <span>Синхронизация...</span>
                </span>
              )}
            </div>
            <p className="mt-1 sm:mt-1.5 text-xs sm:text-base text-[#52525B]">
              {teacher.email} · Прописей:{' '}
              <span className="font-mono-tabular font-bold text-[#18181B]">
                {savedWorksheets.length}
              </span>{' '}
              · Папок:{' '}
              <span className="font-mono-tabular font-bold text-[#18181B]">{folders.length}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          {onRefreshFromCloud && (
            <button
              type="button"
              onClick={() => void onRefreshFromCloud()}
              disabled={isCloudLoading || isMutating}
              title="Обновить прописи из облака Supabase"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-[#18181B] bg-white border border-[#EAE3D5] hover:bg-[#FAF7F2] disabled:opacity-50 rounded-xl transition-colors cursor-pointer min-h-[44px]"
            >
              <RefreshCw className={`w-4 h-4 ${isCloudLoading ? 'animate-spin' : ''}`} />
              <span>Обновить</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNavigateToBuilder}
            className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold text-white bg-[#C83E31] hover:bg-[#B03226] rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Создать пропись</span>
          </button>

          <button
            type="button"
            onClick={onExportBackup}
            data-testid="export-workspace-backup-button"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-[#18181B] bg-white border border-[#EAE3D5] hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer min-h-[44px]"
          >
            <Download className="w-4 h-4 text-[#52525B]" />
            <span>Резервная копия</span>
          </button>

          <button
            type="button"
            onClick={() => void onLogout()}
            data-testid="logout-teacher-button"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-[#52525B] hover:text-[#C83E31] bg-[#FAF7F2] hover:bg-[#FDF2F0] border border-[#EAE3D5] rounded-xl transition-colors cursor-pointer min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {/* Вкладки внутри Личного кабинета со свайпом на смартфонах */}
      <div className="flex items-center gap-2 border-b border-[#EAE3D5] pb-3 overflow-x-auto flex-nowrap no-scrollbar py-1">
        <button
          type="button"
          onClick={() => setActiveSection('worksheets')}
          data-testid="dashboard-tab-worksheets"
          className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[44px] ${
            activeSection === 'worksheets'
              ? 'bg-[#18181B] text-[#FAF7F2] shadow-sm border-b-2 border-[#C83E31]'
              : 'bg-white text-[#52525B] border border-[#EAE3D5] hover:bg-[#FAF7F2]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Мои прописи ({savedWorksheets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('folders')}
          data-testid="dashboard-tab-folders"
          className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[44px] ${
            activeSection === 'folders'
              ? 'bg-[#18181B] text-[#FAF7F2] shadow-sm border-b-2 border-[#C83E31]'
              : 'bg-white text-[#52525B] border border-[#EAE3D5] hover:bg-[#FAF7F2]'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>Папки и группы ({folders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('profile')}
          data-testid="dashboard-tab-profile"
          className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[44px] ${
            activeSection === 'profile'
              ? 'bg-[#18181B] text-[#FAF7F2] shadow-sm border-b-2 border-[#C83E31]'
              : 'bg-white text-[#52525B] border border-[#EAE3D5] hover:bg-[#FAF7F2]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Настройки по умолчанию</span>
        </button>
      </div>

      {(cloudError || actionError) && (
        <div
          role="alert"
          className="bg-[#FDF2F0] border border-[#F5D0C8] text-[#C83E31] rounded-xl px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm font-medium flex items-center gap-2.5"
        >
          <AlertCircle className="w-5 h-5 text-[#C83E31] shrink-0" />
          <span>{actionError || cloudError}</span>
        </div>
      )}

      {feedbackBanner && (
        <div
          role="status"
          data-testid="dashboard-feedback-banner"
          className="bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] rounded-xl px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm font-semibold flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* СЕКЦИЯ 1: Мои прописи и уроки */}
      {activeSection === 'worksheets' && (
        <div className="space-y-6">
          {/* Фильтр по папкам и поиск со свайпом */}
          <div className="bg-white border border-[#EAE3D5] rounded-2xl p-4 sm:p-5 shadow-[0_8px_30px_rgb(24,24,27,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setSelectedFolderFilter('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
                  selectedFolderFilter === 'ALL'
                    ? 'bg-[#C83E31] text-white'
                    : 'bg-[#FAF7F2] text-[#52525B] border border-[#EAE3D5] hover:bg-[#F3EFE6]'
                }`}
              >
                Все папки ({savedWorksheets.length})
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
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
                      isSelected
                        ? 'bg-[#18181B] text-[#FAF7F2] border-[#18181B]'
                        : 'bg-white text-[#52525B] border-[#EAE3D5] hover:bg-[#FAF7F2]'
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
              <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию или иероглифам..."
                data-testid="dashboard-search-input"
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31]"
              />
            </div>
          </div>

          {/* Карточки сохраненных прописей */}
          {isCloudLoading && savedWorksheets.length === 0 ? (
            <div className="bg-white border border-[#EAE3D5] rounded-2xl p-12 text-center shadow-[0_8px_30px_rgb(24,24,27,0.04)] flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#C83E31]" />
              <p className="text-base font-medium text-[#52525B]">
                Загружаем ваши сохраненные прописи и папки из облака Supabase...
              </p>
            </div>
          ) : filteredWorksheets.length === 0 ? (
            <div
              data-testid="dashboard-empty-worksheets"
              className="bg-white border border-[#EAE3D5] rounded-2xl p-8 sm:p-16 text-center shadow-[0_8px_30px_rgb(24,24,27,0.04)]"
            >
              <img
                src={MOSHUI_LOGO_SRC}
                alt="MoShui 墨水"
                data-testid="dashboard-empty-logo"
                className="h-20 w-20 sm:h-24 sm:w-24 object-contain rounded-full mix-blend-multiply opacity-85 mx-auto mb-4"
              />
              <h3 className="font-display text-lg sm:text-2xl font-bold text-[#18181B]">
                {savedWorksheets.length === 0
                  ? 'У вас пока нет сохраненных прописей'
                  : 'Ничего не найдено по выбранному фильтру'}
              </h3>
              <p className="mt-2 text-xs sm:text-base text-[#52525B] max-w-lg mx-auto leading-relaxed">
                {savedWorksheets.length === 0
                  ? 'Добавьте нужные слова в конструкторе прописей и нажмите кнопку «Сохранить в Личный кабинет», чтобы сформировать свою библиотеку уроков.'
                  : 'Попробуйте выбрать другую папку или изменить поисковый запрос.'}
              </p>
              {savedWorksheets.length === 0 && (
                <button
                  type="button"
                  onClick={onNavigateToBuilder}
                  className="mt-6 inline-flex items-center gap-2.5 px-6 py-3 h-12 text-sm font-semibold text-white bg-[#18181B] hover:bg-[#27272A] rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-5 h-5 text-[#F5D0C8]" />
                  <span>Открыть Конструктор прописей</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {filteredWorksheets.map((sheet) => {
                const folderObj = folderMap.get(sheet.folder);
                const folderStyle =
                  FOLDER_COLOR_STYLES[folderObj?.color || 'rose'] || FOLDER_COLOR_STYLES.rose;
                const formattedDate = new Date(sheet.updatedAt).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <article
                    key={sheet.id}
                    onMouseEnter={() => setSelectedSheetForRender(sheet)}
                    onFocus={() => setSelectedSheetForRender(sheet)}
                    data-testid={`saved-worksheet-card-${sheet.id}`}
                    className="bg-white border border-[#EAE3D5] rounded-2xl p-6 shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] flex flex-col justify-between gap-5 hover:border-[#C83E31]/40 transition-all duration-300"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold border rounded-lg ${folderStyle.badge}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${folderStyle.dot}`} />
                              <span>{sheet.folder}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#71717A] font-mono-tabular">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{formattedDate}</span>
                            </span>
                          </div>

                          <h3 className="mt-2.5 font-display text-xl font-bold text-[#18181B] leading-snug">
                            {sheet.title}
                          </h3>
                        </div>

                        <span className="px-3 py-1 bg-[#FAF7F2] border border-[#EAE3D5] text-[#18181B] font-mono-tabular text-sm font-bold rounded-lg shrink-0">
                          {sheet.words.length} сл.
                        </span>
                      </div>

                      {sheet.description && (
                        <p className="text-sm text-[#52525B] line-clamp-2">{sheet.description}</p>
                      )}

                      {/* Превью иероглифов и слов в сохраненном листе */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {sheet.words.slice(0, 10).map((w) => (
                          <span
                            key={w.id}
                            className="inline-flex items-baseline gap-1.5 px-3 py-1.5 bg-[#FAF7F2] border border-[#EAE3D5] rounded-lg"
                          >
                            <span className="font-chinese text-lg font-bold text-[#18181B]">
                              {w.word}
                            </span>
                            <span className="text-xs font-mono-tabular text-[#C83E31] font-semibold">
                              {w.pinyin}
                            </span>
                          </span>
                        ))}
                        {sheet.words.length > 10 && (
                          <span className="inline-flex items-center px-2.5 py-1 text-sm font-mono-tabular text-[#71717A]">
                            +{sheet.words.length - 10} ещё
                          </span>
                        )}
                      </div>

                      {/* Параметры сетки сохраненного листа */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#71717A] font-mono-tabular pt-1">
                        <span>
                          {sheet.config.layoutMode === 'by-character'
                            ? 'Режим А: Посимвольный'
                            : 'Режим Б: Слово целиком'}
                        </span>
                        <span>·</span>
                        <span>
                          {sheet.config.gridType === 'mizi'
                            ? 'Мицзыгэ 米字格'
                            : sheet.config.gridType === 'tianzi'
                            ? 'Тяньцзыгэ 田字格'
                            : 'Квадрат 口字格'}
                        </span>
                        <span>·</span>
                        <span>Обводка: {sheet.config.traceCount} кл.</span>
                      </div>
                    </div>

                    {/* Кнопки управления прописью */}
                    <div className="pt-4 border-t border-[#EAE3D5] flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenWorksheetInBuilder(sheet)}
                          data-testid={`open-worksheet-${sheet.id}`}
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] text-sm font-semibold text-white bg-[#18181B] hover:bg-[#27272A] rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Открыть в конструкторе</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintSavedSheetInWindow(sheet)}
                          data-testid={`print-worksheet-${sheet.id}`}
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] text-sm font-semibold text-white bg-[#C83E31] hover:bg-[#B03226] rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Печать</span>
                        </button>

                        <button
                          type="button"
                          disabled={exportingSheetId === sheet.id}
                          onClick={() => void handleDownloadSavedSheetPdf(sheet)}
                          data-testid={`download-pdf-worksheet-${sheet.id}`}
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] text-sm font-semibold text-[#18181B] bg-[#FAF7F2] hover:bg-[#EAE3D5] border border-[#E6E0D6] disabled:opacity-60 rounded-xl transition-colors cursor-pointer"
                        >
                          {exportingSheetId === sheet.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-[#C83E31]" />
                              <span>Создание PDF...</span>
                            </>
                          ) : (
                            <>
                              <FileDown className="w-4 h-4 text-[#52525B]" />
                              <span>Скачать PDF</span>
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
                              showFeedback(`Создана копия прописи «${sheet.title}».`);
                            } finally {
                              setIsMutating(false);
                            }
                          }}
                          title="Дублировать пропись"
                          aria-label={`Дублировать ${sheet.title}`}
                          data-testid={`duplicate-worksheet-${sheet.id}`}
                          className="p-2.5 text-[#71717A] hover:text-[#18181B] hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer"
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
                              showFeedback(`Пропись «${sheet.title}» удалена.`);
                            } finally {
                              setIsMutating(false);
                            }
                          }}
                          title="Удалить пропись"
                          aria-label={`Удалить ${sheet.title}`}
                          data-testid={`delete-worksheet-${sheet.id}`}
                          className="p-2.5 text-[#71717A] hover:text-[#C83E31] hover:bg-[#FDF2F0] rounded-xl transition-colors cursor-pointer"
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
          <section className="lg:col-span-5 bg-white border border-[#EAE3D5] rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(24,24,27,0.04)] space-y-4">
            <h2 className="font-display text-xl font-bold text-[#18181B] flex items-center gap-2.5">
              <FolderPlus className="w-5 h-5 text-[#C83E31]" />
              <span>Создать тематическую папку</span>
            </h2>
            <p className="text-sm text-[#52525B] leading-relaxed">
              Группируйте прописи по уровням HSK, учебникам, возрастным группам или дням недели.
            </p>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4 pt-1">
              <div>
                <label
                  htmlFor="new-folder-name-input"
                  className="block text-sm font-semibold text-[#18181B] mb-1.5"
                >
                  Название папки или группы *
                </label>
                <input
                  id="new-folder-name-input"
                  data-testid="new-folder-name-input"
                  type="text"
                  required
                  disabled={isMutating}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Например: HSK 3 · Вторник 18:00"
                  className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] focus:outline-none focus:bg-white focus:border-[#C83E31]"
                />
              </div>

              <div>
                <span className="block text-sm font-semibold text-[#18181B] mb-2">
                  Цветовая метка папки
                </span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FOLDER_COLOR_STYLES).map(([colorKey, style]) => (
                    <button
                      key={colorKey}
                      type="button"
                      disabled={isMutating}
                      onClick={() => setNewFolderColor(colorKey)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                        newFolderColor === colorKey
                          ? 'bg-[#18181B] text-[#FAF7F2] border-[#18181B]'
                          : 'bg-white text-[#52525B] border-[#EAE3D5] hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                      <span>{style.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isMutating}
                data-testid="create-folder-submit-button"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 h-12 text-sm font-semibold text-white bg-[#18181B] hover:bg-[#27272A] disabled:opacity-60 rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                {isMutating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Сохранение в облако...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-[#F5D0C8]" />
                    <span>Добавить папку</span>
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="lg:col-span-7 bg-white border border-[#EAE3D5] rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(24,24,27,0.04)] space-y-4">
            <h2 className="font-display text-xl font-bold text-[#18181B] flex items-center gap-2.5">
              <Folder className="w-5 h-5 text-[#C83E31]" />
              <span>Активные папки ({folders.length})</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {folders.map((folder) => {
                const count = savedWorksheets.filter((w) => w.folder === folder.name).length;
                const style = FOLDER_COLOR_STYLES[folder.color] || FOLDER_COLOR_STYLES.slate;
                return (
                  <div
                    key={folder.id}
                    className="p-4 rounded-xl border border-[#EAE3D5] bg-[#FAF7F2] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                        <span className="text-base font-bold text-[#18181B] truncate">
                          {folder.name}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[#71717A] font-mono-tabular">
                        Сохранено прописей: {count}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFolderFilter(folder.name);
                          setActiveSection('worksheets');
                        }}
                        className="px-3 py-1.5 text-sm font-semibold text-[#18181B] bg-white border border-[#EAE3D5] hover:bg-[#F3EFE6] rounded-lg transition-colors cursor-pointer"
                      >
                        Открыть
                      </button>
                      {folders.length > 1 && (
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={async () => {
                            setIsMutating(true);
                            try {
                              await onDeleteFolder(folder.id);
                              showFeedback(`Папка «${folder.name}» удалена.`);
                            } finally {
                              setIsMutating(false);
                            }
                          }}
                          aria-label={`Удалить папку ${folder.name}`}
                          className="p-2 text-[#71717A] hover:text-[#C83E31] hover:bg-[#FDF2F0] rounded-lg transition-colors cursor-pointer"
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
          <section className="lg:col-span-5 bg-white border border-[#EAE3D5] rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(24,24,27,0.04)] space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-[#18181B] flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-[#C83E31]" />
                <span>Личные данные преподавателя</span>
              </h2>
              <p className="mt-1.5 text-sm text-[#52525B]">
                Ваше имя автоматически подставляется в правый верхний угол каждого печатного листа
                А4 («Преподаватель: [Имя]»).
              </p>
            </div>

            <form onSubmit={handleSaveProfileSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="profile-name-input"
                  className="block text-sm font-semibold text-[#18181B] mb-1.5"
                >
                  Имя и отчество / Обращение *
                </label>
                <input
                  id="profile-name-input"
                  data-testid="profile-name-input"
                  type="text"
                  required
                  disabled={isMutating}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] focus:outline-none focus:bg-white focus:border-[#C83E31]"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-email-input"
                  className="block text-sm font-semibold text-[#18181B] mb-1.5"
                >
                  Электронная почта (Email)
                </label>
                <input
                  id="profile-email-input"
                  type="email"
                  required
                  disabled
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-4 py-3 text-base bg-[#F3EFE6] border border-[#EAE3D5] rounded-xl text-[#71717A] cursor-not-allowed"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-school-input"
                  className="block text-sm font-semibold text-[#18181B] mb-1.5"
                >
                  Учебное заведение / Статус
                </label>
                <input
                  id="profile-school-input"
                  type="text"
                  disabled={isMutating}
                  value={profileSchool}
                  onChange={(e) => setProfileSchool(e.target.value)}
                  placeholder="Школа китайского языка, ВУЗ или частный репетитор"
                  className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] focus:outline-none focus:bg-white focus:border-[#C83E31]"
                />
              </div>

              <button
                type="submit"
                disabled={isMutating}
                data-testid="save-profile-button"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 h-12 text-sm font-semibold text-white bg-[#18181B] hover:bg-[#27272A] disabled:opacity-60 rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                {isMutating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Сохранение...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#F5D0C8]" />
                    <span>Сохранить профиль преподавателя</span>
                  </>
                )}
              </button>
            </form>

            {/* Резервное копирование кабинета (JSON) */}
            <div className="pt-5 border-t border-[#EAE3D5] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717A]">
                Резервное копирование кабинета
              </h3>
              <p className="text-sm text-[#52525B] leading-relaxed">
                Скачайте полный архив своих папок, сохраненных прописей и настроек в один файл JSON
                для резервного хранения.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#18181B] bg-[#FAF7F2] border border-[#EAE3D5] hover:bg-[#F3EFE6] rounded-xl transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Скачать резервную копию кабинета (JSON)</span>
                </button>

                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#C83E31] bg-[#FDF2F0] hover:bg-[#FCE6E2] border border-[#F5D0C8] rounded-xl transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Восстановить из файла</span>
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
          <section className="lg:col-span-7 bg-white border border-[#EAE3D5] rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(24,24,27,0.04)] space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-[#18181B] flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-[#C83E31]" />
                <span>Настройки прописей по умолчанию</span>
              </h2>
              <p className="mt-1.5 text-sm text-[#52525B]">
                Выберите любимый тип сетки, цвет линий и режим компоновки, которые будут
                применяться при создании новых листов прописи.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <span className="block text-sm font-semibold text-[#18181B] mb-2.5 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#71717A]" />
                  <span>Режим компоновки по умолчанию</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      setLocalDefaultConfig({ ...localDefaultConfig, layoutMode: 'by-character' })
                    }
                    className={`p-4 rounded-xl border text-left text-sm transition-all cursor-pointer ${
                      localDefaultConfig.layoutMode === 'by-character'
                        ? 'bg-[#FDF2F0] border-[#C83E31] font-bold text-[#18181B]'
                        : 'bg-[#FAF7F2] border-[#EAE3D5] text-[#52525B]'
                    }`}
                  >
                    Режим А: Посимвольный разбор (1 знак = 1 блок)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLocalDefaultConfig({ ...localDefaultConfig, layoutMode: 'whole-word' })
                    }
                    className={`p-4 rounded-xl border text-left text-sm transition-all cursor-pointer ${
                      localDefaultConfig.layoutMode === 'whole-word'
                        ? 'bg-[#FDF2F0] border-[#C83E31] font-bold text-[#18181B]'
                        : 'bg-[#FAF7F2] border-[#EAE3D5] text-[#52525B]'
                    }`}
                  >
                    Режим Б: Словарный режим (Слово целиком в строке)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#EAE3D5]">
                <div>
                  <span className="block text-sm font-semibold text-[#18181B] mb-2.5 flex items-center gap-2">
                    <Grid className="w-4 h-4 text-[#71717A]" />
                    <span>Тип сетки по умолчанию</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'mizi', label: 'Мицзыгэ 米字格' },
                        { id: 'tianzi', label: 'Тяньцзыгэ 田字格' },
                        { id: 'kouzi', label: 'Квадрат 口字格' },
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() =>
                          setLocalDefaultConfig({ ...localDefaultConfig, gridType: g.id })
                        }
                        className={`px-3.5 py-2 text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                          localDefaultConfig.gridType === g.id
                            ? 'bg-[#18181B] text-[#FAF7F2] border-[#18181B]'
                            : 'bg-white text-[#52525B] border-[#EAE3D5]'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-semibold text-[#18181B] mb-2.5">
                    Цвет линий сетки
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'red', label: 'Красный' },
                        { id: 'green', label: 'Зеленый' },
                        { id: 'gray', label: 'Графит' },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setLocalDefaultConfig({ ...localDefaultConfig, gridColor: c.id })
                        }
                        className={`px-3.5 py-2 text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                          localDefaultConfig.gridColor === c.id
                            ? 'bg-[#18181B] text-[#FAF7F2] border-[#18181B]'
                            : 'bg-white text-[#52525B] border-[#EAE3D5]'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#EAE3D5] flex items-center justify-between">
                <div className="text-sm text-[#52525B]">
                  Контуров для обводки по умолчанию:{' '}
                  <strong className="font-mono-tabular text-[#18181B]">
                    {localDefaultConfig.traceCount} шт.
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
                className="inline-flex items-center gap-2.5 px-6 py-3 h-12 text-sm font-semibold text-white bg-[#18181B] hover:bg-[#27272A] rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-[#F5D0C8]" />
                <span>Применить как настройки по умолчанию</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Скрытый контейнер рендеринга печатного листа А4 для мгновенного экспорта PDF и печати из кабинета */}
      {selectedSheetForRender && (
        <div
          aria-hidden="true"
          className="fixed -left-[9999px] top-0 w-[210mm] bg-white pointer-events-none overflow-hidden"
        >
          <PrintableSheet
            worksheetList={selectedSheetForRender.words}
            config={selectedSheetForRender.config}
            teacherName={teacher.name}
          />
        </div>
      )}
    </div>
  );
};
