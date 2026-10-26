import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        data-testid="pwa-install-btn"
        title="Установить приложение MoShui на устройство"
        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-[#C83E31] bg-[#FDF2F0] border border-[#F5D0C8] hover:bg-[#F5D0C8]/50 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="hidden lg:inline">Установить приложение</span>
        <span className="lg:hidden">Установить</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          data-testid="pwa-ios-install-btn"
          title="Установить MoShui на iPhone или iPad"
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-[#C83E31] bg-[#FDF2F0] border border-[#F5D0C8] hover:bg-[#F5D0C8]/50 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">На экран «Домой»</span>
        </button>

        {showIOSGuide && (
          <div
            data-testid="pwa-ios-install-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          >
            <div className="w-full max-w-sm rounded-2xl bg-[#FAF7F2] border border-[#E6E0D6] p-6 shadow-xl text-[#18181B]">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold text-[#18181B]">
                  Установка на iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Закрыть инструкцию"
                  className="p-1.5 rounded-lg text-[#52525B] hover:text-[#18181B] hover:bg-[#EAE3D5]/60 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-[#52525B]">
                <li className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#FDF2F0] text-[#C83E31] font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    Нажмите кнопку <strong>Поделиться</strong>{' '}
                    <Share className="inline w-4 h-4 text-[#C83E31] mx-0.5" /> в панели Safari.
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#FDF2F0] text-[#C83E31] font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Выберите пункт <strong>На экран «Домой»</strong>{' '}
                    <PlusSquare className="inline w-4 h-4 text-[#C83E31] mx-0.5" />.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#18181B] text-[#FAF7F2] py-2.5 text-sm font-semibold hover:bg-[#18181B]/90 transition-colors cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
