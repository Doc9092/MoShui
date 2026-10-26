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
  onCreateFolder?: (
    name: string,
    color?: string
  ) => Promise<TeacherFolder | null> | TeacherFolder | null;
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

  const showPreview = mobileTab === 'preview';

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
    setStatusNote(`Добавлено слов: ${addedItems.length}. Загружаем русские переводы...`);

    try {
      const batchMap = await translateWordsBatch(addedWordsList);
      onUpdateWorksheetList(applyBatchTranslations(nextList, batchMap, false));
      setStatusNote(
        `Добавлено слов: ${addedItems.length} (${addedWordsList.join(', ')}). Переводы подтянуты автоматически.`
      );
    } catch {
      setStatusNote(
        `Добавлено слов: ${addedItems.length}. Вы можете отредактировать перевод каждого слова вручную.`
      );
    } finally {
      setIsEnrichingAi(false);
    }
  };

  const handleEnrichTranslationsViaAi = async () => {
    if (worksheetList.length === 0 || isEnrichingAi) return;
    setIsEnrichingAi(true);
    setStatusNote('Запрашиваем точные переводы и посимвольный разбор через ИИ...');

    try {
      const wordsToTranslate = worksheetList.map((item) => item.word);
      const batchMap = await translateWordsBatch(wordsToTranslate);
      let updatedList = applyBatchTranslations(worksheetList, batchMap, true);

      // Дополнительное глубокое обогащение для слов, которые не нашлись в пакетном ответе
      const stillMissing = updatedList.filter(
        (item) => !item.translation || isPlaceholderTranslation(item.translation)
      );

      if (stillMissing.length > 0) {
        const deepUpdated: WordItem[] = [];
        for (const item of updatedList) {
          if (!item.translation || isPlaceholderTranslation(item.translation)) {
            try {
              const analyzed = await analyzeChineseInput(item.word);
              deepUpdated.push({ ...analyzed, id: item.id });
            } catch {
              deepUpdated.push(item);
            }
          } else {
            deepUpdated.push(item);
          }
        }
        updatedList = deepUpdated;
      }

      onUpdateWorksheetList(updatedList);
      setStatusNote('Русские переводы и пиньинь успешно обновлены для всех слов.');
    } catch {
      setStatusNote('Не удалось обновить часть переводов. Проверьте соединение.');
    } finally {
      setIsEnrichingAi(false);
    }
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
    setStatusNote('Генерация PDF-файла А4... Пожалуйста, подождите.');
    try {
      const pdfName = activeSavedWorksheet?.title || config.sheetTitle || 'moshui-worksheet';
      await downloadWorksheetAsPDF(PRINTABLE_SHEET_ELEMENT_ID, pdfName);
      setStatusNote(`PDF-файл «${pdfName}.pdf» успешно сформирован и скачан.`);
      showToast(`Файл «${pdfName}.pdf» сохранен на ваше устройство.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось сформировать PDF-файл.';
      setStatusNote(msg);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintSheet = () => {
    const sheetTitle = activeSavedWorksheet?.title || config.sheetTitle || 'Пропись MoShui';
    printWorksheetInNewWindow(PRINTABLE_SHEET_ELEMENT_ID, sheetTitle);
  };

  const handleExportJson = () => {
    const payload = JSON.stringify({ config, words: worksheetList }, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moshui-worksheet-${ new Date().toISOString().slice(0, 10) }.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenSaveModal = (mode: 'new' | 'copy' | 'update') => {
    if (!currentTeacher) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }
    setSaveError(null);
    setSaveMode(mode);
    if (mode === 'copy' && activeSavedWorksheet) {
      setSheetTitleInput(`${activeSavedWorksheet.title} (Копия)`);
      setSelectedFolder(activeSavedWorksheet.folder);
      setDescriptionInput(activeSavedWorksheet.description || '');
    } else if (mode === 'update' && activeSavedWorksheet) {
      setSheetTitleInput(activeSavedWorksheet.title);
      setSelectedFolder(activeSavedWorksheet.folder);
      setDescriptionInput(activeSavedWorksheet.description || '');
    } else {
      setSheetTitleInput(config.sheetTitle || 'Урок 1. Базовая лексика');
      setSelectedFolder(activeSavedWorksheet?.folder || folders[0]?.name || 'HSK 1');
    }
    setIsSaveModalOpen(true);
  };

  const handleQuickUpdateSavedWorksheet = async () => {
    if (!currentTeacher) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }
    if (!activeSavedWorksheet || !onSaveToWorkspace || isSavingToCloud) return;

    setIsSavingToCloud(true);
    try {
      const saved = await onSaveToWorkspace({
        id: activeSavedWorksheet.id,
        title: activeSavedWorksheet.title,
        folder: activeSavedWorksheet.folder,
        description: activeSavedWorksheet.description,
      });
      if (saved) {
        showToast(
          `Изменения сохранены в облаке: «${saved.title}» (папка «${saved.folder}»)`
        );
      }
    } catch (err) {
      setStatusNote(
        err instanceof Error ? err.message : 'Ошибка обновления прописи в облаке Supabase.'
      );
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const handleCreateInlineFolderSubmit = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || !onCreateFolder) return;
    setSaveError(null);
    try {
      const created = await onCreateFolder(trimmed, 'rose');
      if (created) {
        setSelectedFolder(created.name);
        setNewFolderName('');
        setIsCreatingInlineFolder(false);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось создать папку в облаке.');
    }
  };

  const handleConfirmSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveToWorkspace || isSavingToCloud) return;

    setSaveError(null);
    setIsSavingToCloud(true);

    try {
      let folderToUse = selectedFolder;
      if (isCreatingInlineFolder && newFolderName.trim() && onCreateFolder) {
        const created = await onCreateFolder(newFolderName.trim(), 'rose');
        if (created) {
          folderToUse = created.name;
        }
        setNewFolderName('');
        setIsCreatingInlineFolder(false);
      }

      const finalTitle = sheetTitleInput.trim() || config.sheetTitle || 'Учебная пропись';
      onUpdateConfig({ ...config, sheetTitle: finalTitle });

      const saved = await onSaveToWorkspace({
        id: saveMode === 'update' && activeSavedWorksheet ? activeSavedWorksheet.id : undefined,
        title: finalTitle,
        folder: folderToUse || 'Общие прописи',
        description: descriptionInput.trim(),
      });

      if (saved) {
        setIsSaveModalOpen(false);
        showToast(`Пропись «${saved.title}» сохранена в папку «${saved.folder}»!`);
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
    <div className="space-y-6">
      {/* Верхняя шапка конструктора и панель быстрых действий (скрывается при печати) */}
      <div className="print:hidden space-y-5">
        <div className="bg-white border border-[#EAE3D5] rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] transition-all duration-300 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#18181B] tracking-tight text-balance">
                Конструктор PDF-прописей MoShui формата А4
              </h1>
              <p className="mt-2 text-base sm:text-lg text-[#52525B] leading-relaxed">
                Поддержка как одиночных иероглифов, так и многосложных слов целиком в одной строке с
                векторными контурами черт.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-[#EAE3D5]">
            {/* Кнопка сохранения в Личный кабинет преподавателя */}
            <button
              type="button"
              onClick={() => handleOpenSaveModal('new')}
              disabled={worksheetList.length === 0 || isSavingToCloud}
              data-testid="save-to-workspace-button"
              className="inline-flex items-center gap-2.5 px-5 py-3 h-12 text-sm sm:text-base font-semibold text-white bg-[#18181B] hover:bg-[#27272A] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSavingToCloud ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#F5D0C8]" />
              ) : (
                <BookmarkCheck className="w-5 h-5 text-[#F5D0C8]" />
              )}
              <span>Сохранить в Личный кабинет</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={worksheetList.length === 0}
              className="inline-flex items-center gap-2 px-4 py-3 h-12 text-sm sm:text-base font-semibold text-[#18181B] bg-[#FAF7F2] border border-[#EAE3D5] hover:bg-[#F3EFE6] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-5 h-5 text-[#52525B]" />
              <span>Экспорт JSON</span>
            </button>

            <button
              type="button"
              onClick={handleEnrichTranslationsViaAi}
              disabled={isEnrichingAi || worksheetList.length === 0}
              className="inline-flex items-center gap-2 px-4 py-3 h-12 text-sm sm:text-base font-semibold text-[#C83E31] bg-[#FDF2F0] border border-[#F5D0C8] hover:bg-[#FCE6E2] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isEnrichingAi ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-[#C83E31]" />
                  <span>Загрузка переводов...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 text-[#C83E31]" />
                  <span>Подтянуть переводы через ИИ</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintSheet}
              disabled={worksheetList.length === 0 || isExportingPdf}
              data-testid="print-sheet-button"
              className="inline-flex items-center gap-2.5 px-6 py-3 h-12 text-base font-semibold text-white bg-[#C83E31] hover:bg-[#B03226] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Печать</span>
            </button>

            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={worksheetList.length === 0 || isExportingPdf}
              data-testid="download-pdf-button"
              className="inline-flex items-center gap-2 px-5 py-3 h-12 text-sm sm:text-base font-semibold text-[#18181B] bg-[#FAF7F2] border border-[#E6E0D6] hover:bg-[#EAE3D5] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isExportingPdf ? (
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
        </div>

        {/* Баннер редактирования сохраненной прописи из Личного кабинета */}
        {activeSavedWorksheet && currentTeacher && (
          <div
            data-testid="active-saved-worksheet-banner"
            className="bg-[#FDF2F0] border border-[#F5D0C8] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#C83E31] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-bold uppercase tracking-wider text-[#C83E31]">
                    Открыта сохраненная пропись:
                  </span>
                  <span className="text-base font-bold text-[#18181B]">
                    {activeSavedWorksheet.title}
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-white border border-[#F5D0C8] text-[#C83E31] rounded-md">
                    {activeSavedWorksheet.folder}
                  </span>
                </div>
                {activeSavedWorksheet.description && (
                  <p className="text-sm text-[#52525B] mt-1">
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
                className="inline-flex items-center gap-2 px-4 py-2.5 h-11 text-sm font-semibold text-white bg-[#C83E31] hover:bg-[#B03226] disabled:opacity-50 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
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
                className="inline-flex items-center gap-2 px-4 py-2.5 h-11 text-sm font-semibold text-[#18181B] bg-white border border-[#EAE3D5] hover:bg-[#FAF7F2] disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4 text-[#52525B]" />
                <span>Сохранить как копию</span>
              </button>

              {onDetachSavedWorksheet && (
                <button
                  type="button"
                  onClick={onDetachSavedWorksheet}
                  className="px-3 py-2.5 text-sm font-medium text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
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
            className="bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] rounded-xl px-5 py-4 text-sm font-semibold flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0" />
              <span>{workspaceToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setWorkspaceToast(null)}
              className="text-[#15803D] hover:text-[#14532D] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Мобильный переключатель экранов (< 768px): «1. Слова и Настройки» | «2. Предпросмотр А4» */}
        <div className="md:hidden flex items-center p-1.5 bg-[#FAF7F2] rounded-2xl border border-[#EAE3D5]">
          <button
            type="button"
            onClick={() => setMobileTab('editor')}
            data-testid="mobile-worksheet-tab-editor"
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px] cursor-pointer ${
              !showPreview
                ? 'bg-[#18181B] text-[#FAF7F2] shadow-sm font-bold'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            <Settings2 className="w-4 h-4 text-[#C83E31]" />
            <span>1. Слова и Настройки ({worksheetList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            data-testid="mobile-worksheet-tab-preview"
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px] cursor-pointer ${
              showPreview
                ? 'bg-[#18181B] text-[#FAF7F2] shadow-sm font-bold'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            <FileText className="w-4 h-4 text-[#C83E31]" />
            <span>2. Предпросмотр А4</span>
          </button>
        </div>
      </div>

      {/* Главный двухколоночный макет (Side-by-Side) для планшетов (md:) и ПК (lg:) */}
      <div
        data-testid="worksheet-side-by-side-grid"
        className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
      >
        {/* ЛЕВАЯ КОЛОНКА (Настройки и слова): всегда видна на md: и выше, на мобильных — когда !showPreview */}
        <div
          data-testid="worksheet-left-column"
          className={`md:col-span-5 lg:col-span-4 space-y-6 print:hidden ${
            showPreview ? 'hidden md:block' : 'block'
          }`}
        >
          {/* Карточка 1: Список слов и быстрый ввод */}
          <section className="bg-white border border-[#EAE3D5] rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] transition-all duration-300 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-[#18181B] flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-[#C83E31]" />
                <span>Слова в прописи ({worksheetList.length})</span>
              </h2>
              {worksheetList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#71717A] hover:text-[#C83E31] transition-colors cursor-pointer"
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
                className="block text-sm font-semibold text-[#18181B]"
              >
                Быстрый ввод списком (через запятую или пробел)
              </label>
              <div className="flex gap-2">
                <input
                  id="batch-words-input"
                  type="text"
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  placeholder="Введите слова через запятую..."
                  className="flex-1 min-w-0 px-3.5 py-2.5 h-11 text-sm sm:text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] font-hanzi-sans"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 h-11 text-sm font-semibold text-white bg-[#18181B] hover:bg-[#27272A] rounded-xl shadow-sm transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить</span>
                </button>
              </div>
              {statusNote && <p className="text-xs sm:text-sm text-[#52525B]">{statusNote}</p>}
            </form>

            {/* Список добавленных слов с изменением порядка и удалением */}
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {worksheetList.length === 0 ? (
                <div className="p-5 text-center bg-[#FAF7F2] border border-dashed border-[#EAE3D5] rounded-xl text-sm text-[#71717A] space-y-3">
                  <p>
                    Очередь слов пуста. Добавьте иероглифы или слова через поле быстрого ввода выше.
                  </p>
                  {onNavigateToDictionary && (
                    <button
                      type="button"
                      onClick={onNavigateToDictionary}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#18181B] bg-white border border-[#EAE3D5] hover:bg-[#F3EFE6] rounded-lg transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-[#C83E31]" />
                      <span>Перейти в «Словарь»</span>
                    </button>
                  )}
                </div>
              ) : (
                worksheetList.map((item, idx) => {
                  const displayTranslation = isPlaceholderTranslation(item.translation)
                    ? ''
                    : item.translation;

                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2.5 p-3.5 bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span className="font-mono-tabular text-xs font-semibold text-[#71717A] w-5 shrink-0 pt-1">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-chinese text-xl font-bold text-[#18181B] shrink-0">
                              {item.word}
                            </span>
                            <span className="text-xs font-mono-tabular font-semibold text-[#C83E31] truncate">
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
                            className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-[#EAE3D5] hover:border-[#D6CEB8] focus:border-[#C83E31] rounded-lg text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveItem(idx, 'up')}
                          disabled={idx === 0}
                          aria-label={`Переместить ${item.word} вверх`}
                          className="p-1.5 text-[#71717A] hover:text-[#18181B] hover:bg-[#EAE3D5]/70 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveItem(idx, 'down')}
                          disabled={idx === worksheetList.length - 1}
                          aria-label={`Переместить ${item.word} вниз`}
                          className="p-1.5 text-[#71717A] hover:text-[#18181B] hover:bg-[#EAE3D5]/70 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Удалить ${item.word} из прописи`}
                          className="p-1.5 text-[#71717A] hover:text-[#C83E31] hover:bg-[#FDF2F0] rounded-lg transition-colors cursor-pointer"
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

          {/* Карточка 2: Панель настроек дизайна прописи (WorksheetConfig) */}
          <section className="bg-white border border-[#EAE3D5] rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] transition-all duration-300 space-y-5">
            <h2 className="text-lg font-bold text-[#18181B] flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-[#C83E31]" />
              <span>Настройки макета и сетки</span>
            </h2>

            {/* Заголовок листа А4 */}
            <div className="space-y-1.5">
              <label
                htmlFor="sheet-title-inline"
                className="block text-sm font-semibold text-[#18181B]"
              >
                Заголовок А4:
              </label>
              <input
                id="sheet-title-inline"
                type="text"
                value={config.sheetTitle}
                onChange={(e) => onUpdateConfig({ ...config, sheetTitle: e.target.value })}
                placeholder="Заголовок прописи..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] focus:outline-none focus:bg-white focus:border-[#C83E31] font-hanzi-sans"
              />
            </div>

            {/* Режим компоновки строк */}
            <div className="space-y-2.5 pt-3 border-t border-[#EAE3D5]">
              <div className="text-sm font-semibold text-[#18181B] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#71717A]" />
                <span>Режим компоновки строк</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ ...config, layoutMode: 'by-character' })}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    config.layoutMode === 'by-character'
                      ? 'bg-[#FDF2F0] border-[#C83E31] ring-1 ring-[#C83E31]'
                      : 'bg-[#FAF7F2] border-[#EAE3D5] hover:bg-[#F3EFE6]'
                  }`}
                >
                  <div className="text-sm font-bold text-[#18181B]">
                    Режим А: Посимвольный разбор
                  </div>
                  <div className="mt-1 text-xs text-[#52525B] leading-relaxed">
                    1 иероглиф = 1 блок с индивидуальным пиньинем и порядком черт.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateConfig({ ...config, layoutMode: 'whole-word' })}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    config.layoutMode === 'whole-word'
                      ? 'bg-[#FDF2F0] border-[#C83E31] ring-1 ring-[#C83E31]'
                      : 'bg-[#FAF7F2] border-[#EAE3D5] hover:bg-[#F3EFE6]'
                  }`}
                >
                  <div className="text-sm font-bold text-[#18181B]">
                    Режим Б: Словарный режим (Слово целиком)
                  </div>
                  <div className="mt-1 text-xs text-[#52525B] leading-relaxed">
                    Чередование иероглифов слова в одной строке сетки: образец, обводка и практика.
                  </div>
                </button>
              </div>
            </div>

            {/* Тип сетки */}
            <div className="space-y-2 pt-3 border-t border-[#EAE3D5]">
              <span className="block text-sm font-semibold text-[#18181B] flex items-center gap-2">
                <Grid className="w-4 h-4 text-[#71717A]" />
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
                    className={`flex-1 px-3 py-2 min-h-[40px] text-xs sm:text-sm font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer font-hanzi-sans ${
                      config.gridType === g.id
                        ? 'bg-[#18181B] text-[#FAF7F2] border-[#18181B] shadow-xs'
                        : 'bg-white text-[#52525B] border-[#EAE3D5] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Цвет сетки */}
            <div className="space-y-2 pt-3 border-t border-[#EAE3D5]">
              <span className="block text-sm font-semibold text-[#18181B]">Цвет линий сетки</span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'red', label: 'Классический красный', swatch: 'bg-[#C83E31]' },
                    { id: 'green', label: 'Изумрудный зеленый', swatch: 'bg-[#15803D]' },
                    { id: 'gray', label: 'Серый графит', swatch: 'bg-[#52525B]' },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onUpdateConfig({ ...config, gridColor: c.id })}
                    className={`inline-flex items-center gap-2 px-3 py-2 min-h-[40px] text-xs sm:text-sm font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      config.gridColor === c.id
                        ? 'bg-[#18181B] text-[#FAF7F2] border-[#18181B] shadow-xs'
                        : 'bg-white text-[#52525B] border-[#EAE3D5] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-xs ${c.swatch}`} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Количество клеток (10 кл = 1 строка, 20 кл = 2 строки, 30 кл = 3 строки по 10 клеток) */}
            <div className="space-y-2 pt-3 border-t border-[#EAE3D5]">
              <span className="block text-sm font-semibold text-[#18181B]">Количество клеток</span>
              <div className="flex gap-2">
                {([10, 20, 30] as const).map((cellCount) => {
                  const activeTotalCells =
                    config.rowsPerItem === 3 || config.cellsPerRow === 30
                      ? 30
                      : config.rowsPerItem === 2 || config.cellsPerRow === 20
                      ? 20
                      : 10;
                  const isActive = activeTotalCells === cellCount;
                  const nextRowsPerItem = (cellCount / 10) as 1 | 2 | 3;
                  return (
                    <button
                      key={cellCount}
                      type="button"
                      data-testid={`cells-per-row-btn-${cellCount}`}
                      onClick={() =>
                        onUpdateConfig({
                          ...config,
                          cellsPerRow: 10,
                          rowsPerItem: nextRowsPerItem,
                        })
                      }
                      className={`flex-1 py-2.5 px-3 min-h-[42px] text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-[#18181B] text-white rounded-lg'
                          : 'bg-[#FAF7F2] text-[#18181B] border border-[#E6E0D6] hover:bg-[#EAE3D5] rounded-lg transition-colors'
                      }`}
                    >
                      {cellCount} кл
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Контуры для обводки (ползунок от 0 до 30 и быстрые кнопки 5, 10, 20, 30, Все клетки) */}
            <div className="space-y-2.5 pt-3 border-t border-[#EAE3D5]">
              <label
                htmlFor="trace-count-slider"
                className="flex items-center justify-between text-sm font-semibold text-[#18181B]"
              >
                <span>Контуры для обводки:</span>
                <span className="font-mono-tabular text-[#C83E31] font-bold">
                  {config.traceCount >= 30 ? 'Все клетки (30)' : `${config.traceCount} шт.`}
                </span>
              </label>
              <input
                id="trace-count-slider"
                type="range"
                min={0}
                max={30}
                step={1}
                value={config.traceCount}
                onChange={(e) =>
                  onUpdateConfig({ ...config, traceCount: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[#C83E31] cursor-pointer"
              />
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {(
                  [
                    { label: '0', value: 0 },
                    { label: '5', value: 5 },
                    { label: '10', value: 10 },
                    { label: '20', value: 20 },
                    { label: '30 / Все клетки', value: 30 },
                  ] as const
                ).map((preset) => {
                  const isActivePreset = config.traceCount === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      data-testid={`trace-preset-btn-${preset.value}`}
                      onClick={() => onUpdateConfig({ ...config, traceCount: preset.value })}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        isActivePreset
                          ? 'bg-[#18181B] text-white border-[#18181B]'
                          : 'bg-[#FAF7F2] text-[#18181B] border-[#E6E0D6] hover:bg-[#EAE3D5]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Пошаговый порядок черт и Поля "Имя" и "Дата" для ученика */}
            <div className="space-y-3 pt-3 border-t border-[#EAE3D5]">
              <div className="space-y-2">
                <span className="block text-sm font-semibold text-[#18181B]">
                  Пошаговый порядок черт
                </span>
                <button
                  type="button"
                  data-testid="toggle-stroke-order-button"
                  onClick={() =>
                    onUpdateConfig({ ...config, showStrokeOrder: !config.showStrokeOrder })
                  }
                  aria-pressed={Boolean(config.showStrokeOrder)}
                  className={`w-full py-2.5 px-3 min-h-[42px] text-sm font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.showStrokeOrder
                      ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                      : 'bg-[#FAF7F2] text-[#52525B] border-[#EAE3D5]'
                  }`}
                >
                  {config.showStrokeOrder ? 'Включен (в шапке)' : 'Выключен'}
                </button>
              </div>

              <label
                htmlFor="toggle-student-info-checkbox"
                data-testid="toggle-student-info-label"
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF7F2] border border-[#EAE3D5] hover:bg-[#F3EFE6] transition-colors cursor-pointer select-none"
              >
                <span className="text-sm font-semibold text-[#18181B]">
                  Поля &laquo;Имя&raquo; и &laquo;Дата&raquo; для ученика
                </span>
                <input
                  id="toggle-student-info-checkbox"
                  data-testid="toggle-student-info-checkbox"
                  type="checkbox"
                  checked={config.showStudentInfo !== false}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, showStudentInfo: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#C83E31] rounded cursor-pointer"
                />
              </label>
            </div>
          </section>
        </div>

        {/* ПРАВАЯ КОЛОНКА (Превью А4 и экспорт): ВСЕГДА рендерится на экранах md: и выше */}
        <div
          data-testid="worksheet-right-column"
          className={`md:col-span-7 lg:col-span-8 space-y-4 ${
            showPreview ? 'block' : 'hidden md:block'
          }`}
        >
          {/* Информационная карточка пустого списка (при пустой очереди слов), не блокирующая рендер листа А4 ниже */}
          {worksheetList.length === 0 && (
            <section
              aria-label="Пустое состояние конструктора прописей"
              data-testid="worksheet-empty-state"
              className="bg-white border border-[#EAE3D5] rounded-2xl p-6 sm:p-8 text-center shadow-[0_8px_30px_rgb(24,24,27,0.04)] print:hidden"
            >
              <div className="max-w-lg mx-auto flex flex-col items-center">
                <img
                  src={MOSHUI_LOGO_SRC}
                  alt="MoShui 墨水"
                  data-testid="worksheet-empty-logo"
                  className="h-16 w-16 object-contain rounded-full mix-blend-multiply opacity-85 mb-3"
                />
                <h2 className="font-display text-xl font-bold text-[#18181B]">
                  Список слов для прописи пока пуст
                </h2>
                <p className="mt-1.5 text-sm text-[#52525B] leading-relaxed">
                  Добавьте китайские слова через поле быстрого ввода слева или отправьте их сюда из
                  вкладки «Словарь». Ниже отображается живой макет листа А4.
                </p>
              </div>
            </section>
          )}

          {/* Внешний контейнер-вьюпорт для просмотра чистого белого листа А4 */}
          <div
            className="bg-[#F3EFE6]/80 border border-[#EAE3D5] rounded-2xl p-2 sm:p-5 overflow-x-auto touch-pan-x overscroll-x-contain shadow-inner"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex items-center justify-end text-xs text-[#52525B] mb-3 px-2 print:hidden">
              <span className="px-2.5 py-0.5 font-mono-tabular font-semibold text-[#C83E31] bg-white/90 border border-[#EAE3D5] rounded-md">
                A4
              </span>
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
      </div>

      {/* Модальное окно «Сохранить в Личный кабинет» */}
      {isSaveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/60 backdrop-blur-xs p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-worksheet-modal-title"
          data-testid="save-worksheet-modal"
        >
          <div className="bg-white border border-[#EAE3D5] rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-[#18181B] text-[#FAF7F2] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BookmarkCheck className="w-5 h-5 text-[#F5D0C8]" />
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
                className="p-1.5 text-[#A1A1AA] hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSaveModal} className="p-6 space-y-4">
              {saveError && (
                <div
                  role="alert"
                  className="p-3.5 bg-[#FDF2F0] border border-[#F5D0C8] rounded-xl flex items-start gap-2.5 text-sm font-medium text-[#C83E31]"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#C83E31]" />
                  <span>{saveError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="save-worksheet-title"
                  className="block text-sm font-semibold text-[#18181B] mb-1.5"
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
                  className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] focus:outline-none focus:bg-white focus:border-[#C83E31]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="save-worksheet-folder"
                    className="block text-sm font-semibold text-[#18181B]"
                  >
                    Папка / Учебная группа *
                  </label>
                  <button
                    type="button"
                    disabled={isSavingToCloud}
                    onClick={() => setIsCreatingInlineFolder((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#C83E31] hover:text-[#B03226] cursor-pointer"
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
                      className="flex-1 px-4 py-2.5 text-sm bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] focus:outline-none focus:bg-white focus:border-[#C83E31]"
                    />
                    <button
                      type="button"
                      disabled={isSavingToCloud}
                      onClick={() => void handleCreateInlineFolderSubmit()}
                      className="px-4 py-2.5 text-sm font-semibold text-white bg-[#18181B] hover:bg-[#27272A] rounded-xl cursor-pointer"
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
                    className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] focus:outline-none focus:bg-white focus:border-[#C83E31]"
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
                  className="block text-sm font-semibold text-[#18181B] mb-1.5"
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
                  className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] focus:outline-none focus:bg-white focus:border-[#C83E31] resize-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE3D5] text-sm text-[#52525B] flex items-center justify-between">
                <span>Слов в сохраняемом листе:</span>
                <span className="font-mono-tabular font-bold text-[#18181B]">
                  {worksheetList.length} ({worksheetList.map((w) => w.word).join(', ')})
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSavingToCloud}
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-5 py-3 text-sm font-semibold text-[#52525B] hover:text-[#18181B] bg-[#FAF7F2] hover:bg-[#F3EFE6] rounded-xl transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingToCloud}
                  data-testid="confirm-save-worksheet-button"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#18181B] hover:bg-[#27272A] disabled:opacity-60 rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                >
                  {isSavingToCloud ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Сохранение в облако...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-[#F5D0C8]" />
                      <span>Сохранить в кабинет</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Мобильная плавающая панель быстрых действий (Печать и Скачать PDF) над нижней навигацией */}
      {worksheetList.length > 0 && (
        <div className="md:hidden fixed bottom-16 left-3 right-3 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border border-[#E6E0D6] rounded-2xl p-2 shadow-lg flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrintSheet}
            disabled={isExportingPdf}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 min-h-[44px] text-xs sm:text-sm font-semibold text-white bg-[#C83E31] hover:bg-[#B03226] disabled:opacity-50 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Печать</span>
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={isExportingPdf}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 min-h-[44px] text-xs sm:text-sm font-semibold text-[#18181B] bg-[#FAF7F2] border border-[#E6E0D6] hover:bg-[#EAE3D5] disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
          >
            {isExportingPdf ? (
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
      )}
    </div>
  );
};
