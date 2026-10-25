import React, { useState, useMemo } from 'react';
import { Search, Volume2, BookOpen, Plus, Check, Filter } from 'lucide-react';
import type { RadicalItem, WordItem } from '../types/hanzi';
import { RADICALS_DATA } from '../utils/radicalsData';
import { speakChinese } from '../services/audioService';
import { normalizeWordItem } from '../utils/hanziUtils';
import { MOSHUI_LOGO_SRC } from './Navbar';

interface RadicalsViewProps {
  worksheetList: WordItem[];
  onAddToWorksheet: (item: WordItem) => void;
  onPracticeRadical: (char: string) => void;
}

const STROKE_FILTERS: { id: number | 'all' | '7+'; label: string }[] = [
  { id: 'all', label: 'Все ключи' },
  { id: 1, label: '1 черта' },
  { id: 2, label: '2 черты' },
  { id: 3, label: '3 черты' },
  { id: 4, label: '4 черты' },
  { id: 5, label: '5 черт' },
  { id: 6, label: '6 черт' },
  { id: '7+', label: '7+ черт' },
];

export const RadicalsView: React.FC<RadicalsViewProps> = ({
  worksheetList,
  onAddToWorksheet,
  onPracticeRadical,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [strokeFilter, setStrokeFilter] = useState<number | 'all' | '7+'>('all');
  const [selectedRadical, setSelectedRadical] = useState<RadicalItem>(RADICALS_DATA[8]); // По умолчанию: 人 (человек)

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
    const item = normalizeWordItem(null, rad.char);
    onAddToWorksheet(item);
  };

  return (
    <div className="space-y-8">
      {/* Шапка и фильтры справочника ключей */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
              Интерактивная таблица иероглифических ключей Канси
            </h1>
            <p className="mt-2 text-base sm:text-lg text-slate-600 leading-relaxed">
              Справочник {RADICALS_DATA.length} самых частотных радикалов китайского языка,
              сгруппированных по числу черт, с вариантами бокового написания и мгновенной тренировкой.
            </p>
          </div>

          {/* Поле мгновенного поиска */}
          <div className="relative w-full lg:w-96 shrink-0">
            <label htmlFor="radical-search-input" className="sr-only">
              Поиск ключа по русскому названию, пиньиню или знаку
            </label>
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="radical-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск: вода, человек, сердце, shuǐ..."
              className="w-full pl-11 pr-4 py-3 text-base bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-rose-600"
            />
          </div>
        </div>

        {/* Фильтр по количеству черт в одну строку со свайпом */}
        <div className="flex items-center gap-2 pt-4 border-t border-slate-200/80 overflow-x-auto flex-nowrap no-scrollbar py-1">
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 mr-1 shrink-0">
            <Filter className="w-4 h-4" />
            <span>Число черт:</span>
          </span>
          {STROKE_FILTERS.map((f) => {
            const isActive = strokeFilter === f.id;
            return (
              <button
                key={String(f.id)}
                type="button"
                onClick={() => setStrokeFilter(f.id)}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Карточка выбранного ключа с действиями */}
      {selectedRadical && (
        <section
          aria-label={`Выбранный ключ ${selectedRadical.char}`}
          className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-24 h-24 bg-rose-50/70 border border-rose-200 rounded-2xl flex flex-col items-center justify-center shrink-0">
              <span className="font-chinese text-5xl font-bold text-slate-900">
                {selectedRadical.char}
              </span>
              {selectedRadical.variant && (
                <span className="text-sm font-chinese text-rose-700 font-semibold mt-0.5">
                  вар. {selectedRadical.variant}
                </span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-500 font-mono-tabular">
                <span>Ключ Канси №{selectedRadical.number}</span>
                <span aria-hidden="true">·</span>
                <span>Черт: {selectedRadical.strokes}</span>
                {selectedRadical.variant && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>В составе знака: <span className="font-chinese font-bold text-slate-800">{selectedRadical.variant}</span></span>
                  </>
                )}
              </div>

              <div className="mt-1.5 flex items-baseline gap-3.5">
                <h2 className="text-2xl font-bold text-slate-900">{selectedRadical.meaning}</h2>
                <span className="text-lg font-mono-tabular font-semibold text-rose-700">
                  [{selectedRadical.pinyin}]
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-sm text-slate-600">
                <span>Примеры иероглифов с этим ключом:</span>
                {selectedRadical.examples.map((exChar) => (
                  <button
                    key={exChar}
                    type="button"
                    onClick={() => onPracticeRadical(exChar)}
                    className="font-chinese text-base font-bold text-slate-900 hover:text-rose-600 underline decoration-slate-300 underline-offset-4 cursor-pointer px-1.5"
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
              className="inline-flex items-center gap-2 px-4 py-3 text-sm sm:text-base font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Volume2 className="w-5 h-5 text-rose-600" />
              <span>Озвучить</span>
            </button>

            <button
              type="button"
              onClick={() => onPracticeRadical(selectedRadical.char)}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm sm:text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookOpen className="w-5 h-5" />
              <span>Разобрать и тренировать</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRadicalToWorksheet(selectedRadical)}
              disabled={isRadicalInWorksheet(selectedRadical.char)}
              className={`inline-flex items-center gap-2 px-5 py-3 text-sm sm:text-base font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isRadicalInWorksheet(selectedRadical.char)
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-600 text-white hover:bg-rose-700'
              }`}
            >
              {isRadicalInWorksheet(selectedRadical.char) ? (
                <>
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span>В прописи</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>+ В пропись</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* Сетка ключей, сгруппированная по числу черт */}
      {groupedByStrokes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs flex flex-col items-center">
          <img
            src={MOSHUI_LOGO_SRC}
            alt="MoShui 墨水"
            className="h-20 w-20 object-contain rounded-2xl opacity-75 mb-4 border border-slate-200/70 bg-[#FAF9F6] p-1.5"
          />
          <p className="text-base text-slate-600">
            По запросу «{searchQuery}» ключей не найдено. Попробуйте сбросить фильтр черт.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByStrokes.map(([strokes, items]) => (
            <section
              key={strokes}
              className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-2xs space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {strokes}{' '}
                  {strokes === 1 ? 'черта' : strokes >= 2 && strokes <= 4 ? 'черты' : 'черт'}
                </h3>
                <span className="text-sm text-slate-500 font-mono-tabular">
                  Ключей в группе: {items.length}
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
                      className={`p-2.5 sm:p-4 rounded-xl border transition-all flex flex-col justify-between gap-2 sm:gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-rose-50/50 border-rose-600 ring-1 ring-rose-600'
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-baseline gap-1 sm:gap-2 min-w-0">
                          <span className="font-chinese text-2xl sm:text-3xl font-bold text-slate-900">
                            {rad.char}
                          </span>
                          {rad.variant && (
                            <span className="font-chinese text-xs sm:text-base font-semibold text-rose-700 hidden sm:inline">
                              ({rad.variant})
                            </span>
                          )}
                        </div>
                        <span className="font-mono-tabular text-[11px] sm:text-sm text-slate-400 shrink-0">
                          №{rad.number}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-mono-tabular font-semibold text-rose-700 truncate">
                          {rad.pinyin}
                        </div>
                        <div className="text-xs sm:text-base font-medium text-slate-900 truncate">
                          {rad.meaning}
                        </div>
                      </div>

                      {/* Быстрые действия: на смартфонах компактные иконки, на десктопе подписи */}
                      <div
                        className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => speakChinese(rad.char)}
                          aria-label={`Озвучить ключ ${rad.char}`}
                          className="p-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5 sm:hidden" />
                          <span className="hidden sm:inline">Озвучить</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPracticeRadical(rad.char)}
                          title="Тренировать ключ"
                          className="p-1 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-slate-800 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer truncate"
                        >
                          <BookOpen className="w-3.5 h-3.5 sm:hidden text-rose-600" />
                          <span className="hidden sm:inline">Тренировать</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRadicalToWorksheet(rad)}
                          disabled={inSheet}
                          aria-label={inSheet ? 'Уже в прописи' : 'Добавить ключ в пропись'}
                          className={`p-1 sm:px-2.5 sm:py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
                            inSheet
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-rose-700 hover:bg-rose-100/70'
                          }`}
                        >
                          {inSheet ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline ml-1">
                            {inSheet ? 'В прописи' : '+ В пропись'}
                          </span>
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
