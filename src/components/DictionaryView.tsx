import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Search,
  Volume2,
  Plus,
  Check,
  Loader2,
  BookOpen,
  Layers,
  Lightbulb,
  MessageSquareQuote,
  ArrowRight,
  Send,
  Mail,
  ExternalLink,
} from 'lucide-react';
import type { WordItem, CharDetail } from '../types/hanzi';
import {
  normalizeWordItem,
  isPlaceholderTranslation,
} from '../utils/hanziUtils';
import { analyzeChineseInput } from '../services/geminiService';
import { speakChinese } from '../services/audioService';
import { HanziCanvas } from './HanziCanvas';
import { useLanguage } from '../context/LanguageContext';

interface DictionaryViewProps {
  currentWord: WordItem | null;
  onWordChange: (word: WordItem) => void;
  worksheetList: WordItem[];
  onAddToWorksheet: (word: WordItem) => void;
  onNavigateToWorksheet: () => void;
}

export const DictionaryView: React.FC<DictionaryViewProps> = ({
  currentWord,
  onWordChange,
  worksheetList,
  onAddToWorksheet,
  onNavigateToWorksheet,
}) => {
  const { lang, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCharIndex, setSelectedCharIndex] = useState<number>(0);
  const currentWordRef = React.useRef<WordItem | null>(currentWord);
  currentWordRef.current = currentWord;
  const prevLangRef = React.useRef<'ru' | 'en'>(lang);

  // Reset selected character tab when the analyzed word changes
  useEffect(() => {
    setSelectedCharIndex(0);
  }, [currentWord?.word]);

  // Автоматическое обновление открытого слова в словаре при переключении языка RU / EN
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    const activeWord = currentWordRef.current?.word;
    if (!activeWord) return;

    let isCancelled = false;
    void (async () => {
      try {
        const reanalyzed = await analyzeChineseInput(activeWord, lang);
        if (!isCancelled) {
          onWordChange(reanalyzed);
        }
      } catch {
        // Сохраняем текущее состояние при сетевой ошибке
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [lang, onWordChange]);

  const isAlreadyInWorksheet = currentWord
    ? worksheetList.some((item) => item.word === currentWord.word)
    : false;

  const handleAnalyze = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      const msg = t.dictEmptyInputError;
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      const analyzed = await analyzeChineseInput(trimmed, lang);
      onWordChange(analyzed);
      setSearchQuery(analyzed.word);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.dictAnalyzeError;
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleAnalyze(searchQuery);
  };

  const activeChar: CharDetail | undefined = currentWord
    ? currentWord.characters[selectedCharIndex] || currentWord.characters[0]
    : undefined;

  return (
    <div className="space-y-8">
      {/* Секция поиска в эстетике Spatial Glass / Ethereal Minimalism */}
      <section className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] transition-all duration-300 p-6 sm:p-8">
        <div className="max-w-4xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight text-balance">
            {t.dictTitle}
          </h1>
          <p className="mt-2.5 text-base sm:text-lg text-stone-600 leading-relaxed">
            {t.dictSubtitle}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <label htmlFor="chinese-search-input" className="sr-only">
                {t.dictSearchLabel}
              </label>
              <Search className="w-5 h-5 text-stone-400 absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="chinese-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.dictSearchPlaceholder}
                className="w-full h-12 sm:h-14 pl-11 sm:pl-13 pr-4 sm:pr-6 text-base sm:text-xl bg-white/70 focus:bg-white rounded-2xl border border-white/90 shadow-inner text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/40 transition-all font-hanzi-sans"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto h-12 sm:h-14 inline-flex items-center justify-center gap-2 px-6 sm:px-7 min-h-[48px] text-base font-semibold bg-gradient-to-b from-stone-800 to-stone-950 text-white rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-[#C83E31]" />
                  <span>{t.dictAnalyzingBtn}</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>{t.dictAnalyzeBtn}</span>
                </>
              )}
            </button>
          </form>

          {errorMessage && (
            <p role="alert" className="mt-3 text-sm font-medium text-[#C83E31]">
              {errorMessage}
            </p>
          )}
        </div>
      </section>

      {/* Чистое пустое состояние (Empty State) с иллюстрацией панды */}
      {!currentWord ? (
        <section
          aria-label={t.dictEmptyAria}
          data-testid="dictionary-empty-state"
          className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] transition-all duration-300 p-8 sm:p-16 text-center"
        >
          <div className="max-w-lg mx-auto flex flex-col items-center">
            <img
              src="/assets/aistudio/panda_logo_9b02a05f.png"
              alt="MoShui 墨水"
              data-testid="dictionary-empty-logo"
              className="h-[97px] w-[97px] sm:h-[116px] sm:w-[116px] object-contain rounded-full mix-blend-multiply opacity-85 mb-4 sm:mb-5"
            />
            <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900">
              {t.dictEmptyTitle}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-stone-600 leading-relaxed">
              {t.dictEmptySubtitle}
            </p>
          </div>
        </section>
      ) : (
        /* Карточка результата: Шапка всего слова */
        <section
          aria-label={`${t.dictWordSectionAria} ${currentWord.word}`}
          className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] transition-all duration-300 overflow-hidden"
        >
          <div className="p-5 sm:p-8 border-b border-stone-200/60 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              {/* Крупное отображение слова в стиле каллиграфического свитка */}
              <div className="inline-flex items-center justify-center px-5 py-4 sm:px-6 sm:py-5 bg-white/80 border border-white rounded-2xl shrink-0 self-start sm:self-auto shadow-inner ring-1 ring-stone-900/5">
                <span
                  className="font-chinese text-4xl sm:text-6xl font-bold tracking-wider text-stone-900 select-all"
                  data-testid="word-header-hanzi"
                >
                  {currentWord.word}
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5">
                  <span
                    className="text-xl sm:text-3xl font-semibold text-[#C83E31] font-mono-tabular"
                    data-testid="word-header-pinyin"
                  >
                    {currentWord.pinyin}
                  </span>
                  <button
                    type="button"
                    onClick={() => speakChinese(currentWord.word)}
                    aria-label={`${t.dictSpeakWordAria} ${currentWord.word}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs sm:text-sm font-semibold text-[#C83E31] bg-white/80 hover:bg-white border border-white rounded-2xl shadow-xs hover:shadow-md transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#C83E31]" />
                    <span>{t.dictListenBtn}</span>
                  </button>
                </div>

                <p
                  className="mt-1.5 sm:mt-2.5 text-lg sm:text-2xl font-semibold text-stone-900"
                  data-testid="word-header-translation"
                >
                  {currentWord.translation}
                </p>

                {/* Метаданные слова */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-stone-500 font-mono-tabular">
                  <span>
                    {t.dictMetaChars}: {currentWord.characters.length}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t.dictMetaStrokes}:{' '}
                    {currentWord.characters.reduce((acc, ch) => acc + (ch.strokeCount || 0), 0)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t.dictMetaExamples}: {currentWord.examples.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Действия со словом: добавление в пропись и переход к печати */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3.5 shrink-0 w-full lg:w-auto">
              <button
                type="button"
                data-testid="add-to-worksheet-button"
                onClick={() => {
                  const normalized = normalizeWordItem(currentWord, currentWord.word, lang);
                  const fullWordItem: WordItem = {
                    ...normalized,
                    id: currentWord.id || normalized.id,
                    word: currentWord.word || normalized.word,
                    pinyin: currentWord.pinyin || normalized.pinyin,
                    translation:
                      currentWord.translation && !isPlaceholderTranslation(currentWord.translation)
                        ? currentWord.translation
                        : normalized.translation,
                    characters:
                      currentWord.characters && currentWord.characters.length > 0
                        ? currentWord.characters.map((chObj, idx) => ({
                            ...chObj,
                            meaning:
                              chObj.meaning && !isPlaceholderTranslation(chObj.meaning)
                                ? chObj.meaning
                                : normalized.characters[idx]?.meaning || chObj.meaning,
                          }))
                        : normalized.characters,
                  };
                  onAddToWorksheet(fullWordItem);
                }}
                disabled={isAlreadyInWorksheet}
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-6 h-12 min-h-[48px] text-sm sm:text-base font-semibold rounded-2xl transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  isAlreadyInWorksheet
                    ? 'bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 cursor-default shadow-2xs'
                    : 'bg-gradient-to-b from-stone-800 to-stone-950 text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0'
                }`}
              >
                {isAlreadyInWorksheet ? (
                  <>
                    <Check className="w-5 h-5 text-emerald-700" />
                    <span>{t.dictAddedBtn}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>{t.dictAddBtn}</span>
                  </>
                )}
              </button>

              {isAlreadyInWorksheet && (
                <button
                  type="button"
                  onClick={onNavigateToWorksheet}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:px-5 h-12 min-h-[48px] text-sm font-semibold bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md transition-all whitespace-nowrap cursor-pointer"
                >
                  <span>{t.dictOpenWorksheetBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Переключатель иероглифов для многосложных слов (сегментированный переключатель в стиле visionOS) */}
          {currentWord.characters.length > 1 && (
            <div className="px-4 sm:px-8 py-3.5 sm:py-4 bg-white/40 border-b border-stone-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-stone-600 shrink-0">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-[#C83E31]" />
                <span>
                  {t.dictCharBreakdownLabel} «
                  <span className="font-chinese font-bold text-stone-900">{currentWord.word}</span>
                  »:
                </span>
              </div>

              <div
                role="tablist"
                aria-label={t.dictCharsInWordAria}
                className="flex items-center gap-1.5 bg-stone-200/50 p-1 rounded-2xl backdrop-blur-md overflow-x-auto whitespace-nowrap no-scrollbar w-full sm:w-auto"
              >
                {currentWord.characters.map((charObj, idx) => {
                  const isSelected = idx === selectedCharIndex;
                  return (
                    <button
                      key={`${charObj.char}-${idx}`}
                      role="tab"
                      type="button"
                      aria-selected={isSelected}
                      onClick={() => setSelectedCharIndex(idx)}
                      className={`inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl text-sm sm:text-base transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-white shadow-sm text-stone-900 font-medium'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
                      }`}
                    >
                      <span className="font-mono-tabular text-xs sm:text-sm opacity-70">
                        {idx + 1}.
                      </span>
                      <span className="font-chinese text-base sm:text-lg font-bold">
                        {charObj.char}
                      </span>
                      <span className="text-xs sm:text-sm opacity-85">({charObj.pinyin})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Основная 2-зонная рабочая область посимвольного разбора */}
          {activeChar && (
            <div className="p-4 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
              {/* Левая колонка: Настольный планшет каллиграфа с HanziWriter */}
              <div className="md:col-span-5 bg-white/55 backdrop-blur-xl border border-white/80 rounded-3xl p-5 sm:p-6 flex flex-col items-center shadow-xs ring-1 ring-stone-900/[0.03]">
                <div className="w-full flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      {t.dictTrainerLabel}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-chinese text-2xl font-bold text-stone-900">
                        {activeChar.char}
                      </span>
                      <span className="text-base font-mono-tabular text-[#C83E31] font-semibold">
                        {activeChar.pinyin}
                      </span>
                      <button
                        type="button"
                        onClick={() => speakChinese(activeChar.char)}
                        aria-label={`${t.dictSpeakCharAria} ${activeChar.char}`}
                        className="p-1.5 text-stone-600 hover:text-[#C83E31] hover:bg-white/80 rounded-xl transition-colors cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-white/80 border border-white rounded-xl text-xs font-mono-tabular font-semibold text-stone-600 shadow-2xs">
                    {t.dictMetaStrokes}: {activeChar.strokeCount}
                  </span>
                </div>

                <HanziCanvas char={activeChar.char} size={240} />
              </div>

              {/* Правая колонка: Структурная декомпозиция, печати-штампы ключей, мнемоника и примеры */}
              <div className="md:col-span-7 space-y-6">
                {/* Значение и традиционная печать иероглифического ключа */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-stone-200/60">
                  <div>
                    <div className="text-sm font-medium text-stone-500">
                      {t.dictCharMeaningLabel} «
                      <span className="font-chinese font-bold text-stone-900">
                        {activeChar.char}
                      </span>
                      »
                    </div>
                    <div className="mt-2 text-lg font-semibold text-stone-900">
                      {activeChar.meaning}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-stone-500">
                      {t.dictRadicalStampLabel}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-3 px-3.5 py-2 border border-[#C83E31]/30 bg-white/80 rounded-2xl shadow-2xs">
                      <span className="font-chinese text-lg font-bold text-[#C83E31]">
                        {activeChar.radical}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Составные графемы и компоненты */}
                <div className="pb-6 border-b border-stone-200/60">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2.5">
                      <BookOpen className="w-5 h-5 text-[#C83E31]" />
                      <span>{t.dictStructuralTitle}</span>
                    </h2>
                    <span className="text-xs px-2.5 py-1 rounded-xl bg-white/80 text-[#C83E31] border border-white font-mono-tabular font-semibold shadow-2xs">
                      {t.dictElementsCount}: {activeChar.graphemes.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeChar.graphemes.map((g, gIdx) => (
                      <div
                        key={`${g.char}-${gIdx}`}
                        className="flex items-center justify-between p-4 bg-white/70 border border-white/90 rounded-2xl shadow-2xs hover:bg-white transition-all"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="w-12 h-12 flex items-center justify-center border border-[#C83E31]/30 bg-[#FDF2F0]/60 rounded-xl font-chinese text-2xl font-bold text-[#C83E31] shrink-0 shadow-2xs">
                            {g.char}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm text-stone-500">
                              <span className="font-semibold text-stone-900 font-mono-tabular">
                                {g.pinyin}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#C83E31] font-medium">
                                {g.type === 'radical' ? t.dictTypeRadical : t.dictTypeComponent}
                              </span>
                            </div>
                            <div className="text-base font-medium text-stone-900 truncate">
                              {g.meaning}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => speakChinese(g.char)}
                          aria-label={`${t.dictSpeakGraphemeAria} ${g.char}`}
                          className="p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center text-stone-600 hover:text-[#C83E31] hover:bg-stone-100/80 rounded-xl transition-colors shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Этимология и мнемоника */}
                <div className="pb-6 border-b border-stone-200/60">
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2.5 mb-3">
                    <Lightbulb className="w-5 h-5 text-amber-600" />
                    <span>{t.dictEtymologyTitle}</span>
                  </h2>
                  <p className="text-base text-stone-800 leading-relaxed bg-white/70 border border-white/90 rounded-2xl p-5 shadow-2xs">
                    {activeChar.etymology}
                  </p>
                </div>

                {/* Примеры употребления слова в предложениях */}
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2.5 mb-4">
                    <MessageSquareQuote className="w-5 h-5 text-[#C83E31]" />
                    <span>
                      {t.dictExamplesTitle} «
                      <span className="font-chinese font-bold">{currentWord.word}</span>»
                    </span>
                  </h2>

                  <div className="space-y-4">
                    {currentWord.examples.map((ex, exIdx) => (
                      <div
                        key={exIdx}
                        className="p-5 bg-white/70 border border-white/90 rounded-2xl shadow-2xs flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="font-chinese text-lg font-semibold text-stone-900">
                            {ex.zh}
                          </div>
                          <div className="text-sm font-mono-tabular text-[#C83E31] font-medium">
                            {ex.pinyin}
                          </div>
                          <div className="text-base text-stone-600">{ex.ru}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => speakChinese(ex.zh)}
                          aria-label={`${t.dictSpeakExampleAria}: ${ex.zh}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[42px] text-sm font-medium bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md transition-all shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4 text-[#C83E31]" />
                          <span>{t.dictListenBtn}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Раздел «О проекте и контакты» (About & Support) — только на странице Словарь и Практика */}
      <section
        aria-label={t.aboutTitle}
        className="w-full bg-white/40 backdrop-blur-lg rounded-3xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.03)] print:hidden"
      >
        <div className="py-8 px-6 max-w-4xl mx-auto space-y-6">
          <div className="space-y-3 text-center sm:text-left">
            <h2 className="text-base sm:text-lg font-serif font-semibold text-stone-900 tracking-tight">
              {t.aboutTitle}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-2xl">
              {t.aboutDescription}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            {/* 1. Telegram-канал Лилии */}
            <div className="p-5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 flex flex-col justify-between gap-3 shadow-2xs">
              <span className="text-xs sm:text-sm font-medium text-stone-600">
                {t.authorChannelLabel}
              </span>
              <div>
                <a
                  href="https://t.me/lia_iakubova_chinese"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md text-xs sm:text-sm font-medium transition-all duration-200"
                >
                  <Send className="w-3.5 h-3.5 text-[#C83E31] shrink-0" />
                  <span>{t.authorChannelBtn}</span>
                  <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                </a>
              </div>
            </div>

            {/* 2. Почта технической поддержки */}
            <div className="p-5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 flex flex-col justify-between gap-3 shadow-2xs">
              <span className="text-xs sm:text-sm font-medium text-stone-600">
                {t.supportLabel}
              </span>
              <div>
                <a
                  href="mailto:dda-job@yandex.ru"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md text-xs sm:text-sm font-medium transition-all duration-200"
                >
                  <Mail className="w-3.5 h-3.5 text-[#C83E31] shrink-0" />
                  <span>dda-job@yandex.ru</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
