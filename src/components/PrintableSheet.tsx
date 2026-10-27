import React, { useEffect, useState, useMemo } from 'react';
import { pinyin } from 'pinyin-pro';
import type { WordItem, WorksheetConfig } from '../types/hanzi';
import {
  buildWorksheetCells,
  extractChineseChars,
  normalizeWordItem,
  isPlaceholderTranslation,
  PRESET_WORDS,
  COMMON_WORD_TRANSLATIONS,
  KNOWN_CHARACTERS,
  COMMON_CHAR_MEANINGS,
} from '../utils/hanziUtils';
import { loadHanziStrokes, type CharacterStrokeData } from '../utils/strokeDataLoader';

interface PrintableSheetProps {
  worksheetList: WordItem[];
  config: WorksheetConfig;
  teacherName?: string;
}

const GRID_PALETTES: Record<
  WorksheetConfig['gridColor'],
  { border: string; guide: string; headerBg: string; badgeText: string }
> = {
  red: {
    border: '#C83E31',
    guide: '#FCA5A5',
    headerBg: '#FEF2F2',
    badgeText: '#B91C1C',
  },
  green: {
    border: '#059669',
    guide: '#6EE7B7',
    headerBg: '#ECFDF5',
    badgeText: '#047857',
  },
  gray: {
    border: '#475569',
    guide: '#CBD5E1',
    headerBg: '#F8FAFC',
    badgeText: '#334155',
  },
};

/**
 * Фиксированная ширина рабочей области листа А4 внутри .printable-a4-page:
 * 794px (ширина листа А4) - 2 * 40px (боковые поля) = 714px.
 * В одной горизонтальной строке ВСЕГДА ровно 10 клеток (~71.4px каждая).
 */
const WORKSHEET_INNER_WIDTH = 714;
const COLS_PER_ROW = 10;

/**
 * Генерирует легкий Data URI (`data:image/svg+xml;utf8,...`) для внутренней пунктирной разлиновки
 * одной клетки (Мицзыгэ 米字格, Тяньцзыгэ 田字格 или Квадрат 口字格).
 */
function buildCellGuideDataUri(
  gridType: WorksheetConfig['gridType'],
  guideColor: string
): string {
  if (gridType === 'kouzi') {
    return 'none';
  }

  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">`,
    `<line x1="0" y1="50" x2="100" y2="50" stroke="${guideColor}" stroke-dasharray="4,4" stroke-width="1.2"/>`,
    `<line x1="50" y1="0" x2="50" y2="100" stroke="${guideColor}" stroke-dasharray="4,4" stroke-width="1.2"/>`,
  ];

  if (gridType === 'mizi') {
    lines.push(
      `<line x1="0" y1="0" x2="100" y2="100" stroke="${guideColor}" stroke-dasharray="4,4" stroke-width="1"/>`,
      `<line x1="100" y1="0" x2="0" y2="100" stroke="${guideColor}" stroke-dasharray="4,4" stroke-width="1"/>`
    );
  }

  lines.push(`</svg>`);
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(lines.join(''))}")`;
}

interface StrokeOrderHeaderProps {
  char: string;
  strokeData?: CharacterStrokeData | null;
  isLoaded?: boolean;
  borderColor: string;
  showCharPrefix?: boolean;
}

/**
 * Ряд мини-квадратов пошагового порядка черт с объединенными SVG-путями.
 */
