import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  extractChineseChars,
  normalizeWordItem,
  isPlaceholderTranslation,
  PRESET_WORDS,
  COMMON_WORD_TRANSLATIONS,
  COMMON_CHAR_MEANINGS,
  KNOWN_CHARACTERS,
} from './src/utils/hanziUtils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function translateChineseToRussianFallback(text: string): Promise<string> {
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

const WORD_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    word: {
      type: Type.STRING,
      description: 'Изучаемое китайское слово или иероглиф (например, 老师 или 好)',
    },
    pinyin: {
      type: Type.STRING,
      description: 'Пиньинь всего слова с тоновыми знаками (например, lǎoshī)',
    },
    translation: {
      type: Type.STRING,
      description: 'Точный и емкий перевод слова на русский язык',
    },
    examples: {
      type: Type.ARRAY,
      description: 'Ровно 2 практических примера употребления слова в предложениях',
      items: {
        type: Type.OBJECT,
        properties: {
          zh: { type: Type.STRING, description: 'Предложение на китайском языке' },
          pinyin: { type: Type.STRING, description: 'Пиньинь предложения с тонами' },
          ru: { type: Type.STRING, description: 'Перевод предложения на русский язык' },
        },
        required: ['zh', 'pinyin', 'ru'],
      },
    },
    characters: {
      type: Type.ARRAY,
      description: 'Детальный посимвольный разбор каждого отдельного иероглифа, входящего в слово, по порядку',
      items: {
        type: Type.OBJECT,
        properties: {
          char: { type: Type.STRING, description: 'Отдельный китайский иероглиф (1 символ)' },
          pinyin: { type: Type.STRING, description: 'Пиньинь этого иероглифа с тоном' },
          tone: { type: Type.INTEGER, description: 'Номер тона от 1 до 5' },
          meaning: { type: Type.STRING, description: 'Значение этого отдельного иероглифа на русском' },
          radical: {
            type: Type.STRING,
            description: 'Ключ иероглифа с пояснением в скобках, например: 女 (женщина)',
          },
          strokeCount: { type: Type.INTEGER, description: 'Количество черт в иероглифе' },
          graphemes: {
            type: Type.ARRAY,
            description: 'Структурные компоненты (графемы и ключи), из которых состоит иероглиф',
            items: {
              type: Type.OBJECT,
              properties: {
                char: { type: Type.STRING, description: 'Символ графемы или ключа' },
                pinyin: { type: Type.STRING, description: 'Пиньинь графемы' },
                meaning: { type: Type.STRING, description: 'Значение графемы на русском языке' },
                type: {
                  type: Type.STRING,
                  description: 'Тип элемента: radical (ключ) или component (компонент/фонетик)',
                },
              },
              required: ['char', 'pinyin', 'meaning', 'type'],
            },
          },
          etymology: {
            type: Type.STRING,
            description: 'Короткая и яркая мнемоника или этимология иероглифа на русском языке (1-2 предложения)',
          },
        },
        required: ['char', 'pinyin', 'tone', 'meaning', 'radical', 'strokeCount', 'graphemes', 'etymology'],
      },
    },
  },
  required: ['word', 'pinyin', 'translation', 'examples', 'characters'],
};

const BATCH_TRANSLATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: 'Список переведенных китайских слов (одиночных и многосложных) с пиньинем и значениями входящих иероглифов',
      items: {
        type: Type.OBJECT,
        properties: {
          word: {
            type: Type.STRING,
            description: 'Исходное китайское слово целиком без изменений (например, 老师, 你好, 图书馆 или 好)',
          },
          pinyin: {
            type: Type.STRING,
            description: 'Пиньинь всего слова с тоновыми знаками (например, lǎoshī)',
          },
          translation: {
            type: Type.STRING,
            description: 'Точный и краткий перевод всего слова на русский язык (например: учитель, преподаватель)',
          },
          characters: {
            type: Type.ARRAY,
            description: 'Краткое значение каждого отдельного иероглифа в составе слова на русском языке с учетом контекста слова',
            items: {
              type: Type.OBJECT,
              properties: {
                char: { type: Type.STRING, description: 'Отдельный иероглиф' },
                meaning: { type: Type.STRING, description: 'Краткое значение этого иероглифа на русском' },
              },
              required: ['char', 'meaning'],
            },
          },
        },
        required: ['word', 'pinyin', 'translation', 'characters'],
      },
    },
  },
  required: ['items'],
};

