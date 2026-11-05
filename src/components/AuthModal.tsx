import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  X,
  LogIn,
  UserPlus,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  ArrowLeft,
  KeyRound,
  Check,
} from 'lucide-react';
import type { TeacherProfile } from '../types/hanzi';
import {
  signIn,
  signUp,
  mapSupabaseUserToProfile,
  translateSupabaseError,
} from '../services/authStorageService';
import { supabase } from '../services/supabaseClient';
import { MOSHUI_LOGO_SRC } from './Navbar';
import { useLanguage } from '../context/LanguageContext';

export type AuthModalMode = 'login' | 'register' | 'forgot_password' | 'update_password';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  onClose: () => void;
  onSuccess: (teacher: TeacherProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [schoolOrTitle, setSchoolOrTitle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update_password');
        setError(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const profile = await signIn(email, password);
        toast.success(`${t.authWelcomeToast}, ${profile.name}!`);
        onSuccess(profile);
        onClose();
      } else if (mode === 'register') {
        const { profile } = await signUp({
          name,
          email,
          password,
          schoolOrTitle,
        });
        toast.success(`${t.authCreatedToast}: «${profile.name}»!`);
        onSuccess(profile);
        onClose();
      } else if (mode === 'forgot_password') {
        const cleanEmail = email.trim().toLowerCase();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });
        if (resetError) {
          throw new Error(translateSupabaseError(resetError));
        }
        toast.success(t.resetEmailSent);
        setMode('login');
      } else if (mode === 'update_password') {
        const { data, error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) {
          throw new Error(translateSupabaseError(updateError));
        }
        toast.success(t.passwordUpdated);
        if (data.user) {
          const updatedProfile = mapSupabaseUserToProfile(data.user);
          onSuccess(updatedProfile);
        } else {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user) {
            onSuccess(mapSupabaseUserToProfile(sessionData.session.user));
          }
        }
        setNewPassword('');
        setMode('login');
        onClose();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t.authGenericError;
      setError(errMsg);
      toast.error(errMsg);
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
          aria-label={t.authCloseAria}
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
            {mode === 'forgot_password' ? (
              t.resetPasswordTitle
            ) : mode === 'update_password' ? (
              t.newPasswordTitle
            ) : (
              <>
                MoShui (<span className="font-chinese">墨水</span>) — {t.authTitle}
              </>
            )}
          </h2>
        </div>

        {/* Переключатель вкладок: Вход / Регистрация (только для режимов login и register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="px-4 sm:px-6 pt-4 sm:pt-5">
            <div
              role="tablist"
              aria-label={t.authModeAria}
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
                <span className="hidden sm:inline">{t.authTabLoginFull}</span>
                <span className="sm:hidden">{t.authTabLoginShort}</span>
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
                <span>{t.authTabRegister}</span>
              </button>
            </div>
          </div>
        )}

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
                {t.authLabelName}
              </label>
              <input
                id="teacher-name-input"
                type="text"
                required
                disabled={isSubmitting}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.authPlaceholderName}
                className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] disabled:opacity-60"
              />
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot_password') && (
            <div>
              <label
                htmlFor="teacher-email-input"
                className="block text-sm font-semibold text-[#18181B] mb-1.5"
              >
                {t.authLabelEmail}
              </label>
              <input
                id="teacher-email-input"
                type="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.authPlaceholderEmail}
                className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] disabled:opacity-60"
              />
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div>
              <label
                htmlFor="teacher-password-input"
                className="block text-sm font-semibold text-[#18181B] mb-1.5"
              >
                {t.authLabelPassword}
              </label>
              <div className="relative">
                <input
                  id="teacher-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.authPlaceholderPassword}
                  className="w-full px-4 py-3 pr-10 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t.authHidePasswordAria : t.authShowPasswordAria}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {mode === 'login' && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setMode('forgot_password');
                      setError(null);
                    }}
                    className="text-xs sm:text-sm font-medium text-[#71717A] hover:text-[#C83E31] transition-colors cursor-pointer"
                  >
                    {t.forgotPassword}
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'update_password' && (
            <div>
              <label
                htmlFor="teacher-new-password-input"
                className="block text-sm font-semibold text-[#18181B] mb-1.5"
              >
                {t.newPasswordTitle}
              </label>
              <div className="relative">
                <input
                  id="teacher-new-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  disabled={isSubmitting}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t.authPlaceholderPassword}
                  className="w-full px-4 py-3 pr-10 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t.authHidePasswordAria : t.authShowPasswordAria}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label
                htmlFor="teacher-school-input"
                className="block text-sm font-semibold text-[#18181B] mb-1.5"
              >
                {t.authLabelSchool}
              </label>
              <input
                id="teacher-school-input"
                type="text"
                disabled={isSubmitting}
                value={schoolOrTitle}
                onChange={(e) => setSchoolOrTitle(e.target.value)}
                placeholder={t.authPlaceholderSchool}
                className="w-full px-4 py-3 text-base bg-[#FAF7F2] border border-[#EAE3D5] rounded-xl text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#C83E31] disabled:opacity-60"
              />
            </div>
          )}

          <div className="pt-2 space-y-2.5">
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
                    {mode === 'login'
                      ? t.authLoadingLogin
                      : mode === 'register'
                      ? t.authLoadingRegister
                      : mode === 'forgot_password'
                      ? t.sendResetLink
                      : t.saveNewPassword}
                  </span>
                </>
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-5 h-5 text-[#F5D0C8]" />
                  <span>{t.authSubmitLogin}</span>
                </>
              ) : mode === 'register' ? (
                <>
                  <UserPlus className="w-5 h-5 text-[#F5D0C8]" />
                  <span>{t.authSubmitRegister}</span>
                </>
              ) : mode === 'forgot_password' ? (
                <>
                  <Mail className="w-5 h-5 text-[#F5D0C8]" />
                  <span>{t.sendResetLink}</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5 text-[#F5D0C8]" />
                  <span>{t.saveNewPassword}</span>
                </>
              )}
            </button>

            {mode === 'forgot_password' && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-[#52525B] hover:text-[#18181B] bg-[#FAF7F2] hover:bg-[#F3EFE6] border border-[#EAE3D5] rounded-xl transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.backToLogin}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
