import { pinyin } from 'pinyin-pro';
import type { CharDetail, Grapheme, WordItem } from '../types/hanzi';
import { RADICALS_DATA } from './radicalsData';

/**
 * Extracts only CJK Unified Ideographs from an input string, preserving order.
 */
export function extractChineseChars(input: string): string[] {
  if (!input) return [];
  const matches = input.trim().match(/[\u2e80-\u2eff\u2f00-\u2fdf\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g);
  return matches ? Array.from(matches) : [];
}

/**
 * Parses a comma, semicolon, or space-separated batch string into distinct Chinese words.
 * Example: "你好, 老师, 水, 朋友" -> ["你好", "老师", "水", "朋友"]
 */
export function parseBatchChineseInput(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  const tokens = raw.split(/[,，;；\s\n]+/);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const chars = extractChineseChars(token).join('');
    if (chars && !seen.has(chars)) {
      seen.add(chars);
      result.push(chars);
    }
  }
  return result;
}

/**
 * Determines tone number (1-5) from a pinyin syllable with diacritics or tone numbers.
 */
export function detectToneFromPinyin(syllable: string): number {
  if (!syllable) return 5;
  const s = syllable.trim().toLowerCase();

  const numMatch = s.match(/[1-5]$/);
  if (numMatch) {
    return parseInt(numMatch[0], 10);
  }

  if (/[āēīōūǖ]/.test(s)) return 1;
  if (/[áéíóúǘ]/.test(s)) return 2;
  if (/[ǎěǐǒǔǚ]/.test(s)) return 3;
  if (/[àèìòùǜ]/.test(s)) return 4;
  return 5;
}

/**
 * Generates tone-marked pinyin for a word or character using pinyin-pro.
 */
export function getPinyinForText(text: string): string {
  const clean = extractChineseChars(text).join('');
  if (!clean) return '';
  return pinyin(clean, { toneType: 'symbol', type: 'string' });
}

/**
 * Generates pinyin and numerical tone (1-5) for a single Chinese character.
 */
export function getCharPinyinAndTone(char: string): { pinyin: string; tone: number } {
  const clean = extractChineseChars(char)[0];
  if (!clean) return { pinyin: '', tone: 5 };
  const pySymbol = pinyin(clean, { toneType: 'symbol' });
  const pyNum = pinyin(clean, { toneType: 'num' });
  const tone = detectToneFromPinyin(pyNum || pySymbol);
  return { pinyin: pySymbol, tone };
}

/**
 * Curated database of common characters for instant rich decomposition & fallback.
 */
