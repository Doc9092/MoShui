import React, { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Search, Volume2, BookOpen, Plus, Check, Filter } from 'lucide-react';
import type { RadicalItem, WordItem } from '../types/hanzi';
import { RADICALS_DATA } from '../utils/radicalsData';
import { speakChinese } from '../services/audioService';
import { normalizeWordItem } from '../utils/hanziUtils';
import { MOSHUI_LOGO_SRC } from './Navbar';
import { useLanguage } from '../context/LanguageContext';

interface RadicalsViewProps {
  worksheetList: WordItem[];
  onAddToWorksheet: (item: WordItem) => void;
  onPracticeRadical: (char: string) => void;
}

export const RadicalsView: React.FC<RadicalsViewProps> = ({
  worksheetList,
  onAddToWorksheet,
  onPracticeRadical,
}) => {
  const { lang, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [strokeFilter, setStrokeFilter] = useState<number | 'all' | '7+'>('all');
  const [selectedRadical, setSelectedRadical] = useState<RadicalItem>(RADICALS_DATA[8]);

  const strokeFilters: { id: number | 'all' | '7+'; label: string }[] = [
    { id: 'all', label: t.radFilterAll },
    { id: 1, label: t.radStroke1 },
    { id: 2, label: t.radStroke2 },
    { id: 3, label: t.radStroke3 },
    { id: 4, label: t.radStroke4 },
    { id: 5, label: t.radStroke5 },
    { id: 6, label: t.radStroke6 },
    { id: '7+', label: t.radStroke7Plus },
  ];

  const filteredRadicals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return RADICALS_DATA.filter((rad) => {
      if (strokeFilter !== 'all') {
        if (strokeFilter === '7+') {
          if (rad.strokes < 7) return false;
        } else if (rad.strokes !== strokeFilter) {
          return false;
        }
      }

      if (!q) return true;
      return (
        rad.char.includes(q) ||
        (rad.variant && rad.variant.includes(q)) ||
        rad.pinyin.toLowerCase().includes(q) ||
        rad.meaning.toLowerCase().includes(q) ||
        Boolean(rad.meaning_en && rad.meaning_en.toLowerCase().includes(q)) ||
        String(rad.number) === q
      );
    });
  }, [searchQuery, strokeFilter]);

  // Группировка по числу черт для наглядного отображения
  const groupedByStrokes = useMemo(() => {
    const map = new Map<number, RadicalItem[]>();
    for (const r of filteredRadicals) {
      const list = map.get(r.strokes) || [];
      list.push(r);
      map.set(r.strokes, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredRadicals]);

  const isRadicalInWorksheet = (char: string) =>
    worksheetList.some((w) => w.word === char);

  const handleAddRadicalToWorksheet = (rad: RadicalItem) => {
    if (isRadicalInWorksheet(rad.char)) return;
    const item = normalizeWordItem(null, rad.char, lang);
    onAddToWorksheet(item);
    toast.success(`${t.radAddedToastPrefix} «${rad.char}» ${t.radAddedToastSuffix}`);
  };

  const formatStrokeGroupTitle = (strokes: number) => {
    if (lang === 'en') {
      return `${strokes} ${strokes === 1 ? 'stroke' : 'strokes'}`;
    }
    const word = strokes === 1 ? 'черта' : strokes >= 2 && strokes <= 4 ? 'черты' : 'черт';
    return `${strokes} ${word}`;
  };

  return (
    <div className="space-y-8">
      {/* Шапка и фильтры справочника ключей в эстетике Spatial Glass */}
      <section className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] transition-all duration-300 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight text-balance">
              {t.radTitle}
            </h1>
            <p className="mt-2 text-base sm:text-lg text-stone-600 leading-relaxed">
              {t.radSubtitlePrefix} {RADICALS_DATA.length} {t.radSubtitleSuffix}
            </p>
          </div>

          {/* Поле мгновенного поиска */}
          <div className="relative w-full lg:w-96 shrink-0">
            <label htmlFor="radical-search-input" className="sr-only">
              {t.radSearchLabel}
            </label>
            <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="radical-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.radSearchPlaceholder}
              className="w-full h-12 pl-11 pr-4 py-3 text-base bg-white/70 focus:bg-white rounded-2xl border border-white/90 shadow-inner text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/40 transition-all"
            />
          </div>
        </div>

        {/* Фильтр по количеству черт в стиле visionOS */}
        <div className="flex items-center gap-2 pt-4 border-t border-stone-200/60 overflow-x-auto flex-nowrap no-scrollbar py-1">
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-stone-500 mr-1 shrink-0">
            <Filter className="w-4 h-4 text-[#C83E31]" />
            <span>{t.radFilterLabel}</span>
          </span>
          <div className="inline-flex items-center gap-1 bg-stone-200/50 p-1 rounded-2xl backdrop-blur-md">
            {strokeFilters.map((f) => {
              const isActive = strokeFilter === f.id;
              return (
                <button
                  key={String(f.id)}
                  type="button"
                  onClick={() => setStrokeFilter(f.id)}
                  className={`px-3.5 py-2 text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] ${
                    isActive
                      ? 'bg-white shadow-sm rounded-xl text-stone-900 font-medium'
                      : 'rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Карточка выбранного ключа с действиями */}
      {selectedRadical && (
        <section
          aria-label={`${t.radSelectedAria} ${selectedRadical.char}`}
          className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] transition-all duration-300 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Квадратный штамп-печать выбранного ключа */}
            <div className="w-24 h-24 bg-white/80 border border-white rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-inner ring-1 ring-[#C83E31]/30">
              <span className="font-chinese text-5xl font-bold text-stone-900">
                {selectedRadical.char}
              </span>
              {selectedRadical.variant && (
                <span className="text-sm font-chinese text-[#C83E31] font-semibold mt-0.5">
                  {t.radVariantPrefix} {selectedRadical.variant}
                </span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5 text-sm text-stone-500 font-mono-tabular">
                <span>
                  {t.radKangxiNumber}
                  {selectedRadical.number}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.radStrokesCount} {selectedRadical.strokes}
                </span>
                {selectedRadical.variant && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t.radInCharVariant}{' '}
                      <span className="font-chinese font-bold text-stone-900">
                        {selectedRadical.variant}
                      </span>
                    </span>
                  </>
                )}
              </div>

              <div className="mt-1.5 flex items-baseline gap-3.5">
                <h2 className="text-2xl font-bold text-stone-900">
                  {lang === 'en'
                    ? selectedRadical.meaning_en || selectedRadical.meaning
                    : selectedRadical.meaning}
                </h2>
                <span className="px-2.5 py-0.5 rounded-xl text-base font-mono-tabular font-semibold bg-white/80 text-[#C83E31] border border-white shadow-2xs">
                  [{selectedRadical.pinyin}]
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-sm text-stone-600">
                <span>{t.radExamplesLabel}</span>
                {selectedRadical.examples.map((exChar) => (
                  <button
                    key={exChar}
                    type="button"
                    onClick={() => onPracticeRadical(exChar)}
                    className="font-chinese text-base font-bold text-stone-900 hover:text-[#C83E31] underline decoration-stone-300 underline-offset-4 cursor-pointer px-1.5"
                  >
                    {exChar}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3 обязательные кнопки действий при выборе ключа */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => speakChinese(selectedRadical.char)}
              className="inline-flex items-center gap-2 px-4 py-3 h-12 min-h-[48px] text-sm sm:text-base font-semibold bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Volume2 className="w-5 h-5 text-[#C83E31]" />
              <span>{t.radSpeakBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => onPracticeRadical(selectedRadical.char)}
              className="inline-flex items-center gap-2 px-5 py-3 h-12 min-h-[48px] text-sm sm:text-base font-semibold bg-gradient-to-b from-stone-800 to-stone-950 text-white rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookOpen className="w-5 h-5" />
              <span>{t.radPracticeBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRadicalToWorksheet(selectedRadical)}
              disabled={isRadicalInWorksheet(selectedRadical.char)}
              className={`inline-flex items-center gap-2 px-5 py-3 h-12 min-h-[48px] text-sm sm:text-base font-semibold rounded-2xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                isRadicalInWorksheet(selectedRadical.char)
                  ? 'bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 shadow-2xs'
                  : 'bg-white/80 hover:bg-white text-[#C83E31] border border-white shadow-xs hover:shadow-md'
              }`}
            >
              {isRadicalInWorksheet(selectedRadical.char) ? (
                <>
                  <Check className="w-5 h-5 text-emerald-700" />
                  <span>{t.radInWorksheetBtn}</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>{t.radAddToWorksheetBtn}</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* Сетка ключей, сгруппированная по числу черт */}
      {groupedByStrokes.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] p-12 text-center flex flex-col items-center">
          <img
            src={MOSHUI_LOGO_SRC}
            alt="MoShui 墨水"
            className="h-20 w-20 object-contain rounded-full mix-blend-multiply opacity-85 mb-4"
          />
          <p className="text-base text-stone-600">
            {t.radNotFoundPrefix} «{searchQuery}» {t.radNotFoundSuffix}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByStrokes.map(([strokes, items]) => (
            <section
              key={strokes}
              className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-stone-900/[0.04] transition-all duration-300 p-6 sm:p-7 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-stone-200/60 pb-3.5">
                <h3 className="font-display text-lg sm:text-xl font-bold text-stone-900">
                  {formatStrokeGroupTitle(strokes)}
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-xl bg-white/80 text-[#C83E31] border border-white font-mono-tabular font-semibold shadow-2xs">
                  {t.radGroupCount} {items.length}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 sm:gap-3.5">
                {items.map((rad) => {
                  const isSelected = selectedRadical?.number === rad.number;
                  const inSheet = isRadicalInWorksheet(rad.char);

                  return (
                    <div
                      key={rad.number}
                      onClick={() => setSelectedRadical(rad)}
                      className={`p-3 sm:p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer hover:-translate-y-0.5 ${
                        isSelected
                          ? 'bg-white border-stone-900/20 ring-2 ring-[#C83E31]/50 shadow-md'
                          : 'bg-white/65 border-white/80 hover:bg-white shadow-2xs hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono-tabular text-[11px] sm:text-xs text-stone-500">
                          №{rad.number}
                        </span>
                        {rad.variant && (
                          <span className="font-chinese text-xs font-semibold text-[#C83E31] px-1.5 py-0.5 rounded-lg bg-[#FDF2F0]/80 border border-[#F5D0C8]/70">
                            {rad.variant}
                          </span>
                        )}
                      </div>

                      <div className="py-1 flex flex-col items-center text-center min-w-0">
                        <span className="font-chinese text-3xl sm:text-4xl font-bold text-stone-900 leading-tight">
                          {rad.char}
                        </span>
                        <div className="mt-1.5 text-xs sm:text-sm font-mono-tabular font-semibold text-[#C83E31] truncate w-full">
                          {rad.pinyin}
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-stone-800 truncate w-full">
                          {lang === 'en' ? rad.meaning_en || rad.meaning : rad.meaning}
                        </div>
                      </div>

                      <div
                        className="pt-2 border-t border-stone-200/60 flex items-center justify-between gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => speakChinese(rad.char)}
                          aria-label={`${t.radSpeakBtn} ${rad.char}`}
                          className="p-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 rounded-lg transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPracticeRadical(rad.char)}
                          title={t.radCardPracticeTitle}
                          className="p-1.5 text-xs font-semibold text-stone-900 hover:text-[#C83E31] hover:bg-[#FDF2F0]/70 rounded-lg transition-colors cursor-pointer truncate"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-[#C83E31] sm:hidden" />
                          <span className="hidden sm:inline">{t.radCardAnalyzeBtn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRadicalToWorksheet(rad)}
                          disabled={inSheet}
                          aria-label={inSheet ? t.radCardAlreadyAria : t.radCardAddAria}
                          className={`p-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
                            inSheet
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-[#C83E31] hover:bg-[#FDF2F0]/80'
                          }`}
                        >
                          {inSheet ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
