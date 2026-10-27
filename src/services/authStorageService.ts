import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type {
  SavedWorksheet,
  TeacherFolder,
  TeacherProfile,
  WordItem,
  WorksheetConfig,
} from '../types/hanzi';

export interface SupabaseWorksheetRow {
  id: string;
  teacher_id: string;
  title: string;
  folder: string;
  description?: string | null;
  words: WordItem[];
  config: WorksheetConfig;
  created_at: number | string;
  updated_at: number | string;
}

export interface SupabaseFolderRow {
  id: string;
  teacher_id: string;
  name: string;
  color: string;
  created_at?: number | string;
}

export interface TeacherWorkspaceBackup {
  version: number;
  exportedAt: string;
  app: 'MoShui';
  profile: TeacherProfile;
  folders: TeacherFolder[];
  worksheets: SavedWorksheet[];
  defaultConfig?: WorksheetConfig;
}

const DEFAULT_FOLDERS_TEMPLATE: Array<{ name: string; color: string }> = [
  { name: 'HSK 1', color: 'rose' },
  { name: 'Детская группа', color: 'amber' },
  { name: 'Индивидуальные уроки', color: 'emerald' },
];

const memoryStore = new Map<string, string>();

function readLocalCache(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return memoryStore.get(key) ?? null;
}

function writeLocalCache(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // ignore
  }
  memoryStore.set(key, value);
}

function removeLocalCache(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch {
    // ignore
  }
  memoryStore.delete(key);
}

const PENDING_PROFILE_KEY = 'moshui_supabase_cached_profile_v1';

function getWorksheetsCacheKey(teacherId: string): string {
  return `moshui_cloud_worksheets_cache_${teacherId}`;
}

function getFoldersCacheKey(teacherId: string): string {
  return `moshui_cloud_folders_cache_${teacherId}`;
}

function getDefaultConfigKey(teacherId: string): string {
  return `moshui_default_config_${teacherId}`;
}

/**
 * Генерация валидного UUID v4 для первичных ключей таблиц public.worksheets и public.folders.
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/**
 * Перевод ошибок Supabase Auth и PostgreSQL на понятный русский язык.
 */
export function translateSupabaseError(error: unknown): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error || '');

  const lower = rawMessage.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Неверный Email или пароль. Проверьте введенные данные или зарегистрируйтесь.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Ваш Email еще не подтвержден. Перейдите по ссылке в письме от Supabase или отключите опцию «Confirm email» в панели Supabase (Authentication → Providers → Email).';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Преподаватель с таким Email уже зарегистрирован. Переключитесь на вкладку «Вход в систему».';
  }
  if (lower.includes('password should be at least 6 characters')) {
    return 'Пароль в Supabase должен содержать минимум 6 символов.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Слишком много запросов к серверу авторизации. Пожалуйста, подождите минуту и попробуйте снова.';
  }
  if (lower.includes('violates row-level security policy')) {
    return 'Для сохранения в облако Supabase требуется активная подтвержденная сессия (подтвердите Email или отключите Confirm Email в настройках проекта Supabase).';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Не удалось соединиться с облаком Supabase. Проверьте подключение к интернету.';
  }

  return rawMessage || 'Произошла ошибка при обращении к облаку Supabase.';
}

/**
 * Преобразование объекта пользователя Supabase Auth в модель TeacherProfile.
 */
export function mapSupabaseUserToProfile(user: User): TeacherProfile {
  const meta = user.user_metadata || {};
  const email = user.email || '';
  const fallbackName = email ? email.split('@')[0] : 'Преподаватель';

  const createdAtMs = user.created_at ? new Date(user.created_at).getTime() : Date.now();

  return {
    id: user.id,
    name: typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : fallbackName,
    email,
    schoolOrTitle:
      typeof meta.schoolOrTitle === 'string' && meta.schoolOrTitle.trim()
        ? meta.schoolOrTitle.trim()
        : undefined,
    avatarUrl:
      typeof meta.avatarUrl === 'string' && meta.avatarUrl.trim()
        ? meta.avatarUrl.trim()
        : undefined,
    createdAt: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
  };
}

/**
 * Преобразование строки таблицы public.worksheets в клиентскую модель SavedWorksheet.
 */
