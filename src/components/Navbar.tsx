import React from 'react';
import {
  Printer,
  UserCheck,
  LogIn,
  BookOpen,
  FileText,
  Grid,
  Gamepad2,
} from 'lucide-react';
import type { AppTab, TeacherProfile } from '../types/hanzi';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  worksheetCount: number;
  onQuickPrint: () => void;
  currentTeacher: TeacherProfile | null;
  onOpenAuthModal: () => void;
}

export const MOSHUI_LOGO_SRC = '/assets/aistudio/image_0_0a6a2fe2.png';

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  worksheetCount,
  onQuickPrint,
  currentTeacher,
  onOpenAuthModal,
}) => {
  const desktopNavItems: { id: AppTab; label: string; count?: number }[] = [
    { id: 'dictionary', label: 'Словарь и Практика' },
    { id: 'worksheet', label: 'Конструктор прописей', count: worksheetCount },
    { id: 'radicals', label: 'Таблица ключей' },
    { id: 'games', label: 'Игры' },
  ];

  const teacherInitials = currentTeacher
    ? currentTeacher.name
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  return (
    <>
      {/* Верхняя шапка сайта (для всех экранов, на мобильных — компактная) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 print:hidden">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
          {/* Фирменный логотип MoShui (image_0.png) с заголовком Cormorant Garamond / Lora */}
          <a
            href="#dictionary"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('dictionary');
            }}
            data-testid="navbar-brand-link"
            className="flex items-center gap-2.5 sm:gap-3 group shrink-0"
          >
            <img
              src={MOSHUI_LOGO_SRC}
              alt="MoShui 墨水"
              width={56}
              height={56}
              data-testid="navbar-logo-img"
              className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl object-contain border border-slate-200/80 bg-[#FAF9F6] shadow-2xs group-hover:border-rose-300 transition-colors shrink-0"
            />

            <div className="flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-none">
                  MoShui
                </span>
                <span className="font-chinese text-sm sm:text-base font-semibold text-rose-700">
                  墨水
                </span>
              </div>
              <span className="mt-0.5 text-xs sm:text-sm font-medium text-slate-600 hidden sm:block whitespace-nowrap">
                Умный словарь и прописи
              </span>
            </div>
          </a>

          {/* Десктопная навигация по основным вкладкам (md:flex, на смартфонах скрыта) */}
          <nav
            aria-label="Основная навигация"
            className="hidden md:flex items-center gap-1 lg:gap-2 shrink-0"
          >
            {desktopNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-2 px-3 text-sm lg:text-base font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    isActive
                      ? 'text-rose-700 border-rose-600 font-semibold'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <span>{item.label}</span>
                  {typeof item.count === 'number' && (
                    <span
                      className={`ml-1.5 font-mono-tabular text-sm font-semibold ${
                        isActive ? 'text-rose-700' : 'text-slate-500'
                      }`}
                    >
                      ({item.count})
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Правая зона: Кабинет преподавателя + Печать А4 */}
          <div className="flex items-center gap-2 shrink-0">
            {currentTeacher ? (
              <button
                type="button"
                onClick={() => onSelectTab('dashboard')}
                data-testid="navbar-teacher-profile-btn"
                aria-label={`Личный кабинет преподавателя: ${currentTeacher.name}`}
                className={`inline-flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-500/30'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-rose-600 text-white text-[11px] sm:text-xs font-bold flex items-center justify-center shrink-0">
                  {teacherInitials || 'Л'}
                </span>
                <span className="max-w-[100px] sm:max-w-[130px] truncate hidden xs:inline">
                  {currentTeacher.name}
                </span>
                <span className="text-rose-700 hidden sm:flex items-center gap-1.5 ml-1">
                  <UserCheck className="w-4 h-4" />
                  <span className="hidden xl:inline">Кабинет</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                data-testid="navbar-login-btn"
                aria-label="Войти или открыть Личный кабинет преподавателя"
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-rose-600" />
                <span className="hidden sm:inline">Войти / Кабинет</span>
                <span className="sm:hidden">Войти</span>
              </button>
            )}

            {/* Кнопка «Печать А4» на десктопе */}
            <button
              type="button"
              onClick={onQuickPrint}
              disabled={worksheetCount === 0}
              className="hidden md:inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Печать А4</span>
            </button>
          </div>
        </div>
      </header>

      {/* Фиксированная нижняя панель навигации для смартфонов (md:hidden) */}
      <nav
        aria-label="Мобильная нижняя навигация"
        data-testid="mobile-bottom-navigation"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg md:hidden px-2 py-1.5 flex items-center justify-around print:hidden"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => onSelectTab('dictionary')}
          data-testid="mobile-nav-dictionary"
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-xs font-semibold transition-colors min-w-[56px] min-h-[44px] cursor-pointer ${
            activeTab === 'dictionary'
              ? 'text-rose-700 font-bold bg-rose-50/60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>Словарь</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('worksheet')}
          data-testid="mobile-nav-worksheet"
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-xs font-semibold transition-colors min-w-[56px] min-h-[44px] cursor-pointer ${
            activeTab === 'worksheet'
              ? 'text-rose-700 font-bold bg-rose-50/60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <FileText className="w-5 h-5 mb-0.5" />
            {worksheetCount > 0 && (
              <span
                data-testid="mobile-worksheet-badge"
                className="absolute -top-1 -right-2 bg-rose-600 text-white font-mono-tabular text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
              >
                {worksheetCount > 9 ? '9+' : worksheetCount}
              </span>
            )}
          </div>
          <span>Прописи</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('radicals')}
          data-testid="mobile-nav-radicals"
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-xs font-semibold transition-colors min-w-[56px] min-h-[44px] cursor-pointer ${
            activeTab === 'radicals'
              ? 'text-rose-700 font-bold bg-rose-50/60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Grid className="w-5 h-5 mb-0.5" />
          <span>Ключи</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('games')}
          data-testid="mobile-nav-games"
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-xs font-semibold transition-colors min-w-[56px] min-h-[44px] cursor-pointer ${
            activeTab === 'games'
              ? 'text-rose-700 font-bold bg-rose-50/60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Gamepad2 className="w-5 h-5 mb-0.5" />
          <span>Игры</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (currentTeacher) {
              onSelectTab('dashboard');
            } else {
              onOpenAuthModal();
            }
          }}
          data-testid="mobile-nav-dashboard"
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-xs font-semibold transition-colors min-w-[56px] min-h-[44px] cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-rose-700 font-bold bg-rose-50/60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {currentTeacher ? (
            <UserCheck className="w-5 h-5 mb-0.5" />
          ) : (
            <LogIn className="w-5 h-5 mb-0.5 text-rose-600" />
          )}
          <span>Кабинет</span>
        </button>
      </nav>
    </>
  );
};
