import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import type { WordItem, CharDetail } from '../types/hanzi';
import { normalizeWordItem, isPlaceholderTranslation } from '../utils/hanziUtils';
import { analyzeChineseInput } from '../services/geminiService';
import { speakChinese } from '../services/audioService';
import { HanziCanvas } from './HanziCanvas';
import { MOSHUI_LOGO_SRC } from './Navbar';

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCharIndex, setSelectedCharIndex] = useState<number>(0);

  // Reset selected character tab when the analyzed word changes
  useEffect(() => {
    setSelectedCharIndex(0);
  }, [currentWord?.word]);

  const isAlreadyInWorksheet = currentWord
    ? worksheetList.some((item) => item.word === currentWord.word)
    : false;

  const handleAnalyze = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setErrorMessage('Введите китайское слово или иероглиф для разбора.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      const analyzed = await analyzeChineseInput(trimmed);
      onWordChange(analyzed);
      setSearchQuery(analyzed.word);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Не удалось разобрать введенное слово.'
      );
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
      {/* Секция поиска (крупная и приметная поисковая строка) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs">
        <div className="max-w-4xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
            Интерактивный разбор слов и практика каллиграфии
          </h1>
          <p className="mt-2.5 text-base sm:text-lg text-slate-600 leading-relaxed">
            Введите одиночный иероглиф или многосложное слово (от 1 до 4+ знаков), чтобы получить
            структурную декомпозицию по ключам и графемам, порядок черт и тренажер письма.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <label htmlFor="chinese-search-input" className="sr-only">
                Введите иероглиф или слово на китайском
              </label>
              <Search className="w-5 h-5 text-slate-400 absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="chinese-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Введите иероглиф или слово на китайском..."
                className="w-full pl-11 sm:pl-13 pr-4 sm:pr-6 py-3.5 sm:py-4 text-base sm:text-xl bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 transition-all font-hanzi-sans"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 sm:py-4 min-h-[48px] text-base font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Анализ ИИ...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Разобрать слово</span>
                </>
              )}
            </button>
          </form>

          {errorMessage && (
            <p role="alert" className="mt-3 text-sm font-medium text-rose-600">
              {errorMessage}
            </p>
          )}
        </div>
      </section>

      {/* Чистое пустое состояние (Empty State) с приглушенным логотипом MoShui высотой 96px */}
      {!currentWord ? (
        <section
          aria-label="Пустое состояние словаря"
          data-testid="dictionary-empty-state"
          className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-16 text-center shadow-2xs"
        >
          <div className="max-w-lg mx-auto flex flex-col items-center">
            <img
              src={MOSHUI_LOGO_SRC}
              alt="MoShui 墨水"
              data-testid="dictionary-empty-logo"
              className="h-20 w-20 sm:h-24 sm:w-24 object-contain rounded-2xl opacity-75 mb-4 sm:mb-5 border border-slate-200/70 bg-[#FAF9F6] p-1.5"
            />
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              Готово к разбору иероглифов и слов
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
              Введите любой иероглиф или многосложное слово в строку поиска выше, чтобы получить
              разбор графем, прослушать произношение и потренировать порядок черт.
            </p>
          </div>
        </section>
      ) : (
        /* Карточка результата: Шапка всего слова */
        <section
          aria-label={`Разбор слова ${currentWord.word}`}
          className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs"
        >
          <div className="p-4 sm:p-8 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              {/* Крупное отображение слова */}
              <div className="inline-flex items-center justify-center px-5 py-4 sm:px-6 sm:py-5 bg-slate-50 border border-slate-200/80 rounded-2xl shrink-0 self-start sm:self-auto">
                <span
                  className="font-chinese text-4xl sm:text-6xl font-bold tracking-wider text-slate-900 select-all"
                  data-testid="word-header-hanzi"
                >
                  {currentWord.word}
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5">
                  <span
                    className="text-xl sm:text-3xl font-semibold text-rose-700 font-mono-tabular"
                    data-testid="word-header-pinyin"
                  >
                    {currentWord.pinyin}
                  </span>
                  <button
                    type="button"
                    onClick={() => speakChinese(currentWord.word)}
                    aria-label={`Озвучить слово ${currentWord.word}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
                    <span>Слушать</span>
                  </button>
                </div>

                <p
                  className="mt-1.5 sm:mt-2.5 text-lg sm:text-2xl font-semibold text-slate-900"
                  data-testid="word-header-translation"
                >
                  {currentWord.translation}
                </p>

                {/* Метаданные слова */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 font-mono-tabular">
                  <span>Знаков: {currentWord.characters.length}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Черт:{' '}
                    {currentWord.characters.reduce((acc, ch) => acc + (ch.strokeCount || 0), 0)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Примеров: {currentWord.examples.length}</span>
                </div>
              </div>
            </div>

            {/* Действия со словом: добавление в пропись и переход к печати */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3.5 shrink-0 w-full lg:w-auto">
              <button
                type="button"
                data-testid="add-to-worksheet-button"
                onClick={() => {
                  const normalized = normalizeWordItem(currentWord, currentWord.word);
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
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-6 sm:py-3.5 text-sm sm:text-base font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  isAlreadyInWorksheet
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                    : 'bg-rose-600 text-white hover:bg-rose-700 shadow-2xs'
                }`}
              >
                {isAlreadyInWorksheet ? (
                  <>
                    <Check className="w-5 h-5 text-emerald-600" />
                    <span>Добавлено в пропись</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>+ Добавить в пропись</span>
                  </>
                )}
              </button>

              {isAlreadyInWorksheet && (
                <button
                  type="button"
                  onClick={onNavigateToWorksheet}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:px-5 sm:py-3.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>Открыть пропись</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Переключатель иероглифов для многосложных слов с горизонтальной прокруткой */}
          {currentWord.characters.length > 1 && (
            <div className="px-4 sm:px-8 py-3 sm:py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 shrink-0">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                <span>Посимвольный разбор слова «<span className="font-chinese font-bold text-slate-900">{currentWord.word}</span>»:</span>
              </div>

              <div
                role="tablist"
                aria-label="Иероглифы в составе слова"
                className="flex items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar py-1 w-full sm:w-auto"
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
                      className={`inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-sm sm:text-base font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-mono-tabular text-xs sm:text-sm opacity-70">{idx + 1}.</span>
                      <span className="font-chinese text-base sm:text-lg font-bold">{charObj.char}</span>
                      <span className="text-xs sm:text-sm opacity-85">({charObj.pinyin})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Основная 2-зонная рабочая область посимвольного разбора */}
          {activeChar && (
            <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
              {/* Левая колонка: Интерактивный HanziCanvas и озвучка отдельного знака */}
              <div className="lg:col-span-5 flex flex-col items-center p-4 sm:p-6 bg-slate-50/70 border border-slate-200/80 rounded-2xl w-full">
                <div className="w-full flex items-center justify-between mb-5 pb-4 border-b border-slate-200/80">
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="font-chinese text-4xl font-bold text-slate-900">
                        {activeChar.char}
                      </span>
                      <span className="text-lg font-semibold text-rose-700 font-mono-tabular">
                        {activeChar.pinyin}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500 font-mono-tabular">
                      <span>Тон: {activeChar.tone}-й</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>Черт: {activeChar.strokeCount}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => speakChinese(activeChar.char)}
                    aria-label={`Озвучить иероглиф ${activeChar.char}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 text-rose-600" />
                    <span>Слушать знак</span>
                  </button>
                </div>

                <HanziCanvas char={activeChar.char} size={240} />
              </div>

              {/* Правая колонка: Структурная декомпозиция, мнемоника и примеры */}
              <div className="lg:col-span-7 space-y-6">
                {/* Значение и ключ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
                  <div>
                    <div className="text-sm font-medium text-slate-500">
                      Значение иероглифа «<span className="font-chinese font-bold text-slate-900">{activeChar.char}</span>»
                    </div>
                    <div className="mt-1.5 text-lg font-semibold text-slate-900">
                      {activeChar.meaning}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-slate-500">Иероглифический ключ</div>
                    <div className="mt-1.5 text-lg font-semibold text-slate-900 font-hanzi-sans">
                      {activeChar.radical}
                    </div>
                  </div>
                </div>

                {/* Составные графемы и компоненты */}
                <div className="pb-6 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2.5">
                      <BookOpen className="w-5 h-5 text-rose-600" />
                      <span>Структурная декомпозиция (графемы и ключи)</span>
                    </h2>
                    <span className="text-sm text-slate-500 font-mono-tabular">
                      Элементов: {activeChar.graphemes.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeChar.graphemes.map((g, gIdx) => (
                      <div
                        key={`${g.char}-${gIdx}`}
                        className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-xl"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl font-chinese text-2xl font-bold text-slate-900 shrink-0">
                            {g.char}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <span className="font-semibold text-slate-800 font-mono-tabular">
                                {g.pinyin}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-rose-700 font-medium">
                                {g.type === 'radical' ? 'ключ' : 'компонент'}
                              </span>
                            </div>
                            <div className="text-base font-medium text-slate-900 truncate">
                              {g.meaning}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => speakChinese(g.char)}
                          aria-label={`Озвучить графему ${g.char}`}
                          className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Этимология и мнемоника */}
                <div className="pb-6 border-b border-slate-200">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2.5 mb-3">
                    <Lightbulb className="w-5 h-5 text-amber-600" />
                    <span>Этимология и мнемоника для запоминания</span>
                  </h2>
                  <p className="text-base text-slate-700 leading-relaxed bg-amber-50/50 border border-amber-200/70 rounded-xl p-5">
                    {activeChar.etymology}
                  </p>
                </div>

                {/* Примеры употребления слова в предложениях */}
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2.5 mb-4">
                    <MessageSquareQuote className="w-5 h-5 text-rose-600" />
                    <span>Примеры употребления со словом «{currentWord.word}»</span>
                  </h2>

                  <div className="space-y-4">
                    {currentWord.examples.map((ex, exIdx) => (
                      <div
                        key={exIdx}
                        className="p-5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="font-chinese text-lg font-semibold text-slate-900">
                            {ex.zh}
                          </div>
                          <div className="text-sm font-mono-tabular text-rose-700">{ex.pinyin}</div>
                          <div className="text-base text-slate-700">{ex.ru}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => speakChinese(ex.zh)}
                          aria-label={`Озвучить пример: ${ex.zh}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4 text-rose-600" />
                          <span>Слушать</span>
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
    </div>
  );
};
