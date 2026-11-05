import type { WordItem } from '../types/hanzi';
import {
  extractChineseChars,
  normalizeWordItem,
  isPlaceholderTranslation,
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

async function fetchDirectRussianTranslation(text: string): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=ru&dt=t&q=${encodeURIComponent(
      clean
    )}`;
    const response = await fetch(url);
    if (!response.ok) return '';
    const data = (await response.json()) as unknown[];
    if (Array.isArray(data?.[0])) {
      const segments = data[0] as Array<[string]>;
      const joined = segments
        .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
        .join('')
        .trim();
      if (joined && joined !== clean) {
        return joined.charAt(0).toLowerCase() + joined.slice(1);
      }
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Анализирует введенный китайский текст (отдельный иероглиф или многосложное слово)
 * через серверный маршрут Gemini API и возвращает строго типизированный объект WordItem.
 */
export async function analyzeChineseInput(input: string): Promise<WordItem> {
  const chars = extractChineseChars(input.trim());
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
    const normalized = normalizeWordItem(data, cleanWord);
    if (isPlaceholderTranslation(normalized.translation)) {
      const tr = await fetchDirectRussianTranslation(cleanWord);
      if (tr) normalized.translation = tr;
    }
    return normalized;
  } catch {
    const fallback = normalizeWordItem(null, cleanWord);
    if (isPlaceholderTranslation(fallback.translation)) {
      const tr = await fetchDirectRussianTranslation(cleanWord);
      if (tr) fallback.translation = tr;
    }
    await Promise.all(
      fallback.characters.map(async (chObj) => {
        if (isPlaceholderTranslation(chObj.meaning)) {
          const chTr = await fetchDirectRussianTranslation(chObj.char);
          if (chTr) chObj.meaning = chTr;
        }
      })
    );
    return fallback;
  }
}

/**
 * Пакетный перевод списка китайских слов (как одиночных иероглифов, так и двусложных/многосложных слов)
 * одним запросом к серверному маршруту ИИ с надежным резервным переводом каждого слова и знака.
 */
export async function translateWordsBatch(
  words: string[],
  options?: { forceRemote?: boolean }
): Promise<Record<string, BatchWordTranslationEntry>> {
  const cleanWords = Array.from(
    new Set(
      words
        .map((w) => extractChineseChars((w || '').trim()).join(''))
        .filter(Boolean)
    )
  );

  if (cleanWords.length === 0) {
    return {};
  }

  // Строим локальный базовый результат для мгновенного отклика
  const mergedResult: Record<string, BatchWordTranslationEntry> = {};
  for (const w of cleanWords) {
    const norm = normalizeWordItem(PRESET_WORDS[w] || null, w);
    const charMeanings: Record<string, string> = {};
    for (const c of norm.characters) {
      charMeanings[c.char] =
        KNOWN_CHARACTERS[c.char]?.meaning ||
        COMMON_CHAR_MEANINGS[c.char] ||
        c.meaning;
    }
    mergedResult[w] = {
      pinyin: norm.pinyin,
      translation:
        PRESET_WORDS[w]?.translation ||
        COMMON_WORD_TRANSLATIONS[w] ||
        norm.translation,
      charMeanings,
    };
  }

  const needsRemoteCall =
    Boolean(options?.forceRemote) ||
    cleanWords.some(
      (w) =>
        isPlaceholderTranslation(mergedResult[w]?.translation) ||
        Object.values(mergedResult[w]?.charMeanings || {}).some((m) =>
          isPlaceholderTranslation(m)
        )
    );

  if (needsRemoteCall) {
    try {
      const response = await fetch('/api/translate-words-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ words: cleanWords }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          translations?: Record<string, BatchWordTranslationEntry>;
        };

        if (data && data.translations && typeof data.translations === 'object') {
          for (const [rawKey, entry] of Object.entries(data.translations)) {
            const cleanKey = extractChineseChars(rawKey.trim()).join('') || rawKey.trim();
            if (!cleanKey || !entry) continue;
            const prev = mergedResult[cleanKey];
            mergedResult[cleanKey] = {
              pinyin: entry.pinyin?.trim() || prev?.pinyin || '',
              translation:
                entry.translation && !isPlaceholderTranslation(entry.translation)
                  ? entry.translation.trim()
                  : prev?.translation || entry.translation || '',
              charMeanings: {
                ...(prev?.charMeanings || {}),
                ...(entry.charMeanings || {}),
              },
            };
          }
        }
      }
    } catch {
      // Переходим к прямому резервному переводу ниже
    }
  }

  // Если после серверного запроса у многосложных или редких слов остались незаполненные переводы,
  // догружаем их напрямую для каждого слова целиком и для входящих в него иероглифов
  const stillMissingWords = cleanWords.filter((w) =>
    isPlaceholderTranslation(mergedResult[w]?.translation)
  );
  const stillMissingChars = new Set<string>();
  for (const w of cleanWords) {
    for (const [ch, m] of Object.entries(mergedResult[w]?.charMeanings || {})) {
      if (isPlaceholderTranslation(m)) {
        stillMissingChars.add(ch);
      }
    }
  }

  if (stillMissingWords.length > 0 || stillMissingChars.size > 0) {
    const charTranslated: Record<string, string> = {};
    await Promise.all([
      ...stillMissingWords.map(async (w) => {
        const tr = await fetchDirectRussianTranslation(w);
        if (tr && !isPlaceholderTranslation(tr)) {
          mergedResult[w].translation = tr;
        }
      }),
      ...Array.from(stillMissingChars).map(async (ch) => {
        const tr = await fetchDirectRussianTranslation(ch);
        if (tr && !isPlaceholderTranslation(tr)) {
          charTranslated[ch] = tr;
        }
      }),
    ]);

    for (const w of cleanWords) {
      const entry = mergedResult[w];
      if (!entry) continue;
      for (const ch of Object.keys(entry.charMeanings)) {
        if (isPlaceholderTranslation(entry.charMeanings[ch]) && charTranslated[ch]) {
          entry.charMeanings[ch] = charTranslated[ch];
        }
      }
      if (
        w.length === 1 &&
        isPlaceholderTranslation(entry.translation) &&
        entry.charMeanings[w] &&
        !isPlaceholderTranslation(entry.charMeanings[w])
      ) {
        entry.translation = entry.charMeanings[w];
      }
    }
  }

  return mergedResult;
}