const StrokeOrderProgressionRow: React.FC<StrokeOrderHeaderProps> = ({
  char,
  strokeData,
  isLoaded = false,
  borderColor,
  showCharPrefix = false,
}) => {
  const boxSize = 26;

  if (!strokeData || strokeData.strokes.length === 0) {
    if (!isLoaded) {
      return (
        <div
          data-testid={`stroke-order-row-${char}`}
          style={{
            fontSize: '11px',
            color: '#64748B',
            fontFamily: "'Plus Jakarta Sans', 'Inter', 'Noto Serif SC', sans-serif",
            paddingTop: '2px',
          }}
        >
          Загрузка порядка черт для «{char}»...
        </div>
      );
    }

    return (
      <div
        data-testid={`stroke-order-row-${char}`}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          paddingTop: '2px',
          paddingBottom: '2px',
          maxWidth: '100%',
        }}
        aria-label={`Эталонное начертание знака ${char}`}
      >
        {showCharPrefix && (
          <span
            style={{
              fontFamily: "'Noto Serif SC', serif",
              fontSize: '14px',
              fontWeight: 700,
              color: '#334155',
              minWidth: '22px',
              marginRight: '2px',
            }}
          >
            {char}:
          </span>
        )}
        <svg
          width={boxSize}
          height={boxSize}
          viewBox="0 0 1024 1024"
          data-testid="stroke-order-box"
          style={{
            width: `${boxSize}px`,
            height: `${boxSize}px`,
            display: 'block',
            backgroundColor: '#ffffff',
            border: `1px solid ${borderColor}`,
            borderRadius: '2px',
            flexShrink: 0,
          }}
        >
          <text
            x="512"
            y="540"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#0F172A"
            fontSize="720"
            fontFamily='"KaiTi", "Kaiti SC", "STKaiti", "Noto Serif SC", "Ma Shan Zheng", serif'
          >
            {char}
          </text>
        </svg>
        <span
          style={{
            fontSize: '11px',
            color: '#64748B',
            fontFamily: "'Plus Jakarta Sans', 'Inter', 'Noto Serif SC', sans-serif",
          }}
        >
          Каллиграфический образец (KaiTi / Noto Serif SC)
        </span>
      </div>
    );
  }

  const combinedAllStrokes = strokeData.strokes.join(' ');

  return (
    <div
      data-testid={`stroke-order-row-${char}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px',
        paddingTop: '2px',
        paddingBottom: '2px',
        maxWidth: '100%',
      }}
      aria-label={`Пошаговый порядок черт для иероглифа ${char} (${strokeData.strokes.length} черт)`}
    >
      {showCharPrefix && (
        <span
          style={{
            fontFamily: "'Noto Serif SC', serif",
            fontSize: '14px',
            fontWeight: 700,
            color: '#334155',
            minWidth: '22px',
            marginRight: '2px',
          }}
        >
          {char}:
        </span>
      )}
      {strokeData.strokes.map((currentStrokeD, stepIndex) => {
        const completedStrokesD =
          stepIndex > 0 ? strokeData.strokes.slice(0, stepIndex).join(' ') : '';
        return (
          <svg
            key={stepIndex}
            width={boxSize}
            height={boxSize}
            viewBox="0 0 1024 1024"
            data-testid="stroke-order-box"
            style={{
              width: `${boxSize}px`,
              height: `${boxSize}px`,
              display: 'block',
              backgroundColor: '#ffffff',
              border: `1px solid ${borderColor}`,
              borderRadius: '2px',
              flexShrink: 0,
            }}
          >
            <g transform="scale(1, -1) translate(0, -900)">
              <path d={combinedAllStrokes} fill="#E2E8F0" />
              {completedStrokesD && <path d={completedStrokesD} fill="#334155" />}
              <path d={currentStrokeD} fill="#EF4444" />
            </g>
          </svg>
        );
      })}
    </div>
  );
};

interface PracticeBlockItem {
  id: string;
  globalIndex: number;
  mode: 'by-character' | 'whole-word';
  chars: string[];
  char?: string;
  charPinyin?: string;
  charMeaning?: string;
  isMultiCharWord?: boolean;
  parentWord: string;
  parentPinyin: string;
  parentTranslation: string;
}

/**
 * Оценивает высоту одного блока прописи в пикселях для точной автоматической пагинации по листам А4.
 * При 10 клетках: ~110px (плюс ряд черт, если включен), при 20 клетках: ~185px, при 30 клетках: ~260px.
 */
function estimateBlockHeightPx(
  block: PracticeBlockItem,
  totalCells: number,
  showStrokeOrder: boolean
): number {
  const rowsCount = Math.ceil(totalCells / COLS_PER_ROW);
  const baseHeight = rowsCount === 1 ? 112 : rowsCount === 2 ? 185 : 258;
  const uniqueCharsCount = new Set(block.chars).size;
  const strokeOrderExtra = showStrokeOrder ? uniqueCharsCount * 32 : 0;
  return baseHeight + strokeOrderExtra;
}

/**
 * Разбивает массив учебных блоков на отдельные листы А4 (794x1123px),
 * чтобы ни один блок не разрезался посередине между страницами.
 */
function paginatePracticeBlocks(
  blocks: PracticeBlockItem[],
  totalCells: number,
  showStrokeOrder: boolean
): PracticeBlockItem[][] {
  if (blocks.length === 0) return [[]];

  // Доступная высота под блоки на 1-й странице (с полной шапкой) и на последующих страницах (с компактным колонтитулом)
  const firstPageMaxHeight = 895;
  const nextPageMaxHeight = 935;
  const blockGap = 18;

  const pages: PracticeBlockItem[][] = [];
  let currentPage: PracticeBlockItem[] = [];
  let usedHeight = 0;

  for (const block of blocks) {
    const blockH = estimateBlockHeightPx(block, totalCells, showStrokeOrder);
    const maxPageHeight = pages.length === 0 ? firstPageMaxHeight : nextPageMaxHeight;
    const neededHeight = currentPage.length === 0 ? blockH : blockH + blockGap;

    if (currentPage.length > 0 && usedHeight + neededHeight > maxPageHeight) {
      pages.push(currentPage);
      currentPage = [block];
      usedHeight = blockH;
    } else {
      currentPage.push(block);
      usedHeight += neededHeight;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

export const PrintableSheet: React.FC<PrintableSheetProps> = ({
  worksheetList,
  config,
}) => {
  const [strokeMap, setStrokeMap] = useState<Record<string, CharacterStrokeData | null>>({});
  const [loadedCharsMap, setLoadedCharsMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    const uniqueChars = new Set<string>();

    for (const item of worksheetList) {
      const chars = extractChineseChars(item.word);
      const safeChars = chars.length > 0 ? chars : Array.from((item.word || '').trim());
      for (const ch of safeChars) {
        if (ch) uniqueChars.add(ch);
      }
    }

    async function fetchAllStrokes() {
      const updates: Record<string, CharacterStrokeData | null> = {};
      const loadedFlags: Record<string, boolean> = {};
      await Promise.all(
        Array.from(uniqueChars).map(async (ch) => {
          try {
            const data = await loadHanziStrokes(ch);
            updates[ch] = data;
          } catch {
            updates[ch] = null;
          } finally {
            loadedFlags[ch] = true;
          }
        })
      );
      if (isMounted) {
        setStrokeMap((prev) => ({ ...prev, ...updates }));
        setLoadedCharsMap((prev) => ({ ...prev, ...loadedFlags }));
      }
    }

    void fetchAllStrokes();
    return () => {
      isMounted = false;
    };
  }, [worksheetList]);

  const palette = GRID_PALETTES[config.gridColor];

  // В одной горизонтальной строке ВСЕГДА 10 клеток (~71.4px).
  // Кнопки «10 кл», «20 кл», «30 кл» задают общее число клеток на элемент (1, 2 или 3 строки по 10 клеток).
  const totalCells =
    config.rowsPerItem === 3 || config.cellsPerRow === 30
      ? 30
      : config.rowsPerItem === 2 || config.cellsPerRow === 20
      ? 20
      : 10;

  // Количество контуров для обводки ограничено Math.min(config.traceCount, totalCells - 1)
  const effectiveTraceCount = Math.min(
    Math.max(0, config.traceCount ?? 3),
    Math.max(0, totalCells - 1)
  );

  const shouldShowStrokeOrder = Boolean(config.showStrokeOrder);
  const shouldShowStudentInfo = config.showStudentInfo !== false;
  const cellSize = WORKSHEET_INNER_WIDTH / COLS_PER_ROW;

  const cellGuideBkgUrl = useMemo(
    () => buildCellGuideDataUri(config.gridType, palette.guide),
    [config.gridType, palette.guide]
  );

  const practiceBlocks = useMemo<PracticeBlockItem[]>(() => {
    const blocks: PracticeBlockItem[] = [];
    let counter = 0;

    for (const item of worksheetList) {
      const normalized = normalizeWordItem(item, item.word);
      const parentWord = item.word || normalized.word;
      const parentPinyin =
        item.pinyin?.trim() ||
        normalized.pinyin ||
        pinyin(parentWord, { toneType: 'symbol' });

      const explicitUserTranslation =
        item.translation && !isPlaceholderTranslation(item.translation)
          ? item.translation.trim()
          : '';
      const fallbackWordTranslation =
        PRESET_WORDS[parentWord]?.translation ||
        COMMON_WORD_TRANSLATIONS[parentWord] ||
        (!isPlaceholderTranslation(normalized.translation) ? normalized.translation : '');

      const parentTranslation = explicitUserTranslation || fallbackWordTranslation || '';
      const chars = extractChineseChars(parentWord);
      const safeChars = chars.length > 0 ? chars : [parentWord];

      if (config.layoutMode === 'by-character') {
        safeChars.forEach((ch, idx) => {
          const charObj =
            item.characters?.find((c) => c.char === ch) ||
            normalized.characters.find((c) => c.char === ch) ||
            normalized.characters[idx];
          const charPinyin = charObj?.pinyin || pinyin(ch, { toneType: 'symbol' });
          const rawCharMeaning =
            charObj?.meaning && !isPlaceholderTranslation(charObj.meaning)
              ? charObj.meaning.trim()
              : KNOWN_CHARACTERS[ch]?.meaning ||
                COMMON_CHAR_MEANINGS[ch] ||
                normalized.characters[idx]?.meaning ||
                '';

          blocks.push({
            id: `${item.id}-char-${ch}-${idx}`,
            globalIndex: counter++,
            mode: 'by-character',
            chars: [ch],
            char: ch,
            charPinyin,
            charMeaning: rawCharMeaning,
            isMultiCharWord: safeChars.length > 1,
            parentWord,
            parentPinyin,
            parentTranslation,
          });
        });
      } else {
        blocks.push({
          id: `${item.id}-word`,
          globalIndex: counter++,
          mode: 'whole-word',
          chars: safeChars,
          parentWord,
          parentPinyin,
          parentTranslation,
        });
      }
    }

    return blocks;
  }, [worksheetList, config.layoutMode]);

  const pages = useMemo(
    () => paginatePracticeBlocks(practiceBlocks, totalCells, shouldShowStrokeOrder),
    [practiceBlocks, totalCells, shouldShowStrokeOrder]
  );

  const sheetTitleText = config.sheetTitle || 'Пропись китайских иероглифов и слов';

  return (
    <div
      id="printable-sheet-area"
      data-testid="printable-a4-sheet"
      style={{
        width: '794px',
        margin: '0 auto',
        fontFamily: '"Noto Serif SC", "KaiTi", sans-serif',
      }}
    >
      {pages.map((pageBlocks, pageIdx) => {
        const isLastPage = pageIdx === pages.length - 1;

        return (
          <div
            key={pageIdx}
            data-testid={`printable-a4-page-${pageIdx}`}
            className="printable-a4-page bg-white shadow-md mb-8 last:mb-0 mx-auto"
            style={{
              width: '794px',
              minHeight: '1123px',
              padding: '40px',
              backgroundColor: '#FFFFFF',
              color: '#111827',
              boxSizing: 'border-box',
              fontFamily: '"Noto Serif SC", "KaiTi", sans-serif',
              WebkitFontSmoothing: 'antialiased',
              textRendering: 'geometricPrecision',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              pageBreakAfter: isLastPage ? 'auto' : 'always',
              breakAfter: isLastPage ? 'auto' : 'page',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {/* Шапка страницы: полная на 1-м листе, компактный колонтитул на 2-м и следующих листах */}
              {pageIdx === 0 ? (
                <div
                  data-testid="printable-sheet-header"
                  className="flex items-end justify-between border-b-2 border-[#18181B] pb-4 mb-6"
                  style={{
                    paddingBottom: '16px',
                    marginBottom: '22px',
                    borderBottom: '2px solid #18181B',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: '16px',
                    fontFamily: "'Lora', serif",
                  }}
                >
                  <div
                    className="flex items-center gap-3"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      minWidth: 0,
                    }}
                  >
                    <img
                      src={`${window.location.origin}/image_0.png`}
                      alt="MoShui Logo"
                      data-testid="printable-sheet-logo"
                      crossOrigin="anonymous"
                      className="w-12 h-12 object-contain shrink-0 block mix-blend-multiply print:mix-blend-normal"
                      style={{
                        width: '48px',
                        height: '48px',
                        objectFit: 'contain',
                        flexShrink: 0,
                        display: 'block',
                        printColorAdjust: 'exact',
                        WebkitPrintColorAdjust: 'exact',
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '24px',
                          fontWeight: 700,
                          color: '#18181B',
                          lineHeight: 1.2,
                          letterSpacing: '-0.01em',
                          fontFamily: "'Lora', 'Noto Serif SC', serif",
                        }}
                      >
                        {sheetTitleText}
                      </h2>
                    </div>
                  </div>

                  {shouldShowStudentInfo && (
                    <div
                      data-testid="printable-sheet-student-info"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        fontSize: '13px',
                        color: '#18181B',
                        fontFamily: "'Lora', serif",
                        fontWeight: 600,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>Имя: ____________</span>
                      <span>Дата: ____________</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  data-testid={`printable-sheet-compact-header-${pageIdx}`}
                  style={{
                    paddingBottom: '10px',
                    marginBottom: '18px',
                    borderBottom: '1.5px solid #18181B',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    fontFamily: "'Lora', 'Noto Serif SC', serif",
                  }}
                >
                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#18181B',
                    }}
                  >
                    {sheetTitleText}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#52525B',
                    }}
                  >
                    Стр. {pageIdx + 1}
                  </span>
                </div>
              )}

              {/* Секции прописи на текущем листе А4 */}
              {pageBlocks.length === 0 ? (
                <div
                  style={{
                    paddingTop: '64px',
                    paddingBottom: '64px',
                    textAlign: 'center',
                    color: '#64748B',
                    fontSize: '14px',
                    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                  }}
                >
                  Список слов для прописи пуст. Добавьте слова слева или выберите быстрый набор.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px',
                    width: `${WORKSHEET_INNER_WIDTH}px`,
                    maxWidth: `${WORKSHEET_INNER_WIDTH}px`,
                  }}
                >
                  {pageBlocks.map((block) => {
                    const blockIdx = block.globalIndex;
                    const cells = buildWorksheetCells(
                      block.chars,
                      config.layoutMode,
                      totalCells,
                      effectiveTraceCount
                    );

                    const uniqueBlockChars = Array.from(new Set(block.chars));

                    return (
                      <div
                        key={block.id}
                        style={{
                          breakInside: 'avoid',
                          pageBreakInside: 'avoid',
                          width: `${WORKSHEET_INNER_WIDTH}px`,
                          maxWidth: `${WORKSHEET_INNER_WIDTH}px`,
                          boxSizing: 'border-box',
                        }}
                        data-testid={`worksheet-block-${blockIdx}`}
                      >
                        {/* Шапка иероглифического / словарного блока */}
                        <div
                          style={{
                            padding: '8px 12px',
                            backgroundColor: palette.headerBg,
                            borderTop: `1.5px solid ${palette.border}`,
                            borderLeft: `1.5px solid ${palette.border}`,
                            borderRight: `1.5px solid ${palette.border}`,
                            borderTopLeftRadius: '6px',
                            borderTopRightRadius: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            boxSizing: 'border-box',
                            width: '100%',
                          }}
                        >
                          {block.mode === 'whole-word' ? (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'baseline',
                                justifyContent: 'space-between',
                                gap: '8px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'baseline',
                                  gap: '10px',
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#94A3B8',
                                  }}
                                >
                                  {String(blockIdx + 1).padStart(2, '0')}.
                                </span>
                                <span
                                  data-testid={`block-title-${blockIdx}`}
                                  style={{
                                    fontFamily: "'Noto Serif SC', serif",
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    color: '#0F172A',
                                    letterSpacing: '0.03em',
                                    lineHeight: 1.1,
                                  }}
                                >
                                  {block.parentWord}
                                </span>
                                <span
                                  style={{
                                    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                                    fontSize: '15px',
                                    color: '#94A3B8',
                                    fontWeight: 600,
                                  }}
                                  aria-hidden="true"
                                >
                                  |
                                </span>
                                <span
                                  data-testid={`block-pinyin-${blockIdx}`}
                                  style={{
                                    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    color: palette.badgeText,
                                  }}
                                >
                                  {block.parentPinyin}
                                </span>
                                <span
                                  style={{
                                    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                                    fontSize: '15px',
                                    color: '#0F172A',
                                    fontWeight: 700,
                                  }}
                                  aria-hidden="true"
                                >
                                  —
                                </span>
                                <strong
                                  data-testid={`block-translation-${blockIdx}`}
                                  style={{
                                    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    color: '#0F172A',
                                  }}
                                >
                                  {block.parentTranslation || 'без перевода'}
                                </strong>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'baseline',
                                  gap: '8px',
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#94A3B8',
                                  }}
                                >
                                  {String(blockIdx + 1).padStart(2, '0')}.
                                </span>
                                <span
                                  data-testid={`block-title-${blockIdx}`}
                                  style={{
                                    fontFamily: "'Noto Serif SC', serif",
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    color: '#0F172A',
                                    letterSpacing: '0.03em',
                                    lineHeight: 1.1,
                                  }}
                                >
                                  {block.char}
                                </span>
                                <span
                                  data-testid={`block-pinyin-${blockIdx}`}
                                  style={{
                                    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: palette.badgeText,
                                  }}
                                >
                                  ({block.charPinyin})
                                </span>
                                <span
                                  data-testid={`block-translation-${blockIdx}`}
                                  style={{
                                    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#1E293B',
                                  }}
                                >
                                  —{' '}
                                  {block.isMultiCharWord
                                    ? block.charMeaning || block.parentTranslation || 'без перевода'
                                    : block.parentTranslation || block.charMeaning || 'без перевода'}
                                </span>
                              </div>

                              {block.isMultiCharWord && (
                                <strong
                                  data-testid={`block-parent-word-${blockIdx}`}
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: palette.badgeText,
                                    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                                    backgroundColor: '#ffffff',
                                    padding: '3px 9px',
                                    borderRadius: '4px',
                                    border: `1px solid ${palette.guide}`,
                                  }}
                                >
                                  [Слово:{' '}
                                  <span style={{ fontFamily: "'Noto Serif SC', serif" }}>
                                    {block.parentWord}
                                  </span>{' '}
                                  ({block.parentPinyin}) —{' '}
                                  {block.parentTranslation || 'без перевода'}]
                                </strong>
                              )}
                            </div>
                          )}

                          {shouldShowStrokeOrder && uniqueBlockChars.length > 0 && (
                            <div
                              data-testid={`block-stroke-order-container-${blockIdx}`}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                paddingTop: '2px',
                              }}
                            >
                              {uniqueBlockChars.map((ch) => (
                                <StrokeOrderProgressionRow
                                  key={ch}
                                  char={ch}
                                  strokeData={strokeMap[ch]}
                                  isLoaded={Boolean(loadedCharsMap[ch])}
                                  borderColor={palette.guide}
                                  showCharPrefix={
                                    config.layoutMode === 'whole-word' &&
                                    uniqueBlockChars.length > 1
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Железобетонная CSS Grid сетка на 10 колонок: 10 кл = 1 ряд, 20 кл = 2 ряда, 30 кл = 3 ряда */}
                        <div
                          data-testid={`worksheet-grid-${blockIdx}`}
                          data-cell-size={cellSize.toFixed(2)}
                          data-total-cells={totalCells}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
                            width: '100%',
                            maxWidth: `${WORKSHEET_INNER_WIDTH}px`,
                            borderTop: `1.5px solid ${palette.border}`,
                            borderLeft: `1.5px solid ${palette.border}`,
                            backgroundColor: '#ffffff',
                            boxSizing: 'border-box',
                          }}
                        >
                          {cells.map((cell, idx) => {
                            const hasChar = Boolean(cell.char && cell.mode !== 'empty');
                            const fillColor = cell.mode === 'sample' ? '#18181B' : '#D4D4D8';
                            const strokeData = cell.char ? strokeMap[cell.char] : null;

                            return (
                              <div
                                key={idx}
                                data-testid={`worksheet-cell-${blockIdx}-${idx}`}
                                style={{
                                  aspectRatio: '1 / 1',
                                  borderRight: `1.5px solid ${palette.border}`,
                                  borderBottom: `1.5px solid ${palette.border}`,
                                  position: 'relative',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundImage: cellGuideBkgUrl,
                                  backgroundSize: '100% 100%',
                                  backgroundRepeat: 'no-repeat',
                                  backgroundColor: '#ffffff',
                                  boxSizing: 'border-box',
                                  overflow: 'hidden',
                                }}
                              >
                                {hasChar && cell.char && (
                                  <svg
                                    viewBox="0 0 1024 1024"
                                    width="82%"
                                    height="82%"
                                    style={{
                                      display: 'block',
                                      width: '82%',
                                      height: '82%',
                                      position: 'relative',
                                      zIndex: 1,
                                    }}
                                  >
                                    {strokeData && strokeData.strokes.length > 0 ? (
                                      <g transform="scale(1, -1) translate(0, -900)">
                                        <path d={strokeData.strokes.join(' ')} fill={fillColor} />
                                      </g>
                                    ) : (
                                      <text
                                        x="512"
                                        y="540"
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fill={fillColor}
                                        fontSize="760"
                                        fontFamily='"KaiTi", "Kaiti SC", "STKaiti", "Noto Serif SC", "Ma Shan Zheng", serif'
                                      >
                                        {cell.char}
                                      </text>
                                    )}
                                  </svg>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Нижний колонтитул печатного листа А4 */}
            <div
              style={{
                marginTop: '24px',
                paddingTop: '12px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#94A3B8',
                fontFamily: "'Plus Jakarta Sans', 'Inter', 'Noto Serif SC', sans-serif",
              }}
            >
              <span>MoShui (墨水) — Учебная пропись китайских иероглифов и слов</span>
              <span>
                Лист А4 {pages.length > 1 ? `• Стр. ${pageIdx + 1} из ${pages.length}` : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
