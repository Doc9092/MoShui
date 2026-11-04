import React from 'react';
import {
  UserCheck,
  LogIn,
  BookOpen,
  FileText,
  Grid,
} from 'lucide-react';
import type { AppTab, TeacherProfile } from '../types/hanzi';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  worksheetCount: number;
  onQuickPrint?: () => void;
  currentTeacher: TeacherProfile | null;
  onOpenAuthModal: () => void;
}

export const MOSHUI_LOGO_SRC = '/assets/aistudio/image_0_0a6a2fe2.png';

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  worksheetCount,
  currentTeacher,
  onOpenAuthModal,
}) => {
  const desktopNavItems: { id: AppTab; label: string; shortLabel: string; count?: number }[] = [
    { id: 'dictionary', label: 'Словарь и Практика', shortLabel: 'Словарь' },
    { id: 'worksheet', label: 'Конструктор прописей', shortLabel: 'Прописи', count: worksheetCount },
    { id: 'radicals', label: 'Таблица ключей', shortLabel: 'Ключи' },
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
      {/* Верхняя шапка сайта с эффектом матового стекла рисовой бумаги */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/85 backdrop-blur-md border-b border-[#E6E0D6] print:hidden">
        <div className="max-w-[1380px] mx-auto flex items-center justify-between gap-2 sm:gap-3 px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3">
          {/* Фирменный логотип MoShui (image_0.png) с бесшовным слиянием mix-blend-multiply */}
          <a
            href="#dictionary"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('dictionary');
            }}
            data-testid="navbar-brand-link"
            className="flex items-center gap-2.5 sm:gap-3.5 group shrink-0 min-h-[44px]"
          >
            <img
              src={MOSHUI_LOGO_SRC}
              alt="MoShui 墨水"
              width={52}
              height={52}
              data-testid="navbar-logo-img"
              className="w-11 h-11 md:w-12 md:h-12 lg:w-[52px] lg:h-[52px] rounded-full object-contain mix-blend-multiply transition-transform duration-200 group-hover:scale-105 shrink-0"
            />

            <div className="flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-xl sm:text-2xl lg:text-[26px] font-bold tracking-tight text-[#18181B] leading-none">
                  MoShui
                </span>
                <span className="font-chinese text-sm sm:text-base font-semibold text-[#C83E31]">
                  墨水
                </span>
              </div>
              <span className="mt-0.5 text-xs font-medium text-[#52525B] hidden sm:block whitespace-nowrap">
                Умный словарь и прописи
              </span>
            </div>
          </a>

          {/* Навигация для планшетов и десктопов (hidden md:flex, кнопки min-h-[44px]) */}
          <nav
            aria-label="Основная навигация"
            className="hidden md:flex items-center gap-1.5 lg:gap-2 shrink-0"
          >
            {desktopNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-tab-${item.id}`}
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative min-h-[44px] py-2 px-3.5 lg:px-4 text-xs lg:text-sm font-medium rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center ${
                    isActive
                      ? 'bg-[#18181B] text-[#FAF7F2] font-semibold shadow-md border-b-2 border-[#C83E31]'
                      : 'text-[#52525B] hover:text-[#18181B] hover:bg-[#EAE3D5]/50'
                  }`}
                >
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="lg:hidden">{item.shortLabel}</span>
                  {typeof item.count === 'number' && (
                    <span
                      className={`ml-1.5 font-mono-tabular text-xs px-1.5 py-0.5 rounded-md font-semibold ${
                        isActive
                          ? 'bg-[#C83E31] text-white'
                          : 'bg-[#FDF2F0] text-[#C83E31] border border-[#F5D0C8]'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Правая зона: Личный кабинет преподавателя / Вход */}
          <div className="flex items-center gap-2 shrink-0">
            {currentTeacher ? (
              <button
                type="button"
                onClick={() => onSelectTab('dashboard')}
                data-testid="navbar-teacher-profile-btn"
                aria-label={`Личный кабинет преподавателя: ${currentTeacher.name}`}
                className={`inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold rounded-xl border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#18181B] text-[#FAF7F2] border-[#18181B] shadow-md'
                    : 'bg-white text-[#18181B] border-[#EAE3D5] hover:bg-[#FAF7F2]'
                }`}
              >
                <span className="w-7 h-7 rounded-full bg-[#C83E31] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {teacherInitials || 'Л'}
                </span>
                <span className="max-w-[100px] lg:max-w-[140px] truncate hidden sm:inline">
                  {currentTeacher.name}
                </span>
                <span
                  className={`hidden lg:flex items-center gap-1 ml-0.5 ${
                    activeTab === 'dashboard' ? 'text-[#FAF7F2]' : 'text-[#C83E31]'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                data-testid="navbar-login-btn"
                aria-label="Войти или открыть Личный кабинет преподавателя"
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold text-[#18181B] bg-white border border-[#EAE3D5] hover:bg-[#FDF2F0] hover:border-[#F5D0C8] rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
              >
                <LogIn className="w-4 h-4 text-[#C83E31]" />
                <span className="hidden sm:inline">Войти / Кабинет</span>
                <span className="sm:hidden">Войти</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Фиксированная нижняя панель навигации для смартфонов (md:hidden): 4 равномерные колонки */}
      <nav
        aria-label="Мобильная нижняя навигация"
        data-testid="mobile-bottom-navigation"
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#FAF7F2]/85 backdrop-blur-md border-t border-[#E6E0D6] shadow-lg md:hidden px-2 py-1.5 grid grid-cols-4 gap-1 items-center print:hidden"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => onSelectTab('dictionary')}
          data-testid="mobile-nav-dictionary"
          className={`w-full flex flex-col items-center justify-center py-1 px-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'dictionary'
              ? 'bg-[#18181B] text-[#FAF7F2] font-bold shadow-md'
              : 'text-[#52525B] hover:text-[#18181B]'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>Словарь</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('worksheet')}
          data-testid="mobile-nav-worksheet"
          className={`relative w-full flex flex-col items-center justify-center py-1 px-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'worksheet'
              ? 'bg-[#18181B] text-[#FAF7F2] font-bold shadow-md'
              : 'text-[#52525B] hover:text-[#18181B]'
          }`}
        >
          <div className="relative">
            <FileText className="w-5 h-5 mb-0.5" />
            {worksheetCount > 0 && (
              <span
                data-testid="mobile-worksheet-badge"
                className="absolute -top-1 -right-2 bg-[#C83E31] text-white font-mono-tabular text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
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
          className={`w-full flex flex-col items-center justify-center py-1 px-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'radicals'
              ? 'bg-[#18181B] text-[#FAF7F2] font-bold shadow-md'
              : 'text-[#52525B] hover:text-[#18181B]'
          }`}
        >
          <Grid className="w-5 h-5 mb-0.5" />
          <span>Ключи</span>
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
          className={`w-full flex flex-col items-center justify-center py-1 px-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-[#18181B] text-[#FAF7F2] font-bold shadow-md'
              : 'text-[#52525B] hover:text-[#18181B]'
          }`}
        >
          {currentTeacher ? (
            <UserCheck className="w-5 h-5 mb-0.5" />
          ) : (
            <LogIn className="w-5 h-5 mb-0.5 text-[#C83E31]" />
          )}
          <span>Кабинет</span>
        </button>
      </nav>
    </>
  );
};
