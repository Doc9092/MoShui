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
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 backdrop-blur-xs p-4 overflow-y-auto print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FAF8F5] max-w-2xl w-full p-6 md:p-8 rounded-2xl border border-stone-200 shadow-xl relative my-auto"
      >
        {/* Кнопка закрытия (крестик в правом верхнем углу) */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.gotItBtn}
          className="absolute right-4 top-4 p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-200/50 rounded-xl transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Заголовок инструкции */}
        <h2
          id="guide-modal-title"
          className="text-xl md:text-2xl font-serif font-bold text-[#18181B] pr-8"
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
                className="bg-white p-4 rounded-xl border border-stone-200/60 shadow-[0_2px_10px_rgb(24,24,27,0.02)] flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#FDF2F0] border border-[#F5D0C8] flex items-center justify-center shrink-0">
                    <IconComponent className="w-4 h-4 text-[#C83E31]" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[#18181B]">
                    {step.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-[#52525B] leading-relaxed">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Блок с советом по печати */}
        <div className="bg-stone-100/80 p-4 rounded-xl border border-stone-200/80 text-sm flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-[#C83E31] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-[#18181B]">{t.printTipTitle}</div>
            <p className="text-[#52525B] leading-relaxed text-xs sm:text-sm">
              {t.printTipDesc}
            </p>
          </div>
        </div>

        {/* Кнопка закрытия внизу по центру */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-[#FAF8F5] text-sm font-semibold transition-colors shadow-xs cursor-pointer"
          >
            {t.gotItBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
