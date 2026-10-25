/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { Navbar } from './components/Navbar';
import { DictionaryView } from './components/DictionaryView';
import { WorksheetBuilder } from './components/WorksheetBuilder';
import { RadicalsView } from './components/RadicalsView';
import { GamesView } from './components/GamesView';
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
  traceCount: 3,
  rowsPerItem: 1,
  cellsPerRow: 10,
};

export default function App() {
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

  // Получение сессии supabase.auth.getSession() и подписка supabase.auth.onAuthStateChange
  useEffect(() => {
    let isMounted = true;

    async function initAuthSession() {
      const sessionProfile = await getTeacherSession();
      if (!isMounted) return;
      if (sessionProfile) {
        setCurrentTeacher(sessionProfile);
        void syncTeacherWorkspaceFromCloud(sessionProfile.id);
      }
    }

    void initAuthSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        const profile = mapSupabaseUserToProfile(session.user);
        setCurrentTeacher(profile);
        void syncTeacherWorkspaceFromCloud(profile.id);
      } else if (event === 'SIGNED_OUT') {
        setCurrentTeacher(null);
        setTeacherFolders([]);
        setSavedWorksheets([]);
        setActiveSavedWorksheet(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [syncTeacherWorkspaceFromCloud]);

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

  const handleQuickPrint = () => {
    if (worksheetList.length === 0) return;
    const filename =
      activeSavedWorksheet?.title || worksheetConfig.sheetTitle || 'Учебная пропись MoShui';
    if (activeTab !== 'worksheet') {
      setActiveTab('worksheet');
      setTimeout(() => {
        void downloadWorksheetAsPDF(PRINTABLE_SHEET_ELEMENT_ID, filename);
      }, 450);
    } else {
      void downloadWorksheetAsPDF(PRINTABLE_SHEET_ELEMENT_ID, filename);
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
    try {
      await signOut();
    } catch (err) {
      console.warn('Ошибка при выходе из Supabase:', err);
    }
    setCurrentTeacher(null);
    setTeacherFolders([]);
    setSavedWorksheets([]);
    setActiveSavedWorksheet(null);
    setActiveTab('dictionary');
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
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        worksheetCount={worksheetList.length}
        onQuickPrint={handleQuickPrint}
        currentTeacher={currentTeacher}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1 max-w-[1380px] w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-24 md:pb-10 print:p-0 print:max-w-none">
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

        {activeTab === 'games' && (
          <GamesView
            worksheetList={worksheetList}
            onNavigateToDictionary={() => setActiveTab('dictionary')}
            onNavigateToWorksheet={() => setActiveTab('worksheet')}
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

      <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-6 lg:px-8 text-sm text-slate-600 print:hidden">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/image_0_0a6a2fe2.png"
              alt="Логотип MoShui"
              className="w-7 h-7 rounded-md object-contain"
            />
            <span className="font-medium text-slate-700">
              MoShui (<span className="font-chinese">墨水</span>) — Умный словарь, интерактивная каллиграфия и конструктор прописей А4
            </span>
          </div>
          <div className="text-slate-500">
            Словарь · Конструктор прописей · 214 ключей Канси · Игры · Облачный кабинет (Supabase)
          </div>
        </div>
      </footer>
    </div>
  );
}
