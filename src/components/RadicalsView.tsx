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
      <section className="bg-white rounded-2xl border border-[#EAE3D5] shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] transition-all duration-300 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#18181B] tracking-tight text-balance">
              Интерактивная таблица иероглифических ключей Канси
            </h1>
            <p className="mt-2 text-base sm:text-lg text-[#52525B] leading-relaxed">
              Справочник {RADICALS_DATA.length} самых частотных радикалов китайского языка,
              сгруппированных по числу черт, с вариантами бокового написания и мгновенной тренировкой.
            </p>
          </div>

          {/* Поле мгновенного поиска */}
          <div className="relative w-full lg:w-96 shrink-0">
            <label htmlFor="radical-search-input" className="sr-only">
              Поиск ключа по русскому названию, пиньиню или знаку
            </label>
            <Search className="w-5 h-5 text-[#71717A] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="radical-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск: вода, человек, сердце, shuǐ..."
              className="w-full h-12 pl-11 pr-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31]"
            />
          </div>
        </div>

        {/* Фильтр по количеству черт в одну строку со свайпом */}
        <div className="flex items-center gap-2 pt-4 border-t border-[#EAE3D5] overflow-x-auto flex-nowrap no-scrollbar py-1">
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#71717A] mr-1 shrink-0">
            <Filter className="w-4 h-4 text-[#C83E31]" />
            <span>Число черт:</span>
          </span>
          {STROKE_FILTERS.map((f) => {
            const isActive = strokeFilter === f.id;
            return (
              <button
                key={String(f.id)}
                type="button"
                onClick={() => setStrokeFilter(f.id)}
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[42px] ${
                  isActive
                    ? 'bg-[#18181B] text-[#FAF7F2] border-[#18181B] shadow-xs'
                    : 'bg-[#FAF7F2] text-[#18181B] border-[#EAE3D5] hover:border-[#C83E31]/40'
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
          className="bg-white rounded-2xl border border-[#EAE3D5] shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] transition-all duration-300 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Квадратный штамп-печать выбранного ключа */}
            <div className="w-24 h-24 bg-[#FDF2F0]/60 border-2 border-[#C83E31]/50 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-2xs">
              <span className="font-chinese text-5xl font-bold text-[#18181B]">
                {selectedRadical.char}
              </span>
              {selectedRadical.variant && (
                <span className="text-sm font-chinese text-[#C83E31] font-semibold mt-0.5">
                  вар. {selectedRadical.variant}
                </span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5 text-sm text-[#71717A] font-mono-tabular">
                <span>Ключ Канси №{selectedRadical.number}</span>
                <span aria-hidden="true">·</span>
                <span>Черт: {selectedRadical.strokes}</span>
                {selectedRadical.variant && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      В составе знака:{' '}
                      <span className="font-chinese font-bold text-[#18181B]">
                        {selectedRadical.variant}
                      </span>
                    </span>
                  </>
                )}
              </div>

              <div className="mt-1.5 flex items-baseline gap-3.5">
                <h2 className="text-2xl font-bold text-[#18181B]">{selectedRadical.meaning}</h2>
                <span className="px-2.5 py-0.5 rounded-lg text-base font-mono-tabular font-semibold bg-[#FDF2F0] text-[#C83E31] border border-[#F5D0C8]">
                  [{selectedRadical.pinyin}]
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-sm text-[#52525B]">
                <span>Примеры иероглифов с этим ключом:</span>
                {selectedRadical.examples.map((exChar) => (
                  <button
                    key={exChar}
                    type="button"
                    onClick={() => onPracticeRadical(exChar)}
                    className="font-chinese text-base font-bold text-[#18181B] hover:text-[#C83E31] underline decoration-[#D6CEB8] underline-offset-4 cursor-pointer px-1.5"
                  >
                    {exChar}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3 обязательные кнопки действий при выборе ключа (h-12 для удобства на планшетах) */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => speakChinese(selectedRadical.char)}
              className="inline-flex items-center gap-2 px-4 py-3 h-12 min-h-[48px] text-sm sm:text-base font-semibold text-[#18181B] bg-[#FAF7F2] border border-[#EAE3D5] hover:bg-[#EAE3D5]/60 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Volume2 className="w-5 h-5 text-[#C83E31]" />
              <span>Озвучить</span>
            </button>

            <button
              type="button"
              onClick={() => onPracticeRadical(selectedRadical.char)}
              className="inline-flex items-center gap-2 px-5 py-3 h-12 min-h-[48px] text-sm sm:text-base font-semibold text-white bg-[#18181B] hover:bg-[#27272A] active:scale-[0.98] rounded-xl shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookOpen className="w-5 h-5" />
              <span>Разобрать и тренировать</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRadicalToWorksheet(selectedRadical)}
              disabled={isRadicalInWorksheet(selectedRadical.char)}
              className={`inline-flex items-center gap-2 px-5 py-3 h-12 min-h-[48px] text-sm sm:text-base font-semibold rounded-xl transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
                isRadicalInWorksheet(selectedRadical.char)
                  ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
                  : 'bg-[#C83E31] text-white hover:bg-[#B03226] shadow-sm'
              }`}
            >
              {isRadicalInWorksheet(selectedRadical.char) ? (
                <>
                  <Check className="w-5 h-5 text-[#15803D]" />
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
        <div className="bg-white rounded-2xl border border-[#EAE3D5] shadow-[0_8px_30px_rgb(24,24,27,0.04)] p-12 text-center flex flex-col items-center">
          <img
            src={MOSHUI_LOGO_SRC}
            alt="MoShui 墨水"
            className="h-20 w-20 object-contain rounded-full mix-blend-multiply opacity-85 mb-4"
          />
          <p className="text-base text-[#52525B]">
            По запросу «{searchQuery}» ключей не найдено. Попробуйте сбросить фильтр черт.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByStrokes.map(([strokes, items]) => (
            <section
              key={strokes}
              className="bg-white rounded-2xl border border-[#EAE3D5] shadow-[0_8px_30px_rgb(24,24,27,0.04)] hover:shadow-[0_12px_40px_rgb(24,24,27,0.07)] transition-all duration-300 p-6 sm:p-7 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-[#EAE3D5] pb-3.5">
                <h3 className="font-display text-lg sm:text-xl font-bold text-[#18181B]">
                  {strokes}{' '}
                  {strokes === 1 ? 'черта' : strokes >= 2 && strokes <= 4 ? 'черты' : 'черт'}
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-md bg-[#FDF2F0] text-[#C83E31] border border-[#F5D0C8] font-mono-tabular font-semibold">
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
                      className={`p-3 sm:p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer hover:-translate-y-0.5 hover:border-[#C83E31]/50 ${
                        isSelected
                          ? 'bg-[#FDF2F0]/60 border-[#C83E31] ring-1 ring-[#C83E31] shadow-xs'
                          : 'bg-[#FAF7F2]/80 border-[#EAE3D5] hover:bg-white'
                      }`}
                    >
                      {/* В углу мелкий номер ключа приглушенным шрифтом */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono-tabular text-[11px] sm:text-xs text-[#71717A]">
                          №{rad.number}
                        </span>
                        {rad.variant && (
                          <span className="font-chinese text-xs font-semibold text-[#C83E31] px-1.5 py-0.5 rounded bg-[#FDF2F0] border border-[#F5D0C8]/70">
                            {rad.variant}
                          </span>
                        )}
                      </div>

                      {/* По центру крупный каллиграфический знак */}
                      <div className="py-1 flex flex-col items-center text-center min-w-0">
                        <span className="font-chinese text-3xl sm:text-4xl font-bold text-[#18181B] leading-tight">
                          {rad.char}
                        </span>
                        <div className="mt-1.5 text-xs sm:text-sm font-mono-tabular font-semibold text-[#C83E31] truncate w-full">
                          {rad.pinyin}
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-[#18181B] truncate w-full">
                          {rad.meaning}
                        </div>
                      </div>

                      {/* Быстрые действия */}
                      <div
                        className="pt-2 border-t border-[#EAE3D5] flex items-center justify-between gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => speakChinese(rad.char)}
                          aria-label={`Озвучить ключ ${rad.char}`}
                          className="p-1.5 text-xs font-medium text-[#52525B] hover:text-[#18181B] hover:bg-[#EAE3D5]/60 rounded-lg transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPracticeRadical(rad.char)}
                          title="Тренировать ключ"
                          className="p-1.5 text-xs font-semibold text-[#18181B] hover:text-[#C83E31] hover:bg-[#FDF2F0] rounded-lg transition-colors cursor-pointer truncate"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-[#C83E31] sm:hidden" />
                          <span className="hidden sm:inline">Разбор</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRadicalToWorksheet(rad)}
                          disabled={inSheet}
                          aria-label={inSheet ? 'Уже в прописи' : 'Добавить ключ в пропись'}
                          className={`p-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
                            inSheet
                              ? 'text-[#15803D] bg-[#F0FDF4]'
                              : 'text-[#C83E31] hover:bg-[#FDF2F0]'
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