export function mapWorksheetRowToSavedWorksheet(row: SupabaseWorksheetRow): SavedWorksheet {
  const createdMs =
    typeof row.created_at === 'number'
      ? row.created_at
      : new Date(row.created_at || Date.now()).getTime();
  const updatedMs =
    typeof row.updated_at === 'number'
      ? row.updated_at
      : new Date(row.updated_at || Date.now()).getTime();

  return {
    id: row.id,
    teacherId: row.teacher_id,
    title: row.title || 'Учебная пропись',
    folder: row.folder || 'HSK 1',
    description: row.description || undefined,
    words: Array.isArray(row.words) ? row.words : [],
    config: row.config,
    createdAt: Number.isFinite(createdMs) ? createdMs : Date.now(),
    updatedAt: Number.isFinite(updatedMs) ? updatedMs : Date.now(),
  };
}

/**
 * Преобразование строки таблицы public.folders в клиентскую модель TeacherFolder.
 */
export function mapFolderRowToTeacherFolder(row: SupabaseFolderRow): TeacherFolder {
  return {
    id: row.id,
    name: row.name,
    color: row.color || 'rose',
  };
}

/**
 * Регистрация нового преподавателя через Supabase Auth (signUp).
 */
export async function signUp(params: {
  name: string;
  email: string;
  password: string;
  schoolOrTitle?: string;
}): Promise<{ profile: TeacherProfile; sessionActive: boolean }> {
  const cleanName = params.name.trim();
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPassword = params.password;

  if (!cleanName) {
    throw new Error('Пожалуйста, укажите ваше имя или обращение (например, Лилия Лаоши).');
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Пожалуйста, укажите корректный Email.');
  }
  if (!cleanPassword || cleanPassword.length < 6) {
    throw new Error('Пароль должен содержать минимум 6 символов.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: cleanPassword,
    options: {
      data: {
        name: cleanName,
        schoolOrTitle: params.schoolOrTitle?.trim() || undefined,
      },
    },
  });

  if (error) {
    throw new Error(translateSupabaseError(error));
  }

  if (!data.user) {
    throw new Error('Не удалось создать профиль преподавателя в Supabase.');
  }

  const profile = mapSupabaseUserToProfile(data.user);
  writeLocalCache(PENDING_PROFILE_KEY, JSON.stringify(profile));

  const sessionActive = Boolean(data.session);
  if (sessionActive) {
    await fetchTeacherFolders(profile.id);
  } else {
    // Инициализируем локальный кэш папок до подтверждения Email
    const initialFolders: TeacherFolder[] = DEFAULT_FOLDERS_TEMPLATE.map((tpl) => ({
      id: generateUuid(),
      name: tpl.name,
      color: tpl.color,
    }));
    writeLocalCache(getFoldersCacheKey(profile.id), JSON.stringify(initialFolders));
  }

  return { profile, sessionActive };
}

/**
 * Вход преподавателя через Supabase Auth (signInWithPassword).
 */
export async function signIn(email: string, password: string): Promise<TeacherProfile> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Введите Email и пароль для входа.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    throw new Error(translateSupabaseError(error));
  }

  if (!data.user) {
    throw new Error('Пользователь не найден.');
  }

  const profile = mapSupabaseUserToProfile(data.user);
  writeLocalCache(PENDING_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

/**
 * Полная очистка всех локальных данных пользователя и черновиков прописей из localStorage.
 */
export function clearAllLocalUserStorage(): void {
  removeLocalCache(PENDING_PROFILE_KEY);
  removeLocalCache('moshui_worksheets');
  removeLocalCache('moshui_current_words');
  removeLocalCache('moshui_worksheet_list_v2');
  removeLocalCache('moshui_worksheet_config_v1');

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (
          key &&
          (key.startsWith('moshui_cloud_worksheets_cache_') ||
            key.startsWith('moshui_cloud_folders_cache_') ||
            key.startsWith('moshui_default_config_'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    }
  } catch {
    // ignore
  }
  memoryStore.clear();
}

/**
 * Выход из аккаунта преподавателя через Supabase Auth (signOut).
 */
export async function signOut(): Promise<void> {
  clearAllLocalUserStorage();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(translateSupabaseError(error));
  }
}

/**
 * Получение текущей сессии преподавателя из Supabase Auth (getSession).
 */
export async function getTeacherSession(): Promise<TeacherProfile | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error) {
      if (data.session?.user) {
        const profile = mapSupabaseUserToProfile(data.session.user);
        writeLocalCache(PENDING_PROFILE_KEY, JSON.stringify(profile));
        return profile;
      }
      removeLocalCache(PENDING_PROFILE_KEY);
      return null;
    }
  } catch {
    // fallback to cached profile only on network exception
  }

  const cached = readLocalCache(PENDING_PROFILE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as TeacherProfile;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Синхронное чтение закэшированного профиля для мгновенного первого рендера до ответа getSession().
 */
export function getCachedTeacherProfile(): TeacherProfile | null {
  const cached = readLocalCache(PENDING_PROFILE_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as TeacherProfile;
  } catch {
    return null;
  }
}

/**
 * Обновление метаданных профиля преподавателя в Supabase Auth.
 */
export async function updateTeacherProfileInCloud(
  teacherId: string,
  updates: Partial<Pick<TeacherProfile, 'name' | 'schoolOrTitle' | 'avatarUrl'>>
): Promise<TeacherProfile> {
  const nextName = updates.name?.trim();
  if (updates.name !== undefined && !nextName) {
    throw new Error('Имя преподавателя не может быть пустым.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    const { data, error } = await supabase.auth.updateUser({
      data: {
        name: nextName,
        schoolOrTitle: updates.schoolOrTitle?.trim() || null,
        avatarUrl: updates.avatarUrl?.trim() || null,
      },
    });

    if (error) {
      throw new Error(translateSupabaseError(error));
    }

    if (data.user) {
      const updated = mapSupabaseUserToProfile(data.user);
      writeLocalCache(PENDING_PROFILE_KEY, JSON.stringify(updated));
      return updated;
    }
  }

  const existing = getCachedTeacherProfile();
  const fallbackProfile: TeacherProfile = {
    id: teacherId,
    name: nextName || existing?.name || 'Преподаватель',
    email: existing?.email || '',
    schoolOrTitle:
      updates.schoolOrTitle !== undefined
        ? updates.schoolOrTitle.trim() || undefined
        : existing?.schoolOrTitle,
    avatarUrl:
      updates.avatarUrl !== undefined
        ? updates.avatarUrl.trim() || undefined
        : existing?.avatarUrl,
    createdAt: existing?.createdAt || Date.now(),
  };
  writeLocalCache(PENDING_PROFILE_KEY, JSON.stringify(fallbackProfile));
  return fallbackProfile;
}