export const KNOWN_CHARACTERS: Record<string, CharDetail> = {
  好: {
    char: '好',
    pinyin: 'hǎo',
    tone: 3,
    meaning: 'хороший, добрый; хорошо, любить',
    radical: '女 (женщина)',
    strokeCount: 6,
    graphemes: [
      { char: '女', pinyin: 'nǚ', meaning: 'женщина, дочь', type: 'radical' },
      { char: '子', pinyin: 'zǐ', meaning: 'ребенок, сын', type: 'component' },
    ],
    etymology: 'Идеограмма: женщина (女) обнимает ребенка (子) — древний символ благополучия, гармонии и добра.',
  },
  老: {
    char: '老',
    pinyin: 'lǎo',
    tone: 3,
    meaning: 'старый, опытный, уважаемый',
    radical: '老 (старость)',
    strokeCount: 6,
    graphemes: [
      { char: '土', pinyin: 'tǔ', meaning: 'земля, опора лет', type: 'component' },
      { char: '匕', pinyin: 'bǐ', meaning: 'посох / сгорбленная фигура', type: 'radical' },
    ],
    etymology: 'Изображение пожилого человека с длинными волосами, опирающегося на трость — символ мудрости и почтения.',
  },
  师: {
    char: '师',
    pinyin: 'shī',
    tone: 1,
    meaning: 'учитель, наставник, мастер',
    radical: '巾 (платок, ткань)',
    strokeCount: 6,
    graphemes: [
      { char: '刀', pinyin: 'dāo', meaning: 'четкий порядок и дисциплина', type: 'component' },
      { char: '巾', pinyin: 'jīn', meaning: 'повязка, знамя, ткань', type: 'radical' },
    ],
    etymology: 'Изначально обозначало холм и войско под знаменем (巾), позже — полководца и мудрого наставника.',
  },
  学: {
    char: '学',
    pinyin: 'xué',
    tone: 2,
    meaning: 'учиться, изучать; наука, школа',
    radical: '子 (ребенок)',
    strokeCount: 8,
    graphemes: [
      { char: '小', pinyin: 'xiǎo', meaning: 'частицы знаний сверху', type: 'component' },
      { char: '冖', pinyin: 'mì', meaning: 'крыша здания (школы)', type: 'component' },
      { char: '子', pinyin: 'zǐ', meaning: 'ребенок, ученик', type: 'radical' },
    ],
    etymology: 'Ребенок (子) под крышей школы (冖), воспринимающий знания старших (верхние черты).',
  },
  习: {
    char: '习',
    pinyin: 'xí',
    tone: 2,
    meaning: 'практиковаться, повторять; привычка',
    radical: '羽 (перья, крылья)',
    strokeCount: 3,
    graphemes: [
      { char: '羽', pinyin: 'yǔ', meaning: 'крыло птицы (в упр. форме)', type: 'radical' },
      { char: '白', pinyin: 'bái', meaning: 'ясность повторения', type: 'component' },
    ],
    etymology: 'Молодая птица снова и снова машет крыльями (羽), учась летать — метафора постоянной практики.',
  },
  中: {
    char: '中',
    pinyin: 'zhōng',
    tone: 1,
    meaning: 'середина, центр; внутри; Китай',
    radical: '丨 (вертикальная черта)',
    strokeCount: 4,
    graphemes: [
      { char: '口', pinyin: 'kǒu', meaning: 'огороженная площадь, мишень', type: 'component' },
      { char: '丨', pinyin: 'gǔn', meaning: 'древко знамени ровно посередине', type: 'radical' },
    ],
    etymology: 'Древко флага (丨), проходящее точно через центр площадки (口) — попадание в самую цель и центр.',
  },
  国: {
    char: '国',
    pinyin: 'guó',
    tone: 2,
    meaning: 'государство, страна, родина',
    radical: '囗 (ограда)',
    strokeCount: 8,
    graphemes: [
      { char: '囗', pinyin: 'wéi', meaning: 'границы государства, стены', type: 'radical' },
      { char: '玉', pinyin: 'yù', meaning: 'нефрит, императорская печать', type: 'component' },
    ],
    etymology: 'Нефритовое сокровище власти (玉), защищенное со всех сторон крепостными стенами (囗) — государство.',
  },
  图: {
    char: '图',
    pinyin: 'tú',
    tone: 2,
    meaning: 'карта, схема, рисунок, план',
    radical: '囗 (ограда)',
    strokeCount: 8,
    graphemes: [
      { char: '囗', pinyin: 'wéi', meaning: 'границы территории', type: 'radical' },
      { char: '冬', pinyin: 'dōng', meaning: 'зима (фонетик и узел учета)', type: 'component' },
    ],
    etymology: 'План земельных владений внутри четких границ (囗) — чертеж, карта или иллюстрация.',
  },
  书: {
    char: '书',
    pinyin: 'shū',
    tone: 1,
    meaning: 'книга, письмо, каллиграфия',
    radical: '乙 (крюк / кисть)',
    strokeCount: 4,
    graphemes: [
      { char: '乛', pinyin: 'zhé', meaning: 'изгибы бамбукового свитка', type: 'component' },
      { char: '丨', pinyin: 'gǔn', meaning: 'вертикальный стержень кисти', type: 'radical' },
    ],
    etymology: 'Упрощенное изображение руки, держащей кисть для письма на свитке — книга и письменность.',
  },
  馆: {
    char: '馆',
    pinyin: 'guǎn',
    tone: 3,
    meaning: 'павильон, зал, публичное здание',
    radical: '饣 (еда)',
    strokeCount: 11,
    graphemes: [
      { char: '饣', pinyin: 'shí', meaning: 'угощение, прием гостей', type: 'radical' },
      { char: '官', pinyin: 'guān', meaning: 'казенный дом, служба (фонетик guān)', type: 'component' },
    ],
    etymology: 'Изначально постоялый двор с угощением (饣) для официальных лиц (官), ныне — крупное общественное здание (библиотека, музей).',
  },
  你: {
    char: '你',
    pinyin: 'nǐ',
    tone: 3,
    meaning: 'ты, вы',
    radical: '亻 (человек)',
    strokeCount: 7,
    graphemes: [
      { char: '亻', pinyin: 'rén', meaning: 'человек сбоку', type: 'radical' },
      { char: '尔', pinyin: 'ěr', meaning: 'ты (древняя форма и фонетик)', type: 'component' },
    ],
    etymology: 'Человек (亻) напротив, к которому обращаются напрямую (尔).',
  },
  朋: {
    char: '朋',
    pinyin: 'péng',
    tone: 2,
    meaning: 'друг, товарищ; пара',
    radical: '月 (луна / раковины)',
    strokeCount: 8,
    graphemes: [
      { char: '月', pinyin: 'yuè', meaning: 'связка раковин каури / луна', type: 'radical' },
      { char: '月', pinyin: 'yuè', meaning: 'вторая равная связка рядом', type: 'component' },
    ],
    etymology: 'Две одинаковые связки драгоценных раковин (月+月) бок о бок — символ равной и близкой дружбы.',
  },
  友: {
    char: '友',
    pinyin: 'yǒu',
    tone: 3,
    meaning: 'друг, дружеский',
    radical: '又 (правая рука)',
    strokeCount: 4,
    graphemes: [
      { char: '𠂇', pinyin: 'zuǒ', meaning: 'протянутая рука', type: 'component' },
      { char: '又', pinyin: 'yòu', meaning: 'вторая рука в рукопожатии', type: 'radical' },
    ],
    etymology: 'Две руки, тянущиеся в одном направлении для взаимопомощи — верный друг.',
  },
  水: {
    char: '水',
    pinyin: 'shuǐ',
    tone: 3,
    meaning: 'вода, река, жидкость',
    radical: '水 (вода)',
    strokeCount: 4,
    graphemes: [
      { char: '亅', pinyin: 'jué', meaning: 'центральное русло потока', type: 'radical' },
      { char: '冫', pinyin: 'bīng', meaning: 'брызги и волны по краям', type: 'component' },
    ],
    etymology: 'Пиктограмма текущей реки с быстрым центральным течением и расходящимися волнами по бокам.',
  },
  生: {
    char: '生',
    pinyin: 'shēng',
    tone: 1,
    meaning: 'рождаться, жизнь; ученик, студент',
    radical: '生 (жизнь)',
    strokeCount: 5,
    graphemes: [
      { char: '丿', pinyin: 'piě', meaning: 'молодой побег растения', type: 'component' },
      { char: '土', pinyin: 'tǔ', meaning: 'плодородная земля', type: 'radical' },
    ],
    etymology: 'Росток, пробивающийся сквозь землю (土) к солнцу — символ рождения, роста и новой жизни.',
  },
  北: {
    char: '北',
    pinyin: 'běi',
    tone: 3,
    meaning: 'север, северный',
    radical: '匕 (черпак / человек)',
    strokeCount: 5,
    graphemes: [
      { char: '爿', pinyin: 'pán', meaning: 'человек, повернувшийся влево', type: 'component' },
      { char: '匕', pinyin: 'bǐ', meaning: 'человек, повернувшийся вправо', type: 'radical' },
    ],
    etymology: 'Два человека стоят спиной друг к другу (отсюда значение «спина» и «север», куда дома в Китае обращали глухой стеной).',
  },
  京: {
    char: '京',
    pinyin: 'jīng',
    tone: 1,
    meaning: 'столица, высокий холм',
    radical: '亠 (крышка)',
    strokeCount: 8,
    graphemes: [
      { char: '亠', pinyin: 'tóu', meaning: 'высокая крыша башни', type: 'radical' },
      { char: '口', pinyin: 'kǒu', meaning: 'смотровое окно дворца', type: 'component' },
      { char: '小', pinyin: 'xiǎo', meaning: 'основание высокого холма', type: 'component' },
    ],
    etymology: 'Высокая сторожевая башня на возвышенности в центре императорской столицы.',
  },
  汉: {
    char: '汉',
    pinyin: 'hàn',
    tone: 4,
    meaning: 'династия Хань, китайский (народ и язык)',
    radical: '氵 (вода)',
    strokeCount: 5,
    graphemes: [
      { char: '氵', pinyin: 'shuǐ', meaning: 'вода, река Ханьшуй', type: 'radical' },
      { char: '又', pinyin: 'yòu', meaning: 'рука, исток', type: 'component' },
    ],
    etymology: 'Название великой реки Ханьшуй (氵), давшей имя династии Хань, китайскому народу и языку.',
  },
  语: {
    char: '语',
    pinyin: 'yǔ',
    tone: 3,
    meaning: 'язык, речь, говорить',
    radical: '讠 (речь)',
    strokeCount: 9,
    graphemes: [
      { char: '讠', pinyin: 'yán', meaning: 'слово, речь', type: 'radical' },
      { char: '五', pinyin: 'wǔ', meaning: 'пять (фонетик wǔ)', type: 'component' },
      { char: '口', pinyin: 'kǒu', meaning: 'рот, уста', type: 'component' },
    ],
    etymology: 'Слова (讠), произносимые устами (口) множества людей — язык и живая речь.',
  },
  喝: {
    char: '喝',
    pinyin: 'hē',
    tone: 1,
    meaning: 'пить',
    radical: '口 (рот)',
    strokeCount: 12,
    graphemes: [
      { char: '口', pinyin: 'kǒu', meaning: 'рот', type: 'radical' },
      { char: '曷', pinyin: 'hé', meaning: 'просить воды (фонетик hé)', type: 'component' },
    ],
    etymology: 'Утолять жажду ртом (口) в жаркий солнечный день (日 внутри 曷).',
  },
  茶: {
    char: '茶',
    pinyin: 'chá',
    tone: 2,
    meaning: 'чай, чайное растение',
    radical: '艹 (трава)',
    strokeCount: 9,
    graphemes: [
      { char: '艹', pinyin: 'cǎo', meaning: 'трава, молодые листья', type: 'radical' },
      { char: '人', pinyin: 'rén', meaning: 'человек, собирающий листья', type: 'component' },
      { char: '木', pinyin: 'mù', meaning: 'чайный куст, дерево', type: 'component' },
    ],
    etymology: 'Человек (人) среди травы (艹) и деревьев (木), собирающий ароматные чайные листья.',
  },
  喜: {
    char: '喜',
    pinyin: 'xǐ',
    tone: 3,
    meaning: 'радость, счастье, нравиться',
    radical: '口 (рот)',
    strokeCount: 12,
    graphemes: [
      { char: '壴', pinyin: 'zhù', meaning: 'праздничный барабан', type: 'component' },
      { char: '口', pinyin: 'kǒu', meaning: 'улыбающийся рот', type: 'radical' },
    ],
    etymology: 'Звук праздничного барабана (壴) и смеющийся рот (口) — искренняя радость.',
  },
  欢: {
    char: '欢',
    pinyin: 'huān',
    tone: 1,
    meaning: 'радоваться, ликовать',
    radical: '欠 (дыхание, эмоция)',
    strokeCount: 6,
    graphemes: [
      { char: '又', pinyin: 'yòu', meaning: 'взмах руки в приветствии', type: 'component' },
      { char: '欠', pinyin: 'qiàn', meaning: 'радостный возглас', type: 'radical' },
    ],
    etymology: 'Радостный возглас (欠) и открытый жест рукой (又) при встрече близких людей.',
  },
  高: {
    char: '高',
    pinyin: 'gāo',
    tone: 1,
    meaning: 'высокий, возвышенный',
    radical: '高 (высокий)',
    strokeCount: 10,
    graphemes: [
      { char: '亠', pinyin: 'tóu', meaning: 'шпиль крыши', type: 'radical' },
      { char: '口', pinyin: 'kǒu', meaning: 'верхний и нижний ярусы башни', type: 'component' },
    ],
    etymology: 'Пиктограмма высокой многоярусной городской башни над воротами.',
  },
  兴: {
    char: '兴',
    pinyin: 'xìng',
    tone: 4,
    meaning: 'воодушевление, интерес, процветать',
    radical: '八 (восемь / опоры)',
    strokeCount: 6,
    graphemes: [
      { char: '⺍', pinyin: 'xiǎo', meaning: 'множество дружных рук сверху', type: 'component' },
      { char: '同', pinyin: 'tóng', meaning: 'совместное поднятие (упр. основа)', type: 'radical' },
    ],
    etymology: 'Четыре руки дружно поднимают тяжелый сосуд вверх — общий подъем и воодушевление.',
  },
  电: {
    char: '电',
    pinyin: 'diàn',
    tone: 4,
    meaning: 'электричество, молния',
    radical: '日 (солнце / грозовая туча)',
    strokeCount: 5,
    graphemes: [
      { char: '日', pinyin: 'rì', meaning: 'грозовое небо', type: 'radical' },
      { char: '乚', pinyin: 'yǐ', meaning: 'разряд молнии, уходящий вниз', type: 'component' },
    ],
    etymology: 'Вспышка молнии (乚), пронзающая грозовые облака (日) — электрическая энергия.',
  },
  脑: {
    char: '脑',
    pinyin: 'nǎo',
    tone: 3,
    meaning: 'мозг, ум, голова',
    radical: '月 (плоть, орган тела)',
    strokeCount: 10,
    graphemes: [
      { char: '月', pinyin: 'ròu', meaning: 'орган тела (плоть)', type: 'radical' },
      { char: '亠', pinyin: 'tóu', meaning: 'макушка головы', type: 'component' },
      { char: '凶', pinyin: 'xiōng', meaning: 'черепная коробка с извилинами', type: 'component' },
    ],
    etymology: 'Важнейший орган тела (月), расположенный под сводом головы (亠) — головной мозг.',
  },
  医: {
    char: '医',
    pinyin: 'yī',
    tone: 1,
    meaning: 'медицина, врач, лечить',
    radical: '匚 (короб, футляр)',
    strokeCount: 7,
    graphemes: [
      { char: '匚', pinyin: 'fāng', meaning: 'медицинский ларец, футляр', type: 'radical' },
      { char: '矢', pinyin: 'shǐ', meaning: 'игла для акупунктуры / стрела', type: 'component' },
    ],
    etymology: 'Футляр лекаря (匚) с целебными иглами (矢) для извлечения стрел и лечения ран.',
  },
  院: {
    char: '院',
    pinyin: 'yuàn',
    tone: 4,
    meaning: 'двор, учреждение, институт, больница',
    radical: '阝 (холм, стена)',
    strokeCount: 9,
    graphemes: [
      { char: '阝', pinyin: 'fù', meaning: 'высокая ограда, стена', type: 'radical' },
      { char: '完', pinyin: 'wán', meaning: 'цельный, защищенный двор (фонетик wán)', type: 'component' },
    ],
    etymology: 'Полностью огороженный двор (完) за высокой стеной (阝) — крупное общественное учреждение.',
  },
};

