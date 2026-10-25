import React, { useEffect, useState } from 'react';
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
  type WorksheetCellSpec,
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
    border: '#DC2626',
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

const CELL_SIZE = 68;
const CHAR_PADDING = 6;
const CHAR_INNER_SIZE = CELL_SIZE - CHAR_PADDING * 2; // 56px
const HANZI_SCALE = Number((CHAR_INNER_SIZE / 1024).toFixed(6)); // 0.054688
const HANZI_Y_OFFSET = Number((CHAR_PADDING + 900 * (CHAR_INNER_SIZE / 1024)).toFixed(3)); // 55.219

interface SvgWorksheetRowProps {
  rowCells: WorksheetCellSpec[];
  rowIndex: number;
  cellsPerRow: number;
  gridType: WorksheetConfig['gridType'];
  palette: { border: string; guide: string };
  strokeMap: Record<string, CharacterStrokeData | null>;
}

/**
 * Единый целостный векторный SVG-ряд клеток прописи (10 клеток по 68x68 = 680x68).
 * Исключает любые сдвиги HTML-рамок при рендеринге через html2canvas и при прямой печати А4.
 */
const SvgWorksheetRow: React.FC<SvgWorksheetRowProps> = ({
  rowCells,
  rowIndex,
  cellsPerRow,
  gridType,
  palette,
  strokeMap,
}) => {
  const rowWidth = cellsPerRow * CELL_SIZE; // 680 при 10 клетках
  const rowHeight = CELL_SIZE; // 68

  return (
    <svg
      viewBox={`0 0 ${rowWidth} ${rowHeight}`}
      width="100%"
      height={rowHeight}
      style={{
        display: 'block',
        width: '100%',
        height: `${rowHeight}px`,
        backgroundColor: '#ffffff',
        overflow: 'hidden',
      }}
      data-testid={`worksheet-svg-row-${rowIndex}`}
      aria-label={`Ряд клеток прописи ${rowIndex + 1}`}
    >
      {/* Фон ряда */}
      <rect x="0" y="0" width={rowWidth} height={rowHeight} fill="#ffffff" />

      {/* Направляющие линии и иероглифы внутри каждой из клеток ряда */}
      {rowCells.map((cell, colIdx) => {
        const x0 = colIdx * CELL_SIZE;
        const centerX = x0 + CELL_SIZE / 2;
        const centerY = CELL_SIZE / 2;
        const fillColor = cell.mode === 'sample' ? '#111827' : '#D1D5DB';
        const strokeData = cell.char ? strokeMap[cell.char] : null;
        const translateX = Number((x0 + CHAR_PADDING).toFixed(2));

        return (
          <g key={colIdx}>
            {/* Линии Тяньцзыгэ (крест) — для mizi и tianzi */}
            {(gridType === 'mizi' || gridType === 'tianzi') && (
              <>
                <line
                  x1={x0}
                  y1={centerY}
                  x2={x0 + CELL_SIZE}
                  y2={centerY}
                  stroke={palette.guide}
                  strokeDasharray="3,3"
                  strokeWidth="0.8"
                />
                <line
                  x1={centerX}
                  y1={0}
                  x2={centerX}
                  y2={CELL_SIZE}
                  stroke={palette.guide}
                  strokeDasharray="3,3"
                  strokeWidth="0.8"
                />
              </>
            )}

            {/* Диагонали Мицзыгэ — только для mizi */}
            {gridType === 'mizi' && (
              <>
                <line
                  x1={x0}
                  y1={0}
                  x2={x0 + CELL_SIZE}
                  y2={CELL_SIZE}
                  stroke={palette.guide}
                  strokeDasharray="3,3"
                  strokeWidth="0.8"
                />
                <line
                  x1={x0 + CELL_SIZE}
                  y1={0}
                  x2={x0}
                  y2={CELL_SIZE}
                  stroke={palette.guide}
                  strokeDasharray="3,3"
                  strokeWidth="0.8"
                />
              </>
            )}

            {/* Векторные контуры черт иероглифа (из HanziWriter.loadCharacterData) */}
            {cell.char && cell.mode !== 'empty' && (
              <>
                {strokeData && strokeData.strokes.length > 0 ? (
                  <g
                    transform={`translate(${translateX}, ${HANZI_Y_OFFSET}) scale(${HANZI_SCALE}, -${HANZI_SCALE})`}
                  >
                    {strokeData.strokes.map((pathD, strokeIdx) => (
                      <path key={strokeIdx} d={pathD} fill={fillColor} />
                    ))}
                  </g>
                ) : (
                  <text
                    x={centerX}
                    y={centerY + 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={fillColor}
                    fontSize="44"
                    fontFamily='"KaiTi", "Kaiti SC", "STKaiti", "Noto Serif SC", "Ma Shan Zheng", serif'
                  >
                    {cell.char}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}

      {/* Вертикальные разделители между клетками */}
      {Array.from({ length: cellsPerRow - 1 }).map((_, divIdx) => {
        const dividerX = (divIdx + 1) * CELL_SIZE;
        return (
          <line
            key={`div-${divIdx}`}
            x1={dividerX}
            y1={0}
            x2={dividerX}
            y2={rowHeight}
            stroke={palette.border}
            strokeWidth="1.5"
          />
        );
      })}

      {/* Внешняя рамка всего ряда */}
      <rect
        x="0.75"
        y="0.75"
        width={rowWidth - 1.5}
        height={rowHeight - 1.5}
        fill="none"
        stroke={palette.border}
        strokeWidth="1.5"
      />
    </svg>
  );
};

interface StrokeOrderHeaderProps {
  char: string;
  strokeData?: CharacterStrokeData | null;
  isLoaded?: boolean;
  borderColor: string;
  showCharPrefix?: boolean;
}

/**
 * Ряд мини-квадратов пошагового порядка черт фиксированного размера 28x28px с чистыми inline-стилями.
 * Если символ отсутствует в hanzi-writer-data (редкий иероглиф, латиница, пунктуация),
 * рендерит аккуратный текстовый fallback шрифтом KaiTi / Noto Serif SC.
 */
const StrokeOrderProgressionRow: React.FC<StrokeOrderHeaderProps> = ({
  char,
  strokeData,
  isLoaded = false,
  borderColor,
  showCharPrefix = false,
}) => {
  if (!strokeData || strokeData.strokes.length === 0) {
    if (!isLoaded) {
      return (
        <div
          data-testid={`stroke-order-row-${char}`}
          style={{
            fontSize: '11px',
            color: '#64748B',
            fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
            paddingTop: '2px',
          }}
        >
          Загрузка порядка черт для «{char}»...
        </div>
      );
    }

    // Fallback для ультра-редких иероглифов, латиницы или символов вне базы hanzi-writer-data
    return (
      <div
        data-testid={`stroke-order-row-${char}`}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          paddingTop: '3px',
          paddingBottom: '2px',
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
          width="28"
          height="28"
          viewBox="0 0 1024 1024"
          data-testid="stroke-order-box"
          style={{
            width: '28px',
            height: '28px',
            display: 'block',
            backgroundColor: '#ffffff',
            border: `1px solid ${borderColor}`,
            borderRadius: '2px',
            flexShrink: 0,
          }}
        >
          <line x1="0" y1="512" x2="1024" y2="512" stroke="#F1F5F9" strokeWidth="28" />
          <line x1="512" y1="0" x2="512" y2="1024" stroke="#F1F5F9" strokeWidth="28" />
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
            fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
          }}
        >
          Каллиграфический образец (KaiTi / Noto Serif SC)
        </span>
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
        gap: '4px',
        paddingTop: '3px',
        paddingBottom: '2px',
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
      {strokeData.strokes.map((_, stepIndex) => (
        <svg
          key={stepIndex}
          width="28"
          height="28"
          viewBox="0 0 1024 1024"
          data-testid="stroke-order-box"
          style={{
            width: '28px',
            height: '28px',
            display: 'block',
            backgroundColor: '#ffffff',
            border: `1px solid ${borderColor}`,
            borderRadius: '2px',
            flexShrink: 0,
          }}
        >
          <title>{`${char} — черта ${stepIndex + 1} из ${strokeData.strokes.length}`}</title>
          {/* Тонкие направляющие оси в мини-клетке */}
          <line x1="0" y1="512" x2="1024" y2="512" stroke="#F1F5F9" strokeWidth="28" />
          <line x1="512" y1="0" x2="512" y2="1024" stroke="#F1F5F9" strokeWidth="28" />
          <g transform="scale(1, -1) translate(0, -900)">
            {/* Контур всех черт бледно-серым фоном */}
            {strokeData.strokes.map((d, sIdx) => (
              <path key={`bg-${sIdx}`} d={d} fill="#E2E8F0" />
            ))}
            {/* Уже написанные черты до текущего шага */}
            {strokeData.strokes.slice(0, stepIndex).map((d, sIdx) => (
              <path key={`prev-${sIdx}`} d={d} fill="#334155" />
            ))}
            {/* Текущая добавленная черта выделена красным (#EF4444) */}
            <path d={strokeData.strokes[stepIndex]} fill="#EF4444" />
          </g>
        </svg>
      ))}
    </div>
  );
};

interface PracticeBlockItem {
  id: string;
  mode: 'by-character' | 'whole-word';
  chars: string[];
  // Для посимвольного режима
  char?: string;
  charPinyin?: string;
  charMeaning?: string;
  isMultiCharWord?: boolean;
  // Ссылки на полное родительское слово (никогда не теряются при итерации)
  parentWord: string;
  parentPinyin: string;
  parentTranslation: string;
}

export const PrintableSheet: React.FC<PrintableSheetProps> = ({
  worksheetList,
  config,
}) => {
  const [strokeMap, setStrokeMap] = useState<Record<string, CharacterStrokeData | null>>({});
  const [loadedCharsMap, setLoadedCharsMap] = useState<Record<string, boolean>>({});

  // Загружаем данные черт через HanziWriter.loadCharacterData для всех уникальных символов в списке
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
  const cellsPerRow = config.cellsPerRow || 10;
  const totalCells = config.rowsPerItem * cellsPerRow;
  const shouldShowStrokeOrder = Boolean(config.showStrokeOrder);

  // Формируем список учебных секций, строго сохраняя item.word, item.pinyin и item.translation
  const practiceBlocks = React.useMemo<PracticeBlockItem[]>(() => {
    const blocks: PracticeBlockItem[] = [];

    for (const item of worksheetList) {
      const normalized = normalizeWordItem(item, item.word);
      const parentWord = item.word || normalized.word;
      const parentPinyin =
        item.pinyin?.trim() ||
        normalized.pinyin ||
        pinyin(parentWord, { toneType: 'symbol' });

      // Извлекаем точный перевод полного слова (из пользовательского поля item.translation или словарей)
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
        // Режим А: Посимвольный разбор — передаем parentWord, parentPinyin, parentTranslation в каждый иероглиф
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
        // Режим Б: Словарный режим (слово целиком в строке)
        blocks.push({
          id: `${item.id}-word`,
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

  return (
    <div
      id="printable-sheet-area"
      data-testid="printable-a4-sheet"
      style={{
        width: '794px',
        minHeight: '1123px',
        padding: '40px',
        backgroundColor: '#ffffff',
        color: '#111827',
        boxSizing: 'border-box',
        fontFamily: '"Noto Serif SC", "KaiTi", sans-serif',
        margin: '0 auto',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
      }}
    >
      {/* Чистая учебная шапка листа прописи А4 с фирменным логотипом 40x40px, заголовком урока и полями Имя / Дата шрифтом 'Lora', serif */}
      <div
        data-testid="printable-sheet-header"
        style={{
          paddingBottom: '14px',
          marginBottom: '22px',
          borderBottom: '2px solid #0F172A',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          fontFamily: "'Lora', serif",
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: 0,
          }}
        >
          <img
            src="/assets/aistudio/image_0_0a6a2fe2.png"
            alt="MoShui"
            width={40}
            height={40}
            data-testid="printable-sheet-logo"
            style={{
              width: '40px',
              height: '40px',
              objectFit: 'contain',
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FAF9F6',
              flexShrink: 0,
              display: 'block',
            }}
          />
          <h2
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              color: '#0F172A',
              lineHeight: 1.25,
              letterSpacing: '-0.01em',
              fontFamily: "'Lora', serif",
            }}
          >
            {config.sheetTitle || 'Пропись китайских иероглифов и слов'}
          </h2>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '22px',
            fontSize: '13px',
            color: '#1E293B',
            fontFamily: "'Lora', serif",
            fontWeight: 600,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          <span>Имя: ___________________</span>
          <span>Дата: ____________</span>
        </div>
      </div>

      {/* Секции прописи */}
      {practiceBlocks.length === 0 ? (
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
            gap: '20px',
          }}
        >
          {practiceBlocks.map((block, blockIdx) => {
            const cells = buildWorksheetCells(
              block.chars,
              config.layoutMode,
              totalCells,
              config.traceCount
            );

            // Уникальные иероглифы текущего блока (1 в посимвольном режиме, 1..N в словарном режиме)
            const uniqueBlockChars = Array.from(new Set(block.chars));

            // Разбиваем плоский массив клеток на ряды по cellsPerRow (по 10 клеток)
            const rows: WorksheetCellSpec[][] = [];
            for (let r = 0; r < config.rowsPerItem; r++) {
              rows.push(cells.slice(r * cellsPerRow, (r + 1) * cellsPerRow));
            }

            return (
              <div
                key={block.id}
                style={{
                  breakInside: 'avoid',
                  pageBreakInside: 'avoid',
                  width: '100%',
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
                  }}
                >
                  {block.mode === 'whole-word' ? (
                    /* СЛОВАРНЫЙ РЕЖИМ (Слово целиком): {item.word} | {item.pinyin} — {item.translation || 'без перевода'} */
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
                    /* ПОСИМВОЛЬНЫЙ РЕЖИМ (Каждый иероглиф на отдельной строке) */
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

                      {/* Для слов из 2+ иероглифов сразу правее выводим жирную цветную плашку полного слова */}
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
                            border: `1.5px solid ${palette.guide}`,
                          }}
                        >
                          [Слово:{' '}
                          <span style={{ fontFamily: "'Noto Serif SC', serif" }}>
                            {block.parentWord}
                          </span>{' '}
                          ({block.parentPinyin}) — {block.parentTranslation || 'без перевода'}]
                        </strong>
                      )}
                    </div>
                  )}

                  {/* Пошаговый порядок черт (работает как в Посимвольном, так и в Словарном режиме) */}
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
                            config.layoutMode === 'whole-word' && uniqueBlockChars.length > 1
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Единые векторные SVG-ряды клеток (по 10 клеток 68x68 в каждом ряду) */}
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {rows.map((rowCells, rIdx) => (
                    <div
                      key={rIdx}
                      style={{
                        width: '100%',
                        marginTop: rIdx > 0 ? '-1.5px' : '0px',
                      }}
                    >
                      <SvgWorksheetRow
                        rowCells={rowCells}
                        rowIndex={rIdx}
                        cellsPerRow={cellsPerRow}
                        gridType={config.gridType}
                        palette={palette}
                        strokeMap={strokeMap}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Нижний колонтитул печатного листа А4 */}
      <div
        style={{
          marginTop: '32px',
          paddingTop: '12px',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#94A3B8',
          fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
        }}
      >
        <span>MoShui (墨水) — Учебная пропись китайских иероглифов и слов</span>
        <span>Лист А4</span>
      </div>
    </div>
  );
};
