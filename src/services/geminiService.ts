import type { WordItem } from '../types/hanzi';
import {
  extractChineseChars,
  normalizeWordItem,
  PRESET_WORDS,
  COMMON_WORD_TRANSLATIONS,
  COMMON_CHAR_MEANINGS,
  KNOWN_CHARACTERS,
} from '../utils/hanziUtils';

export interface BatchWordTranslationEntry {
  pinyin: string;
  translation: string;
  charMeanings: Record<string, string>;
}

/**
 * Анализирует введенный китайский текст (отдельный иероглиф или многосложное слово)
 * через серверный маршрут Gemini API (`gemini-2.5-flash` с JSON Schema) и возвращает
 * строго типизированный объект WordItem.
 */
export async function analyzeChineseInput(input: string): Promise<WordItem> {
  const chars = extractChineseChars(input);
  const cleanWord = chars.join('');

  if (!cleanWord) {
    throw new Error('Введите хотя бы один китайский иероглиф (например: 好, 老师, 学习, 图书馆).');
  }

  if (PRESET_WORDS[cleanWord]) {
    return normalizeWordItem(PRESET_WORDS[cleanWord], cleanWord);
  }

  try {
    const response = await fetch('/api/analyze-chinese', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: cleanWord }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || `Ошибка сервера: ${response.status}`);
    }

    const data = (await response.json()) as Partial<WordItem>;
    return normalizeWordItem(data, cleanWord);
  } catch {
    // Безопасный локальный разбор с помощью pinyin-pro при недоступности сети
    return normalizeWordItem(null, cleanWord);
  }
}

/**
 * Пакетный перевод списка китайских слов одним запросом к Gemini API.
 * Возвращает для каждого слова его общий пиньинь, точный русский перевод всего слова
 * и краткие значения каждого входящего иероглифа.
 */
export async function translateWordsBatch(
  words: string[]
): Promise<Record<string, BatchWordTranslationEntry>> {
  const cleanWords = Array.from(
    new Set(words.map((w) => extractChineseChars(w).join('')).filter(Boolean))
  );

  if (cleanWords.length === 0) {
    return {};
  }

  // Строим локальный базовый результат для мгновенного отклика и надежного fallback
  const localFallback: Record<string, BatchWordTranslationEntry> = {};
  for (const w of cleanWords) {
    const norm = normalizeWordItem(PRESET_WORDS[w] || null, w);
    const charMeanings: Record<string, string> = {};
    for (const c of norm.characters) {
      charMeanings[c.char] =
        KNOWN_CHARACTERS[c.char]?.meaning ||
        COMMON_CHAR_MEANINGS[c.char] ||
        c.meaning;
    }
    localFallback[w] = {
      pinyin: norm.pinyin,
      translation:
        PRESET_WORDS[w]?.translation ||
        COMMON_WORD_TRANSLATIONS[w] ||
        norm.translation,
      charMeanings,
    };
  }

  // Если все запрошенные слова уже есть в эталонном словаре PRESET_WORDS / COMMON_WORD_TRANSLATIONS,
  // но хотя бы одно слово требует ИИ-перевода — обращаемся к серверному маршруту Gemini API
  const needsRemoteCall = cleanWords.some(
    (w) => !PRESET_WORDS[w] && !COMMON_WORD_TRANSLATIONS[w]
  );

  if (!needsRemoteCall) {
    return localFallback;
  }

  try {
    const response = await fetch('/api/translate-words-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ words: cleanWords }),
    });

    if (!response.ok) {
      return localFallback;
    }

    const data = (await response.json()) as {
      translations?: Record<string, BatchWordTranslationEntry>;
    };

    if (data && data.translations && typeof data.translations === 'object') {
      return {
        ...localFallback,
        ...data.translations,
      };
    }

    return localFallback;
  } catch {
    return localFallback;
  }
}
