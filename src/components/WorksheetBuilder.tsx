import React, { useState, useEffect } from 'react';
import {
  Printer,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Wand2,
  Loader2,
  Settings2,
  ListPlus,
  Layers,
  Grid,
  Download,
  FileText,
  BookOpen,
  BookmarkCheck,
  Save,
  Copy,
  FolderPlus,
  X,
  CheckCircle2,
  Folder,
  AlertCircle,
  FileDown,
} from 'lucide-react';
import type {
  WordItem,
  WorksheetConfig,
  TeacherProfile,
  TeacherFolder,
  SavedWorksheet,
} from '../types/hanzi';
import {
  parseBatchChineseInput,
  normalizeWordItem,
  isPlaceholderTranslation,
  PRESET_WORDS,
} from '../utils/hanziUtils';
import {
  analyzeChineseInput,
  translateWordsBatch,
  type BatchWordTranslationEntry,
} from '../services/geminiService';
import {
  downloadWorksheetAsPDF,
  printWorksheetInNewWindow,
  PRINTABLE_SHEET_ELEMENT_ID,
} from '../services/pdfExportService';
import { PrintableSheet } from './PrintableSheet';
import { MOSHUI_LOGO_SRC } from './Navbar';

interface WorksheetBuilderProps {
  worksheetList: WordItem[];
  onUpdateWorksheetList: (nextList: WordItem[]) => void;
  config: WorksheetConfig;
  onUpdateConfig: (nextConfig: WorksheetConfig) => void;
  onNavigateToDictionary?: () => void;
  currentTeacher?: TeacherProfile | null;
  folders?: TeacherFolder[];
  activeSavedWorksheet?: SavedWorksheet | null;
  onOpenAuthModal?: () => void;
  onSaveToWorkspace?: (payload: {
    id?: string;
    title: string;
    folder: string;
    description?: string;
  }) => Promise<SavedWorksheet | null> | SavedWorksheet | null;
  onCreateFolder?: (name: string, color?: string) => Promise<TeacherFolder | null> | TeacherFolder | null;
  onDetachSavedWorksheet?: () => void;
}