function buildLocalWordTranslationFallback(cleanWord: string): {
  pinyin: string;
  translation: string;
  charMeanings: Record<string, string>;
} {
  const normalized = normalizeWordItem(PRESET_WORDS[cleanWord] || null, cleanWord);
  const charMeanings: Record<string, string> = {};
  for (const chObj of normalized.characters) {
    charMeanings[chObj.char] =
      KNOWN_CHARACTERS[chObj.char]?.meaning ||
      COMMON_CHAR_MEANINGS[chObj.char] ||
      chObj.meaning;
  }
  const translation =
    PRESET_WORDS[cleanWord]?.translation ||
    COMMON_WORD_TRANSLATIONS[cleanWord] ||
    normalized.translation;

  return {
    pinyin: normalized.pinyin,
    translation,
    charMeanings,
  };
}

async function enrichMissingTranslationsWithFallback(
  result: Record<string, { pinyin: string; translation: string; charMeanings: Record<string, string> }>
): Promise<void> {
  const wordsNeedingTranslation = Object.keys(result).filter((w) =>
    isPlaceholderTranslation(result[w]?.translation)
  );

  const charsNeedingMeaning = new Set<string>();
  for (const w of Object.keys(result)) {
    const entry = result[w];
    if (!entry?.charMeanings) continue;
    for (const [ch, meaning] of Object.entries(entry.charMeanings)) {
      if (isPlaceholderTranslation(meaning)) {
        charsNeedingMeaning.add(ch);
      }
    }
  }

  const charTranslationsMap: Record<string, string> = {};

  await Promise.all([
    ...wordsNeedingTranslation.map(async (w) => {
      const tr = await translateChineseToRussianFallback(w);
      if (tr && !isPlaceholderTranslation(tr)) {
        result[w].translation = tr;
      }
    }),
    ...Array.from(charsNeedingMeaning).map(async (ch) => {
      const tr = await translateChineseToRussianFallback(ch);
      if (tr && !isPlaceholderTranslation(tr)) {
        charTranslationsMap[ch] = tr;
      }
    }),
  ]);

  for (const w of Object.keys(result)) {
    const entry = result[w];
    if (!entry?.charMeanings) continue;
    for (const ch of Object.keys(entry.charMeanings)) {
      if (isPlaceholderTranslation(entry.charMeanings[ch]) && charTranslationsMap[ch]) {
        entry.charMeanings[ch] = charTranslationsMap[ch];
      }
    }
    if (w.length === 1 && isPlaceholderTranslation(entry.translation) && entry.charMeanings[w] && !isPlaceholderTranslation(entry.charMeanings[w])) {
      entry.translation = entry.charMeanings[w];
    }
  }
}

const analysisMemoryCache = new Map<string, ReturnType<typeof normalizeWordItem>>();
const batchWordMemoryCache = new Map<
  string,
  { pinyin: string; translation: string; charMeanings: Record<string, string> }
>();
const modelCooldownUntil = new Map<string, number>();

const GEMINI_TEXT_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
] as const;

function isQuotaOrRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota exceeded') ||
    msg.includes('rate-limit')
  );
}