/**
 * Rich preset words dictionary for instant response and zero-latency demo & HSK 1 starter set.
 */
export const PRESET_WORDS: Record<string, Omit<WordItem, 'id' | 'createdAt'>> = {
  好: {
    word: '好',
    pinyin: 'hǎo',
    translation: 'хороший, отлично, ладно',
    examples: [
      { zh: '你好！很高兴认识你。', pinyin: 'Nǐ hǎo! Hěn gāoxìng rènshi nǐ.', ru: 'Привет! Очень рад познакомиться с тобой.' },
      { zh: '今天天气真好。', pinyin: 'Jīntiān tiānqì zhēn hǎo.', ru: 'Сегодня действительно отличная погода.' },
    ],
    characters: [KNOWN_CHARACTERS['好']],
  },
  老师: {
    word: '老师',
    pinyin: 'lǎoshī',
    translation: 'учитель, преподаватель',
    examples: [
      { zh: '王老师教我们中文。', pinyin: 'Wáng lǎoshī jiāo wǒmen Zhōngwén.', ru: 'Учитель Ван преподает нам китайский язык.' },
      { zh: '谢谢您的帮助，老师！', pinyin: 'Xièxie nín de bāngzhù, lǎoshī!', ru: 'Спасибо за вашу помощь, учитель!' },
    ],
    characters: [KNOWN_CHARACTERS['老'], KNOWN_CHARACTERS['师']],
  },
  学习: {
    word: '学习',
    pinyin: 'xuéxí',
    translation: 'учиться, изучать',
    examples: [
      { zh: '我每天都努力学习汉语。', pinyin: 'Wǒ měitiān dōu nǔlì xuéxí Hànyǔ.', ru: 'Я каждый день усердно изучаю китайский язык.' },
      { zh: '学习新知识非常有趣。', pinyin: 'Xuéxí xīn zhīshi fēicháng yǒuqù.', ru: 'Изучать новые знания очень интересно.' },
    ],
    characters: [KNOWN_CHARACTERS['学'], KNOWN_CHARACTERS['习']],
  },
  中国: {
    word: '中国',
    pinyin: 'Zhōngguó',
    translation: 'Китай',
    examples: [
      { zh: '中国有着悠久的历史和文化。', pinyin: 'Zhōngguó yǒuzhe yōujiǔ de lìshǐ hé wénhuà.', ru: 'У Китая древняя история и богатая культура.' },
      { zh: '我明年想去中国旅行。', pinyin: 'Wǒ míngnián xiǎng qù Zhōngguó lǚxíng.', ru: 'В следующем году я хочу поехать путешествовать в Китай.' },
    ],
    characters: [KNOWN_CHARACTERS['中'], KNOWN_CHARACTERS['国']],
  },
  图书馆: {
    word: '图书馆',
    pinyin: 'túshūguǎn',
    translation: 'библиотека',
    examples: [
      { zh: '周末我喜欢在图书馆看书。', pinyin: 'Zhōumò wǒ xǐhuan zài túshūguǎn kànshū.', ru: 'По выходным я люблю читать книги в библиотеке.' },
      { zh: '大学图书馆里非常安静。', pinyin: 'Dàxué túshūguǎn lǐ fēicháng ānjìng.', ru: 'В университетской библиотеке очень тихо.' },
    ],
    characters: [KNOWN_CHARACTERS['图'], KNOWN_CHARACTERS['书'], KNOWN_CHARACTERS['馆']],
  },
  朋友: {
    word: '朋友',
    pinyin: 'péngyou',
    translation: 'друг, друзья',
    examples: [
      { zh: '他是我最好的朋友。', pinyin: 'Tā shì wǒ zuì hǎo de péngyou.', ru: 'Он мой самый лучший друг.' },
      { zh: '我们和朋友一起喝茶。', pinyin: 'Wǒmen hé péngyou yìqǐ hē chá.', ru: 'Мы вместе с друзьями пьем чай.' },
    ],
    characters: [KNOWN_CHARACTERS['朋'], KNOWN_CHARACTERS['友']],
  },
  你好: {
    word: '你好',
    pinyin: 'nǐ hǎo',
    translation: 'здравствуйте, привет',
    examples: [
      { zh: '你好，请问图书馆怎么走？', pinyin: 'Nǐ hǎo, qǐngwèn túshūguǎn zěnme zǒu?', ru: 'Здравствуйте, подскажите, пожалуйста, как пройти к библиотеке?' },
      { zh: '见到你真好，你好吗？', pinyin: 'Jiàndào nǐ zhēn hǎo, nǐ hǎo ma?', ru: 'Как здорово тебя видеть, как твои дела?' },
    ],
    characters: [KNOWN_CHARACTERS['你'], KNOWN_CHARACTERS['好']],
  },
  水: {
    word: '水',
    pinyin: 'shuǐ',
    translation: 'вода',
    examples: [
      { zh: '请给我一杯温水。', pinyin: 'Qǐng gěi wǒ yì bēi wēnshuǐ.', ru: 'Пожалуйста, дайте мне стакан теплой воды.' },
      { zh: '多喝水对身体好。', pinyin: 'Duō hē shuǐ duì shēntǐ hǎo.', ru: 'Пить больше воды полезно для здоровья.' },
    ],
    characters: [KNOWN_CHARACTERS['水']],
  },
  学生: {
    word: '学生',
    pinyin: 'xuésheng',
    translation: 'студент, ученик',
    examples: [
      { zh: '班里有二十个学生。', pinyin: 'Bān lǐ yǒu èrshí gè xuésheng.', ru: 'В группе двадцать студентов.' },
      { zh: '她是一位非常聪明的学生。', pinyin: 'Tā shì yí wèi fēicháng cōngmíng de xuésheng.', ru: 'Она очень умная студентка.' },
    ],
    characters: [KNOWN_CHARACTERS['学'], KNOWN_CHARACTERS['生']],
  },
  北京: {
    word: '北京',
    pinyin: 'Běijīng',
    translation: 'Пекин',
    examples: [
      { zh: '北京是中国的首都。', pinyin: 'Běijīng shì Zhōngguó de shǒudū.', ru: 'Пекин — столица Китая.' },
      { zh: '秋天是去北京旅游的最好季节。', pinyin: 'Qiūtiān shì qù Běijīng lǚyóu de zuì hǎo jìjié.', ru: 'Осень — лучший сезон для поездки в Пекин.' },
    ],
    characters: [KNOWN_CHARACTERS['北'], KNOWN_CHARACTERS['京']],
  },
  汉语: {
    word: '汉语',
    pinyin: 'Hànyǔ',
    translation: 'китайский язык',
    examples: [
      { zh: '他的汉语说得很流利。', pinyin: 'Tā de Hànyǔ shuō de hěn liúlì.', ru: 'Он очень бегло говорит по-китайски.' },
      { zh: '我们一起练习写汉字和说汉语。', pinyin: 'Wǒmen yìqǐ liànxí xiě Hànzì hé shuō Hànyǔ.', ru: 'Мы вместе тренируемся писать иероглифы и говорить по-китайски.' },
    ],
    characters: [KNOWN_CHARACTERS['汉'], KNOWN_CHARACTERS['语']],
  },
  喝茶: {
    word: '喝茶',
    pinyin: 'hē chá',
    translation: 'пить чай',
    examples: [
      { zh: '爷爷每天早上都喜欢喝茶。', pinyin: 'Yéye měitiān zǎoshang dōu xǐhuan hē chá.', ru: 'Дедушка каждое утро любит пить чай.' },
      { zh: '请坐，我们一起喝茶聊天吧。', pinyin: 'Qǐng zuò, wǒmen yìqǐ hē chá liáotiān ba.', ru: 'Присаживайтесь, давайте вместе выпьем чаю и побеседуем.' },
    ],
    characters: [KNOWN_CHARACTERS['喝'], KNOWN_CHARACTERS['茶']],
  },
  喜欢: {
    word: '喜欢',
    pinyin: 'xǐhuan',
    translation: 'нравиться, любить',
    examples: [
      { zh: '你最喜欢什么颜色？', pinyin: 'Nǐ zuì xǐhuan shénme yánsè?', ru: 'Какой цвет тебе нравится больше всего?' },
      { zh: '我很喜欢看中国电影。', pinyin: 'Wǒ hěn xǐhuan kàn Zhōngguó diànyǐng.', ru: 'Мне очень нравится смотреть китайские фильмы.' },
    ],
    characters: [KNOWN_CHARACTERS['喜'], KNOWN_CHARACTERS['欢']],
  },
  高兴: {
    word: '高兴',
    pinyin: 'gāoxìng',
    translation: 'радостный, довольный, рад',
    examples: [
      { zh: '听到这个好消息，大家都很高兴。', pinyin: 'Tīngdào zhège hǎo xiāoxi, dàjiā dōu hěn gāoxìng.', ru: 'Услышав эту хорошую новость, все очень обрадовались.' },
      { zh: '认识你我非常高兴。', pinyin: 'Rènshi nǐ wǒ fēicháng gāoxìng.', ru: 'Я очень рад знакомству с вами.' },
    ],
    characters: [KNOWN_CHARACTERS['高'], KNOWN_CHARACTERS['兴']],
  },
  电脑: {
    word: '电脑',
    pinyin: 'diànnǎo',
    translation: 'компьютер',
    examples: [
      { zh: '桌子上有一台新电脑。', pinyin: 'Zhuōzi shàng yǒu yì tái xīn diànnǎo.', ru: 'На столе стоит новый компьютер.' },
      { zh: '我用电脑查找学习资料。', pinyin: 'Wǒ yòng diànnǎo cházhǎo xuéxí zīliào.', ru: 'Я использую компьютер для поиска учебных материалов.' },
    ],
    characters: [KNOWN_CHARACTERS['电'], KNOWN_CHARACTERS['脑']],
  },
  医院: {
    word: '医院',
    pinyin: 'yīyuàn',
    translation: 'больница, клиника',
    examples: [
      { zh: '李大夫在第一医院工作。', pinyin: 'Lǐ dàifu zài dì-yī yīyuàn gōngzuò.', ru: 'Доктор Ли работает в первой больнице.' },
      { zh: '这家医院离地铁站很近。', pinyin: 'Zhè jiā yīyuàn lí dìtiězhàn hěn jìn.', ru: 'Эта больница находится очень близко к станции метро.' },
    ],
    characters: [KNOWN_CHARACTERS['医'], KNOWN_CHARACTERS['院']],
  },
};

