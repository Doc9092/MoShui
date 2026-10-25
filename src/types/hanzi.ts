export interface Grapheme {
  char: string;
  pinyin: string;
  meaning: string;
  type: 'radical' | 'component';
}

export interface CharDetail {
  char: string;
  pinyin: string;
  tone: number;
  meaning: string;
  radical: string;
  strokeCount: number;
  graphemes: Grapheme[];
  etymology: string;
}

export interface WordExample {
  zh: string;
  pinyin: string;
  ru: string;
}

export interface WordItem {
  id: string;
  word: string;
  pinyin: string;
  translation: string;
  examples: WordExample[];
  characters: CharDetail[];
  createdAt: number;
}

export interface WorksheetConfig {
  sheetTitle: string;
  layoutMode: 'by-character' | 'whole-word';
  gridType: 'mizi' | 'tianzi' | 'kouzi';
  gridColor: 'red' | 'green' | 'gray';
  showStrokeOrder: boolean;
  traceCount: number;
  rowsPerItem: 1 | 2;
  cellsPerRow: number;
}

export interface RadicalItem {
  number: number;
  char: string;
  variant?: string;
  pinyin: string;
  meaning: string;
  strokes: number;
  examples: string[];
}

export interface TeacherProfile {
  id: string;
  name: string;
  email: string;
  schoolOrTitle?: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface TeacherFolder {
  id: string;
  name: string;
  color: string;
}

export interface SavedWorksheet {
  id: string;
  teacherId: string;
  title: string;
  folder: string;
  description?: string;
  words: WordItem[];
  config: WorksheetConfig;
  createdAt: number;
  updatedAt: number;
}

export type AppTab = 'dictionary' | 'worksheet' | 'radicals' | 'games' | 'dashboard';
