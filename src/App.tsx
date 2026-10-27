/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type {
  AppTab,
  WordItem,
  WorksheetConfig,
  TeacherProfile,
  TeacherFolder,
  SavedWorksheet,
} from './types/hanzi';
import { normalizeWordItem, isPlaceholderTranslation, PRESET_WORDS } from './utils/hanziUtils';
import { analyzeChineseInput } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import {
  getCachedTeacherProfile,
  getTeacherSession,
  mapSupabaseUserToProfile,
  signOut,
  clearAllLocalUserStorage,
  fetchTeacherFolders,
  createFolderInCloud,
  deleteFolderFromCloud,
  fetchSavedWorksheets,
  saveWorksheetToCloud,
  duplicateWorksheetInCloud,
  deleteWorksheetFromCloud,
  getTeacherDefaultConfig,
  saveTeacherDefaultConfig,
  updateTeacherProfileInCloud,
  buildTeacherWorkspaceBackup,
  importTeacherWorkspaceBackupToCloud,
  translateSupabaseError,
} from './services/authStorageService';
import { Navbar, MOSHUI_LOGO_SRC } from './components/Navbar';
import { DictionaryView } from './components/DictionaryView';
import { WorksheetBuilder } from './components/WorksheetBuilder';
import { RadicalsView } from './components/RadicalsView';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AuthModal } from './components/AuthModal';
import {
  downloadWorksheetAsPDF,
  PRINTABLE_SHEET_ELEMENT_ID,
} from './services/pdfExportService';

const WORKSHEET_STORAGE_KEY = 'moshui_worksheet_list_v2';
const CONFIG_STORAGE_KEY = 'moshui_worksheet_config_v1';

const DEFAULT_WORKSHEET_CONFIG: WorksheetConfig = {
  sheetTitle: 'Учебная пропись MoShui (墨水)',
  layoutMode: 'by-character',
  gridType: 'mizi',
  gridColor: 'red',
  showStrokeOrder: true,
  showStudentInfo: true,
  traceCount: 3,
  rowsPerItem: 1,
  cellsPerRow: 10,
};

