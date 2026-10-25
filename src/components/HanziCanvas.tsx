import React, { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import { Play, PenTool, Eye, EyeOff, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { loadHanziStrokes } from '../utils/strokeDataLoader';

interface HanziCanvasProps {
  char: string;
  size?: number;
}

export const HanziCanvas: React.FC<HanziCanvasProps> = ({ char, size = 240 }) => {
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
    message: 'Нажмите «Анимация» для просмотра порядка черт или «Практика письма» для тренажера.',
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
      message: 'Готово к анимации черт или интерактивной практике письма.',
    });

    void (async () => {
      const strokeData = await loadHanziStrokes(singleChar);
      if (isCancelled || !containerRef.current) return;

      if (!strokeData || !Array.isArray(strokeData.strokes) || strokeData.strokes.length === 0) {
        // Если введена латиница, пунктуация или редкий иероглиф, которого нет в базе hanzi-writer-data
        setIsFallbackGlyph(true);
        setFeedback({
          type: 'info',
          message: `Для знака «${singleChar}» нет векторных данных черт — включен каллиграфический показ шрифтом KaiTi / Noto Serif SC.`,
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
          strokeColor: '#0F172A',
          radicalColor: '#E11D48',
          outlineColor: '#CBD5E1',
          drawingColor: '#E11D48',
          drawingWidth: 18,
          strokeAnimationSpeed: 1.15,
          delayBetweenStrokes: 220,
          showHintAfterMisses: 2,
          highlightOnComplete: true,
          highlightColor: '#059669',
          charDataLoader: (_loadedChar, onComplete) => {
            onComplete(strokeData as never);
          },
          onLoadCharDataError: () => {
            if (!isCancelled) {
              setIsFallbackGlyph(true);
              setFeedback({
                type: 'info',
                message: `Для знака «${singleChar}» включено отображение шрифтом KaiTi / Noto Serif SC.`,
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
            message: `Для знака «${singleChar}» включено отображение шрифтом KaiTi / Noto Serif SC.`,
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
  }, [singleChar, size]);

  const handleAnimate = () => {
    if (isFallbackGlyph) {
      setShowOutline(true);
      setFeedback({
        type: 'info',
        message: `Показано эталонное начертание «${singleChar}» шрифтом KaiTi / Noto Serif SC.`,
      });
      return;
    }

    const writer = writerRef.current;
    if (!writer) return;

    setMode('animate');
    setFeedback({
      type: 'info',
      message: `Анимация написания иероглифа «${singleChar}» по порядку черт...`,
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
            message: `Порядок черт для «${singleChar}» показан полностью.`,
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
        message: `Интерактивная проверка черт недоступна для редкого знака «${singleChar}». Используйте каллиграфический образец выше.`,
      });
      return;
    }

    const writer = writerRef.current;
    if (!writer) return;

    setMode('quiz');
    setMistakeCount(0);
    setFeedback({
      type: 'info',
      message: `Рисуйте черты иероглифа «${singleChar}» мышкой, стилусом или пальцем в правильном порядке.`,
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
            message: `Неверная черта №${strokeData.strokeNum + 1}. Попробуйте провести её по направлению письма (ошибок: ${strokeData.totalMistakes}).`,
          });
        },
        onCorrectStroke: (strokeData) => {
          setFeedback({
            type: 'info',
            message: `Отлично! Черта №${strokeData.strokeNum + 1} верна. Осталось черт: ${strokeData.strokesRemaining}.`,
          });
        },
        onComplete: (summaryData) => {
          setMistakeCount(summaryData.totalMistakes);
          setFeedback({
            type: 'success',
            message:
              summaryData.totalMistakes === 0
                ? `Безупречно! Вы написали «${singleChar}» без единой ошибки!`
                : `Молодец! Иероглиф «${singleChar}» написан (всего ошибок: ${summaryData.totalMistakes}).`,
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
      {/* Квадратный холст с классической сеткой Мицзыгэ (米字格) - центрирован, touch-action: none */}
      <div
        className="relative bg-white border-2 border-rose-700/80 rounded-2xl shadow-xs overflow-hidden mx-auto select-none touch-none"
        style={{
          width: size,
          height: size,
          maxWidth: '100%',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
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
            stroke="#FECDD3"
            strokeWidth="0.75"
          />
          {/* Горизонтальная и вертикальная оси (Тяньцзыгэ) */}
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="#FDA4AF"
            strokeWidth="0.9"
            strokeDasharray="3,3"
          />
          <line
            x1="50"
            y1="0"
            x2="50"
            y2="100"
            stroke="#FDA4AF"
            strokeWidth="0.9"
            strokeDasharray="3,3"
          />
          {/* Диагональные линии (Мицзыгэ) */}
          <line
            x1="0"
            y1="0"
            x2="100"
            y2="100"
            stroke="#FECDD3"
            strokeWidth="0.75"
            strokeDasharray="2.5,3.5"
          />
          <line
            x1="100"
            y1="0"
            x2="0"
            y2="100"
            stroke="#FECDD3"
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
              color: showOutline ? '#0F172A' : '#CBD5E1',
              transition: 'color 150ms ease',
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
            aria-label={`Каллиграфическое начертание знака ${singleChar}`}
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
            aria-label={`Холст для написания иероглифа ${singleChar}`}
          />
        )}
      </div>

      {/* Панель управления под холстом: на мобильных сетка на всю ширину с touch-зонами не менее 44px */}
      <div className="mt-4 grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center gap-2.5 w-full max-w-[320px] sm:max-w-none">
        <button
          type="button"
          onClick={handleAnimate}
          disabled={isFallbackGlyph}
          className={`inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-sm font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
            mode === 'animate' && !isFallbackGlyph
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>Анимация</span>
        </button>

        <button
          type="button"
          onClick={handleStartQuiz}
          disabled={isFallbackGlyph}
          className={`inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-sm font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
            mode === 'quiz' && !isFallbackGlyph
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>Практика</span>
        </button>

        <button
          type="button"
          onClick={handleToggleOutline}
          className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          aria-pressed={showOutline}
        >
          {showOutline ? (
            <>
              <EyeOff className="w-4 h-4 text-slate-500" />
              <span>Скрыть контур</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-slate-500" />
              <span>Показать контур</span>
            </>
          )}
        </button>

        {mode === 'quiz' && !isFallbackGlyph && (
          <button
            type="button"
            onClick={handleStartQuiz}
            title="Начать практику заново"
            aria-label="Сбросить практику письма"
            className="col-span-2 sm:col-span-1 inline-flex items-center justify-center p-3 min-h-[44px] text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 mr-1.5 sm:mr-0" />
            <span className="sm:hidden">Сбросить черты</span>
          </button>
        )}
      </div>

      {/* Статусная строка обратной связи */}
      <div
        className={`mt-3 w-full max-w-[300px] text-center px-4 py-2.5 rounded-xl text-sm leading-relaxed border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : feedback.type === 'mistake'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-slate-50 border-slate-200/80 text-slate-600'
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-center gap-2">
          {feedback.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          {feedback.type === 'mistake' && (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
        {mode === 'quiz' && mistakeCount > 0 && (
          <div className="mt-1 text-xs text-slate-500 font-mono-tabular">
            Ошибок за попытку: {mistakeCount}
          </div>
        )}
      </div>
    </div>
  );
};