/**
 * Дополнительный словарь частотных слов HSK 1–3 для мгновенного отображения перевода многосложных слов.
 */
export const COMMON_WORD_TRANSLATIONS: Record<string, string> = {
  妈妈: 'мама',
  爸爸: 'папа',
  哥哥: 'старший брат',
  姐姐: 'старшая сестра',
  弟弟: 'младший брат',
  妹妹: 'младшая сестра',
  家人: 'семья, домашние',
  吃饭: 'кушать, принимать пищу',
  米饭: 'вареный рис',
  面条: 'лапша',
  水果: 'фрукты',
  苹果: 'яблоко',
  牛奶: 'молоко',
  咖啡: 'кофе',
  面包: 'хлеб',
  鸡蛋: 'куриное яйцо',
  学校: 'школа, учебное заведение',
  大学: 'университет',
  中学: 'средняя школа',
  小学: 'начальная школа',
  同学: 'одноклассник, сокурсник',
  教室: 'класс, аудитория',
  工作: 'работа, работать',
  公司: 'компания, фирма',
  医生: 'врач, доктор',
  护士: 'медсестра',
  司机: 'водитель',
  经理: 'менеджер, директор',
  谢谢: 'спасибо, благодарю',
  不客气: 'не за что, пожалуйста',
  再见: 'до свидания',
  对不起: 'извините, простите',
  没关系: 'ничего страшного',
  请问: 'подскажите, пожалуйста',
  名字: 'имя',
  什么: 'что, какой',
  哪里: 'где, куда',
  怎么: 'как, каким образом',
  多少: 'сколько',
  今天: 'сегодня',
  明天: 'завтра',
  昨天: 'вчера',
  现在: 'сейчас',
  时间: 'время',
  星期: 'неделя',
  上午: 'первая половина дня, утро',
  下午: 'вторая половина дня',
  晚上: 'вечер',
  早上: 'раннее утро',
  天气: 'погода',
  下雨: 'идет дождь',
  下雪: 'идет снег',
  看书: 'читать книгу',
  写字: 'писать иероглифы',
  说话: 'разговаривать, говорить',
  听音乐: 'слушать музыку',
  看电影: 'смотреть кино',
  电影: 'фильм, кино',
  电视: 'телевизор',
  手机: 'мобильный телефон',
  飞机: 'самолет',
  火车: 'поезд',
  火车站: 'железнодорожный вокзал',
  机场: 'аэропорт',
  出租车: 'такси',
  公共汽车: 'автобус',
  商店: 'магазин',
  超市: 'супермаркет',
  买东西: 'покупать вещи, делать покупки',
  东西: 'вещь, предмет',
  衣服: 'одежда',
  漂亮: 'красивый, нарядный',
  认识: 'знакомиться, знать',
  休息: 'отдыхать, отдых',
  运动: 'спорт, заниматься спортом',
  游泳: 'плавать, плавание',
  跑步: 'бегать',
  旅游: 'путешествовать, туризм',
  上海: 'Шанхай',
  俄罗斯: 'Россия',
  莫斯科: 'Москва',
  中文: 'китайский язык (письменный и устный)',
  汉字: 'китайские иероглифы',
  书法: 'каллиграфия',
  毛笔: 'кисть для каллиграфии',
  墨水: 'тушь, чернила',
};

