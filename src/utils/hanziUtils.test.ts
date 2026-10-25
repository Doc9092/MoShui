import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractChineseChars,
  parseBatchChineseInput,
  detectToneFromPinyin,
  getPinyinForText,
  getCharPinyinAndTone,
  normalizeWordItem,
  buildWorksheetCells,
  generatePinyinToneOptions,
  getInitialDemoWorksheet,
  getHsk1StarterWords,
} from './hanziUtils';

test('extractChineseChars extracts only Chinese characters in order', () => {
  assert.deepEqual(extractChineseChars('老师 (lǎoshī)'), ['老', '师']);
  assert.deepEqual(extractChineseChars('图书馆123'), ['图', '书', '馆']);
  assert.deepEqual(extractChineseChars('䶮 (yǎn)'), ['䶮']);
  assert.deepEqual(extractChineseChars('hello'), []);
});

test('parseBatchChineseInput splits comma and space separated Chinese words and deduplicates', () => {
  const parsed = parseBatchChineseInput('你好, 老师, 水, 朋友, 老师');
  assert.deepEqual(parsed, ['你好', '老师', '水', '朋友']);
});

test('detectToneFromPinyin detects tones 1 to 5 from symbols and numbers', () => {
  assert.equal(detectToneFromPinyin('shī'), 1);
  assert.equal(detectToneFromPinyin('xué'), 2);
  assert.equal(detectToneFromPinyin('hǎo'), 3);
  assert.equal(detectToneFromPinyin('shì'), 4);
  assert.equal(detectToneFromPinyin('ma'), 5);
  assert.equal(detectToneFromPinyin('hao3'), 3);
});

test('getPinyinForText and getCharPinyinAndTone generate accurate pinyin', () => {
  const py = getPinyinForText('中国');
  assert.ok(py.includes('zhōng') && py.includes('guó'));

  const charInfo = getCharPinyinAndTone('好');
  assert.equal(charInfo.pinyin, 'hǎo');
  assert.equal(charInfo.tone, 3);
});

test('normalizeWordItem builds a complete two-level WordItem for multi-character words', () => {
  const item = normalizeWordItem(null, '老师');
  assert.equal(item.word, '老师');
  assert.equal(item.characters.length, 2);
  assert.equal(item.characters[0].char, '老');
  assert.equal(item.characters[1].char, '师');
  assert.ok(item.examples.length >= 2);
  assert.ok(item.characters[0].graphemes.length >= 2);
});

test('buildWorksheetCells generates correct sequence for by-character and whole-word modes', () => {
  const byChar = buildWorksheetCells(['老'], 'by-character', 10, 3);
  assert.equal(byChar.length, 10);
  assert.deepEqual(byChar[0], { char: '老', mode: 'sample' });
  assert.deepEqual(byChar[1], { char: '老', mode: 'trace' });
  assert.deepEqual(byChar[3], { char: '老', mode: 'trace' });
  assert.deepEqual(byChar[4], { char: null, mode: 'empty' });

  const wholeWord = buildWorksheetCells(['老', '师'], 'whole-word', 10, 2);
  assert.equal(wholeWord.length, 10);
  // First pair: sample
  assert.deepEqual(wholeWord[0], { char: '老', mode: 'sample' });
  assert.deepEqual(wholeWord[1], { char: '师', mode: 'sample' });
  // Next 2 pairs: trace
  assert.deepEqual(wholeWord[2], { char: '老', mode: 'trace' });
  assert.deepEqual(wholeWord[3], { char: '师', mode: 'trace' });
  assert.deepEqual(wholeWord[4], { char: '老', mode: 'trace' });
  assert.deepEqual(wholeWord[5], { char: '师', mode: 'trace' });
  // Remaining: empty
  assert.deepEqual(wholeWord[6], { char: null, mode: 'empty' });
});

test('generatePinyinToneOptions returns 4 unique options including the correct pinyin', () => {
  const options = generatePinyinToneOptions('lǎoshī');
  assert.equal(options.length, 4);
  assert.ok(options.includes('lǎoshī'));
  assert.equal(new Set(options).size, 4);
});

test('starter sets return non-empty valid WordItems', () => {
  assert.equal(getInitialDemoWorksheet().length, 3);
  assert.equal(getHsk1StarterWords().length, 15);
});

import {
  generateUuid,
  isValidUuid,
  translateSupabaseError,
  mapWorksheetRowToSavedWorksheet,
  mapFolderRowToTeacherFolder,
  buildTeacherWorkspaceBackup,
} from '../services/authStorageService';

