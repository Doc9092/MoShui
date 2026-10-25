import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Volume2,
  Trophy,
  Flame,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Puzzle,
  Headphones,
  Sparkles,
  ArrowRight,
  BookOpen,
  ListPlus,
} from 'lucide-react';
import type { WordItem } from '../types/hanzi';
import {
  extractChineseChars,
  generatePinyinToneOptions,
} from '../utils/hanziUtils';
import { speakChinese } from '../services/audioService';
import { MOSHUI_LOGO_SRC } from './Navbar';

interface GamesViewProps {
  worksheetList: WordItem[];
  onNavigateToDictionary: () => void;
  onNavigateToWorksheet: () => void;
}

type GameMode = 'word-builder' | 'audio-sprint' | 'pinyin-master';

const EXTRA_DISTRACTOR_CHARS = ['大', '小', '人', '口', '日', '月', '水', '火', '山', '木', '天', '生'];
const MIN_WORDS_FOR_GAMES = 4;

export const GamesView: React.FC<GamesViewProps> = ({
  worksheetList,
  onNavigateToDictionary,
  onNavigateToWorksheet,
}) => {
  const [activeGame, setActiveGame] = useState<GameMode>('word-builder');

  // Счетчики очков и серии правильных ответов (Streak)
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);

  // Текущий вопрос
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [roundFeedback, setRoundFeedback] = useState<{
    status: 'idle' | 'correct' | 'wrong';
    message: string;
  }>({ status: 'idle', message: '' });

  // Состояние для Игры 1: «Собери слово»
  const [assembledChars, setAssembledChars] = useState<{ char: string; tileIdx: number }[]>([]);

  const hasEnoughWords = worksheetList.length >= MIN_WORDS_FOR_GAMES;

  // Для игры 1 («Собери слово») приоритезируем многосложные слова (2+ иероглифа), если они есть в списке пользователя
  const gamePool = useMemo(() => {
    if (!hasEnoughWords) return [];
    if (activeGame === 'word-builder') {
      const multiChar = worksheetList.filter((w) => extractChineseChars(w.word).length >= 2);
      return multiChar.length > 0 ? multiChar : worksheetList;
    }
    return worksheetList;
  }, [activeGame, worksheetList, hasEnoughWords]);

  const currentTarget: WordItem | undefined =
    gamePool.length > 0 ? gamePool[questionIndex % gamePool.length] : undefined;

  const targetChars = useMemo(
    () => (currentTarget ? extractChineseChars(currentTarget.word) : []),
    [currentTarget]
  );

  // Плитки иероглифов для Игры 1
  const wordBuilderTiles = useMemo(() => {
    if (!currentTarget) return [];
    const poolChars = [...targetChars];
    const seed = questionIndex + currentTarget.word.charCodeAt(0);
    for (const d of EXTRA_DISTRACTOR_CHARS) {
      if (poolChars.length >= Math.max(6, targetChars.length + 3)) break;
      if (!poolChars.includes(d)) {
        poolChars.push(d);
      }
    }
    const indexed = poolChars.map((char, idx) => ({
      char,
      sortKey: ((idx + 1) * 9301 + seed * 49297) % 233280,
    }));
    indexed.sort((a, b) => a.sortKey - b.sortKey);
    return indexed.map((item) => item.char);
  }, [targetChars, questionIndex, currentTarget]);

  // 4 карточки вариантов для Игры 2 («Аудио-спринт») из списка пользователя
  const audioSprintOptions = useMemo(() => {
    if (!currentTarget) return [];
    const others = worksheetList.filter((w) => w.word !== currentTarget.word);
    const picked = others.slice(0, 3);
    const all = [currentTarget, ...picked];
    return all.sort((a, b) => a.word.localeCompare(b.word));
  }, [worksheetList, currentTarget]);

  // 4 варианта пиньиня с тонами для Игры 3 («Мастер пиньиня и тонов»)
  const pinyinMasterOptions = useMemo(() => {
    if (!currentTarget) return [];
    return generatePinyinToneOptions(currentTarget.pinyin);
  }, [currentTarget]);

  const resetCurrentRoundState = useCallback(() => {
    setAssembledChars([]);
    setRoundFeedback({ status: 'idle', message: '' });
  }, []);

  useEffect(() => {
    resetCurrentRoundState();
    if (hasEnoughWords && currentTarget && (activeGame === 'audio-sprint' || activeGame === 'word-builder')) {
      speakChinese(currentTarget.word);
    }
  }, [questionIndex, activeGame, currentTarget, hasEnoughWords, resetCurrentRoundState]);

  const registerAnswer = (isCorrect: boolean, successMsg: string, errorMsg: string) => {
    if (!currentTarget) return;
    if (isCorrect) {
      const nextStreak = streak + 1;
      setScore((prev) => prev + 10 + streak * 2);
      setStreak(nextStreak);
      if (nextStreak > bestStreak) {
        setBestStreak(nextStreak);
      }
      setRoundFeedback({ status: 'correct', message: successMsg });
      speakChinese(currentTarget.word);
    } else {
      setStreak(0);
      setRoundFeedback({ status: 'wrong', message: errorMsg });
    }
  };

  const handleNextQuestion = () => {
    setQuestionIndex((prev) => prev + 1);
  };

  const handleSelectTile = (char: string, tileIdx: number) => {
    if (!currentTarget || roundFeedback.status === 'correct') return;
    if (assembledChars.some((item) => item.tileIdx === tileIdx)) return;

    const nextAssembled = [...assembledChars, { char, tileIdx }];
    setAssembledChars(nextAssembled);

    const expectedPrefix = targetChars.slice(0, nextAssembled.length).join('');
    const currentString = nextAssembled.map((x) => x.char).join('');

    if (currentString !== expectedPrefix) {
      registerAnswer(
        false,
        '',
        `Неверный порядок знаков! Попробуйте еще раз собрать слово «${currentTarget.translation}».`
      );
      setAssembledChars([]);
      return;
    }

    if (nextAssembled.length === targetChars.length) {
      registerAnswer(
        true,
        `Отлично! Вы собрали слово «${currentTarget.word}» (${currentTarget.pinyin}) — ${currentTarget.translation}.`,
        ''
      );
    } else {
      setRoundFeedback({
        status: 'idle',
        message: `Верно! Выберите следующий иероглиф (${nextAssembled.length} из ${targetChars.length}).`,
      });
    }
  };

  const handleAudioSprintChoice = (chosen: WordItem) => {
    if (!currentTarget || roundFeedback.status === 'correct') return;
    const isCorrect = chosen.word === currentTarget.word;
    registerAnswer(
      isCorrect,
      `Верно на слух! Это «${currentTarget.word}» (${currentTarget.pinyin}) — ${currentTarget.translation}.`,
      `Ошибка! Прозвучало слово «${currentTarget.word}» (${currentTarget.pinyin}), а не «${chosen.word}».`
    );
  };

  const handlePinyinMasterChoice = (chosenPinyin: string) => {
    if (!currentTarget || roundFeedback.status === 'correct') return;
    const isCorrect = chosenPinyin === currentTarget.pinyin;
    registerAnswer(
      isCorrect,
      `Точно в тон! «${currentTarget.word}» читается как [${currentTarget.pinyin}].`,
      `Неверный тон! Правильная транскрипция для «${currentTarget.word}» — [${currentTarget.pinyin}].`
    );
  };

  // Если в списке пользователя меньше 4 слов — отображаем честный экран-заглушку с фирменным логотипом и прогресс-баром
  if (!hasEnoughWords || !currentTarget) {
    const currentCount = worksheetList.length;
    const progressPercent = Math.min(100, Math.round((currentCount / MIN_WORDS_FOR_GAMES) * 100));

    return (
      <div className="space-y-8">
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
            Интерактивные игры и тренажеры лексики
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Закрепляйте порядок иероглифов в многосложных словах, восприятие на слух и тоны пиньиня
            на основе вашего персонального списка прописей.
          </p>
        </section>

        <section
          aria-label="Недостаточно слов для запуска игр"
          data-testid="games-empty-state"
          className="bg-white border border-slate-200 rounded-2xl p-10 sm:p-16 text-center shadow-2xs max-w-3xl mx-auto"
        >
          <div className="flex flex-col items-center">
            <img
              src={MOSHUI_LOGO_SRC}
              alt="MoShui 墨水"
              data-testid="games-empty-logo"
              className="h-24 w-24 object-contain opacity-75 mb-5"
            />

            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 text-balance">
              Для запуска игр добавьте минимум 4 слова или иероглифа в свой список прописей (сейчас
              добавлено: {currentCount} из {MIN_WORDS_FOR_GAMES})
            </h2>

            {/* Прогресс-бар наполнения списка */}
            <div className="mt-6 w-full max-w-md space-y-2.5">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-600 font-mono-tabular">
                <span>Прогресс готовности словаря</span>
                <span className="text-rose-700 font-bold">
                  {currentCount} / {MIN_WORDS_FOR_GAMES}
                </span>
              </div>
              <div
                className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200"
                role="progressbar"
                aria-valuenow={currentCount}
                aria-valuemin={0}
                aria-valuemax={MIN_WORDS_FOR_GAMES}
              >
                <div
                  className="h-full bg-rose-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={onNavigateToDictionary}
                className="inline-flex items-center gap-2.5 px-6 py-3 text-base font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer"
              >
                <BookOpen className="w-5 h-5" />
                <span>Перейти в «Словарь и Практика»</span>
              </button>

              <button
                type="button"
                onClick={onNavigateToWorksheet}
                className="inline-flex items-center gap-2.5 px-6 py-3 text-base font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <ListPlus className="w-5 h-5" />
                <span>Открыть «Конструктор прописей»</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Верхняя панель игр и счетчиков очков/серии */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
              Интерактивные игры и тренажеры лексики
            </h1>
            <p className="mt-1.5 text-base text-slate-600">
              Тренировка по вашему списку прописей ({worksheetList.length} слов).
            </p>
          </div>

          {/* Статистика игрока: Очки и Серия (Streak) */}
          <div className="flex flex-wrap items-center gap-6 bg-slate-50 border border-slate-200/80 rounded-xl px-6 py-3.5 shrink-0">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-amber-500" />
              <div>
                <div className="text-xs font-medium text-slate-500">Очки</div>
                <div
                  className="text-xl font-bold text-slate-900 font-mono-tabular"
                  data-testid="game-score"
                >
                  {score}
                </div>
              </div>
            </div>

            <div className="h-9 w-px bg-slate-200" aria-hidden="true" />

            <div className="flex items-center gap-3">
              <Flame className="w-6 h-6 text-rose-600" />
              <div>
                <div className="text-xs font-medium text-slate-500">Серия (Streak)</div>
                <div
                  className="text-xl font-bold text-rose-700 font-mono-tabular"
                  data-testid="game-streak"
                >
                  {streak}{' '}
                  <span className="text-sm font-normal text-slate-400">(макс. {bestStreak})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Переключатель 3 игровых режимов со свайпом на мобильных */}
        <div className="pt-4 sm:pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div
            role="tablist"
            aria-label="Игровые режимы"
            className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar py-1 w-full sm:w-auto"
          >
            <button
              role="tab"
              type="button"
              aria-selected={activeGame === 'word-builder'}
              onClick={() => setActiveGame('word-builder')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[44px] ${
                activeGame === 'word-builder'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Puzzle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>1. Собери слово</span>
            </button>

            <button
              role="tab"
              type="button"
              aria-selected={activeGame === 'audio-sprint'}
              onClick={() => setActiveGame('audio-sprint')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[44px] ${
                activeGame === 'audio-sprint'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Headphones className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>2. Аудио-спринт</span>
            </button>

            <button
              role="tab"
              type="button"
              aria-selected={activeGame === 'pinyin-master'}
              onClick={() => setActiveGame('pinyin-master')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[44px] ${
                activeGame === 'pinyin-master'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>3. Мастер пиньиня и тонов</span>
            </button>
          </div>

          <div className="text-sm text-slate-500 font-mono-tabular">
            Активный словарь: Моя пропись ({worksheetList.length} слов)
          </div>
        </div>
      </section>

      {/* Игровая сцена */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-2xs max-w-4xl mx-auto">
        {/* ИГРА 1: «Собери слово (Конструктор слов)» */}
        {activeGame === 'word-builder' && (
          <div className="space-y-8 text-center">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-rose-700">
                Игра 1 · Собери слово по порядку иероглифов ({targetChars.length} знака)
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900">
                «{currentTarget.translation}»
              </h2>
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => speakChinese(currentTarget.word)}
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <Volume2 className="w-5 h-5 text-rose-600" />
                  <span>Прослушать произношение ({currentTarget.pinyin})</span>
                </button>
              </div>
            </div>

            {/* Слоты собираемого слова */}
            <div className="flex items-center justify-center gap-4">
              {targetChars.map((_, slotIdx) => {
                const filled = assembledChars[slotIdx];
                return (
                  <div
                    key={slotIdx}
                    className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 flex items-center justify-center font-hanzi text-4xl sm:text-5xl font-bold transition-all ${
                      filled
                        ? 'bg-rose-50 border-rose-600 text-slate-900'
                        : 'bg-slate-50 border-dashed border-slate-300 text-slate-300'
                    }`}
                  >
                    {filled ? filled.char : slotIdx + 1}
                  </div>
                );
              })}
            </div>

            {/* Разбросанные иероглифы для выбора */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 max-w-xl mx-auto">
              {wordBuilderTiles.map((tileChar, idx) => {
                const isUsed = assembledChars.some((item) => item.tileIdx === idx);
                return (
                  <button
                    key={`${tileChar}-${idx}`}
                    type="button"
                    disabled={isUsed}
                    onClick={() => handleSelectTile(tileChar, idx)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border font-hanzi text-3xl sm:text-4xl font-bold transition-all cursor-pointer ${
                      isUsed
                        ? 'bg-slate-100 border-slate-200 text-slate-300 opacity-40 cursor-default'
                        : 'bg-white border-slate-300 text-slate-900 hover:border-rose-600 hover:bg-rose-50/40 shadow-2xs'
                    }`}
                  >
                    {tileChar}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ИГРА 2: «Аудио-спринт (Угадай на слух)» */}
        {activeGame === 'audio-sprint' && (
          <div className="space-y-8 text-center">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-rose-700">
                Игра 2 · Аудио-спринт (Угадай слово на слух)
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                Прослушайте аудио и выберите правильную карточку слова
              </h2>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => speakChinese(currentTarget.word)}
                  className="inline-flex items-center gap-3 px-7 py-4 text-base font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Volume2 className="w-5 h-5" />
                  <span>Прослушать слово еще раз</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {audioSprintOptions.map((option) => (
                <button
                  key={option.word}
                  type="button"
                  onClick={() => handleAudioSprintChoice(option)}
                  className="p-6 bg-slate-50 hover:bg-white border border-slate-200 hover:border-rose-600 rounded-xl text-left transition-all flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <div className="font-hanzi text-4xl font-bold text-slate-900">
                      {option.word}
                    </div>
                    <div className="mt-1.5 text-base text-slate-600">{option.translation}</div>
                  </div>
                  <span className="text-sm font-mono-tabular text-slate-400">Выбрать →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ИГРА 3: «Мастер пиньиня и тонов» */}
        {activeGame === 'pinyin-master' && (
          <div className="space-y-8 text-center">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-rose-700">
                Игра 3 · Мастер пиньиня и тонов
              </div>
              <div className="py-3">
                <span className="font-hanzi text-6xl sm:text-7xl font-bold text-slate-900">
                  {currentTarget.word}
                </span>
              </div>
              <p className="text-lg font-medium text-slate-700">
                Значение: «{currentTarget.translation}»
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
              {pinyinMasterOptions.map((pyOption) => (
                <button
                  key={pyOption}
                  type="button"
                  onClick={() => handlePinyinMasterChoice(pyOption)}
                  className="py-4 px-6 bg-slate-50 hover:bg-white border border-slate-200 hover:border-rose-600 rounded-xl font-mono-tabular text-xl font-bold text-slate-900 transition-all cursor-pointer"
                >
                  {pyOption}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Полоса обратной связи и кнопка перехода к следующему слову */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-base">
            {roundFeedback.status === 'correct' && (
              <span className="inline-flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{roundFeedback.message}</span>
              </span>
            )}
            {roundFeedback.status === 'wrong' && (
              <span className="inline-flex items-center gap-2 text-rose-700 font-semibold">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{roundFeedback.message}</span>
              </span>
            )}
            {roundFeedback.status === 'idle' && (
              <span className="text-slate-500 text-sm">
                {roundFeedback.message ||
                  `Вопрос ${(questionIndex % gamePool.length) + 1} из ${gamePool.length}`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={resetCurrentRoundState}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Сбросить</span>
            </button>

            <button
              type="button"
              onClick={handleNextQuestion}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <span>Следующее слово</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