/**
 * Дополнительный словарь значений отдельных частотных иероглифов HSK 1–3.
 */
export const COMMON_CHAR_MEANINGS: Record<string, string> = {
  我: 'я, мой',
  他: 'он',
  她: 'она',
  们: 'суффикс множественного числа',
  的: 'притяжательная частица',
  是: 'быть, являться',
  不: 'не, нет',
  在: 'находиться в, на',
  有: 'иметь, есть',
  人: 'человек, люди',
  大: 'большой, старший',
  小: 'маленький, младший',
  多: 'много',
  少: 'мало',
  上: 'верх, наверх, прошлый',
  下: 'низ, вниз, следующий',
  来: 'приходить, приезжать',
  去: 'уходить, ехать',
  看: 'смотреть, читать',
  听: 'слушать',
  说: 'говорить, сказать',
  读: 'читать вслух',
  写: 'писать',
  吃: 'есть, кушать',
  饭: 'еда, вареный рис',
  买: 'покупать',
  卖: 'продавать',
  开: 'открывать, вести машину',
  坐: 'сидеть, ехать (на транспорте)',
  住: 'жить, проживать',
  家: 'дом, семья',
  校: 'школа, учебное заведение',
  店: 'магазин, лавка',
  车: 'повозка, машина, транспорт',
  机: 'механизм, аппарат, самолет',
  天: 'небо, день',
  气: 'воздух, дыхание, погода',
  年: 'год',
  月: 'месяц, луна',
  日: 'солнце, день',
  今: 'нынешний, сегодня',
  明: 'светлый, ясный, завтра',
  昨: 'вчера',
  早: 'рано, утро',
  晚: 'поздно, вечер',
  午: 'полдень',
  时: 'время, час',
  间: 'промежуток, комната',
  名: 'имя, знаменитый',
  字: 'иероглиф, письменный знак',
  文: 'письменность, культура, язык',
  妈: 'мама',
  爸: 'папа',
  哥: 'старший брат',
  姐: 'старшая сестра',
  弟: 'младший брат',
  妹: 'младшая сестра',
  爱: 'любить, любовь',
  想: 'думать, хотеть, скучать',
  会: 'уметь, мочь',
  能: 'мочь, быть способным',
  很: 'очень',
  太: 'слишком, чрезвычайно',
  真: 'настоящий, действительно',
  都: 'все, всё',
  也: 'тоже, также',
  和: 'и, с, мир',
  謝: 'благодарить',
  谢: 'благодарить, спасибо',
  再: 'снова, еще раз',
  见: 'видеть, встречаться',
  请: 'просить, пожалуйста',
  问: 'спрашивать',
  火: 'огонь',
  山: 'гора',
  木: 'дерево',
  口: 'рот, вход',
  手: 'рука',
  心: 'сердце, душа, мысль',
  墨: 'тушь, чернила',
};