export const WorksheetBuilder: React.FC<WorksheetBuilderProps> = ({
  worksheetList,
  onUpdateWorksheetList,
  config,
  onUpdateConfig,
  onNavigateToDictionary,
  currentTeacher,
  folders = [],
  activeSavedWorksheet,
  onOpenAuthModal,
  onSaveToWorkspace,
  onCreateFolder,
  onDetachSavedWorksheet,
}) => {
  const [batchInput, setBatchInput] = useState<string>('');
  const [isEnrichingAi, setIsEnrichingAi] = useState<boolean>(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const autoTranslatedWordsRef = React.useRef<Set<string>>(new Set());

  // Состояние модального окна «Сохранить в Личный кабинет»
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [saveMode, setSaveMode] = useState<'new' | 'copy' | 'update'>('new');
  const [sheetTitleInput, setSheetTitleInput] = useState<string>(
    activeSavedWorksheet?.title || config.sheetTitle || 'Урок 1. Базовая лексика'
  );
  const [selectedFolder, setSelectedFolder] = useState<string>(
    activeSavedWorksheet?.folder || folders[0]?.name || 'HSK 1'
  );
  const [descriptionInput, setDescriptionInput] = useState<string>(
    activeSavedWorksheet?.description || ''
  );
  const [isCreatingInlineFolder, setIsCreatingInlineFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isSavingToCloud, setIsSavingToCloud] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [workspaceToast, setWorkspaceToast] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

  useEffect(() => {
    if (activeSavedWorksheet) {
      setSheetTitleInput(activeSavedWorksheet.title);
      setSelectedFolder(activeSavedWorksheet.folder);
      setDescriptionInput(activeSavedWorksheet.description || '');
    }
  }, [activeSavedWorksheet]);

  useEffect(() => {
    if (!selectedFolder && folders.length > 0) {
      setSelectedFolder(folders[0].name);
    }
  }, [folders, selectedFolder]);

  const showToast = (msg: string) => {
    setWorkspaceToast(msg);
    setTimeout(() => {
      setWorkspaceToast((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const applyBatchTranslations = React.useCallback(
    (
      list: WordItem[],
      batchMap: Record<string, BatchWordTranslationEntry>,
      overwriteExisting = false
    ): WordItem[] => {
      return list.map((item) => {
        const entry = batchMap[item.word];
        if (!entry) return item;

        const hasExistingTranslation =
          Boolean(item.translation?.trim()) && !isPlaceholderTranslation(item.translation);
        const nextTranslation =
          overwriteExisting && entry.translation && !isPlaceholderTranslation(entry.translation)
            ? entry.translation
            : hasExistingTranslation
            ? item.translation
            : !isPlaceholderTranslation(entry.translation)
            ? entry.translation
            : item.translation;

        const nextPinyin = item.pinyin?.trim() || entry.pinyin || item.pinyin;
        const nextCharacters = item.characters.map((chObj) => {
          const batchCharMeaning = entry.charMeanings?.[chObj.char];
          const nextMeaning =
            batchCharMeaning && !isPlaceholderTranslation(batchCharMeaning)
              ? batchCharMeaning
              : chObj.meaning;
          return {
            ...chObj,
            meaning: nextMeaning,
          };
        });

        return {
          ...item,
          pinyin: nextPinyin,
          translation: nextTranslation,
          characters: nextCharacters,
        };
      });
    },
    []
  );

  // Автоматическая подгрузка переводов для слов с пустым или техническим переводом
  useEffect(() => {
    const wordsMissingTranslation = worksheetList
      .filter(
        (item) =>
          (!item.translation || isPlaceholderTranslation(item.translation)) &&
          !autoTranslatedWordsRef.current.has(item.word)
      )
      .map((item) => item.word);

    if (wordsMissingTranslation.length === 0) return;

    for (const w of wordsMissingTranslation) {
      autoTranslatedWordsRef.current.add(w);
    }

    let isMounted = true;
    void (async () => {
      try {
        const batchMap = await translateWordsBatch(wordsMissingTranslation);
        if (!isMounted) return;
        onUpdateWorksheetList(applyBatchTranslations(worksheetList, batchMap, false));
      } catch {
        // Оставляем возможность ручного ввода в поле input
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [worksheetList, applyBatchTranslations, onUpdateWorksheetList]);

  const handleManualTranslationChange = (id: string, nextTranslation: string) => {
    onUpdateWorksheetList(
      worksheetList.map((item) =>
        item.id === id ? { ...item, translation: nextTranslation } : item
      )
    );
  };

  const handleBatchAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const words = parseBatchChineseInput(batchInput);
    if (words.length === 0) {
      setStatusNote('Введите хотя бы одно китайское слово или иероглиф через запятую или пробел.');
      return;
    }

    const existingWords = new Set(worksheetList.map((w) => w.word));
    const addedItems: WordItem[] = [];

    for (const w of words) {
      if (!existingWords.has(w)) {
        existingWords.add(w);
        const norm = normalizeWordItem(PRESET_WORDS[w] || null, w);
        addedItems.push({
          ...norm,
          translation: isPlaceholderTranslation(norm.translation) ? '' : norm.translation,
        });
      }
    }

    if (addedItems.length === 0) {
      setStatusNote('Все указанные слова уже присутствуют в вашей прописи.');
      return;
    }

    const nextList = [...worksheetList, ...addedItems];
    onUpdateWorksheetList(nextList);
    setBatchInput('');

    // Вызываем пакетный перевод translateWordsBatch для всех добавленных слов
    const addedWordsList = addedItems.map((item) => item.word);
    for (const w of addedWordsList) {
      autoTranslatedWordsRef.current.add(w);
    }

    setIsEnrichingAi(true);
    setStatusNote(`Добавлено слов: ${addedItems.length}. Загружаем переводы...`);
    try {
      const batchMap = await translateWordsBatch(addedWordsList);
      onUpdateWorksheetList(applyBatchTranslations(nextList, batchMap, true));
      setStatusNote(`Добавлено новых позиций в пропись: ${addedItems.length}.`);
    } catch {
      setStatusNote(
        `Добавлено слов: ${addedItems.length}. Вы можете вписать или уточнить перевод в поле под словом.`
      );
    } finally {
      setIsEnrichingAi(false);
    }
  };

  const handleEnrichTranslationsViaAi = async () => {
    if (worksheetList.length === 0 || isEnrichingAi) return;
    setIsEnrichingAi(true);
    setStatusNote('Обновляем переводы и значения знаков через Gemini AI...');

    try {
      const allWords = worksheetList.map((item) => item.word);
      const batchMap = await translateWordsBatch(allWords);
      const batchUpdated = applyBatchTranslations(worksheetList, batchMap, true);

      // Дополнительно обогащаем разбор черт/графем, если требуется
      const fullyUpdated: WordItem[] = [];
      for (const item of batchUpdated) {
        try {
          const enriched = await analyzeChineseInput(item.word);
          const resolvedTranslation =
            !isPlaceholderTranslation(item.translation) && item.translation
              ? item.translation
              : !isPlaceholderTranslation(enriched.translation)
              ? enriched.translation
              : item.translation;
          fullyUpdated.push({
            ...enriched,
            id: item.id,
            translation: resolvedTranslation,
            characters: enriched.characters.map((chObj, cIdx) => ({
              ...chObj,
              meaning:
                item.characters[cIdx]?.meaning &&
                !isPlaceholderTranslation(item.characters[cIdx].meaning)
                  ? item.characters[cIdx].meaning
                  : chObj.meaning,
            })),
          });
        } catch {
          fullyUpdated.push(item);
        }
      }

      onUpdateWorksheetList(fullyUpdated);
      setStatusNote('Переводы полных слов и значения иероглифов успешно обновлены.');
    } catch {
      setStatusNote('Не удалось обновить часть слов через ИИ, сохранены текущие переводы.');
    } finally {
      setIsEnrichingAi(false);
    }
  };

  const handleExportJson = () => {
    if (worksheetList.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `moshui-words-${dateStr}.json`;
    const blob = new Blob([JSON.stringify(worksheetList, null, 2)], {
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
    setStatusNote(`Коллекция экспортирована в файл ${filename}`);
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= worksheetList.length) return;

    const copy = [...worksheetList];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    onUpdateWorksheetList(copy);
  };

  const handleRemoveItem = (id: string) => {
    onUpdateWorksheetList(worksheetList.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    onUpdateWorksheetList([]);
    setStatusNote('Список прописи очищен.');
  };

  const handleDownloadPdf = async () => {
    if (worksheetList.length === 0 || isExportingPdf) return;
    setIsExportingPdf(true);
    setStatusNote('Формируем PDF-документ высокого разрешения (А4)...');
    try {
      const filename =
        activeSavedWorksheet?.title || config.sheetTitle || 'Учебная пропись MoShui';
      await downloadWorksheetAsPDF(PRINTABLE_SHEET_ELEMENT_ID, filename);
      showToast(`Готовый PDF-файл «${filename}.pdf» успешно сохранен.`);
      setStatusNote(null);
    } catch (err) {
      setStatusNote(
        err instanceof Error ? err.message : 'Не удалось сформировать PDF-файл прописи.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintSheet = () => {
    if (worksheetList.length === 0) return;
    try {
      const sheetTitle =
        activeSavedWorksheet?.title || config.sheetTitle || 'Учебная пропись MoShui (墨水)';
      printWorksheetInNewWindow(PRINTABLE_SHEET_ELEMENT_ID, sheetTitle);
    } catch (err) {
      setStatusNote(
        err instanceof Error
          ? err.message
          : 'Не удалось открыть окно печати. Используйте кнопку «Скачать PDF».'
      );
    }
  };

  const handleOpenSaveModal = (mode: 'new' | 'copy' | 'update') => {
    if (!currentTeacher) {
      onOpenAuthModal?.();
      return;
    }
    if (worksheetList.length === 0) {
      setStatusNote('Добавьте хотя бы одно слово в пропись перед сохранением в кабинет.');
      return;
    }

    setSaveError(null);
    setSaveMode(mode);
    if (mode === 'copy' && activeSavedWorksheet) {
      setSheetTitleInput(`${activeSavedWorksheet.title} (копия)`);
      setSelectedFolder(activeSavedWorksheet.folder);
      setDescriptionInput(activeSavedWorksheet.description || '');
    } else if (mode === 'update' && activeSavedWorksheet) {
      setSheetTitleInput(activeSavedWorksheet.title);
      setSelectedFolder(activeSavedWorksheet.folder);
      setDescriptionInput(activeSavedWorksheet.description || '');
    } else {
      setSheetTitleInput(
        config.sheetTitle && config.sheetTitle !== 'Учебная пропись MoShui (墨水)'
          ? config.sheetTitle
          : `Урок (${worksheetList.map((w) => w.word).slice(0, 3).join(', ')})`
      );
      setSelectedFolder(folders[0]?.name || 'HSK 1');
    }
    setIsSaveModalOpen(true);
  };

  const handleQuickUpdateSavedWorksheet = async () => {
    if (!currentTeacher || !activeSavedWorksheet || !onSaveToWorkspace || isSavingToCloud) return;
    setIsSavingToCloud(true);
    setSaveError(null);
    try {
      const saved = await onSaveToWorkspace({
        id: activeSavedWorksheet.id,
        title: activeSavedWorksheet.title,
        folder: activeSavedWorksheet.folder,
        description: activeSavedWorksheet.description,
      });
      if (saved) {
        showToast(`Лист «${saved.title}» синхронизирован с облаком в папке «${saved.folder}».`);
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Ошибка при обновлении прописи в облаке Supabase.'
      );
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const handleCreateInlineFolderSubmit = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || !onCreateFolder) return;
    setIsSavingToCloud(true);
    try {
      const created = await onCreateFolder(trimmed, 'rose');
      if (created) {
        setSelectedFolder(created.name);
        setNewFolderName('');
        setIsCreatingInlineFolder(false);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось создать папку в облаке.');
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const handleConfirmSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveToWorkspace || isSavingToCloud) return;

    const cleanTitle = sheetTitleInput.trim() || 'Учебная пропись MoShui';
    const cleanFolder = selectedFolder.trim() || 'Общая папка';

    if (config.sheetTitle !== cleanTitle) {
      onUpdateConfig({ ...config, sheetTitle: cleanTitle });
    }

    setIsSavingToCloud(true);
    setSaveError(null);

    try {
      const saved = await onSaveToWorkspace({
        id: saveMode === 'update' && activeSavedWorksheet ? activeSavedWorksheet.id : undefined,
        title: cleanTitle,
        folder: cleanFolder,
        description: descriptionInput.trim() || undefined,
      });

      if (saved) {
        setIsSaveModalOpen(false);
        showToast(
          saveMode === 'update'
            ? `Изменения в прописи «${saved.title}» сохранены в облаке.`
            : `Пропись «${saved.title}» сохранена в папку «${saved.folder}».`
        );
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Не удалось сохранить пропись в облако Supabase.'
      );
    } finally {
      setIsSavingToCloud(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Панель управления и настроек (скрывается при печати через print:hidden) */}
      <div className="print:hidden space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
                Конструктор PDF-прописей MoShui формата А4
              </h1>
              <p className="mt-2 text-base sm:text-lg text-slate-600 leading-relaxed">
                Поддержка как одиночных иероглифов, так и многосложных слов целиком в одной строке с
                векторными контурами черт.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-slate-100">
            {/* Кнопка сохранения в Личный кабинет преподавателя */}
            <button
              type="button"
              onClick={() => handleOpenSaveModal('new')}
              disabled={worksheetList.length === 0 || isSavingToCloud}
              data-testid="save-to-workspace-button"
              className="inline-flex items-center gap-2.5 px-5 py-3 text-sm sm:text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSavingToCloud ? (
                <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
              ) : (
                <BookmarkCheck className="w-5 h-5 text-rose-400" />
              )}
              <span>Сохранить в Личный кабинет</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={worksheetList.length === 0}
              className="inline-flex items-center gap-2 px-4 py-3 text-sm sm:text-base font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-5 h-5 text-slate-600" />
              <span>Экспорт JSON</span>
            </button>

            <button
              type="button"
              onClick={handleEnrichTranslationsViaAi}
              disabled={isEnrichingAi || worksheetList.length === 0}
              className="inline-flex items-center gap-2 px-4 py-3 text-sm sm:text-base font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isEnrichingAi ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-rose-600" />
                  <span>Загрузка переводов...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 text-rose-600" />
                  <span>Подтянуть переводы через ИИ</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintSheet}
              disabled={worksheetList.length === 0 || isExportingPdf}
              data-testid="print-sheet-button"
              className="inline-flex items-center gap-2 px-5 py-3 text-sm sm:text-base font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-5 h-5 text-slate-700" />
              <span>Печать листа</span>
            </button>

            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={worksheetList.length === 0 || isExportingPdf}
              data-testid="download-pdf-button"
              className="inline-flex items-center gap-2.5 px-6 py-3 text-base font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-2xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Генерация PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-5 h-5" />
                  <span>Скачать PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Баннер редактирования сохраненной прописи из Личного кабинета */}
        {activeSavedWorksheet && currentTeacher && (
          <div
            data-testid="active-saved-worksheet-banner"
            className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-bold uppercase tracking-wider text-rose-700">
                    Открыта сохраненная пропись:
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {activeSavedWorksheet.title}
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-white border border-rose-200 text-rose-800 rounded-md">
                    {activeSavedWorksheet.folder}
                  </span>
                </div>
                {activeSavedWorksheet.description && (
                  <p className="text-sm text-slate-600 mt-1">
                    {activeSavedWorksheet.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => void handleQuickUpdateSavedWorksheet()}
                disabled={worksheetList.length === 0 || isSavingToCloud}
                data-testid="update-saved-worksheet-button"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
              >
                {isSavingToCloud ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Обновить сохраненный лист</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenSaveModal('copy')}
                disabled={worksheetList.length === 0 || isSavingToCloud}
                data-testid="save-as-copy-button"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4 text-slate-600" />
                <span>Сохранить как копию</span>
              </button>

              {onDetachSavedWorksheet && (
                <button
                  type="button"
                  onClick={onDetachSavedWorksheet}
                  className="px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Создать новый лист без перезаписи текущего урока"
                >
                  Новый черновик
                </button>
              )}
            </div>
          </div>
        )}

        {/* Уведомление об успешном сохранении */}
        {workspaceToast && (
          <div
            role="status"
            data-testid="workspace-save-toast"
            className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-5 py-4 text-sm font-semibold flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{workspaceToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setWorkspaceToast(null)}
              className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Мобильный переключатель экранов: «1. Слова и Настройки» | «2. Предпросмотр А4» */}
        <div className="lg:hidden flex items-center p-1.5 bg-slate-100 rounded-2xl mb-4 border border-slate-200">
          <button
            type="button"
            onClick={() => setMobileTab('editor')}
            data-testid="mobile-worksheet-tab-editor"
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px] cursor-pointer ${
              mobileTab === 'editor'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings2 className="w-4 h-4 text-rose-600" />
            <span>1. Слова и Настройки ({worksheetList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            data-testid="mobile-worksheet-tab-preview"
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px] cursor-pointer ${
              mobileTab === 'preview'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>2. Предпросмотр А4</span>
          </button>
        </div>

        {/* Двухколоночная панель настройки: Слева — Список слов и быстрый ввод, Справа — Настройки сетки */}
        <div
          className={`${
            mobileTab === 'preview' ? 'hidden lg:grid' : 'grid'
          } grid-cols-1 lg:grid-cols-12 gap-6 items-start`}
        >
          {/* Левая колонка: Быстрый ввод списком + управление очередью слов */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-2xs space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5">
                <ListPlus className="w-5 h-5 text-rose-600" />
                <span>Слова в прописи ({worksheetList.length})</span>
              </h2>
              {worksheetList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Очистить список</span>
                </button>
              )}
            </div>

            {/* Быстрый ввод списком */}
            <form onSubmit={handleBatchAdd} className="space-y-2.5">
              <label
                htmlFor="batch-words-input"
                className="block text-sm font-semibold text-slate-700"
              >
                Быстрый ввод списком (через запятую или пробел)
              </label>
              <div className="flex gap-2.5">
                <input
                  id="batch-words-input"
                  type="text"
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  placeholder="Введите слова через запятую..."
                  className="flex-1 px-4 py-3 text-base bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-rose-600 font-hanzi-sans"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm sm:text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить</span>
                </button>
              </div>
              {statusNote && <p className="text-sm text-slate-600">{statusNote}</p>}
            </form>

            {/* Список добавленных слов с изменением порядка и удалением */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {worksheetList.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-sm text-slate-500">
                  Очередь слов пуста. Добавьте иероглифы или слова через поле быстрого ввода выше.
                </div>
              ) : (
                worksheetList.map((item, idx) => {
                  const displayTranslation = isPlaceholderTranslation(item.translation)
                    ? ''
                    : item.translation;

                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3.5 p-4 bg-slate-50 border border-slate-200/80 rounded-xl"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="font-mono-tabular text-sm font-semibold text-slate-400 w-6 shrink-0 pt-1">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-baseline gap-2.5 flex-wrap">
                            <span className="font-chinese text-2xl font-bold text-slate-900 shrink-0">
                              {item.word}
                            </span>
                            <span className="text-sm font-mono-tabular font-semibold text-rose-700 truncate">
                              {item.pinyin}
                            </span>
                          </div>
                          <input
                            type="text"
                            aria-label={`Перевод слова ${item.word}`}
                            data-testid={`word-translation-input-${item.id}`}
                            value={displayTranslation}
                            onChange={(e) =>
                              handleManualTranslationChange(item.id, e.target.value)
                            }
                            placeholder="Введите перевод..."
                            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 hover:border-slate-300 focus:border-rose-600 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveItem(idx, 'up')}
                          disabled={idx === 0}
                          aria-label={`Переместить ${item.word} вверх`}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveItem(idx, 'down')}
                          disabled={idx === worksheetList.length - 1}
                          aria-label={`Переместить ${item.word} вниз`}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Удалить ${item.word} из прописи`}
                          className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Правая колонка: Панель настроек дизайна прописи (WorksheetConfig) */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5">
                <Settings2 className="w-5 h-5 text-rose-600" />
                <span>Настройки макета и сетки прописи</span>
              </h2>

              <div className="flex items-center gap-2.5">
                <label htmlFor="sheet-title-inline" className="text-sm font-medium text-slate-600">
                  Заголовок А4:
                </label>
                <input
                  id="sheet-title-inline"
                  type="text"
                  value={config.sheetTitle}
                  onChange={(e) => onUpdateConfig({ ...config, sheetTitle: e.target.value })}
                  placeholder="Заголовок прописи..."
                  className="px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:border-rose-600"
                />
              </div>
            </div>

            {/* КЛЮЧЕВАЯ ФИЧА: Режим компоновки строк */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <span>Режим компоновки строк</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ ...config, layoutMode: 'by-character' })}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    config.layoutMode === 'by-character'
                      ? 'bg-rose-50/70 border-rose-600 ring-1 ring-rose-600'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-sm sm:text-base font-bold text-slate-900">
                    Режим А: Посимвольный разбор
                  </div>
                  <div className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    1 иероглиф = 1 блок. Многосложное слово разбивается на отдельные учебные секции с
                    пошаговым порядком черт.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateConfig({ ...config, layoutMode: 'whole-word' })}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    config.layoutMode === 'whole-word'
                      ? 'bg-rose-50/70 border-rose-600 ring-1 ring-rose-600'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-sm sm:text-base font-bold text-slate-900">
                    Режим Б: Словарный режим (Слово целиком)
                  </div>
                  <div className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    Чередование иероглифов слова в одной строке сетки: образец, затем пары для
                    обводки и пустые клетки.
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 border-t border-slate-200">
              {/* Тип сетки */}
              <div className="space-y-2.5">
                <span className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Grid className="w-4 h-4 text-slate-500" />
                  <span>Тип каллиграфической сетки</span>
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
                      onClick={() => onUpdateConfig({ ...config, gridType: g.id })}
                      className={`px-3.5 py-2 text-sm font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        config.gridType === g.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Цвет сетки */}
              <div className="space-y-2.5">
                <span className="block text-sm font-semibold text-slate-700">Цвет линий сетки</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'red', label: 'Классический красный', swatch: 'bg-red-600' },
                      { id: 'green', label: 'Изумрудный зеленый', swatch: 'bg-emerald-600' },
                      { id: 'gray', label: 'Серый графит', swatch: 'bg-slate-600' },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onUpdateConfig({ ...config, gridColor: c.id })}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        config.gridColor === c.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-xs ${c.swatch}`} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5 border-t border-slate-200">
              {/* Ползунок количества серых контуров для обводки (0 - 10) */}
              <div className="space-y-2.5">
                <label
                  htmlFor="trace-count-slider"
                  className="flex items-center justify-between text-sm font-semibold text-slate-700"
                >
                  <span>Контуров для обводки:</span>
                  <span className="font-mono-tabular text-rose-700 font-bold">
                    {config.traceCount} шт.
                  </span>
                </label>
                <input
                  id="trace-count-slider"
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={config.traceCount}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, traceCount: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-rose-600 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-400 font-mono-tabular">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </div>

              {/* Количество строк клеток на элемент (1 или 2 строки по 10 клеток) */}
              <div className="space-y-2.5">
                <span className="block text-sm font-semibold text-slate-700">
                  Строк на элемент (по 10 клеток)
                </span>
                <div className="flex gap-2">
                  {([1, 2] as const).map((rows) => (
                    <button
                      key={rows}
                      type="button"
                      onClick={() => onUpdateConfig({ ...config, rowsPerItem: rows })}
                      className={`flex-1 py-2.5 px-3 text-sm font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        config.rowsPerItem === rows
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {rows === 1 ? '1 строка (10 кл.)' : '2 строки (20 кл.)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Пошаговый порядок черт (Stroke Order Header) */}
              <div className="space-y-2.5">
                <span className="block text-sm font-semibold text-slate-700">
                  Пошаговый порядок черт
                </span>
                <button
                  type="button"
                  data-testid="toggle-stroke-order-button"
                  onClick={() =>
                    onUpdateConfig({ ...config, showStrokeOrder: !config.showStrokeOrder })
                  }
                  aria-pressed={Boolean(config.showStrokeOrder)}
                  className={`w-full py-2.5 px-3 text-sm font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.showStrokeOrder
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {config.showStrokeOrder ? 'Включен (в шапке)' : 'Выключен'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Модальное окно «Сохранить в Личный кабинет» */}
      {isSaveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-worksheet-modal-title"
          data-testid="save-worksheet-modal"
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BookmarkCheck className="w-5 h-5 text-rose-400" />
                <h3 id="save-worksheet-modal-title" className="text-lg font-bold">
                  {saveMode === 'copy'
                    ? 'Сохранить копию прописи в облако'
                    : saveMode === 'update'
                    ? 'Обновить пропись в облаке'
                    : 'Сохранить пропись в Личный кабинет'}
                </h3>
              </div>
              <button
                type="button"
                disabled={isSavingToCloud}
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSaveModal} className="p-6 space-y-4">
              {saveError && (
                <div
                  role="alert"
                  className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-sm font-medium text-rose-700"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                  <span>{saveError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="save-worksheet-title"
                  className="block text-sm font-semibold text-slate-700 mb-1.5"
                >
                  Название листа прописи *
                </label>
                <input
                  id="save-worksheet-title"
                  data-testid="save-worksheet-title-input"
                  type="text"
                  required
                  disabled={isSavingToCloud}
                  value={sheetTitleInput}
                  onChange={(e) => setSheetTitleInput(e.target.value)}
                  placeholder="Например: Урок 4. Семья и профессии"
                  className="w-full px-4 py-3 text-base bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-rose-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="save-worksheet-folder"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Папка / Учебная группа *
                  </label>
                  <button
                    type="button"
                    disabled={isSavingToCloud}
                    onClick={() => setIsCreatingInlineFolder((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>{isCreatingInlineFolder ? 'Отмена' : 'Создать новую папку'}</span>
                  </button>
                </div>

                {isCreatingInlineFolder ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled={isSavingToCloud}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Название новой папки (например: HSK 3)"
                      className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-rose-600"
                    />
                    <button
                      type="button"
                      disabled={isSavingToCloud}
                      onClick={() => void handleCreateInlineFolderSubmit()}
                      className="px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
                    >
                      Добавить
                    </button>
                  </div>
                ) : (
                  <select
                    id="save-worksheet-folder"
                    data-testid="save-worksheet-folder-select"
                    disabled={isSavingToCloud}
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="w-full px-4 py-3 text-base bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-rose-600"
                  >
                    {folders.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                    {folders.length === 0 && <option value="HSK 1">HSK 1</option>}
                  </select>
                )}
              </div>

              <div>
                <label
                  htmlFor="save-worksheet-description"
                  className="block text-sm font-semibold text-slate-700 mb-1.5"
                >
                  Краткая заметка к уроку (необязательно)
                </label>
                <textarea
                  id="save-worksheet-description"
                  data-testid="save-worksheet-description-input"
                  rows={2}
                  disabled={isSavingToCloud}
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Например: Домашнее задание для вторничной группы, повторить порядок черт..."
                  className="w-full px-4 py-3 text-base bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-rose-600 resize-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600 flex items-center justify-between">
                <span>Слов в сохраняемом листе:</span>
                <span className="font-mono-tabular font-bold text-slate-900">
                  {worksheetList.length} ({worksheetList.map((w) => w.word).join(', ')})
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSavingToCloud}
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-5 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingToCloud}
                  data-testid="confirm-save-worksheet-button"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  {isSavingToCloud ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Сохранение в облако...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Сохранить в кабинет</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Если список пуст — выводим информационную карточку Empty State с приглушенным логотипом MoShui (высотой 96px) */}
      {worksheetList.length === 0 ? (
        <section
          aria-label="Пустое состояние конструктора прописей"
          data-testid="worksheet-empty-state"
          className="bg-white border border-slate-200 rounded-2xl p-12 sm:p-16 text-center shadow-2xs print:hidden"
        >
          <div className="max-w-lg mx-auto flex flex-col items-center">
            <img
              src={MOSHUI_LOGO_SRC}
              alt="MoShui 墨水"
              data-testid="worksheet-empty-logo"
              className="h-24 w-24 object-contain rounded-2xl opacity-75 mb-5 border border-slate-200/70 bg-[#FAF9F6] p-1.5"
            />
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Список слов для прописи пока пуст
            </h2>
            <p className="mt-2.5 text-base text-slate-600 leading-relaxed">
              Список слов для прописи пока пуст. Добавьте слова через поле быстрого ввода слева или
              отправьте их сюда из вкладки «Словарь».
            </p>
            {onNavigateToDictionary && (
              <button
                type="button"
                onClick={onNavigateToDictionary}
                className="mt-6 inline-flex items-center gap-2.5 px-6 py-3.5 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <BookOpen className="w-5 h-5" />
                <span>Перейти во вкладку «Словарь и Практика»</span>
              </button>
            )}
          </div>
        </section>
      ) : (
        <div className={`mt-8 ${mobileTab === 'editor' ? 'hidden lg:block' : 'block'}`}>
          {/* Внешний контейнер-вьюпорт со свайпом/скроллом, предотвращающий переполнение экрана на смартфонах */}
          <div
            className="bg-slate-100/70 border border-slate-200 rounded-2xl p-2 sm:p-6 overflow-x-auto touch-pan-x overscroll-x-contain shadow-2xs"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-2 lg:hidden">
              <span>Лист формата А4 (794px). Смахните вправо для просмотра:</span>
              <span className="font-mono-tabular font-semibold text-rose-700">794 × 1123 px</span>
            </div>
            <div style={{ minWidth: '794px' }} className="mx-auto flex justify-center">
              <PrintableSheet
                worksheetList={worksheetList}
                config={config}
                teacherName={currentTeacher?.name}
              />
            </div>
          </div>
        </div>
      )}

      {/* Мобильная плавающая панель быстрых действий (Скачать PDF и Сохранить) над нижней навигацией */}
      {worksheetList.length > 0 && (
        <div className="lg:hidden fixed bottom-16 left-3 right-3 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-2 shadow-lg flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={isExportingPdf}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>{isExportingPdf ? 'Генерация...' : 'Скачать PDF'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenSaveModal('new')}
            disabled={isSavingToCloud}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
          >
            <BookmarkCheck className="w-4 h-4 text-slate-700" />
            <span>В кабинет</span>
          </button>
        </div>
      )}
    </div>
  );
};
