import React, { useState, useEffect, useMemo } from 'react';
import {
  Volume2,
  PenTool,
  Puzzle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Flame,
} from 'lucide-react';
import type { CharDetail, Grapheme, WordItem } from '../types/hanzi';
import { getCharacterGraphemesForPractice } from '../utils/hanziUtils';
import { RADICALS_DATA } from '../utils/radicalsData';
import { speakChinese } from '../services/audioService';
import { HanziCanvas } from './HanziCanvas';

export type PracticeMode = 'strokes' | 'graphemes';

interface PoolTile {
  uid: string;
  targetStepIndex: number | null; // null if distractor
  grapheme: Grapheme;
  isPlaced: boolean;
}

interface DictionaryPracticeProps {
  currentWord: WordItem;
  activeChar: CharDetail;
  selectedCharIndex: number;
  onSelectCharIndex: (index: number) => void;
  onNextWord: () => void;
}

/**
 * Перемешивает массив плиток пула так, чтобы порядок не совпадал с исходным порядком сборки.
 */
function shufflePoolTiles(tiles: PoolTile[]): PoolTile[] {
  if (tiles.length <= 1) return [...tiles];
  const copy = [...tiles];

  for (let attempt = 0; attempt < 6; attempt++) {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }

    // Проверяем, что порядок символов реально изменился (если символы различны)
    const isSameOrder = copy.every((tile, idx) => tile.grapheme.char === tiles[idx].grapheme.char);
    if (!isSameOrder) {
      return copy;
    }
  }

  // Принудительный сдвиг, если случайная перестановка совпала с исходной
  return [...copy.slice(1), copy[0]];
}