/**
 * Загрузка всех папок преподавателя из таблицы public.folders.
 * Если у нового преподавателя еще нет папок в БД, автоматически создает базовые папки.
 */
export async function fetchTeacherFolders(teacherId: string): Promise<TeacherFolder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: true });

  if (!error && Array.isArray(data)) {
    if (data.length > 0) {
      const mapped = (data as SupabaseFolderRow[]).map(mapFolderRowToTeacherFolder);
      writeLocalCache(getFoldersCacheKey(teacherId), JSON.stringify(mapped));
      return mapped;
    }

    // Если в облаке пока 0 папок и есть активная сессия — создаем стартовые папки
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user?.id === teacherId) {
      const now = Date.now();
      const seedRows: SupabaseFolderRow[] = DEFAULT_FOLDERS_TEMPLATE.map((tpl, idx) => ({
        id: generateUuid(),
        teacher_id: teacherId,
        name: tpl.name,
        color: tpl.color,
        created_at: now + idx,
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('folders')
        .upsert(seedRows)
        .select('*');

      if (!insertErr && Array.isArray(inserted) && inserted.length > 0) {
        const mapped = (inserted as SupabaseFolderRow[]).map(mapFolderRowToTeacherFolder);
        writeLocalCache(getFoldersCacheKey(teacherId), JSON.stringify(mapped));
        return mapped;
      }
    }
  }

  // Резервный кэш (например, если пользователь зарегистрировался, но еще не подтвердил Email)
  const rawCache = readLocalCache(getFoldersCacheKey(teacherId));
  if (rawCache) {
    try {
      const parsed = JSON.parse(rawCache);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  const fallbackFolders: TeacherFolder[] = DEFAULT_FOLDERS_TEMPLATE.map((tpl) => ({
    id: generateUuid(),
    name: tpl.name,
    color: tpl.color,
  }));
  writeLocalCache(getFoldersCacheKey(teacherId), JSON.stringify(fallbackFolders));
  return fallbackFolders;
}

/**
 * Создание новой папки в таблице public.folders.
 */
export async function createFolderInCloud(
  teacherId: string,
  name: string,
  color = 'rose'
): Promise<TeacherFolder[]> {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Введите название папки.');
  }

  const currentFolders = await fetchTeacherFolders(teacherId);
  const existing = currentFolders.find(
    (f) => f.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (existing) {
    return currentFolders;
  }

  const newRow: SupabaseFolderRow = {
    id: generateUuid(),
    teacher_id: teacherId,
    name: cleanName,
    color,
    created_at: Date.now(),
  };

  const { data, error } = await supabase.from('folders').insert(newRow).select('*').single();

  if (!error && data) {
    const createdFolder = mapFolderRowToTeacherFolder(data as SupabaseFolderRow);
    const updated = [...currentFolders, createdFolder];
    writeLocalCache(getFoldersCacheKey(teacherId), JSON.stringify(updated));
    return updated;
  }

  // Если сессия ожидает подтверждения Email, сохраняем также в локальный кэш учителя
  const fallbackFolder: TeacherFolder = {
    id: newRow.id,
    name: cleanName,
    color,
  };
  const updated = [...currentFolders, fallbackFolder];
  writeLocalCache(getFoldersCacheKey(teacherId), JSON.stringify(updated));
  return updated;
}

/**
 * Удаление папки из таблицы public.folders.
 */
export async function deleteFolderFromCloud(
  teacherId: string,
  folderId: string
): Promise<TeacherFolder[]> {
  const { error } = await supabase.from('folders').delete().eq('id', folderId);
  if (error) {
    console.warn('Предупреждение при удалении папки из Supabase:', error.message);
  }

  const current = await fetchTeacherFolders(teacherId);
  const updated = current.filter((f) => f.id !== folderId);
  writeLocalCache(getFoldersCacheKey(teacherId), JSON.stringify(updated));
  return updated;
}

/**
 * Загрузка всех сохраненных прописей преподавателя из таблицы public.worksheets:
 * supabase.from('worksheets').select('*').order('updated_at', { ascending: false })
 */
export async function fetchSavedWorksheets(teacherId: string): Promise<SavedWorksheet[]> {
  const { data, error } = await supabase
    .from('worksheets')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('updated_at', { ascending: false });

  if (!error && Array.isArray(data)) {
    const cloudSheets = (data as SupabaseWorksheetRow[]).map(mapWorksheetRowToSavedWorksheet);
    if (cloudSheets.length > 0) {
      writeLocalCache(getWorksheetsCacheKey(teacherId), JSON.stringify(cloudSheets));
      return cloudSheets;
    }

    // Проверяем, есть ли активная сессия
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user?.id === teacherId) {
      writeLocalCache(getWorksheetsCacheKey(teacherId), JSON.stringify([]));
      return [];
    }
  }

  const rawCache = readLocalCache(getWorksheetsCacheKey(teacherId));
  if (rawCache) {
    try {
      const parsed = JSON.parse(rawCache);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  return [];
}

/**
 * Сохранение новой или обновление существующей прописи в таблице public.worksheets через upsert.
 */
export async function saveWorksheetToCloud(params: {
  id?: string;
  teacherId: string;
  title: string;
  folder: string;
  description?: string;
  words: WordItem[];
  config: WorksheetConfig;
}): Promise<SavedWorksheet> {
  const cleanTitle = params.title.trim() || 'Учебная пропись без названия';
  const cleanFolder = params.folder.trim() || 'HSK 1';
  const now = Date.now();

  // Убеждаемся, что папка существует
  await createFolderInCloud(params.teacherId, cleanFolder);

  const worksheetId = params.id && isValidUuid(params.id) ? params.id : generateUuid();
  const normalizedConfig: WorksheetConfig = {
    ...params.config,
    sheetTitle: cleanTitle,
  };

  // Сохраняем created_at если обновляем существующую запись
  const existingSheets = await fetchSavedWorksheets(params.teacherId);
  const existingItem = existingSheets.find((w) => w.id === worksheetId);
  const createdAt = existingItem ? existingItem.createdAt : now;

  const rowToUpsert: SupabaseWorksheetRow = {
    id: worksheetId,
    teacher_id: params.teacherId,
    title: cleanTitle,
    folder: cleanFolder,
    description: params.description?.trim() || null,
    words: params.words,
    config: normalizedConfig,
    created_at: createdAt,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('worksheets')
    .upsert(rowToUpsert)
    .select('*')
    .single();

  if (!error && data) {
    const saved = mapWorksheetRowToSavedWorksheet(data as SupabaseWorksheetRow);
    const updatedList = [saved, ...existingSheets.filter((w) => w.id !== saved.id)];
    writeLocalCache(getWorksheetsCacheKey(params.teacherId), JSON.stringify(updatedList));
    return saved;
  }

  // Если сессия еще не подтверждена по Email (RLS), сохраняем в локальное хранилище учителя,
  // чтобы работа в конструкторе не прерывалась
  const fallbackSaved: SavedWorksheet = mapWorksheetRowToSavedWorksheet(rowToUpsert);
  const updatedList = [
    fallbackSaved,
    ...existingSheets.filter((w) => w.id !== fallbackSaved.id),
  ];
  writeLocalCache(getWorksheetsCacheKey(params.teacherId), JSON.stringify(updatedList));
  return fallbackSaved;
}

/**
 * Дублирование сохраненного листа прописи в облаке Supabase.
 */
export async function duplicateWorksheetInCloud(
  teacherId: string,
  worksheetId: string
): Promise<SavedWorksheet | null> {
  const current = await fetchSavedWorksheets(teacherId);
  const original = current.find((w) => w.id === worksheetId);
  if (!original) return null;

  return saveWorksheetToCloud({
    teacherId,
    title: `${original.title} (Копия)`,
    folder: original.folder,
    description: original.description,
    words: original.words,
    config: original.config,
  });
}

/**
 * Удаление прописи из таблицы public.worksheets:
 * supabase.from('worksheets').delete().eq('id', worksheetId)
 */
export async function deleteWorksheetFromCloud(
  teacherId: string,
  worksheetId: string
): Promise<SavedWorksheet[]> {
  const { error } = await supabase.from('worksheets').delete().eq('id', worksheetId);
  if (error) {
    console.warn('Предупреждение при удалении прописи из Supabase:', error.message);
  }

  const rawCache = readLocalCache(getWorksheetsCacheKey(teacherId));
  let current: SavedWorksheet[] = [];
  if (rawCache) {
    try {
      current = JSON.parse(rawCache);
    } catch {
      current = [];
    }
  }
  const updated = current.filter((w) => w.id !== worksheetId);
  writeLocalCache(getWorksheetsCacheKey(teacherId), JSON.stringify(updated));
  return updated;
}

/**
 * Настройки прописи по умолчанию для преподавателя.
 */
export function getTeacherDefaultConfig(teacherId: string): WorksheetConfig | null {
  const raw = readLocalCache(getDefaultConfigKey(teacherId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorksheetConfig;
  } catch {
    return null;
  }
}

export function saveTeacherDefaultConfig(teacherId: string, config: WorksheetConfig): void {
  writeLocalCache(getDefaultConfigKey(teacherId), JSON.stringify(config));
}

/**
 * Экспорт резервной копии кабинета преподавателя в JSON.
 */
export function buildTeacherWorkspaceBackup(params: {
  profile: TeacherProfile;
  folders: TeacherFolder[];
  worksheets: SavedWorksheet[];
  defaultConfig?: WorksheetConfig;
}): TeacherWorkspaceBackup {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    app: 'MoShui',
    profile: params.profile,
    folders: params.folders,
    worksheets: params.worksheets,
    defaultConfig: params.defaultConfig,
  };
}

/**
 * Восстановление резервной копии кабинета преподавателя из JSON с синхронизацией в Supabase.
 */
export async function importTeacherWorkspaceBackupToCloud(
  teacherId: string,
  jsonString: string
): Promise<{
  profile: TeacherProfile;
  folders: TeacherFolder[];
  worksheets: SavedWorksheet[];
  defaultConfig?: WorksheetConfig;
}> {
  let parsed: Partial<TeacherWorkspaceBackup>;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Файл не является корректным JSON-документом.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Некорректный формат файла резервной копии MoShui.');
  }

  let profile = (await getTeacherSession()) || {
    id: teacherId,
    name: 'Преподаватель',
    email: '',
    createdAt: Date.now(),
  };

  if (parsed.profile && typeof parsed.profile.name === 'string') {
    profile = await updateTeacherProfileInCloud(teacherId, {
      name: parsed.profile.name,
      schoolOrTitle: parsed.profile.schoolOrTitle,
    });
  }

  if (Array.isArray(parsed.folders)) {
    for (const f of parsed.folders) {
      if (f?.name) {
        await createFolderInCloud(teacherId, f.name, f.color || 'rose');
      }
    }
  }

  if (Array.isArray(parsed.worksheets)) {
    for (const sheet of parsed.worksheets) {
      if (sheet?.title && Array.isArray(sheet.words) && sheet.config) {
        await saveWorksheetToCloud({
          id: isValidUuid(sheet.id) ? sheet.id : undefined,
          teacherId,
          title: sheet.title,
          folder: sheet.folder || 'HSK 1',
          description: sheet.description,
          words: sheet.words,
          config: sheet.config,
        });
      }
    }
  }

  if (parsed.defaultConfig) {
    saveTeacherDefaultConfig(teacherId, parsed.defaultConfig);
  }

  const [folders, worksheets] = await Promise.all([
    fetchTeacherFolders(teacherId),
    fetchSavedWorksheets(teacherId),
  ]);

  return {
    profile,
    folders,
    worksheets,
    defaultConfig: getTeacherDefaultConfig(teacherId) || undefined,
  };
}
