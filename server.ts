import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  extractChineseChars,
  normalizeWordItem,
  PRESET_WORDS,
  COMMON_WORD_TRANSLATIONS,
  COMMON_CHAR_MEANINGS,
  KNOWN_CHARACTERS,
} from './src/utils/hanziUtils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      description: 'Список переведенных китайских слов с пиньинем и значениями входящих иероглифов',
      items: {
        type: Type.OBJECT,
        properties: {
          word: {
            type: Type.STRING,
            description: 'Исходное китайское слово целиком (например, 老师)',
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
            description: 'Краткое значение каждого отдельного иероглифа в составе слова на русском языке',
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

    const apiKey = process.env.GEMINI_API_KEY;
    const isMissingOrPlaceholderKey =
      !apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '';

    if (isMissingOrPlaceholderKey) {
      const fallbackItem = normalizeWordItem(PRESET_WORDS[cleanWord] || null, cleanWord);
      res.json(fallbackItem);
      return;
    }

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
1. Общий пиньинь (с тонами) и перевод слова «${cleanWord}» на русский язык.
2. 2 естественных примера употребления с пиньинем и переводом на русский.
3. Посимвольный разбор для каждого иероглифа в порядке следования (${chars.join(', ')}): пиньинь, номер тона (1-5), значение знака, иероглифический ключ (радикал), точное число черт, список составных графем (type: "radical" или "component") с их пиньинем и значением на русском, а также понятную мнемонику/этимологию на русском языке.`;

      let responseText: string | undefined;
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: WORD_ANALYSIS_SCHEMA,
            temperature: 0.2,
          },
        });
        responseText = response.text;
      } catch {
        const fallbackModelResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: WORD_ANALYSIS_SCHEMA,
            temperature: 0.2,
          },
        });
        responseText = fallbackModelResponse.text;
      }

      if (!responseText) {
        throw new Error('Пустой ответ от модели Gemini');
      }

      const parsed = JSON.parse(responseText.trim());
      const normalized = normalizeWordItem(parsed, cleanWord);
      res.json(normalized);
    } catch (error) {
      console.warn('Gemini API fallback triggered:', error instanceof Error ? error.message : error);
      const fallbackItem = normalizeWordItem(PRESET_WORDS[cleanWord] || null, cleanWord);
      res.json(fallbackItem);
    }
  });

  app.post('/api/translate-words-batch', async (req, res) => {
    const rawWords: unknown[] = Array.isArray(req.body?.words) ? req.body.words : [];
    const cleanWords = Array.from(
      new Set(
        rawWords
          .map((w) => (typeof w === 'string' ? extractChineseChars(w).join('') : ''))
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

    // Заполняем базовый локальный словарь для всех слов на случай недоступности сети
    for (const w of cleanWords) {
      result[w] = buildLocalWordTranslationFallback(w);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isMissingOrPlaceholderKey =
      !apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '';

    if (isMissingOrPlaceholderKey) {
      res.json({ translations: result });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Переведи на русский язык следующий список китайских слов: ${cleanWords.join(', ')}.
Для КАЖДОГО слова из списка обязательно верни:
1. word — само китайское слово целиком без изменений.
2. pinyin — точный пиньинь всего слова с тоновыми знаками.
3. translation — точный, естественный перевод всего слова целиком на русский язык (например, для 老师 — "учитель, преподаватель", для 图书馆 — "библиотека").
4. characters — массив каждого входящего в слово иероглифа с его кратким значением на русском языке.`;

      let responseText: string | undefined;
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: BATCH_TRANSLATION_SCHEMA,
            temperature: 0.1,
          },
        });
        responseText = response.text;
      } catch {
        const fallbackModelResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: BATCH_TRANSLATION_SCHEMA,
            temperature: 0.1,
          },
        });
        responseText = fallbackModelResponse.text;
      }

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
            const wKey = extractChineseChars(item.word || '').join('');
            if (!wKey) continue;
            const charMeanings: Record<string, string> = {
              ...(result[wKey]?.charMeanings || {}),
            };
            if (Array.isArray(item.characters)) {
              for (const chEntry of item.characters) {
                if (chEntry.char && chEntry.meaning) {
                  charMeanings[chEntry.char] = chEntry.meaning.trim();
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

      res.json({ translations: result });
    } catch (error) {
      console.warn(
        'Gemini batch translation fallback triggered:',
        error instanceof Error ? error.message : error
      );
      res.json({ translations: result });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