async function generateJsonWithFallback(
  ai: GoogleGenAI,
  prompt: string,
  responseSchema: Record<string, unknown>
): Promise<string | undefined> {
  const now = Date.now();
  for (const modelName of GEMINI_TEXT_MODELS) {
    const cooldown = modelCooldownUntil.get(modelName) || 0;
    if (now < cooldown) {
      continue;
    }
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      if (response.text) {
        return response.text;
      }
    } catch (err) {
      if (isQuotaOrRateLimitError(err)) {
        // Put this model on cooldown for 15 minutes so we don't repeatedly hit 429
        modelCooldownUntil.set(modelName, Date.now() + 15 * 60 * 1000);
      }
    }
  }
  return undefined;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/analyze-chinese', async (req, res) => {
    const rawInput = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
    const chars = extractChineseChars(rawInput);
    const cleanWord = chars.join('');

    if (!cleanWord) {
      res.status(400).json({ error: 'Пожалуйста, введите хотя бы один китайский иероглиф.' });
      return;
    }

    const cachedAnalysis = analysisMemoryCache.get(cleanWord);
    if (cachedAnalysis) {
      res.json(cachedAnalysis);
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isMissingOrPlaceholderKey =
      !apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '';

    if (!isMissingOrPlaceholderKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const prompt = `Проанализируй китайское слово или иероглиф «${cleanWord}» для русскоязычного студента.
Верни:
1. Общий пиньинь (с тонами) и точный перевод слова «${cleanWord}» целиком на русский язык.
2. 2 естественных примера употребления с пиньинем и переводом на русский.
3. Посимвольный разбор для каждого иероглифа в порядке следования (${chars.join(', ')}): пиньинь, номер тона (1-5), значение знака, иероглифический ключ (радикал), точное число черт, список составных графем (type: "radical" или "component") с их пиньинем и значением на русском, а также понятную мнемонику/этимологию на русском языке.`;

        const responseText = await generateJsonWithFallback(ai, prompt, WORD_ANALYSIS_SCHEMA);

        if (responseText) {
          const parsed = JSON.parse(responseText.trim());
          const normalized = normalizeWordItem(parsed, cleanWord);
          analysisMemoryCache.set(cleanWord, normalized);
          res.json(normalized);
          return;
        }
      } catch {
        // При недоступности или исчерпании квоты ИИ бесшовно переходим к резервному словарю
      }
    }

    const fallbackItem = normalizeWordItem(PRESET_WORDS[cleanWord] || null, cleanWord);
    if (isPlaceholderTranslation(fallbackItem.translation)) {
      const tr = await translateChineseToRussianFallback(cleanWord);
      if (tr) {
        fallbackItem.translation = tr;
      }
    }
    await Promise.all(
      fallbackItem.characters.map(async (chObj) => {
        if (isPlaceholderTranslation(chObj.meaning)) {
          const chTr = await translateChineseToRussianFallback(chObj.char);
          if (chTr) {
            chObj.meaning = chTr;
          }
        }
      })
    );
    analysisMemoryCache.set(cleanWord, fallbackItem);
    res.json(fallbackItem);
  });

  app.post('/api/translate-words-batch', async (req, res) => {
    const rawWords: unknown[] = Array.isArray(req.body?.words) ? req.body.words : [];
    const cleanWords = Array.from(
      new Set(
        rawWords
          .map((w) => (typeof w === 'string' ? extractChineseChars(w.trim()).join('') : ''))
          .filter(Boolean)
      )
    );

    if (cleanWords.length === 0) {
      res.json({ translations: {} });
      return;
    }

    const result: Record<
      string,
      { pinyin: string; translation: string; charMeanings: Record<string, string> }
    > = {};

    const uncachedWords: string[] = [];

    // Заполняем из кэша или базового локального словаря
    for (const w of cleanWords) {
      const cached = batchWordMemoryCache.get(w);
      if (cached && !isPlaceholderTranslation(cached.translation)) {
        result[w] = cached;
      } else {
        result[w] = buildLocalWordTranslationFallback(w);
        if (isPlaceholderTranslation(result[w].translation)) {
          uncachedWords.push(w);
        }
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isMissingOrPlaceholderKey =
      !apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '';

    if (!isMissingOrPlaceholderKey && uncachedWords.length > 0) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const prompt = `Переведи на русский язык следующий список китайских слов (среди них есть как одиночные иероглифы, так и двусложные и многосложные слова): ${uncachedWords.join(', ')}.
Для КАЖДОГО элемента из списка (${uncachedWords.map((w) => `"${w}"`).join(', ')}) обязательно верни:
1. word — само китайское слово целиком точно как во входном списке без пробелов и изменений (например, "${uncachedWords[0]}").
2. pinyin — точный пиньинь всего слова с тоновыми знаками.
3. translation — точный, естественный перевод всего слова целиком на русский язык (например, для 老师 — "учитель, преподаватель", для 你好 — "привет, здравствуйте", для 图书馆 — "библиотека").
4. characters — массив каждого отдельного иероглифа, входящего в это слово, с его кратким значением на русском языке с учетом контекста слова.`;

        const responseText = await generateJsonWithFallback(ai, prompt, BATCH_TRANSLATION_SCHEMA);

        if (responseText) {
          const parsed = JSON.parse(responseText.trim()) as {
            items?: Array<{
              word: string;
              pinyin: string;
              translation: string;
              characters?: Array<{ char: string; meaning: string }>;
            }>;
          };

          if (Array.isArray(parsed.items)) {
            for (const item of parsed.items) {
              const wKey = extractChineseChars((item.word || '').trim()).join('');
              if (!wKey) continue;
              const charMeanings: Record<string, string> = {
                ...(result[wKey]?.charMeanings || {}),
              };
              if (Array.isArray(item.characters)) {
                for (const chEntry of item.characters) {
                  const cleanCh = extractChineseChars(chEntry.char || '')[0];
                  if (cleanCh && chEntry.meaning?.trim()) {
                    charMeanings[cleanCh] = chEntry.meaning.trim();
                  }
                }
              }
              result[wKey] = {
                pinyin: item.pinyin?.trim() || result[wKey]?.pinyin || '',
                translation: item.translation?.trim() || result[wKey]?.translation || '',
                charMeanings,
              };
            }
          }
        }
      } catch {
        // При исчерпании квоты переходим к резервному переводу ниже
      }
    }

    await enrichMissingTranslationsWithFallback(result);
    for (const [wKey, val] of Object.entries(result)) {
      if (val && !isPlaceholderTranslation(val.translation)) {
        batchWordMemoryCache.set(wKey, val);
      }
    }
    res.json({ translations: result });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MoShui (墨水) server running on http://localhost:${PORT}`);
  });
}

startServer();
