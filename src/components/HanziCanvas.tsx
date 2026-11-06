import React, { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import { Play, PenTool, Eye, EyeOff, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { loadHanziStrokes } from '../utils/strokeDataLoader';
import { useLanguage } from '../context/LanguageContext';

interface HanziCanvasProps {
  char: string;
  size?: number;
}

export const HanziCanvas: React.FC<HanziCanvasProps> = ({ char, size = 240 }) => {
  const { t } = useLanguage();
  const codePoints = Array.from((char || '').trim());
  const singleChar = codePoints[0] || '';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);

  const [mode, setMode] = useState<'animate' | 'quiz'>('animate');
  const [showOutline, setShowOutline] = useState<boolean>(true);
  const [isFallbackGlyph, setIsFallbackGlyph] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'idle' | 'info' | 'mistake' | 'success';
    message: string;
  }>({
    type: 'idle',
    message: t.canvasInitIdle,
  });
  const [mistakeCount, setMistakeCount] = useState<number>(0);

  useEffect(() => {
    let isCancelled = false;
    const el = containerRef.current;
    if (!el || !singleChar) return;

    el.innerHTML = '';
    writerRef.current = null;
    setMode('animate');
    setShowOutline(true);
    setMistakeCount(0);
    setIsFallbackGlyph(false);
    setFeedback({
      type: 'idle',
      message: t.canvasReadyIdle,
    });

    void (async () => {
      const strokeData = await loadHanziStrokes(singleChar);
      if (isCancelled || !containerRef.current) return;

      if (!strokeData || !Array.isArray(strokeData.strokes) || strokeData.strokes.length === 0) {
        setIsFallbackGlyph(true);
        setFeedback({
          type: 'info',
          message: `«${singleChar}»: ${t.canvasFallbackInfo}`,
        });
        return;
      }

      try {
        containerRef.current.innerHTML = '';
        const writer = HanziWriter.create(containerRef.current, singleChar, {
          width: size,
          height: size,
          padding: 16,
          showOutline: true,
          showCharacter: true,
          strokeColor: '#18181B',
          radicalColor: '#C83E31',
          outlineColor: '#D6CEB8',
          drawingColor: '#C83E31',
          drawingWidth: 18,
          strokeAnimationSpeed: 1.15,
          delayBetweenStrokes: 220,
          showHintAfterMisses: 2,
          highlightOnComplete: true,
          highlightColor: '#15803D',
          charDataLoader: (_loadedChar, onComplete) => {
            onComplete(strokeData as never);
          },
          onLoadCharDataError: () => {
            if (!isCancelled) {
              setIsFallbackGlyph(true);
              setFeedback({
                type: 'info',
                message: `«${singleChar}»: ${t.canvasFallbackShort}`,
              });
            }
          },
        });

        writerRef.current = writer;
      } catch {
        if (!isCancelled) {
          setIsFallbackGlyph(true);
          setFeedback({
            type: 'info',
            message: `«${singleChar}»: ${t.canvasFallbackShort}`,
          });
        }
      }
    })();

    return () => {
      isCancelled = true;
      if (el) {
        el.innerHTML = '';
      }
      writerRef.current = null;
    };
  }, [singleChar, size, t]);

  const handleAnimate = () => {
    if (isFallbackGlyph) {
      setShowOutline(true);
      setFeedback({
        type: 'info',
        message: `«${singleChar}»: ${t.canvasAnimateFallback}`,
      });
      return;
    }

    const writer = writerRef.current;
    if (!writer) return;

    setMode('animate');
    setFeedback({
      type: 'info',
      message: `«${singleChar}»: ${t.canvasAnimating}`,
    });

    try {
      writer.cancelQuiz();
      writer.showCharacter();
      if (showOutline) {
        writer.showOutline();
      } else {
        writer.hideOutline();
      }

      writer.animateCharacter({
        onComplete: () => {
          setFeedback({
            type: 'success',
            message: `«${singleChar}»: ${t.canvasAnimateComplete}`,
          });
        },
      });
    } catch {
      setIsFallbackGlyph(true);
    }
  };

  const handleStartQuiz = () => {
    if (isFallbackGlyph) {
      setFeedback({
        type: 'info',
        message: `«${singleChar}»: ${t.canvasQuizUnavailable}`,
      });
      return;
    }

    const writer = writerRef.current;
    if (!writer) return;

    setMode('quiz');
    setMistakeCount(0);
    setFeedback({
      type: 'info',
      message: `«${singleChar}»: ${t.canvasQuizPrompt}`,
    });

    try {
      writer.hideCharacter();
      if (showOutline) {
        writer.showOutline();
      } else {
        writer.hideOutline();
      }

      writer.quiz({
        onMistake: (strokeData) => {
          setMistakeCount(strokeData.totalMistakes);
          setFeedback({
            type: 'mistake',
            message: `${t.canvasMistakePrefix}${strokeData.strokeNum + 1}. ${t.canvasMistakeHint} ${strokeData.totalMistakes}).`,
          });
        },
        onCorrectStroke: (strokeData) => {
          setFeedback({
            type: 'info',
            message: `${t.canvasCorrectPrefix}${strokeData.strokeNum + 1} ${t.canvasCorrectRemaining} ${strokeData.strokesRemaining}.`,
          });
        },
        onComplete: (summaryData) => {
          setMistakeCount(summaryData.totalMistakes);
          setFeedback({
            type: 'success',
            message:
              summaryData.totalMistakes === 0
                ? `«${singleChar}»: ${t.canvasCompletePerfect}`
                : `«${singleChar}»: ${t.canvasCompleteGood} ${summaryData.totalMistakes}).`,
          });
        },
      });
    } catch {
      setIsFallbackGlyph(true);
    }
  };

  const handleToggleOutline = () => {
    const writer = writerRef.current;
    const nextState = !showOutline;
    setShowOutline(nextState);

    if (writer && !isFallbackGlyph) {
      try {
        if (nextState) {
          writer.showOutline();
        } else {
          writer.hideOutline();
        }
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Стеклянная рамка настольного планшета мастера каллиграфии + киноварная сетка Мицзыгэ */}
      <div className="border border-white/90 p-3 rounded-3xl bg-white/75 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.05)] ring-1 ring-stone-900/5 mx-auto">
        <div
          className="relative bg-white border-2 border-[#C83E31]/80 rounded-2xl shadow-2xs overflow-hidden mx-auto select-none touch-none worksheet-cell-container"
          style={{
            width: size,
            height: size,
            maxWidth: '100%',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            writingMode: 'horizontal-tb',
            direction: 'ltr',
          }}
          data-testid={`hanzi-canvas-${singleChar}`}
        >
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
          >
            {/* Внешняя тонкая рамка */}
            <rect
              x="2"
              y="2"
              width="96"
              height="96"
              fill="none"
              stroke="#F5D0C8"
              strokeWidth="0.75"
            />
            {/* Горизонтальная и вертикальная оси (Тяньцзыгэ) */}
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
            {/* Диагональные линии (Мицзыгэ) */}
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

          {/* Текстовый каллиграфический fallback (KaiTi / Noto Serif SC), если знака нет в hanzi-writer-data */}
          {isFallbackGlyph ? (
            <div
              data-testid="hanzi-canvas-fallback"
              className="relative z-10 w-full h-full flex items-center justify-center select-none"
              style={{
                fontFamily: '"KaiTi", "Kaiti SC", "STKaiti", "Noto Serif SC", "Ma Shan Zheng", serif',
                fontSize: `${Math.round(size * 0.68)}px`,
                lineHeight: 1,
                color: showOutline ? '#18181B' : '#D6CEB8',
                transition: 'color 150ms ease',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              aria-label={singleChar}
            >
              {singleChar}
            </div>
          ) : (
            /* Контейнер HanziWriter */
            <div
              ref={containerRef}
              className="relative z-10 w-full h-full cursor-crosshair select-none touch-none"
              style={{
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              aria-label={singleChar}
            />
          )}
        </div>
      </div>

      {/* Панель управления под холстом: тактильные кнопки в эстетике Spatial Glass */}
      <div className="mt-4 grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center gap-2.5 w-full max-w-[320px] sm:max-w-none">
        <button
          type="button"
          onClick={handleAnimate}
          disabled={isFallbackGlyph}
          className={`inline-flex items-center justify-center gap-2 px-4 py-3 h-12 min-h-[48px] text-sm font-semibold rounded-2xl transition-all duration-200 whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
            mode === 'animate' && !isFallbackGlyph
              ? 'bg-gradient-to-b from-stone-800 to-stone-950 text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0'
              : 'bg-white/80 hover:bg-white text-stone-800 border border-white shadow-xs hover:shadow-md'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>{t.canvasAnimateBtn}</span>
        </button>

        <button
          type="button"
          onClick={handleStartQuiz}
          disabled={isFallbackGlyph}
          className={`inline-flex items-center justify-center gap-2 px-4 py-3 h-12 min-h-[48px] text-sm font-semibold rounded-2xl transition-all duration-200 whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
            mode === 'quiz' && !isFallbackGlyph
              ? 'bg-gradient-to-b from-stone-800 to-stone-950 text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0'
              : 'bg-white/80 hover:bg-white text-[#C83E31] border border-white shadow-xs hover:shadow-md'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>{t.canvasPracticeBtn}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleOutline}
          className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 px-4 py-3 h-12 min-h-[48px] text-sm font-medium bg-white/80 hover:bg-white text-stone-800 border border-white rounded-2xl shadow-xs hover:shadow-md transition-all whitespace-nowrap cursor-pointer"
          aria-pressed={showOutline}
        >
          {showOutline ? (
            <>
              <EyeOff className="w-4 h-4 text-stone-500" />
              <span>{t.canvasHideOutlineBtn}</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-stone-500" />
              <span>{t.canvasShowOutlineBtn}</span>
            </>
          )}
        </button>

        {mode === 'quiz' && !isFallbackGlyph && (
          <button
            type="button"
            onClick={handleStartQuiz}
            title={t.canvasResetTitle}
            aria-label={t.canvasResetAria}
            className="col-span-2 sm:col-span-1 inline-flex items-center justify-center p-3 h-12 min-h-[48px] text-sm font-medium bg-white/80 hover:bg-white text-stone-700 border border-white rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 mr-1.5 sm:mr-0" />
            <span className="sm:hidden">{t.canvasResetBtn}</span>
          </button>
        )}
      </div>

      {/* Статусная строка обратной связи */}
      <div
        className={`mt-3 w-full max-w-[300px] text-center px-4 py-2.5 rounded-2xl text-sm leading-relaxed border backdrop-blur-md ${
          feedback.type === 'success'
            ? 'bg-emerald-50/85 border-emerald-200/80 text-emerald-700'
            : feedback.type === 'mistake'
            ? 'bg-[#FDF2F0]/90 border-[#F5D0C8] text-[#C83E31]'
            : 'bg-white/75 border-white/90 text-stone-600 shadow-2xs'
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-center gap-2">
          {feedback.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          )}
          {feedback.type === 'mistake' && (
            <AlertCircle className="w-4 h-4 text-[#C83E31] shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
        {mode === 'quiz' && mistakeCount > 0 && (
          <div className="mt-1 text-xs text-stone-500 font-mono-tabular">
            {t.canvasMistakesTotal}: {mistakeCount}
          </div>
        )}
      </div>
    </div>
  );
};