export const DictionaryPractice: React.FC<DictionaryPracticeProps> = ({
  currentWord,
  activeChar,
  selectedCharIndex,
  onSelectCharIndex,
  onNextWord,
}) => {
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('strokes');
  const [includeDistractors, setIncludeDistractors] = useState<boolean>(false);
  const [showSilhouetteHint, setShowSilhouetteHint] = useState<boolean>(true);

  const targetGraphemes = useMemo(
    () => getCharacterGraphemesForPractice(activeChar),
    [activeChar]
  );

  const [poolTiles, setPoolTiles] = useState<PoolTile[]>([]);
  const [placedSteps, setPlacedSteps] = useState<Grapheme[]>([]);
  const [wrongTileUid, setWrongTileUid] = useState<string | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState<boolean>(false);
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    type: 'idle' | 'success' | 'mistake' | 'completed';
    message: string;
  }>({
    type: 'idle',
    message: 'Выберите или перетащите первую графему в сетку-силуэт (слева направо, сверху вниз).',
  });

  // Инициализация / сброс раунда сборки при смене иероглифа или режима ловушек
  const initGraphemeRound = React.useCallback(() => {
    const baseTiles: PoolTile[] = targetGraphemes.map((g, idx) => ({
      uid: `target-${activeChar.char}-${idx}-${g.char}`,
      targetStepIndex: idx,
      grapheme: g,
      isPlaced: false,
    }));

    let allTiles = [...baseTiles];

    if (includeDistractors) {
      const usedChars = new Set(targetGraphemes.map((g) => g.char));
      usedChars.add(activeChar.char);
      const candidates = RADICALS_DATA.filter(
        (r) => !usedChars.has(r.char) && (!r.variant || !usedChars.has(r.variant))
      );
      const pickedDistractors: PoolTile[] = [];
      const shuffledCandidates = [...candidates].sort(() => Math.random() - 0.5).slice(0, 2);

      shuffledCandidates.forEach((rad, dIdx) => {
        pickedDistractors.push({
          uid: `distractor-${activeChar.char}-${dIdx}-${rad.char}`,
          targetStepIndex: null,
          grapheme: {
            char: rad.variant || rad.char,
            pinyin: rad.pinyin,
            meaning: rad.meaning.split(',')[0],
            type: 'radical',
          },
          isPlaced: false,
        });
      });

      allTiles = [...baseTiles, ...pickedDistractors];
    }

    setPoolTiles(shufflePoolTiles(allTiles));
    setPlacedSteps([]);
    setWrongTileUid(null);
    setMistakeCount(0);
    setDragOverSlotIndex(null);
    setIsDragOverCanvas(false);
    setFeedback({
      type: 'idle',
      message: `Шаг 1 из ${targetGraphemes.length}: перетащите или нажмите на начальную графему знака «${activeChar.char}».`,
    });
  }, [activeChar.char, targetGraphemes, includeDistractors]);

  useEffect(() => {
    initGraphemeRound();
  }, [initGraphemeRound]);

  const currentStepIndex = placedSteps.length;
  const isCompleted = placedSteps.length === targetGraphemes.length && targetGraphemes.length > 0;
  const hasNextCharInWord = selectedCharIndex < currentWord.characters.length - 1;
  const nextCharInWord = hasNextCharInWord
    ? currentWord.characters[selectedCharIndex + 1]
    : null;

  const handleSelectTile = (tile: PoolTile) => {
    if (tile.isPlaced || isCompleted) return;

    const expectedGrapheme = targetGraphemes[currentStepIndex];
    if (!expectedGrapheme) return;

    // Допускаем совпадение по символу графемы на случай одинаковых графем в знаке (например, 朋 = 月 + 月 или 林 = 木 + 木)
    const isCorrect = tile.grapheme.char === expectedGrapheme.char;

    if (isCorrect) {
      const nextPlaced = [...placedSteps, expectedGrapheme];
      setPlacedSteps(nextPlaced);
      setPoolTiles((prev) =>
        prev.map((item) => (item.uid === tile.uid ? { ...item, isPlaced: true } : item))
      );
      setWrongTileUid(null);

      if (nextPlaced.length === targetGraphemes.length) {
        setFeedback({
          type: 'completed',
          message: `Великолепно! Иероглиф «${activeChar.char}» (${activeChar.pinyin}) собран верно!`,
        });
        speakChinese(activeChar.char);
      } else {
        const nextStepNum = nextPlaced.length + 1;
        setFeedback({
          type: 'success',
          message: `Верно! Графема «${tile.grapheme.char}» (${tile.grapheme.meaning}) на месте. Теперь шаг ${nextStepNum} из ${targetGraphemes.length}.`,
        });
        speakChinese(tile.grapheme.char);
      }
    } else {
      setMistakeCount((prev) => prev + 1);
      setWrongTileUid(tile.uid);
      setTimeout(() => {
        setWrongTileUid((prev) => (prev === tile.uid ? null : prev));
      }, 650);

      const isDistractor = tile.targetStepIndex === null;
      setFeedback({
        type: 'mistake',
        message: isDistractor
          ? `Ключ «${tile.grapheme.char}» (${tile.grapheme.meaning}) — лишний и не входит в состав знака «${activeChar.char}».`
          : `Нарушен порядок письма! Сначала пишется часть №${currentStepIndex + 1} (слева направо, сверху вниз), а не «${tile.grapheme.char}».`,
      });
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, tile: PoolTile) => {
    if (tile.isPlaced || isCompleted) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', tile.uid);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnTarget = (e: React.DragEvent<HTMLElement>, slotIdx?: number) => {
    e.preventDefault();
    setDragOverSlotIndex(null);
    setIsDragOverCanvas(false);

    if (isCompleted) return;

    // Если пользователь бросил плитку в будущий слот (не текущий по порядку письма), подсказываем порядок
    if (typeof slotIdx === 'number' && slotIdx !== currentStepIndex) {
      setMistakeCount((prev) => prev + 1);
      setFeedback({
        type: 'mistake',
        message: `Заполняйте графемы строго по порядку написания: сейчас активна ячейка №${currentStepIndex + 1}.`,
      });
      return;
    }

    const droppedUid = e.dataTransfer.getData('text/plain');
    const foundTile = poolTiles.find((t) => t.uid === droppedUid);
    if (foundTile) {
      handleSelectTile(foundTile);
    }
  };

  return (
    <div className="md:col-span-5 flex flex-col items-center p-4 sm:p-6 bg-[#FAF7F2] border border-[#EAE3D5] rounded-2xl w-full shadow-2xs">
      {/* Шапка карточки знака */}
      <div className="w-full flex items-center justify-between mb-4 pb-4 border-b border-[#EAE3D5]">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="font-chinese text-4xl font-bold text-[#18181B]">
              {activeChar.char}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg text-base font-semibold bg-[#FDF2F0] text-[#C83E31] border border-[#F5D0C8] font-mono-tabular">
              {activeChar.pinyin}
            </span>
          </div>
          <div className="mt-1.5 text-sm text-[#52525B] font-mono-tabular">
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
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-[#18181B] bg-white border border-[#EAE3D5] rounded-xl hover:bg-[#FDF2F0] hover:border-[#F5D0C8] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Volume2 className="w-4 h-4 text-[#C83E31]" />
          <span>Слушать знак</span>
        </button>
      </div>

      {/* Переключатель режимов практики: Порядок черт (笔画) / Собери из ключей (部件) */}
      <div
        role="tablist"
        aria-label="Режим тренировки иероглифа"
        data-testid="practice-mode-switcher"
        className="w-full grid grid-cols-2 gap-1.5 p-1.5 mb-5 bg-[#F3EFE6] border border-[#EAE3D5] rounded-xl"
      >
        <button
          type="button"
          role="tab"
          aria-selected={practiceMode === 'strokes'}
          data-testid="mode-strokes-tab"
          onClick={() => setPracticeMode('strokes')}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            practiceMode === 'strokes'
              ? 'bg-[#18181B] text-[#FAF7F2] shadow-xs'
              : 'text-[#52525B] hover:text-[#18181B] hover:bg-white/60'
          }`}
        >
          <PenTool className="w-4 h-4 shrink-0 text-[#C83E31]" />
          <span className="truncate">Порядок черт (笔画)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={practiceMode === 'graphemes'}
          data-testid="mode-graphemes-tab"
          onClick={() => setPracticeMode('graphemes')}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            practiceMode === 'graphemes'
              ? 'bg-[#C83E31] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#18181B] hover:bg-white/60'
          }`}
        >
          <Puzzle className="w-4 h-4 shrink-0" />
          <span className="truncate">Собери из ключей (部件)</span>
        </button>
      </div>

      {/* РЕЖИМ 1: Порядок черт (笔画) */}
      {practiceMode === 'strokes' ? (
        <HanziCanvas char={activeChar.char} size={240} />
      ) : (
        /* РЕЖИМ 2: Интерактивная мини-игра «Собери из ключей (部件)» */
        <div
          data-testid="grapheme-builder-game"
          className="w-full flex flex-col items-center space-y-4"
        >
          {/* Верхняя панель управления силуэтом и усложнением */}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-[#52525B]">
            <span className="font-mono-tabular font-semibold text-[#18181B]">
              Собрано частей: {placedSteps.length} / {targetGraphemes.length}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowSilhouetteHint((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#EAE3D5] hover:bg-[#FDF2F0] text-[#52525B] hover:text-[#18181B] font-medium transition-colors cursor-pointer"
                title="Показать или скрыть фоновый силуэт иероглифа"
              >
                {showSilhouetteHint ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-[#71717A]" />
                    <span>Силуэт</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-[#C83E31]" />
                    <span>Силуэт</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIncludeDistractors((prev) => !prev)}
                aria-pressed={includeDistractors}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                  includeDistractors
                    ? 'bg-[#FDF2F0] border-[#C83E31]/50 text-[#C83E31]'
                    : 'bg-white border-[#EAE3D5] text-[#52525B] hover:text-[#18181B]'
                }`}
                title="Добавить лишние ключи-ловушки в пул деталей"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Ловушки</span>
              </button>

              <button
                type="button"
                onClick={initGraphemeRound}
                aria-label="Перемешать и начать сборку заново"
                title="Сбросить и перемешать"
                className="p-1.5 rounded-lg bg-white border border-[#EAE3D5] hover:bg-[#FDF2F0] text-[#52525B] hover:text-[#C83E31] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ВЕРХНЯЯ ЗОНА: Сетка-силуэт целевого иероглифа (Мицзыгэ 米字格) */}
          <div className="border-2 border-[#D6CEB8] p-3 rounded-2xl bg-[#FFFEFA] shadow-inner mx-auto">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOverCanvas(true);
              }}
              onDragLeave={() => setIsDragOverCanvas(false)}
              onDrop={(e) => handleDropOnTarget(e)}
              data-testid="grapheme-target-silhouette"
              className={`relative w-[240px] h-[240px] bg-white border-2 rounded-xl overflow-hidden select-none transition-all duration-300 flex flex-col items-center justify-center p-3 ${
                isCompleted
                  ? 'border-[#15803D] shadow-[0_0_25px_rgba(21,128,61,0.14)]'
                  : isDragOverCanvas
                  ? 'border-[#C83E31] bg-[#FDF2F0]/30 scale-[1.01]'
                  : 'border-[#C83E31]/80'
              }`}
            >
              {/* Векторная сетка Мицзыгэ (米字格) */}
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-hidden="true"
              >
                <rect
                  x="2"
                  y="2"
                  width="96"
                  height="96"
                  fill="none"
                  stroke="#F5D0C8"
                  strokeWidth="0.75"
                />
                <line
                  x1="0"
                  y1="50"
                  x2="100"
                  y2="50"
                  stroke="#E6A195"
                  strokeWidth="0.9"
                  strokeDasharray="3,3"
                />
                <line
                  x1="50"
                  y1="0"
                  x2="50"
                  y2="100"
                  stroke="#E6A195"
                  strokeWidth="0.9"
                  strokeDasharray="3,3"
                />
                <line
                  x1="0"
                  y1="0"
                  x2="100"
                  y2="100"
                  stroke="#F5D0C8"
                  strokeWidth="0.75"
                  strokeDasharray="2.5,3.5"
                />
                <line
                  x1="100"
                  y1="0"
                  x2="0"
                  y2="100"
                  stroke="#F5D0C8"
                  strokeWidth="0.75"
                  strokeDasharray="2.5,3.5"
                />
              </svg>

              {/* Полупрозрачный фоновый силуэт целевого иероглифа */}
              {showSilhouetteHint && !isCompleted && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center pointer-events-none select-none font-chinese text-[162px] leading-none text-[#EAE3D5]/55"
                >
                  {activeChar.char}
                </div>
              )}

              {/* Состояние 1: Иероглиф полностью собран — торжественная каллиграфическая печать */}
              {isCompleted ? (
                <div
                  data-testid="grapheme-assembly-complete-glyph"
                  className="relative z-10 flex flex-col items-center justify-center w-full h-full animate-fadeIn"
                >
                  <span className="font-chinese text-[142px] leading-none font-bold text-[#18181B] drop-shadow-xs">
                    {activeChar.char}
                  </span>

                  {/* Традиционная красная печать мастера в углу */}
                  <div className="absolute top-1.5 right-1.5 px-2 py-1 bg-[#C83E31] text-[#FAF7F2] rounded-md border border-[#9E2B20] shadow-xs flex items-center gap-1">
                    <span className="font-chinese text-xs font-bold tracking-widest">完成</span>
                  </div>

                  {/* Формула собранного знака внизу сетки */}
                  <div className="mt-1 px-2.5 py-0.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] text-xs font-semibold font-mono-tabular">
                    {targetGraphemes.map((g) => g.char).join(' + ')} = {activeChar.char}
                  </div>
                </div>
              ) : (
                /* Состояние 2: Интерактивные слоты силуэта по порядку написания */
                <div
                  className={`relative z-10 w-full h-full grid gap-2 p-1.5 items-stretch justify-center ${
                    targetGraphemes.length === 2
                      ? 'grid-cols-2'
                      : targetGraphemes.length === 3
                      ? 'grid-cols-1 grid-rows-3'
                      : 'grid-cols-2 grid-rows-2'
                  }`}
                >
                  {targetGraphemes.map((targetG, slotIdx) => {
                    const placedG = placedSteps[slotIdx];
                    const isCurrentActiveSlot = slotIdx === currentStepIndex;
                    const isHoveredByDrag = dragOverSlotIndex === slotIdx;

                    return (
                      <div
                        key={`slot-${slotIdx}-${targetG.char}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverSlotIndex(slotIdx);
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          setDragOverSlotIndex((prev) => (prev === slotIdx ? null : prev));
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          handleDropOnTarget(e, slotIdx);
                        }}
                        data-testid={`grapheme-slot-${slotIdx}`}
                        className={`rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-200 px-2 py-1 ${
                          placedG
                            ? 'bg-[#FAF7F2]/95 border-[#15803D]/60 text-[#18181B] shadow-2xs'
                            : isCurrentActiveSlot || isHoveredByDrag
                            ? 'bg-[#FDF2F0]/75 border-dashed border-[#C83E31] text-[#C83E31] shadow-inner'
                            : 'bg-white/65 border-dashed border-[#D6CEB8] text-[#A1A1AA]'
                        }`}
                      >
                        {placedG ? (
                          <>
                            <span className="font-chinese text-3xl sm:text-4xl font-bold text-[#18181B] leading-none">
                              {placedG.char}
                            </span>
                            <span className="mt-1 text-[10px] font-mono-tabular font-semibold text-[#15803D] truncate max-w-full">
                              {placedG.pinyin}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="w-6 h-6 rounded-full bg-white/90 border border-current flex items-center justify-center text-xs font-mono-tabular font-bold">
                              {slotIdx + 1}
                            </span>
                            <span className="mt-1 text-[10px] font-medium text-center leading-tight">
                              {isCurrentActiveSlot ? 'Поместите ключ сюда' : `Часть ${slotIdx + 1}`}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* КАРТОЧКА УСПЕШНОЙ СБОРКИ ИЕРОГЛИФА (перевод, пиньинь, переход к следующему слову) */}
          {isCompleted ? (
            <div
              data-testid="grapheme-success-panel"
              className="w-full p-4 sm:p-5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#18181B] shadow-xs space-y-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#15803D] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#15803D]">
                      Иероглиф собран верно!
                    </div>
                    <div className="text-base font-bold text-[#18181B] flex items-baseline gap-2">
                      <span className="font-chinese text-xl">{activeChar.char}</span>
                      <span className="font-mono-tabular text-[#C83E31]">{activeChar.pinyin}</span>
                      <span className="text-xs font-normal text-[#52525B]">
                        (ошибок: {mistakeCount})
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => speakChinese(currentWord.word)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#BBF7D0] text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition-colors cursor-pointer shrink-0"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Слово</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-white/90 border border-[#BBF7D0]/70 space-y-1">
                <div className="text-xs text-[#52525B]">
                  Значение знака «<span className="font-chinese font-bold">{activeChar.char}</span>»:
                </div>
                <div className="text-sm font-semibold text-[#18181B]">{activeChar.meaning}</div>
                {currentWord.characters.length > 1 && (
                  <div className="pt-1.5 mt-1.5 border-t border-[#EAE3D5] text-xs text-[#52525B] flex flex-wrap items-baseline gap-1.5">
                    <span>Целое слово:</span>
                    <strong className="font-chinese text-sm text-[#18181B]">
                      {currentWord.word}
                    </strong>
                    <span className="font-mono-tabular text-[#C83E31] font-semibold">
                      ({currentWord.pinyin})
                    </span>
                    <span>— {currentWord.translation}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                {hasNextCharInWord && nextCharInWord && (
                  <button
                    type="button"
                    data-testid="next-char-in-word-button"
                    onClick={() => onSelectCharIndex(selectedCharIndex + 1)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#C83E31] hover:bg-[#B03226] text-white text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <span>Следующий знак «{nextCharInWord.char}»</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  data-testid="next-word-practice-button"
                  onClick={onNextWord}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Следующее слово</span>
                  <ArrowRight className="w-4 h-4 text-[#F5D0C8]" />
                </button>

                <button
                  type="button"
                  onClick={initGraphemeRound}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-white border border-[#BBF7D0] hover:bg-[#DCFCE7]/50 text-[#15803D] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Повторить</span>
                </button>
              </div>
            </div>
          ) : (
            /* НИЖНЯЯ ЗОНА: «Пул деталей» (случайный порядок графем для клика или перетаскивания) */
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#71717A]">
                  Пул деталей (перетащите или нажмите по порядку)
                </span>
                <span className="text-xs font-mono-tabular text-[#C83E31] font-semibold">
                  Шаг {currentStepIndex + 1} из {targetGraphemes.length}
                </span>
              </div>

              <div
                data-testid="grapheme-parts-pool"
                className="grid grid-cols-2 gap-2.5 w-full"
              >
                {poolTiles.map((tile) => {
                  const isWrong = wrongTileUid === tile.uid;

                  return (
                    <button
                      key={tile.uid}
                      type="button"
                      draggable={!tile.isPlaced}
                      disabled={tile.isPlaced}
                      onDragStart={(e) => handleDragStart(e, tile)}
                      onClick={() => handleSelectTile(tile)}
                      data-testid={`grapheme-pool-tile-${tile.grapheme.char}`}
                      className={`group relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all select-none ${
                        tile.isPlaced
                          ? 'bg-[#F3EFE6]/60 border-[#EAE3D5] opacity-40 cursor-default scale-[0.98]'
                          : isWrong
                          ? 'bg-[#FDF2F0] border-[#C83E31] text-[#C83E31] ring-2 ring-[#C83E31]/25 scale-[0.97] cursor-pointer'
                          : 'bg-white border-[#EAE3D5] hover:border-[#C83E31]/60 hover:bg-[#FFFEFA] shadow-2xs hover:shadow-sm active:scale-[0.97] cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      <span
                        className={`w-11 h-11 rounded-lg flex items-center justify-center font-chinese text-2xl font-bold shrink-0 border transition-colors ${
                          tile.isPlaced
                            ? 'bg-[#EAE3D5]/50 border-[#D6CEB8] text-[#71717A]'
                            : tile.grapheme.type === 'radical'
                            ? 'bg-[#FDF2F0] border-[#C83E31]/40 text-[#C83E31] group-hover:bg-[#C83E31] group-hover:text-white'
                            : 'bg-[#FAF7F2] border-[#D6CEB8] text-[#18181B] group-hover:border-[#C83E31]/50'
                        }`}
                      >
                        {tile.grapheme.char}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-tabular text-xs font-bold text-[#18181B]">
                            {tile.grapheme.pinyin}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF7F2] border border-[#EAE3D5] text-[#C83E31] font-medium">
                            {tile.grapheme.type === 'radical' ? 'ключ' : 'часть'}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-[#52525B] truncate">
                          {tile.grapheme.meaning}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Строка обратной связи под пулом деталей */}
              <div
                role="status"
                aria-live="polite"
                className={`w-full text-center px-3.5 py-2.5 rounded-xl text-xs sm:text-sm leading-relaxed border ${
                  feedback.type === 'success'
                    ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
                    : feedback.type === 'mistake'
                    ? 'bg-[#FDF2F0] border-[#F5D0C8] text-[#C83E31]'
                    : 'bg-white border-[#EAE3D5] text-[#52525B]'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {feedback.type === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                  )}
                  {feedback.type === 'mistake' && (
                    <AlertCircle className="w-4 h-4 text-[#C83E31] shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
