import React, { useState } from 'react';
import {
  UserCheck,
  LogIn,
  BookOpen,
  FileText,
  Grid,
  HelpCircle,
} from 'lucide-react';
import type { AppTab, TeacherProfile } from '../types/hanzi';
import { useLanguage } from '../context/LanguageContext';
import { GuideModal } from './GuideModal';

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
  const { lang, setLang, t } = useLanguage();
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  const desktopNavItems: { id: AppTab; label: string; count?: number }[] = [
    { id: 'dictionary', label: t.navDictionary },
    { id: 'worksheet', label: t.navBuilder, count: worksheetCount },
    { id: 'radicals', label: t.navRadicals },
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
      {/* Парящая стеклянная капсула в эстетике Spatial Glass / visionOS */}
      <header className="sticky top-4 z-40 w-[calc(100%-1.5rem)] md:w-[calc(100%-3rem)] lg:w-full max-w-6xl mx-auto rounded-full px-3 py-2 md:px-4 md:py-2.5 lg:px-6 lg:py-3 bg-white/65 backdrop-blur-xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] print:hidden">
        <div className="flex items-center justify-between w-full gap-1.5 lg:gap-4">
          {/* Фирменный логотип MoShui */}
          <a
            href="#dictionary"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('dictionary');
            }}
            data-testid="navbar-brand-link"
            className="flex items-center gap-2 lg:gap-3 group shrink-0"
          >
            <img
              src={MOSHUI_LOGO_SRC}
              alt="MoShui 墨水"
              width={46}
              height={46}
              data-testid="navbar-logo-img"
              className="w-8 h-8 lg:w-11 lg:h-11 rounded-full object-contain mix-blend-multiply transition-transform duration-200 group-hover:scale-105 shrink-0"
            />

            <div className="flex flex-col shrink-0">
              <div className="flex items-baseline gap-1 lg:gap-1.5 whitespace-nowrap">
                <span className="font-display text-base lg:text-2xl font-bold tracking-tight text-stone-900 leading-none whitespace-nowrap">
                  MoShui
                </span>
                <span className="font-chinese text-xs lg:text-base font-semibold text-[#C83E31] whitespace-nowrap">
                  墨水
                </span>
              </div>
              <span className="mt-0.5 text-[11px] font-medium text-stone-500 hidden lg:block whitespace-nowrap">
                {t.navSubtitle}
              </span>
            </div>
          </a>

          {/* Навигация для планшетов и десктопов в виде сегментированного стеклянного контрола */}
          <nav
            aria-label={t.navMainAria}
            className="hidden md:flex items-center gap-1 bg-stone-200/45 p-1 rounded-full backdrop-blur-md border border-white/60 shrink-0"
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
                  className={`relative py-1.5 px-2.5 lg:px-4 text-xs lg:text-sm rounded-full transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer flex items-center ${
                    isActive
                      ? 'bg-white shadow-sm text-stone-900 font-semibold ring-1 ring-stone-900/[0.04]'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
                  }`}
                >
                  <span className="whitespace-nowrap">{item.label}</span>
                  {typeof item.count === 'number' && (
                    <span
                      className={`ml-1.5 font-mono-tabular text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isActive
                          ? 'bg-stone-900 text-white'
                          : 'bg-white/80 text-stone-700 border border-white'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Правая зона: Переключатель языка RU / EN, круглая кнопка ? (Инструкция) и профиль преподавателя */}
          <div className="flex items-center gap-1.5 lg:gap-2.5 shrink-0">
            <div
              className="flex items-center gap-0.5 lg:gap-1 px-2 py-1.5 lg:px-3.5 lg:py-2 text-xs lg:text-sm rounded-full bg-white/50 hover:bg-white/90 border border-white/80 transition-all duration-300 shadow-2xs select-none whitespace-nowrap print:hidden"
              role="group"
              aria-label="Language switcher"
              data-testid="language-switcher"
            >
              <button
                type="button"
                onClick={() => setLang('ru')}
                data-testid="lang-btn-ru"
                aria-pressed={lang === 'ru'}
                className={`px-1.5 py-0.5 rounded-full cursor-pointer transition-all whitespace-nowrap ${
                  lang === 'ru'
                    ? 'font-semibold text-stone-900 bg-white shadow-2xs'
                    : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                RU
              </button>
              <span className="text-stone-300 select-none" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                onClick={() => setLang('en')}
                data-testid="lang-btn-en"
                aria-pressed={lang === 'en'}
                className={`px-1.5 py-0.5 rounded-full cursor-pointer transition-all whitespace-nowrap ${
                  lang === 'en'
                    ? 'font-semibold text-stone-900 bg-white shadow-2xs'
                    : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                EN
              </button>
            </div>

            {/* Круглая кнопка инструкции с пиктограммой ? без подписи */}
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              aria-label={t.howItWorksBtn}
              title={t.howItWorksBtn}
              data-testid="navbar-guide-btn"
              className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-white/50 hover:bg-white/90 border border-white/80 text-stone-700 hover:text-[#C83E31] flex items-center justify-center transition-all duration-300 shadow-2xs shrink-0 cursor-pointer print:hidden"
            >
              <HelpCircle className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
            </button>

            {currentTeacher ? (
              <button
                type="button"
                onClick={() => onSelectTab('dashboard')}
                data-testid="navbar-teacher-profile-btn"
                aria-label={`${t.navTeacherProfileAria}: ${currentTeacher.name}`}
                className={`inline-flex items-center gap-1.5 lg:gap-2 px-2 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-semibold rounded-full border transition-all duration-300 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs ${
                  activeTab === 'dashboard'
                    ? 'bg-gradient-to-b from-stone-800 to-stone-950 text-white border-stone-900 shadow-[0_4px_14px_rgba(0,0,0,0.15)]'
                    : 'bg-white/50 hover:bg-white/90 text-stone-900 border-white/80'
                }`}
              >
                <span className="w-5 h-5 lg:w-6 lg:h-6 rounded-full bg-[#C83E31] text-white text-[11px] lg:text-xs font-bold flex items-center justify-center shrink-0">
                  {teacherInitials || 'T'}
                </span>
                <span className="max-w-[90px] lg:max-w-[140px] truncate hidden sm:inline whitespace-nowrap">
                  {currentTeacher.name || t.navDashboardShort}
                </span>
                <span
                  className={`hidden lg:flex items-center gap-1 ml-0.5 ${
                    activeTab === 'dashboard' ? 'text-white' : 'text-[#C83E31]'
                  }`}
                >
                  <UserCheck className="w-4 h-4 lg:w-5 lg:h-5" />
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                data-testid="navbar-login-btn"
                aria-label={t.navLoginAria}
                className="inline-flex items-center gap-1.5 lg:gap-2 px-2 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-semibold text-stone-800 rounded-full bg-white/50 hover:bg-white/90 border border-white/80 transition-all duration-300 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
              >
                <LogIn className="w-4 h-4 lg:w-5 lg:h-5 text-[#C83E31] shrink-0" />
                <span className="whitespace-nowrap">{t.navAuth}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Фиксированная нижняя стеклянная панель навигации для смартфонов (md:hidden) */}
      <nav
        aria-label={t.navMobileAria}
        data-testid="mobile-bottom-navigation"
        className="fixed bottom-3 left-3 right-3 z-50 bg-white/75 backdrop-blur-2xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] rounded-3xl md:hidden px-2 py-1.5 grid grid-cols-4 gap-1 items-center print:hidden"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => onSelectTab('dictionary')}
          data-testid="mobile-nav-dictionary"
          className={`w-full flex flex-col items-center justify-center py-1 px-2 rounded-2xl text-xs font-semibold transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'dictionary'
              ? 'bg-white text-stone-900 font-bold shadow-sm ring-1 ring-stone-900/5'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>{t.navDictionaryShort}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('worksheet')}
          data-testid="mobile-nav-worksheet"
          className={`relative w-full flex flex-col items-center justify-center py-1 px-2 rounded-2xl text-xs font-semibold transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'worksheet'
              ? 'bg-white text-stone-900 font-bold shadow-sm ring-1 ring-stone-900/5'
              : 'text-stone-500 hover:text-stone-900'
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
          <span>{t.navWorksheetShort}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('radicals')}
          data-testid="mobile-nav-radicals"
          className={`w-full flex flex-col items-center justify-center py-1 px-2 rounded-2xl text-xs font-semibold transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'radicals'
              ? 'bg-white text-stone-900 font-bold shadow-sm ring-1 ring-stone-900/5'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Grid className="w-5 h-5 mb-0.5" />
          <span>{t.navRadicalsShort}</span>
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
          className={`w-full flex flex-col items-center justify-center py-1 px-2 rounded-2xl text-xs font-semibold transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-white text-stone-900 font-bold shadow-sm ring-1 ring-stone-900/5'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          {currentTeacher ? (
            <UserCheck className="w-5 h-5 mb-0.5" />
          ) : (
            <LogIn className="w-5 h-5 mb-0.5 text-[#C83E31]" />
          )}
          <span>{t.navDashboardShort}</span>
        </button>
      </nav>

      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  );
};
