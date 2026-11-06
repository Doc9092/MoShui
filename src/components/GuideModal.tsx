import React from 'react';
import { X, Type, Languages, Grid, Printer, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const steps = [
    {
      icon: Type,
      title: t.step1Title,
      desc: t.step1Desc,
    },
    {
      icon: Languages,
      title: t.step2Title,
      desc: t.step2Desc,
    },
    {
      icon: Grid,
      title: t.step3Title,
      desc: t.step3Desc,
    },
    {
      icon: Printer,
      title: t.step4Title,
      desc: t.step4Desc,
    },
  ];

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/25 backdrop-blur-md p-4 overflow-y-auto print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white/75 backdrop-blur-2xl max-w-2xl w-full p-6 md:p-8 rounded-3xl border border-white shadow-2xl ring-1 ring-stone-900/[0.04] relative my-auto"
      >
        {/* Кнопка закрытия (крестик в правом верхнем углу) */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.gotItBtn}
          className="absolute right-4 top-4 p-2 rounded-full bg-white/60 hover:bg-white text-stone-500 hover:text-stone-900 border border-white/80 shadow-2xs transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Заголовок инструкции */}
        <h2
          id="guide-modal-title"
          className="text-xl md:text-2xl font-serif font-bold text-stone-900 pr-8"
        >
          {t.guideTitle}
        </h2>

        {/* 4 шага в виде сетки */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            return (
              <div
                key={index}
                className="bg-white/75 backdrop-blur-xl p-4 rounded-2xl border border-white/90 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.05)] ring-1 ring-stone-900/[0.03] flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white border border-stone-200/70 shadow-2xs flex items-center justify-center shrink-0">
                    <IconComponent className="w-4 h-4 text-[#C83E31]" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-stone-900">
                    {step.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Блок с советом по печати */}
        <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/90 ring-1 ring-stone-900/[0.03] text-sm flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-[#C83E31] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-stone-900">{t.printTipTitle}</div>
            <p className="text-stone-600 leading-relaxed text-xs sm:text-sm">
              {t.printTipDesc}
            </p>
          </div>
        </div>

        {/* Кнопка закрытия внизу по центру */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-7 py-3 rounded-2xl bg-gradient-to-b from-stone-800 to-stone-950 text-white text-sm font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
          >
            {t.gotItBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