/**
 * Проверяет, является ли строка перевода технической заглушкой или пустой.
 */
export function isPlaceholderTranslation(text?: string | null): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  return /^Слово «.+»/i.test(trimmed) || /^Иероглиф «.+»/i.test(trimmed);
}

/**
 * Builds a complete fallback CharDetail for any Chinese character,
 * checking KNOWN_CHARACTERS, COMMON_CHAR_MEANINGS, and RADICALS_DATA first.
 */
export function buildFallbackCharDetail(char: string): CharDetail {
  if (KNOWN_CHARACTERS[char]) {
    return KNOWN_CHARACTERS[char];
  }
  const radicalMatch = RADICALS_DATA.find((r) => r.char === char || r.variant === char);
  const { pinyin: py, tone } = getCharPinyinAndTone(char);
  const commonCharMeaning = COMMON_CHAR_MEANINGS[char];

  if (radicalMatch) {
    return {
      char,
      pinyin: radicalMatch.pinyin || py,
      tone: detectToneFromPinyin(radicalMatch.pinyin || py),
      meaning: commonCharMeaning || radicalMatch.meaning,
      radical: `${radicalMatch.char} (ключ №${radicalMatch.number}, ${radicalMatch.meaning.split(',')[0]})`,
      strokeCount: radicalMatch.strokes,
      graphemes: [
        {
          char: radicalMatch.char,
          pinyin: radicalMatch.pinyin,
          meaning: radicalMatch.meaning,
          type: 'radical',
        },
      ],
      etymology: `Базовый иероглифический ключ Канси №${radicalMatch.number} (${radicalMatch.strokes} черт): «${radicalMatch.meaning}». Часто встречается в знаках: ${radicalMatch.examples.join(', ')}.`,
    };
  }

  return {
    char,
    pinyin: py || char,
    tone,
    meaning: commonCharMeaning || `знак «${char}» (${py})`,
    radical: `${char} (базовый ключ)`,
    strokeCount: 8,
    graphemes: [
      {
        char,
        pinyin: py,
        meaning: commonCharMeaning || 'основной структурный элемент',
        type: 'radical',
      },
    ],
    etymology: `Иероглиф «${char}» произносится как «${py}» (${tone}-й тон) и входит в состав лексической единицы.`,
  };
}