test('authStorageService maps Supabase PostgreSQL rows, validates UUIDs, and translates errors to Russian', () => {
  const id = generateUuid();
  assert.ok(isValidUuid(id), 'Generated ID must be a valid UUID v4');
  assert.equal(isValidUuid('not-a-uuid'), false);

  const sampleWord = normalizeWordItem(null, '老师');
  const now = Date.now();
  const mappedSheet = mapWorksheetRowToSavedWorksheet({
    id,
    teacher_id: generateUuid(),
    title: 'Урок 1. Приветствия',
    folder: 'HSK 1',
    description: 'Отработка базовых слов',
    words: [sampleWord],
    config: {
      sheetTitle: 'Урок 1. Приветствия',
      layoutMode: 'by-character',
      gridType: 'mizi',
      gridColor: 'red',
      showStrokeOrder: true,
      traceCount: 3,
      rowsPerItem: 1,
      cellsPerRow: 10,
    },
    created_at: now,
    updated_at: now,
  });

  assert.equal(mappedSheet.id, id);
  assert.equal(mappedSheet.title, 'Урок 1. Приветствия');
  assert.equal(mappedSheet.words.length, 1);

  const folder = mapFolderRowToTeacherFolder({
    id: generateUuid(),
    teacher_id: mappedSheet.teacherId,
    name: 'HSK 1',
    color: 'rose',
  });
  assert.equal(folder.name, 'HSK 1');

  const ruMsg = translateSupabaseError(new Error('Invalid login credentials'));
  assert.ok(ruMsg.includes('Неверный Email или пароль'));

  const backup = buildTeacherWorkspaceBackup({
    profile: {
      id: mappedSheet.teacherId,
      name: 'Лилия Лаоши',
      email: 'liliya@moshui.ru',
      schoolOrTitle: 'Школа Конфуция',
      createdAt: now,
    },
    folders: [folder],
    worksheets: [mappedSheet],
  });
  assert.equal(backup.worksheets.length, 1);
  assert.equal(backup.profile.schoolOrTitle, 'Школа Конфуция');
});

import { sanitizePdfFilename, calculateA4Dimensions } from '../services/pdfExportService';

test('pdfExportService sanitizes filenames and calculates multi-page A4 dimensions accurately', () => {
  assert.equal(
    sanitizePdfFilename('Урок 4: Приветствие / 你好.pdf'),
    'Урок 4- Приветствие - 你好'
  );
  assert.equal(sanitizePdfFilename('   '), 'moshui-worksheet');

  const singlePage = calculateA4Dimensions(1600, 1200, 8);
  assert.equal(singlePage.pageCount, 1);
  assert.equal(singlePage.printableWidthMm, 194);

  const multiPage = calculateA4Dimensions(1600, 4800, 8);
  assert.ok(multiPage.pageCount >= 2, 'Tall canvas should paginate into 2+ A4 pages');
});

import { isPlaceholderTranslation } from './hanziUtils';

test('normalizeWordItem resolves translations for common multi-character words and detects placeholders', () => {
  assert.equal(isPlaceholderTranslation(''), true);
  assert.equal(isPlaceholderTranslation('Слово «妈妈» (māma)'), true);
  assert.equal(isPlaceholderTranslation('мама'), false);

  const mama = normalizeWordItem(null, '妈妈');
  assert.equal(mama.translation, 'мама');
  assert.equal(mama.characters[0].meaning, 'мама');

  const chifan = normalizeWordItem(null, '吃饭');
  assert.equal(chifan.translation, 'кушать, принимать пищу');
});

import { translateWordsBatch } from '../services/geminiService';

test('translateWordsBatch returns full word translations, pinyin, and charMeanings for batch words', async () => {
  const batch = await translateWordsBatch(['老师', '图书馆']);
  assert.ok(batch['老师'], 'Should include 老师');
  assert.equal(batch['老师'].translation, 'учитель, преподаватель');
  assert.ok(batch['老师'].charMeanings['老'].includes('старый'));
  assert.ok(batch['老师'].charMeanings['师'].includes('учитель'));

  assert.ok(batch['图书馆'], 'Should include 图书馆');
  assert.equal(batch['图书馆'].translation, 'библиотека');
  assert.ok(batch['图书馆'].charMeanings['书'].includes('книга'));
});

import { isLikelyHanziCharacter, loadHanziStrokes } from './strokeDataLoader';

test('strokeDataLoader safely handles Latin, punctuation, and rare characters without throwing', async () => {
  assert.equal(isLikelyHanziCharacter('好'), true);
  assert.equal(isLikelyHanziCharacter('A'), false);
  assert.equal(isLikelyHanziCharacter('!'), false);

  const latinResult = await loadHanziStrokes('A');
  assert.equal(latinResult, null);

  const punctResult = await loadHanziStrokes('？');
  assert.equal(punctResult, null);
});



