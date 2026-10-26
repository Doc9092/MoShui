import React, { useState } from 'react';
import { X, LogIn, UserPlus, AlertCircle, Loader2, CloudCheck } from 'lucide-react';
import type { TeacherProfile } from '../types/hanzi';
import { signIn, signUp } from '../services/authStorageService';
import { MOSHUI_LOGO_SRC } from './Navbar';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (teacher: TeacherProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [schoolOrTitle, setSchoolOrTitle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const profile = await signIn(email, password);
        onSuccess(profile);
        onClose();
      } else {
        const { profile } = await signUp({
          name,
          email,
          password,
          schoolOrTitle,
        });
        onSuccess(profile);
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Произошла ошибка при обращении к облаку Supabase.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative bg-white border border-[#EAE3D5] rounded-2xl shadow-xl w-[95vw] max-w-md overflow-hidden my-auto">
        {/* Кнопка закрытия в правом верхнем углу */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Закрыть окно авторизации"
          className="absolute right-3.5 top-3.5 p-2 text-[#71717A] hover:text-[#18181B] hover:bg-[#FAF7F2] disabled:opacity-50 rounded-xl transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Брендированная шапка с крупным логотипом по центру */}
        <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-[#EAE3D5] text-center bg-[#FAF7F2]">
          <img
            src={MOSHUI_LOGO_SRC}
            alt="MoShui 墨水"
            data-testid="auth-modal-logo"
            style={{ height: '120px' }}
            className="h-[96px] sm:h-[120px] w-auto object-contain mx-auto rounded-full mix-blend-multiply"
          />
          <h2
            id="auth-modal-title"
            className="mt-3 font-display text-xl sm:text-2xl font-bold text-[#18181B]"
          >
            MoShui (<span className="font-chinese">墨水</span>) — Кабинет преподавателя
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#52525B] inline-flex items-center justify-center gap-1.5">
            <CloudCheck className="w-4 h-4 text-[#15803D] shrink-0" />
            <span>Облачная синхронизация прописей и папок (Supabase)</span>
          </p>
        </div>

        {/* Переключатель вкладок: Вход / Регистрация */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5">
          <div
            role="tablist"
            aria-label="Режим входа или регистрации"
            className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl"
          >
            <button
              role="tab"
              type="button"
              disabled={isSubmitting}
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2.5 px-2 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap text-center cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#18181B] text-[#FAF7F2] shadow-xs font-bold'
                  : 'text-[#52525B] hover:text-[#18181B]'
              }`}
            >
              <span className="hidden sm:inline">Вход в систему</span>
              <span className="sm:hidden">Вход</span>
            </button>

            <button
              role="tab"
              type="button"
              disabled={isSubmitting}
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2.5 px-2 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap text-center cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#18181B] text-[#FAF7F2] shadow-xs font-bold'
                  : 'text-[#52525B] hover:text-[#18181B]'
              }`}
            >
              <span>Регистрация</span>
            </button>
          </div>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              data-testid="auth-error-banner"
              className="p-3.5 bg-[#FDF2F0] border border-[#F5D0C8] rounded-xl flex items-start gap-2.5 text-sm font-medium text-[#C83E31]"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#C83E31]" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label
                htmlFor="teacher-name-input"
                className="block text-sm font-semibold text-[#18181B] mb-1.5"
              >
                Имя / Обращение *
              </label>
              <input
                id="teacher-name-input"
                type="text"
                required
                disabled={isSubmitting}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Лилия Лаоши"
                className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] disabled:opacity-60"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="teacher-email-input"
              className="block text-sm font-semibold text-[#18181B] mb-1.5"
            >
              Email *
            </label>
            <input
              id="teacher-email-input"
              type="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@school.edu"
              className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="teacher-password-input"
              className="block text-sm font-semibold text-[#18181B] mb-1.5"
            >
              Пароль *
            </label>
            <input
              id="teacher-password-input"
              type="password"
              required
              minLength={6}
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] disabled:opacity-60"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="teacher-school-input"
                className="block text-sm font-semibold text-[#18181B] mb-1.5"
              >
                Название школы / курса (необязательно)
              </label>
              <input
                id="teacher-school-input"
                type="text"
                disabled={isSubmitting}
                value={schoolOrTitle}
                onChange={(e) => setSchoolOrTitle(e.target.value)}
                placeholder="Например: Языковой центр «Поднебесная»"
                className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] disabled:opacity-60"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="auth-submit-button"
              className="w-full inline-flex items-center justify-center gap-2.5 py-3.5 px-6 h-12 text-base font-semibold text-white bg-[#18181B] hover:bg-[#27272A] disabled:opacity-60 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    {mode === 'login' ? 'Вход в Supabase...' : 'Регистрация...'}
                  </span>
                </>
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-5 h-5 text-[#F5D0C8]" />
                  <span>Войти в кабинет</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 text-[#F5D0C8]" />
                  <span>Регистрация</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