/**
 * Normalizes raw API output or fallback into a strictly valid WordItem.
 */
export function normalizeWordItem(raw: Partial<WordItem> | null | undefined, inputText: string): WordItem {
  const chars = extractChineseChars(raw?.word || inputText);
  const cleanWord = chars.length > 0 ? chars.join('') : inputText.trim();
  const preset = PRESET_WORDS[cleanWord];
  const commonWordMeaning = COMMON_WORD_TRANSLATIONS[cleanWord];
  const radicalEntry =
    cleanWord.length === 1
      ? RADICALS_DATA.find((r) => r.char === cleanWord || r.variant === cleanWord)
      : undefined;

  const wordPinyin =
    raw?.pinyin?.trim() || preset?.pinyin || radicalEntry?.pinyin || getPinyinForText(cleanWord);

  const rawTranslation = raw?.translation?.trim();
  const cleanRawTranslation =
    rawTranslation && !isPlaceholderTranslation(rawTranslation) ? rawTranslation : '';

  const rawChars = Array.isArray(raw?.characters) ? raw!.characters : [];
  const characters: CharDetail[] = (chars.length > 0 ? chars : [cleanWord.slice(0, 1)]).map(
    (ch, idx) => {
      const found = rawChars.find((rc) => rc.char === ch) || rawChars[idx];
      const fallback = buildFallbackCharDetail(ch);
      if (!found) return fallback;

      const { pinyin: computedPy, tone: computedTone } = getCharPinyinAndTone(ch);
      const graphemes: Grapheme[] =
        Array.isArray(found.graphemes) && found.graphemes.length > 0
          ? found.graphemes.map((g) => ({
              char: g.char || ch,
              pinyin: g.pinyin || getPinyinForText(g.char || ch),
              meaning: g.meaning || 'компонент',
              type: g.type === 'radical' ? 'radical' : 'component',
            }))
          : fallback.graphemes;

      return {
        char: ch,
        pinyin: found.pinyin || computedPy || fallback.pinyin,
        tone:
          typeof found.tone === 'number' && found.tone >= 1 && found.tone <= 5
            ? found.tone
            : computedTone,
        meaning:
          found.meaning && !isPlaceholderTranslation(found.meaning)
            ? found.meaning
            : fallback.meaning,
        radical: found.radical || fallback.radical,
        strokeCount:
          typeof found.strokeCount === 'number' && found.strokeCount > 0
            ? found.strokeCount
            : fallback.strokeCount,
        graphemes,
        etymology: found.etymology || fallback.etymology,
      };
    }
  );

  // Если перевод всего слова еще не задан, проверяем словари или собираем осмысленный перевод из известных знаков
  const knownCharMeanings = characters
    .map((c) => {
      if (KNOWN_CHARACTERS[c.char]) return KNOWN_CHARACTERS[c.char].meaning.split(',')[0].trim();
      if (COMMON_CHAR_MEANINGS[c.char]) return COMMON_CHAR_MEANINGS[c.char].split(',')[0].trim();
      return '';
    })
    .filter(Boolean);

  const translation =
    cleanRawTranslation ||
    preset?.translation ||
    commonWordMeaning ||
    radicalEntry?.meaning ||
    (cleanWord.length === 1 && KNOWN_CHARACTERS[cleanWord]
      ? KNOWN_CHARACTERS[cleanWord].meaning
      : cleanWord.length === 1 && COMMON_CHAR_MEANINGS[cleanWord]
      ? COMMON_CHAR_MEANINGS[cleanWord]
      : knownCharMeanings.length === chars.length && knownCharMeanings.length > 0
      ? knownCharMeanings.join(' + ')
      : `Слово «${cleanWord}» (${wordPinyin})`);

  const examples =
    Array.isArray(raw?.examples) && raw!.examples.length > 0
      ? raw!.examples.map((ex) => ({
          zh: ex.zh || cleanWord,
          pinyin: ex.pinyin || getPinyinForText(ex.zh || cleanWord),
          ru: ex.ru || '',
        }))
      : preset?.examples || [
          {
            zh: `我们今天学习“${cleanWord}”。`,
            pinyin: `Wǒmen jīntiān xuéxí "${wordPinyin}".`,
            ru: `Сегодня мы изучаем «${cleanWord}» (${translation}).`,
          },
          {
            zh: `请在字帖中练习写“${cleanWord}”。`,
            pinyin: `Qǐng zài zìtiè zhōng liànxí xiě "${wordPinyin}".`,
            ru: `Пожалуйста, потренируйтесь писать «${cleanWord}» в прописи.`,
          },
        ];

  return {
    id: raw?.id || `word-${cleanWord}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    word: cleanWord,
    pinyin: wordPinyin,
    translation,
    examples,
    characters,
    createdAt: raw?.createdAt || Date.now(),
  };
}

/**
 * Starter demo set of 3 words for the very first launch of the app.
 */
export function getInitialDemoWorksheet(): WordItem[] {
  return ['你好', '老师', '好'].map((w, i) => ({
    ...normalizeWordItem(PRESET_WORDS[w], w),
    id: `demo-${w}-${i}`,
  }));
}

/**
 * Returns the 15-word HSK 1 starter vocabulary list (including multi-syllable words) for Games.
 */
export function getHsk1StarterWords(): WordItem[] {
  const keys = [
    '你好',
    '老师',
    '学习',
    '中国',
    '图书馆',
    '朋友',
    '学生',
    '北京',
    '汉语',
    '喝茶',
    '喜欢',
    '高兴',
    '电脑',
    '医院',
    '好',
  ];
  return keys.map((w, i) => ({
    ...normalizeWordItem(PRESET_WORDS[w], w),
    id: `hsk1-${w}-${i}`,
  }));
}

export interface WorksheetCellSpec {
  char: string | null;
  mode: 'sample' | 'trace' | 'empty';
}

/**
 * Generates cell descriptors for a worksheet block:
 * - by-character mode: 1 black sample, `traceCount` gray trace cells, remaining empty cells.
 * - whole-word mode: alternating characters of the word in sequence:
 *   first word instance in 'sample' (black), next `traceCount` instances in 'trace' (gray),
 *   and remaining cells 'empty'.
 */
export function buildWorksheetCells(
  chars: string[],
  layoutMode: 'by-character' | 'whole-word',
  totalCells: number,
  traceCount: number
): WorksheetCellSpec[] {
  const cells: WorksheetCellSpec[] = [];
  if (chars.length === 0 || totalCells <= 0) return cells;

  if (layoutMode === 'by-character') {
    const ch = chars[0];
    for (let i = 0; i < totalCells; i++) {
      if (i === 0) {
        cells.push({ char: ch, mode: 'sample' });
      } else if (i <= traceCount) {
        cells.push({ char: ch, mode: 'trace' });
      } else {
        cells.push({ char: null, mode: 'empty' });
      }
    }
    return cells;
  }

  // whole-word mode: word characters alternate in groups
  const wordLen = chars.length;
  for (let i = 0; i < totalCells; i++) {
    const groupIndex = Math.floor(i / wordLen);
    const charIndex = i % wordLen;
    const isCompleteWordGroupFit = (groupIndex + 1) * wordLen <= totalCells;

    if (!isCompleteWordGroupFit) {
      cells.push({ char: null, mode: 'empty' });
    } else if (groupIndex === 0) {
      cells.push({ char: chars[charIndex], mode: 'sample' });
    } else if (groupIndex <= traceCount) {
      cells.push({ char: chars[charIndex], mode: 'trace' });
    } else {
      cells.push({ char: null, mode: 'empty' });
    }
  }
  return cells;
}

const TONE_VOWEL_SETS: string[][] = [
  ['ā', 'á', 'ǎ', 'à', 'a'],
  ['ē', 'é', 'ě', 'è', 'e'],
  ['ī', 'í', 'ǐ', 'ì', 'i'],
  ['ō', 'ó', 'ǒ', 'ò', 'o'],
  ['ū', 'ú', 'ǔ', 'ù', 'u'],
  ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
];

/**
 * Generates 4 distinct pinyin tone options (1 correct + 3 realistic tone distractors) for Game 3.
 */
export function generatePinyinToneOptions(correctPinyin: string): string[] {
  const clean = correctPinyin.trim();
  const variants = new Set<string>([clean]);

  // Try replacing tone vowels across syllables to create realistic tone distractors
  for (const vowelGroup of TONE_VOWEL_SETS) {
    for (const v of vowelGroup) {
      if (clean.toLowerCase().includes(v)) {
        for (const replacement of vowelGroup) {
          if (replacement !== v) {
            const mutated = clean.replace(new RegExp(v, 'i'), replacement);
            variants.add(mutated);
          }
        }
      }
    }
  }

  // Also add second-syllable tone variations for multi-syllable words
  const currentList = Array.from(variants);
  for (const base of currentList) {
    if (variants.size >= 8) break;
    for (const vowelGroup of TONE_VOWEL_SETS) {
      for (const v of vowelGroup) {
        const lastIdx = base.toLowerCase().lastIndexOf(v);
        if (lastIdx > 0) {
          for (const rep of vowelGroup) {
            if (rep !== v) {
              const nextVariant = base.slice(0, lastIdx) + rep + base.slice(lastIdx + 1);
              variants.add(nextVariant);
            }
          }
        }
      }
    }
  }

  const fallbackPool = ['lǎoshī', 'xuéxí', 'péngyou', 'túshūguǎn', 'Zhōngguó', 'xǐhuan', 'gāoxìng', 'hǎo'];
  for (const fb of fallbackPool) {
    if (variants.size >= 4) break;
    variants.add(fb);
  }

  const distractors = Array.from(variants)
    .filter((v) => v !== clean)
    .slice(0, 3);

  return [clean, ...distractors].sort((a, b) => a.localeCompare(b));
}
