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
import {
  normalizeWordItem,
  isPlaceholderTranslation,
} from '../utils/hanziUtils';
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
      {/* Секция поиска в эстетике Warm Oriental Minimalism */}
      <section className="bg-white rounded-2xl border border-[#EAE3D5] shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] transition-all duration-300 p-6 sm:p-8">
        <div className="max-w-4xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#18181B] tracking-tight text-balance">
            Интерактивный разбор слов и практика каллиграфии
          </h1>
          <p className="mt-2.5 text-base sm:text-lg text-[#52525B] leading-relaxed">
            Введите одиночный иероглиф или многосложное слово (от 1 до 4+ знаков), чтобы получить
            структурную декомпозицию по ключам и графемам, порядок черт и тренажер письма.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <label htmlFor="chinese-search-input" className="sr-only">
                Введите иероглиф или слово на китайском
              </label>
              <Search className="w-5 h-5 text-[#71717A] absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="chinese-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Введите иероглиф или слово на китайском..."
                className="w-full h-12 sm:h-14 pl-11 sm:pl-13 pr-4 sm:pr-6 text-base sm:text-xl bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] focus:ring-2 focus:ring-[#C83E31]/15 transition-all font-hanzi-sans"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto h-12 sm:h-14 inline-flex items-center justify-center gap-2 px-6 sm:px-7 min-h-[48px] text-base font-semibold text-white bg-[#18181B] hover:bg-[#27272A] active:scale-[0.98] rounded-xl disabled:opacity-60 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-[#C83E31]" />
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
            <p role="alert" className="mt-3 text-sm font-medium text-[#C83E31]">
              {errorMessage}
            </p>
          )}
        </div>
      </section>

      {/* Чистое пустое состояние (Empty State) с логотипом MoShui */}
      {!currentWord ? (
        <section
          aria-label="Пустое состояние словаря"
          data-testid="dictionary-empty-state"
          className="bg-white rounded-2xl border border-[#EAE3D5] shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] transition-all duration-300 p-8 sm:p-16 text-center"
        >
          <div className="max-w-lg mx-auto flex flex-col items-center">
            <img
              src={MOSHUI_LOGO_SRC}
              alt="MoShui 墨水"
              data-testid="dictionary-empty-logo"
              className="h-20 w-20 sm:h-24 sm:w-24 object-contain rounded-full mix-blend-multiply opacity-85 mb-4 sm:mb-5"
            />
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#18181B]">
              Готово к разбору иероглифов и слов
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[#52525B] leading-relaxed">
              Введите любой иероглиф или многосложное слово в строку поиска выше, чтобы получить
              разбор графем, прослушать произношение и потренировать порядок черт.
            </p>
          </div>
        </section>
      ) : (
        /* Карточка результата: Шапка всего слова */
        <section
          aria-label={`Разбор слова ${currentWord.word}`}
          className="bg-white rounded-2xl border border-[#EAE3D5] shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] transition-all duration-300 overflow-hidden"
        >
          <div className="p-5 sm:p-8 border-b border-[#EAE3D5] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              {/* Крупное отображение слова в стиле каллиграфического свитка */}
              <div className="inline-flex items-center justify-center px-5 py-4 sm:px-6 sm:py-5 bg-[#FAF7F2] border-2 border-[#D6CEB8] rounded-2xl shrink-0 self-start sm:self-auto shadow-inner">
                <span
                  className="font-chinese text-4xl sm:text-6xl font-bold tracking-wider text-[#18181B] select-all"
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
                    aria-label={`Озвучить слово ${currentWord.word}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs sm:text-sm font-semibold text-[#C83E31] bg-[#FDF2F0] border border-[#F5D0C8] hover:bg-[#F5D0C8]/50 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#C83E31]" />
                    <span>Слушать</span>
                  </button>
                </div>

                <p
                  className="mt-1.5 sm:mt-2.5 text-lg sm:text-2xl font-semibold text-[#18181B]"
                  data-testid="word-header-translation"
                >
                  {currentWord.translation}
                </p>

                {/* Метаданные слова */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#71717A] font-mono-tabular">
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
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-6 h-12 min-h-[48px] text-sm sm:text-base font-semibold rounded-xl transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer ${
                  isAlreadyInWorksheet
                    ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] cursor-default'
                    : 'bg-[#C83E31] text-white hover:bg-[#B03226] shadow-sm'
                }`}
              >
                {isAlreadyInWorksheet ? (
                  <>
                    <Check className="w-5 h-5 text-[#15803D]" />
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
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:px-5 h-12 min-h-[48px] text-sm font-semibold text-[#18181B] bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl hover:bg-[#EAE3D5]/50 transition-all whitespace-nowrap cursor-pointer"
                >
                  <span>Открыть пропись</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Переключатель иероглифов для многосложных слов с горизонтальной прокруткой */}
          {currentWord.characters.length > 1 && (
            <div className="px-4 sm:px-8 py-3.5 sm:py-4 bg-[#FAF7F2] border-b border-[#EAE3D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#52525B] shrink-0">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-[#C83E31]" />
                <span>
                  Посимвольный разбор слова «
                  <span className="font-chinese font-bold text-[#18181B]">{currentWord.word}</span>
                  »:
                </span>
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
                      className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm sm:text-base font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-[#18181B] text-[#FAF7F2] shadow-md'
                          : 'bg-white text-[#18181B] border border-[#EAE3D5] hover:border-[#C83E31]/50'
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

          {/* Основная 2-зонная рабочая область посимвольного разбора (на планшетах md:grid-cols-12) */}
          {activeChar && (
            <div className="p-4 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
              {/* Левая колонка: Настольный планшет каллиграфа с HanziWriter */}
              <div className="md:col-span-5 bg-[#FAF7F2] border border-[#EAE3D5] rounded-2xl p-5 sm:p-6 flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#71717A]">
                      Тренажер каллиграфии
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-chinese text-2xl font-bold text-[#18181B]">
                        {activeChar.char}
                      </span>
                      <span className="text-base font-mono-tabular text-[#C83E31] font-semibold">
                        {activeChar.pinyin}
                      </span>
                      <button
                        type="button"
                        onClick={() => speakChinese(activeChar.char)}
                        aria-label={`Озвучить иероглиф ${activeChar.char}`}
                        className="p-1.5 text-[#52525B] hover:text-[#C83E31] hover:bg-[#FDF2F0] rounded-lg transition-colors cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-white border border-[#EAE3D5] rounded-lg text-xs font-mono-tabular font-semibold text-[#52525B]">
                    Черт: {activeChar.strokeCount}
                  </span>
                </div>

                <HanziCanvas char={activeChar.char} size={240} />
              </div>

              {/* Правая колонка: Структурная декомпозиция, печати-штампы ключей, мнемоника и примеры */}
              <div className="md:col-span-7 space-y-6">
                {/* Значение и традиционная печать иероглифического ключа */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-[#EAE3D5]">
                  <div>
                    <div className="text-sm font-medium text-[#71717A]">
                      Значение иероглифа «
                      <span className="font-chinese font-bold text-[#18181B]">
                        {activeChar.char}
                      </span>
                      »
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[#18181B]">
                      {activeChar.meaning}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-[#71717A]">
                      Ключ (Радикал) — традиционная печать
                    </div>
                    <div className="mt-2 inline-flex items-center gap-3 px-3.5 py-2 border border-[#C83E31]/40 bg-[#FDF2F0]/50 rounded-lg">
                      <span className="font-chinese text-lg font-bold text-[#C83E31]">
                        {activeChar.radical}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Составные графемы и компоненты в виде традиционных квадратных печатей */}
                <div className="pb-6 border-b border-[#EAE3D5]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base sm:text-lg font-bold text-[#18181B] flex items-center gap-2.5">
                      <BookOpen className="w-5 h-5 text-[#C83E31]" />
                      <span>Структурная декомпозиция (графемы и ключи)</span>
                    </h2>
                    <span className="text-xs px-2.5 py-1 rounded-md bg-[#FDF2F0] text-[#C83E31] border border-[#F5D0C8] font-mono-tabular font-semibold">
                      Элементов: {activeChar.graphemes.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeChar.graphemes.map((g, gIdx) => (
                      <div
                        key={`${g.char}-${gIdx}`}
                        className="flex items-center justify-between p-4 bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl hover:border-[#C83E31]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Традиционный квадратный штамп-печать для графемы */}
                          <span className="w-12 h-12 flex items-center justify-center border border-[#C83E31]/40 bg-[#FDF2F0]/50 rounded-lg font-chinese text-2xl font-bold text-[#C83E31] shrink-0 shadow-2xs">
                            {g.char}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm text-[#71717A]">
                              <span className="font-semibold text-[#18181B] font-mono-tabular">
                                {g.pinyin}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#C83E31] font-medium">
                                {g.type === 'radical' ? 'ключ' : 'компонент'}
                              </span>
                            </div>
                            <div className="text-base font-medium text-[#18181B] truncate">
                              {g.meaning}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => speakChinese(g.char)}
                          aria-label={`Озвучить графему ${g.char}`}
                          className="p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#52525B] hover:text-[#C83E31] hover:bg-[#FDF2F0] rounded-xl transition-colors shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Этимология и мнемоника */}
                <div className="pb-6 border-b border-[#EAE3D5]">
                  <h2 className="text-base sm:text-lg font-bold text-[#18181B] flex items-center gap-2.5 mb-3">
                    <Lightbulb className="w-5 h-5 text-amber-600" />
                    <span>Этимология и мнемоника для запоминания</span>
                  </h2>
                  <p className="text-base text-[#18181B] leading-relaxed bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl p-5">
                    {activeChar.etymology}
                  </p>
                </div>

                {/* Примеры употребления слова в предложениях */}
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#18181B] flex items-center gap-2.5 mb-4">
                    <MessageSquareQuote className="w-5 h-5 text-[#C83E31]" />
                    <span>
                      Примеры употребления со словом «
                      <span className="font-chinese font-bold">{currentWord.word}</span>»
                    </span>
                  </h2>

                  <div className="space-y-4">
                    {currentWord.examples.map((ex, exIdx) => (
                      <div
                        key={exIdx}
                        className="p-5 bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="font-chinese text-lg font-semibold text-[#18181B]">
                            {ex.zh}
                          </div>
                          <div className="text-sm font-mono-tabular text-[#C83E31] font-medium">
                            {ex.pinyin}
                          </div>
                          <div className="text-base text-[#52525B]">{ex.ru}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => speakChinese(ex.zh)}
                          aria-label={`Озвучить пример: ${ex.zh}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[42px] text-sm font-medium text-[#18181B] bg-white border border-[#EAE3D5] rounded-xl hover:bg-[#FDF2F0] hover:border-[#F5D0C8] transition-colors shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4 text-[#C83E31]" />
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
