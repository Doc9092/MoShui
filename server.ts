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
  getLocalWordTranslation,
  getLocalCharMeaning,
} from './src/utils/hanziUtils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function translateChineseFallback(
  text: string,
  lang: 'ru' | 'en' = 'ru'
): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';
  const targetLang = lang === 'en' ? 'en' : 'ru';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=${targetLang}&dt=t&q=${encodeURIComponent(
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
      description: 'Target Chinese word or character (e.g., 老师 or 好)',
    },
    pinyin: {
      type: Type.STRING,
      description: 'Tone-marked pinyin of the whole word (e.g., lǎoshī)',
    },
    translation: {
      type: Type.STRING,
      description: 'Concise and accurate translation of the word in the requested target language',
    },
    examples: {
      type: Type.ARRAY,
      description: 'Exactly 2 practical example sentences using the word',
      items: {
        type: Type.OBJECT,
        properties: {
          zh: { type: Type.STRING, description: 'Sentence in Chinese' },
          pinyin: { type: Type.STRING, description: 'Tone-marked pinyin of the sentence' },
          ru: { type: Type.STRING, description: 'Translation of the sentence in the requested target language' },
        },
        required: ['zh', 'pinyin', 'ru'],
      },
    },
    characters: {
      type: Type.ARRAY,
      description: 'Detailed character-by-character breakdown in sequence',
      items: {
        type: Type.OBJECT,
        properties: {
          char: { type: Type.STRING, description: 'Single Chinese character (1 symbol)' },
          pinyin: { type: Type.STRING, description: 'Tone-marked pinyin of this character' },
          tone: { type: Type.INTEGER, description: 'Tone number from 1 to 5' },
          meaning: { type: Type.STRING, description: 'Concise meaning of this character in the requested target language' },
          radical: {
            type: Type.STRING,
            description: 'Character radical with explanation in parentheses, e.g., 女 (женщина) or 女 (woman)',
          },
          strokeCount: { type: Type.INTEGER, description: 'Stroke count of the character' },
          graphemes: {
            type: Type.ARRAY,
            description: 'Structural components (graphemes and radicals) that form the character',
            items: {
              type: Type.OBJECT,
              properties: {
                char: { type: Type.STRING, description: 'Grapheme or radical symbol' },
                pinyin: { type: Type.STRING, description: 'Pinyin of the grapheme' },
                meaning: { type: Type.STRING, description: 'Meaning of the grapheme in the requested target language' },
                type: {
                  type: Type.STRING,
                  description: 'Element type: radical or component',
                },
              },
              required: ['char', 'pinyin', 'meaning', 'type'],
            },
          },
          etymology: {
            type: Type.STRING,
            description: 'Short, memorable mnemonic or etymology in the requested target language (1-2 sentences)',
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
      description: 'List of translated Chinese words (single characters and multi-character words) with pinyin and character meanings',
      items: {
        type: Type.OBJECT,
        properties: {
          word: {
            type: Type.STRING,
            description: 'Original Chinese word unchanged (e.g., 老师, 你好, 图书馆, or 好)',
          },
          pinyin: {
            type: Type.STRING,
            description: 'Tone-marked pinyin of the whole word (e.g., lǎoshī)',
          },
          translation: {
            type: Type.STRING,
            description: 'Concise and accurate translation of the whole word in the requested target language suitable for a calligraphy worksheet',
          },
          characters: {
            type: Type.ARRAY,
            description: 'Concise meaning of each individual character in the word in the requested target language',
            items: {
              type: Type.OBJECT,
              properties: {
                char: { type: Type.STRING, description: 'Single character' },
                meaning: { type: Type.STRING, description: 'Concise meaning of this character in the requested target language' },
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

function buildLocalWordTranslationFallback(
  cleanWord: string,
  lang: 'ru' | 'en' = 'ru'
): {
  pinyin: string;
  translation: string;
  charMeanings: Record<string, string>;
} {
  const normalized = normalizeWordItem(PRESET_WORDS[cleanWord] || null, cleanWord, lang);
  const charMeanings: Record<string, string> = {};
  for (const chObj of normalized.characters) {
    charMeanings[chObj.char] =
      getLocalCharMeaning(chObj.char, lang) || chObj.meaning;
  }
  const translation =
    getLocalWordTranslation(cleanWord, lang) || normalized.translation;

  return {
    pinyin: normalized.pinyin,
    translation,
    charMeanings,
  };
}

async function enrichMissingTranslationsWithFallback(
  result: Record<string, { pinyin: string; translation: string; charMeanings: Record<string, string> }>,
  lang: 'ru' | 'en' = 'ru'
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
      const tr = await translateChineseFallback(w, lang);
      if (tr && !isPlaceholderTranslation(tr)) {
        result[w].translation = tr;
      }
    }),
    ...Array.from(charsNeedingMeaning).map(async (ch) => {
      const tr = await translateChineseFallback(ch, lang);
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
    const lang: 'ru' | 'en' = req.body?.lang === 'en' ? 'en' : 'ru';
    const chars = extractChineseChars(rawInput);
    const cleanWord = chars.join('');

    if (!cleanWord) {
      res.status(400).json({
        error:
          lang === 'en'
            ? 'Please enter at least one Chinese character.'
            : 'Пожалуйста, введите хотя бы один китайский иероглиф.',
      });
      return;
    }

    const cacheKey = `${lang}:${cleanWord}`;
    const cachedAnalysis = analysisMemoryCache.get(cacheKey);
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

        const prompt =
          lang === 'en'
            ? `Analyze the Chinese word or character "${cleanWord}" for an English-speaking student.
Return:
1. Overall tone-marked pinyin and a concise English translation suitable for a calligraphy worksheet for "${cleanWord}".
2. 2 natural example sentences with pinyin and English translation (in the "ru" field).
3. Character-by-character breakdown in sequence (${chars.join(', ')}): pinyin, tone number (1-5), concise English meaning of the character, radical with English explanation in parentheses, exact stroke count, structural graphemes (type: "radical" or "component") with their pinyin and English meaning, and a clear mnemonic/etymology in English.`
            : `Проанализируй китайское слово или иероглиф «${cleanWord}» для русскоязычного студента.
Верни:
1. Общий пиньинь (с тонами) и краткий, точный перевод слова «${cleanWord}» целиком на русский язык.
2. 2 естественных примера употребления с пиньинем и переводом на русский.
3. Посимвольный разбор для каждого иероглифа в порядке следования (${chars.join(', ')}): пиньинь, номер тона (1-5), значение знака, иероглифический ключ (радикал), точное число черт, список составных графем (type: "radical" или "component") с их пиньинем и значением на русском, а также понятную мнемонику/этимологию на русском языке.`;

        const responseText = await generateJsonWithFallback(ai, prompt, WORD_ANALYSIS_SCHEMA);

        if (responseText) {
          const parsed = JSON.parse(responseText.trim());
          const normalized = normalizeWordItem(parsed, cleanWord, lang);
          analysisMemoryCache.set(cacheKey, normalized);
          res.json(normalized);
          return;
        }
      } catch {
        // При недоступности или исчерпании квоты ИИ бесшовно переходим к резервному словарю
      }
    }

    const fallbackItem = normalizeWordItem(PRESET_WORDS[cleanWord] || null, cleanWord, lang);
    if (isPlaceholderTranslation(fallbackItem.translation)) {
      const tr = await translateChineseFallback(cleanWord, lang);
      if (tr) {
        fallbackItem.translation = tr;
        if (lang === 'en') fallbackItem.translation_en = tr;
        else fallbackItem.translation_ru = tr;
      }
    }
    await Promise.all(
      fallbackItem.characters.map(async (chObj) => {
        if (isPlaceholderTranslation(chObj.meaning)) {
          const chTr = await translateChineseFallback(chObj.char, lang);
          if (chTr) {
            chObj.meaning = chTr;
            if (lang === 'en') chObj.meaning_en = chTr;
            else chObj.meaning_ru = chTr;
          }
        }
      })
    );
    analysisMemoryCache.set(cacheKey, fallbackItem);
    res.json(fallbackItem);
  });

  app.post('/api/translate-words-batch', async (req, res) => {
    const rawWords: unknown[] = Array.isArray(req.body?.words) ? req.body.words : [];
    const lang: 'ru' | 'en' = req.body?.lang === 'en' ? 'en' : 'ru';
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

    // Заполняем из кэша или базового локального словаря на выбранном языке
    for (const w of cleanWords) {
      const cacheKey = `${lang}:${w}`;
      const cached = batchWordMemoryCache.get(cacheKey);
      if (cached && !isPlaceholderTranslation(cached.translation)) {
        result[w] = cached;
      } else {
        result[w] = buildLocalWordTranslationFallback(w, lang);
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

        const prompt =
          lang === 'en'
            ? `Translate the following list of Chinese words and characters into concise, accurate English (concise English translation suitable for a calligraphy worksheet): ${uncachedWords.join(', ')}.
For EACH item in the list (${uncachedWords.map((w) => `"${w}"`).join(', ')}) you MUST return:
1. word — the exact Chinese word or character from the input list without spaces or changes (e.g., "${uncachedWords[0]}").
2. pinyin — accurate tone-marked pinyin of the whole word.
3. translation — a concise English translation suitable for a calligraphy worksheet (e.g., for 老师 — "teacher", for 你好 — "hello", for 图书馆 — "library").
4. characters — an array of each individual character in the word with its concise English meaning in context.`
            : `Переведи на краткий, точный русский язык следующий список китайских слов (среди них есть как одиночные иероглифы, так и двусложные и многосложные слова): ${uncachedWords.join(', ')}.
Для КАЖДОГО элемента из списка (${uncachedWords.map((w) => `"${w}"`).join(', ')}) обязательно верни:
1. word — само китайское слово целиком точно как во входном списке без пробелов и изменений (например, "${uncachedWords[0]}").
2. pinyin — точный пиньинь всего слова с тоновыми знаками.
3. translation — краткий, точный перевод всего слова целиком на русский язык (например, для 老师 — "учитель, преподаватель", для 你好 — "привет, здравствуйте", для 图书馆 — "библиотека").
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

    await enrichMissingTranslationsWithFallback(result, lang);
    for (const [wKey, val] of Object.entries(result)) {
      if (val && !isPlaceholderTranslation(val.translation)) {
        batchWordMemoryCache.set(`${lang}:${wKey}`, val);
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