export default function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (import.meta.env.DEV && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            void registration.unregister();
          }
        })
        .catch(() => {});
    }
  }, []);

  const [activeTab, setActiveTab] = useState<AppTab>('dictionary');

  // Авторизованный преподаватель и модальное окно входа/регистрации
  const [currentTeacher, setCurrentTeacher] = useState<TeacherProfile | null>(() =>
    getCachedTeacherProfile()
  );
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Данные Личного кабинета преподавателя из облака Supabase (таблицы public.folders и public.worksheets)
  const [teacherFolders, setTeacherFolders] = useState<TeacherFolder[]>([]);
  const [savedWorksheets, setSavedWorksheets] = useState<SavedWorksheet[]>([]);
  const [activeSavedWorksheet, setActiveSavedWorksheet] = useState<SavedWorksheet | null>(null);
  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Чистое стартовое состояние: иероглиф/слово не выбрано, пока пользователь сам не введет запрос
  const [currentWord, setCurrentWord] = useState<WordItem | null>(null);

  // Чистый стартовый список прописи: по умолчанию строго пустой массив [], если пользователь сам ничего не сохранял
  const [worksheetList, setWorksheetList] = useState<WordItem[]>(() => {
    try {
      const saved = localStorage.getItem(WORKSHEET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((rawItem: WordItem) => {
            const norm = normalizeWordItem(rawItem, rawItem.word || '');
            return {
              ...norm,
              id: rawItem.id || norm.id,
              translation:
                rawItem.translation && !isPlaceholderTranslation(rawItem.translation)
                  ? rawItem.translation
                  : norm.translation,
            };
          });
        }
      }
    } catch (err) {
      console.warn('Не удалось прочитать список прописи из localStorage:', err);
    }
    return [];
  });

  const [worksheetConfig, setWorksheetConfig] = useState<WorksheetConfig>(() => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_WORKSHEET_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_WORKSHEET_CONFIG;
  });

  // Загрузка папок и прописей преподавателя из Supabase PostgreSQL
  const syncTeacherWorkspaceFromCloud = useCallback(async (teacherId: string) => {
    setIsCloudLoading(true);
    setCloudError(null);
    try {
      const [folders, worksheets] = await Promise.all([
        fetchTeacherFolders(teacherId),
        fetchSavedWorksheets(teacherId),
      ]);
      setTeacherFolders(folders);
      setSavedWorksheets(worksheets);
    } catch (err) {
      setCloudError(translateSupabaseError(err));
    } finally {
      setIsCloudLoading(false);
    }
  }, []);

  // Полный сброс локального стейта и localStorage в чистый гостевой режим при логауте / SIGNED_OUT
  const resetUserWorkspaceState = useCallback(() => {
    setCurrentTeacher(null);
    setTeacherFolders([]);
    setSavedWorksheets([]);
    setActiveSavedWorksheet(null);
    setWorksheetList([]);
    setWorksheetConfig(DEFAULT_WORKSHEET_CONFIG);
    setCurrentWord(null);
    setCloudError(null);
    try {
      localStorage.removeItem('moshui_worksheets');
      localStorage.removeItem('moshui_current_words');
      localStorage.removeItem(WORKSHEET_STORAGE_KEY);
      localStorage.removeItem(CONFIG_STORAGE_KEY);
      clearAllLocalUserStorage();
    } catch {
      // ignore
    }
  }, []);

  // Получение сессии supabase.auth.getSession() и подписка supabase.auth.onAuthStateChange
  useEffect(() => {
    let isMounted = true;

    async function initAuthSession() {
      const sessionProfile = await getTeacherSession();
      if (!isMounted) return;
      if (sessionProfile) {
        setCurrentTeacher(sessionProfile);
        void syncTeacherWorkspaceFromCloud(sessionProfile.id);
      } else {
        setCurrentTeacher(null);
        setTeacherFolders([]);
        setSavedWorksheets([]);
        setActiveSavedWorksheet(null);
      }
    }

    void initAuthSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        resetUserWorkspaceState();
      } else if (session?.user) {
        const profile = mapSupabaseUserToProfile(session.user);
        setCurrentTeacher(profile);
        void syncTeacherWorkspaceFromCloud(profile.id);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [syncTeacherWorkspaceFromCloud, resetUserWorkspaceState]);

  useEffect(() => {
    try {
      localStorage.setItem(WORKSHEET_STORAGE_KEY, JSON.stringify(worksheetList));
    } catch (err) {
      console.warn('Ошибка сохранения списка прописи в localStorage:', err);
    }
  }, [worksheetList]);

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(worksheetConfig));
    } catch {
      // ignore
    }
  }, [worksheetConfig]);

  const handleAddToWorksheet = (item: WordItem) => {
    const normalized = normalizeWordItem(item, item.word);
    const enrichedItem: WordItem = {
      ...normalized,
      id: item.id || normalized.id,
      word: item.word || normalized.word,
      pinyin: item.pinyin || normalized.pinyin,
      translation:
        item.translation && !isPlaceholderTranslation(item.translation)
          ? item.translation
          : normalized.translation,
      characters:
        item.characters && item.characters.length > 0
          ? item.characters.map((chObj, idx) => ({
              ...chObj,
              meaning:
                chObj.meaning && !isPlaceholderTranslation(chObj.meaning)
                  ? chObj.meaning
                  : normalized.characters[idx]?.meaning || chObj.meaning,
            }))
          : normalized.characters,
    };

    setWorksheetList((prev) => {
      const existingIndex = prev.findIndex((w) => w.word === enrichedItem.word);
      if (existingIndex !== -1) {
        const copy = [...prev];
        copy[existingIndex] = {
          ...copy[existingIndex],
          ...enrichedItem,
          id: copy[existingIndex].id,
        };
        return copy;
      }
      return [...prev, enrichedItem];
    });
  };

  const handlePracticeCharacterFromRadicals = async (char: string) => {
    setActiveTab('dictionary');
    const immediate = normalizeWordItem(PRESET_WORDS[char] || null, char);
    setCurrentWord(immediate);
    try {
      const analyzed = await analyzeChineseInput(char);
      setCurrentWord(analyzed);
    } catch {
      // Оставляем локальный разбор
    }
  };

  // --- Обработчики Личного кабинета преподавателя (Supabase Cloud) ---

  const handleAuthSuccess = (teacher: TeacherProfile) => {
    setCurrentTeacher(teacher);
    void syncTeacherWorkspaceFromCloud(teacher.id);
    const teacherDef = getTeacherDefaultConfig(teacher.id);
    if (teacherDef && !activeSavedWorksheet) {
      setWorksheetConfig((prev) => ({ ...prev, ...teacherDef }));
    }
  };

  const handleLogoutTeacher = async () => {
    resetUserWorkspaceState();
    setActiveTab('dictionary');
    try {
      await signOut();
    } catch (err) {
      console.warn('Ошибка при выходе из Supabase:', err);
    }
  };

  const handleSaveToWorkspace = async (payload: {
    id?: string;
    title: string;
    folder: string;
    description?: string;
  }): Promise<SavedWorksheet | null> => {
    if (!currentTeacher) {
      setIsAuthModalOpen(true);
      return null;
    }

    const saved = await saveWorksheetToCloud({
      id: payload.id,
      teacherId: currentTeacher.id,
      title: payload.title,
      folder: payload.folder,
      description: payload.description,
      words: worksheetList,
      config: worksheetConfig,
    });

    await syncTeacherWorkspaceFromCloud(currentTeacher.id);
    setActiveSavedWorksheet(saved);
    return saved;
  };

  const handleCreateFolder = async (
    name: string,
    color = 'rose'
  ): Promise<TeacherFolder | null> => {
    if (!currentTeacher) return null;
    const updatedFolders = await createFolderInCloud(currentTeacher.id, name, color);
    setTeacherFolders(updatedFolders);
    return (
      updatedFolders.find((f) => f.name.toLowerCase() === name.trim().toLowerCase()) ||
      updatedFolders[updatedFolders.length - 1] ||
      null
    );
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!currentTeacher) return;
    const updatedFolders = await deleteFolderFromCloud(currentTeacher.id, folderId);
    setTeacherFolders(updatedFolders);
  };

  const handleOpenWorksheetInBuilder = (sheet: SavedWorksheet) => {
    setWorksheetList(sheet.words);
    setWorksheetConfig(sheet.config);
    setActiveSavedWorksheet(sheet);
    setActiveTab('worksheet');
  };

  const handleQuickPrintSavedWorksheet = (sheet: SavedWorksheet) => {
    setWorksheetList(sheet.words);
    setWorksheetConfig(sheet.config);
    setActiveSavedWorksheet(sheet);
    setActiveTab('worksheet');
    setTimeout(() => {
      void downloadWorksheetAsPDF(PRINTABLE_SHEET_ELEMENT_ID, sheet.title);
    }, 450);
  };

  const handleDuplicateWorksheet = async (id: string) => {
    if (!currentTeacher) return;
    await duplicateWorksheetInCloud(currentTeacher.id, id);
    const updated = await fetchSavedWorksheets(currentTeacher.id);
    setSavedWorksheets(updated);
  };

  const handleDeleteWorksheet = async (id: string) => {
    if (!currentTeacher) return;
    const next = await deleteWorksheetFromCloud(currentTeacher.id, id);
    setSavedWorksheets(next);
    if (activeSavedWorksheet?.id === id) {
      setActiveSavedWorksheet(null);
    }
  };

  const handleUpdateTeacherProfile = async (updates: {
    name: string;
    email: string;
    schoolOrTitle?: string;
  }) => {
    if (!currentTeacher) return;
    const updated = await updateTeacherProfileInCloud(currentTeacher.id, {
      name: updates.name,
      schoolOrTitle: updates.schoolOrTitle,
    });
    setCurrentTeacher(updated);
  };

  const handleSaveDefaultConfig = (nextConfig: WorksheetConfig) => {
    if (!currentTeacher) return;
    saveTeacherDefaultConfig(currentTeacher.id, nextConfig);
    setWorksheetConfig(nextConfig);
  };

  const handleExportWorkspaceBackup = () => {
    if (!currentTeacher) return;
    const backup = buildTeacherWorkspaceBackup({
      profile: currentTeacher,
      folders: teacherFolders,
      worksheets: savedWorksheets,
      defaultConfig: getTeacherDefaultConfig(currentTeacher.id) || worksheetConfig,
    });
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `moshui-workspace-${dateStr}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportWorkspaceBackup = async (
    jsonText: string
  ): Promise<{ importedCount: number } | null> => {
    if (!currentTeacher) return null;
    try {
      const restored = await importTeacherWorkspaceBackupToCloud(currentTeacher.id, jsonText);
      setCurrentTeacher(restored.profile);
      setTeacherFolders(restored.folders);
      setSavedWorksheets(restored.worksheets);
      if (restored.defaultConfig) {
        setWorksheetConfig(restored.defaultConfig);
      }
      return { importedCount: restored.worksheets.length };
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#18181B]">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        worksheetCount={worksheetList.length}
        currentTeacher={currentTeacher}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1 max-w-[1380px] w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-24 md:pb-12 print:p-0 print:max-w-none">
        {activeTab === 'dictionary' && (
          <DictionaryView
            currentWord={currentWord}
            onWordChange={setCurrentWord}
            worksheetList={worksheetList}
            onAddToWorksheet={handleAddToWorksheet}
            onNavigateToWorksheet={() => setActiveTab('worksheet')}
          />
        )}

        {activeTab === 'worksheet' && (
          <WorksheetBuilder
            worksheetList={worksheetList}
            onUpdateWorksheetList={setWorksheetList}
            config={worksheetConfig}
            onUpdateConfig={setWorksheetConfig}
            onNavigateToDictionary={() => setActiveTab('dictionary')}
            currentTeacher={currentTeacher}
            folders={teacherFolders}
            activeSavedWorksheet={activeSavedWorksheet}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onSaveToWorkspace={handleSaveToWorkspace}
            onCreateFolder={handleCreateFolder}
            onDetachSavedWorksheet={() => setActiveSavedWorksheet(null)}
          />
        )}

        {activeTab === 'radicals' && (
          <RadicalsView
            worksheetList={worksheetList}
            onAddToWorksheet={handleAddToWorksheet}
            onPracticeRadical={(ch) => void handlePracticeCharacterFromRadicals(ch)}
          />
        )}

        {activeTab === 'dashboard' && (
          <TeacherDashboard
            teacher={currentTeacher}
            folders={teacherFolders}
            savedWorksheets={savedWorksheets}
            defaultConfig={
              (currentTeacher && getTeacherDefaultConfig(currentTeacher.id)) || worksheetConfig
            }
            isCloudLoading={isCloudLoading}
            cloudError={cloudError}
            onRefreshFromCloud={
              currentTeacher ? () => syncTeacherWorkspaceFromCloud(currentTeacher.id) : undefined
            }
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onLogout={handleLogoutTeacher}
            onOpenWorksheetInBuilder={handleOpenWorksheetInBuilder}
            onQuickPrintSavedWorksheet={handleQuickPrintSavedWorksheet}
            onDuplicateWorksheet={handleDuplicateWorksheet}
            onDeleteWorksheet={handleDeleteWorksheet}
            onCreateFolder={async (name, color) => {
              await handleCreateFolder(name, color);
            }}
            onDeleteFolder={handleDeleteFolder}
            onUpdateProfile={handleUpdateTeacherProfile}
            onSaveDefaultConfig={handleSaveDefaultConfig}
            onExportBackup={handleExportWorkspaceBackup}
            onImportBackupFile={handleImportWorkspaceBackup}
            onNavigateToBuilder={() => setActiveTab('worksheet')}
          />
        )}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Минималистичный однострочный футер в стиле «Warm Oriental Minimalism» */}
      <footer
        data-testid="app-footer"
        className="hidden md:block print:hidden py-4 px-6 border-t border-[#E6E0D6] bg-[#FAF7F2]/90 text-[#18181B]/70 text-sm"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src={MOSHUI_LOGO_SRC}
              alt="MoShui"
              className="w-7 h-7 rounded-full object-contain mix-blend-multiply"
            />
            <span className="font-display font-semibold text-[#18181B]">MoShui</span>
            <span aria-hidden="true">·</span>
            <span>Интерактивная каллиграфия и конструктор прописей</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://t.me/lia_iakubova_chinese"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-telegram-link"
              className="flex items-center gap-1.5 text-[#18181B]/70 hover:text-[#C83E31] transition-colors font-medium"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 shrink-0"
                aria-hidden="true"
              >
                <path d="M21.73 2.27a1 1 0 0 0-1.05-.2L2.6 9.3a1 1 0 0 0 .06 1.88l4.75 1.58 1.88 5.65a1 1 0 0 0 1.72.34l2.72-2.72 4.55 3.32a1 1 0 0 0 1.57-.63L22 3.22a1 1 0 0 0-.27-.95Z" />
                <path d="m7.41 12.76 13.3-9.5" />
              </svg>
              <span>@lia_iakubova_chinese</span>
            </a>

            <span aria-hidden="true">·</span>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 text-[11px] font-chinese text-[#C83E31] border border-[#C83E31]/50 rounded-xs bg-[#FDF2F0]">
                墨
              </span>
              <span>© 2026 MoShui</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Уведомление о доступности новой версии PWA */}
      {needRefresh && (
        <div
          role="status"
          aria-live="polite"
          data-testid="pwa-update-toast"
          className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-50 print:hidden flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#18181B] text-[#FAF7F2] shadow-xl border border-[#C83E31]/40 text-xs sm:text-sm font-medium max-w-[92vw]"
        >
          <span>Доступна новая версия MoShui.</span>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            data-testid="pwa-update-btn"
            className="px-3 py-1.5 rounded-xl bg-[#C83E31] hover:bg-[#B23327] text-white font-semibold transition-colors cursor-pointer shrink-0"
          >
            Обновить
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            aria-label="Скрыть уведомление"
            className="px-2 py-1 rounded-lg text-[#FAF7F2]/70 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
